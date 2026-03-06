# Identity and Access Modes

## Purpose

This document defines the live product behavior for `guest mode` and `authenticated mode`, including what each mode can access, how the app transitions between them, and how onboarding interacts with authenticated use.

## Canonical sources used for this document

- [client/src/providers/AuthProvider.jsx](../../client/src/providers/AuthProvider.jsx)
- [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx)
- [client/src/hooks/useAuth.js](../../client/src/hooks/useAuth.js)
- [client/src/hooks/useApi.js](../../client/src/hooks/useApi.js)
- [client/src/components/auth/ProtectedRoute.jsx](../../client/src/components/auth/ProtectedRoute.jsx)
- [client/src/pages/OnboardingPage.jsx](../../client/src/pages/OnboardingPage.jsx)
- [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js)
- [backend/src/middleware/auth0.js](../../backend/src/middleware/auth0.js)
- [backend/src/middleware/attachCurrentUser.js](../../backend/src/middleware/attachCurrentUser.js)
- [backend/src/middleware/roles.js](../../backend/src/middleware/roles.js)
- [backend/src/index.js](../../backend/src/index.js)

## Identity vocabulary

Use these terms consistently:

- `guest mode` = local-only browser mode
- `authenticated mode` = Auth0-backed server mode
- `onboarding` = required authenticated first-run profile completion before normal use

These definitions are locked by [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](../reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md).

## Guest mode

### What guest mode is

`guest mode` is the product's local-only usage path.

The app enters guest mode when:

- the user is not authenticated
- identity resolution determines there is no authenticated session
- the todo provider falls back after an authenticated fetch failure that indicates the session is no longer usable

### What guest mode uses as data storage

Guest mode uses browser storage for:

- todos
- tags
- theme and font preferences

Guest task and tag operations are implemented through [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js) and [client/src/hooks/useGuestStorage.js](../../client/src/hooks/useGuestStorage.js).

### Product capabilities available in guest mode

Guest mode still supports the main task workflow:

- create tasks
- edit tasks
- complete tasks
- flag tasks
- delete tasks
- use subtasks, notes, priority, due date, due time, and recurrence
- filter by day, search text, and tags
- use seeded default tags and create custom local tags
- keep per-guest sequential `taskNumber` values for lookup-oriented UX
- compute statistics locally from guest data

### Product capabilities not backed by guest mode

Guest mode is not the canonical source for account-level server workflows.

Guest mode does not provide authenticated persistence for:

- server-backed profile data
- saved backend settings records
- account export/import endpoints
- reset-account on the backend
- authenticated-only routes guarded by `ProtectedRoute` or backend auth middleware

## Authenticated mode

### What authenticated mode is

`authenticated mode` is the server-backed operating mode used after the app successfully resolves an Auth0-authenticated identity and loads the current user from `/api/me`.

### What authenticated mode provides

Authenticated mode enables:

- server-backed todos and tags
- user profile persistence
- settings persistence
- role-aware backend enforcement
- onboarding state tracking
- export and import
- account reset behavior
- access to protected profile and settings flows

### Identity load sequence

At a high level, the frontend does this:

1. detect whether Auth0 considers the user authenticated
2. obtain an access token silently when possible
3. call the backend identity endpoint to hydrate `currentUser`
4. set `guestMode` to `false` once the authenticated identity is loaded
5. redirect to onboarding if the profile exists and `onboarding_completed` is `false`

## Transitions between modes

### Default unauthenticated path

If the user is not authenticated, the auth provider sets:

- `guestMode = true`
- `currentUser = null`
- `checkedIdentity = true`

That makes guest mode the default non-authenticated experience rather than a locked splash state.

### Session-expiry fallback

The todo provider can switch the app back into guest mode when authenticated requests fail with signals such as:

- `401`
- missing refresh token problems
- `login_required`

When that happens, the product keeps the user in a working state instead of leaving the task surface unusable.

### Login transition

When the user becomes authenticated, guest task and tag storage is cleared by the auth provider so the app does not keep mixing old guest data into the authenticated account context.

This means guest data is not automatically migrated into the authenticated account.

## Access control model from the product perspective

### Frontend gating

The frontend uses `ProtectedRoute` and route-level logic to guard authenticated-only screens such as profile-related views.

### Backend gating

The backend uses:

- JWT validation middleware
- current-user attachment middleware
- role-aware access checks

From the product perspective, the important rule is simple: authenticated-only account features must have a resolved current user.

## Authenticated roles and limits

The backend exposes a current user role and roles list through `/api/me`.

The live product behavior currently treats the default authenticated user as role `free` unless changed server-side.

The main user-visible effects of that role are current free-tier limits:

- maximum 200 active non-archived tasks
- maximum 50 custom tags

## `AUTH_DISABLED` development behavior

The backend contains a development bypass path where JWT validation becomes a no-op when `AUTH_DISABLED=1`.

This is part of development/runtime behavior, not an alternate product identity mode.

Canonical product language should therefore continue to describe the real user-facing modes as only:

- `guest mode`
- `authenticated mode`

## Onboarding interaction with access

Authenticated mode is not considered fully usable until onboarding is complete.

The product behavior is:

- authenticated user loads
- if profile onboarding state is incomplete, the app redirects to `/onboarding`
- normal app use resumes after the onboarding profile submission succeeds and identity is refreshed

## Product implications

The two-mode design has several practical consequences:

- the app remains usable without login
- the app still has a richer account-backed path for users who authenticate
- some experiences are mirrored across local and server modes, but they do not share the same persistence layer
- canonical docs must avoid implying that guest mode and authenticated mode are interchangeable storage models

## Related canonical documents

- [core-product-concepts.md](core-product-concepts.md)
- [onboarding-profile-and-preferences.md](onboarding-profile-and-preferences.md)
- [../frontend/profile-and-onboarding-screens.md](../frontend/profile-and-onboarding-screens.md)
- [../backend/auth-user-attachment-and-rbac.md](../backend/auth-user-attachment-and-rbac.md)
- [../api/auth-profile-and-settings-endpoints.md](../api/auth-profile-and-settings-endpoints.md)
