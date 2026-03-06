# Auth, Current-User Attachment, and RBAC

## Purpose

This document describes the backend authentication, current-user attachment, and role-based authorization behavior that sits in front of most Lifeline API routes.

## Canonical sources used for this document

- [backend/src/middleware/auth0.js](../../backend/src/middleware/auth0.js)
- [backend/src/middleware/attachCurrentUser.js](../../backend/src/middleware/attachCurrentUser.js)
- [backend/src/middleware/roles.js](../../backend/src/middleware/roles.js)
- [backend/src/middleware/errorHandler.js](../../backend/src/middleware/errorHandler.js)
- [backend/src/infrastructure/TypeORMUserRepository.js](../../backend/src/infrastructure/TypeORMUserRepository.js)
- [backend/src/infrastructure/TypeORMUserProfileRepository.js](../../backend/src/infrastructure/TypeORMUserProfileRepository.js)
- [backend/src/infrastructure/TypeORMUserSettingsRepository.js](../../backend/src/infrastructure/TypeORMUserSettingsRepository.js)
- [backend/src/index.js](../../backend/src/index.js)

## Global auth middleware placement

The backend applies this chain to the `/api` prefix:

- `checkJwt`
- `attachCurrentUser`

That makes JWT validation and current-user hydration a cross-cutting backend concern rather than a per-route afterthought.

## JWT validation behavior

### Normal runtime

In normal runtime, [backend/src/middleware/auth0.js](../../backend/src/middleware/auth0.js) configures Auth0 JWT validation through `express-oauth2-jwt-bearer`.

Important characteristics:

- issuer is derived from `AUTH0_DOMAIN`
- audience can come from `AUTH0_AUDIENCE` and `AUTH0_AUDIENCE_ALT`
- RS256 is enforced
- production throws during startup if required auth configuration is missing and auth bypass is not enabled

### Development bypass

If `AUTH_DISABLED=1`, `checkJwt` becomes a no-op.

That is a runtime/development escape hatch, not a separate product identity mode.

## Current-user attachment behavior

`attachCurrentUser` is responsible for populating `req.currentUser`.

### Development local-user branch

When `AUTH_DISABLED=1`, the middleware:

- uses `AUTH_LOCAL_USER_ID` when provided or `guest-local` otherwise
- attempts to load that user, profile, and settings from PostgreSQL
- falls back to a deterministic local user shape when no stored record exists

### No-authorization-header branch

When there is no authorization header in the request, `attachCurrentUser` sets:

- `req.currentUser = null`

and does not create a surrogate database user.

### Authenticated branch

When JWT claims are present, the middleware:

- extracts claims and Auth0 subject
- resolves roles from claims
- ensures the user exists in the database through the user repository
- loads profile data when available
- loads user settings when available
- attaches a normalized current-user object to `req.currentUser`

## Current-user payload shape

The attached user can include:

- `id`
- `email`
- `name`
- `picture`
- `role`
- `roles`
- `subscription_status`
- `profile`
- `settings`

The profile sub-object can include:

- first and last name
- phone
- country
- city
- timezone
- avatar URL
- start day of week
- onboarding completion state

## Role mapping

The backend uses role claims to derive a primary role.

Current role outcomes include:

- `free`
- `paid`
- `admin`

The role is used both as a convenience single value and as part of the full `roles` array.

## Authorization helpers

### `requireAuth()`

`requireAuth()` blocks requests when `req.currentUser` is missing or incomplete.

It currently returns a `401` error with the message:

- `Please log in to use this feature. Guest mode works only locally.`

### `requireRole(role)`

Requires the given role to appear in the user's role array.

### `requireRoleIn(rolesArray)`

Allows access when the user has at least one role from a supplied list.

### `requirePaid()`

Allows only `paid` or `admin` users.

## Role-aware product effects in the backend

Current user-visible role effects include:

- authenticated free-tier task limits
- authenticated free-tier custom-tag limits
- reserved route prefixes for admin and paid-only behavior

Current route-prefix enforcement includes:

- `/api/admin` guarded by `requireRole('admin')`
- `/api/ai` guarded by `requirePaid()` and its own rate limiter

## Error normalization for auth failures

The global error handler maps common OAuth-related failures into friendly API errors.

Examples include:

- missing or invalid authorization header -> `401`
- invalid or expired access token -> `401`

After mapping, the error handler returns the shared error response shape.

## Important implementation nuance

Some handlers contain fallback branches that appear to tolerate anonymous access, but the `/api` prefix still passes through `checkJwt` and `attachCurrentUser` first in normal runtime.

Canonical backend and API docs should therefore treat authenticated access as the stable rule unless a route is clearly defined before the `/api` auth middleware or intentionally public.

## Related canonical documents

- [runtime-composition.md](runtime-composition.md)
- [../api/auth-profile-and-settings-endpoints.md](../api/auth-profile-and-settings-endpoints.md)
- [../api/validation-auth-and-error-behavior.md](../api/validation-auth-and-error-behavior.md)
- [../product/identity-and-access-modes.md](../product/identity-and-access-modes.md)
