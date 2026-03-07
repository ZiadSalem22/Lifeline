# Auth, Profile, and Settings Endpoints

## Purpose

This document describes the current authenticated identity, profile, settings, and account-reset endpoints.

## Canonical sources used for this document

- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/middleware/auth0.js](../../backend/src/middleware/auth0.js)
- [backend/src/middleware/attachCurrentUser.js](../../backend/src/middleware/attachCurrentUser.js)
- [backend/src/middleware/roles.js](../../backend/src/middleware/roles.js)
- [backend/src/routes/mcpApiKeyRoutes.js](../../backend/src/routes/mcpApiKeyRoutes.js)
- [backend/src/controllers/McpApiKeyController.js](../../backend/src/controllers/McpApiKeyController.js)
- [backend/src/validators/index.js](../../backend/src/validators/index.js)

## Endpoint group summary

| Endpoint | Method | Auth requirement | Purpose |
| --- | --- | --- | --- |
| `/api/me` | `GET` | Authenticated | Returns the normalized current-user payload |
| `/api/profile` | `POST` | Authenticated | Creates or updates the current user's profile |
| `/api/settings` | `POST` | Authenticated | Saves or updates user settings |
| `/api/mcp-api-keys` | `GET` | Authenticated | Lists the current user's MCP API keys by metadata only |
| `/api/mcp-api-keys` | `POST` | Authenticated | Creates a new self-serve MCP API key for the current user |
| `/api/mcp-api-keys/:id/revoke` | `POST` | Authenticated | Revokes one of the current user's MCP API keys |
| `/api/reset-account` | `POST` | Authenticated | Deletes todos, custom tags, and saved settings for the current user |
| `/api/me/raw` | `GET` | JWT middleware path | Returns raw auth payload for debugging |
| `/me` | `GET` | Public redirect | Redirects to `/api/me` |

## `GET /api/me`

### Purpose

Returns the normalized authenticated user object used by the frontend.

### Current response fields

The response can include:

- `id`
- `email`
- `name`
- `picture`
- `role`
- `roles`
- `subscription_status`
- `settings`
- `profile`

The `profile` object can include:

- `first_name`
- `last_name`
- `phone`
- `country`
- `city`
- `timezone`
- `avatar_url`
- `start_day_of_week`
- `onboarding_completed`

### Auth behavior

This endpoint uses `requireAuth()`, so missing `req.currentUser` yields a `401` error.

## `POST /api/profile`

### Purpose

Creates or updates the current authenticated user's profile.

### Current request fields

The handler accepts fields such as:

- `first_name`
- `last_name`
- `email`
- `phone`
- `country`
- `city`
- `avatar_url`
- `timezone`
- `start_day_of_week`
- `onboarding_completed`

### Important behavior

- `first_name` and `last_name` are required
- `start_day_of_week` is normalized to a canonical day name
- invalid day values return `400`
- onboarding completion is only set true when explicitly supplied as true
- the backend creates the user record if it does not already exist
- email conflicts during onboarding/update return `409`

### Response behavior

On success, the endpoint returns the saved profile-facing fields.

## `GET /api/mcp-api-keys`

### Purpose

Returns the authenticated user's existing MCP API keys by metadata only.

### Current query parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `limit` | integer | no | Maximum number of results to return, default `25`, maximum `50` |

### Current response behavior

Each item can include:

- `id`
- `name`
- `keyPrefix`
- `scopes`
- `status`
- `createdAt`
- `expiresAt`
- `lastUsedAt`
- `revokedAt`

### Important security rule

This endpoint does **not** return plaintext key secrets or stored hash material.

## `POST /api/mcp-api-keys`

### Purpose

Creates a new self-serve MCP API key for the authenticated user.

### Current request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Human-readable label for the key |
| `scopePreset` | string | yes | `read_only` or `read_write` |
| `expiryPreset` | string | yes | `1_day`, `7_days`, `30_days`, `90_days`, or `never` |

### Current response behavior

The response returns:

- `apiKey` metadata
- `plaintextKey`

`plaintextKey` is returned only on create and should be treated as a one-time reveal value.

### Validation behavior

- invalid scope presets return `400`
- invalid expiry presets return `400`
- blank names return `400`

## `POST /api/mcp-api-keys/:id/revoke`

### Purpose

Revokes one of the authenticated user's own MCP API keys.

### Current response behavior

Returns the updated `apiKey` metadata with revoked status.

### Current auth/scoping rule

The lookup is user-scoped. A user cannot revoke another user's key.

## `POST /api/settings`

### Purpose

Creates or updates user settings.

### Current request shape

The handler accepts an object with fields such as:

- `theme`
- `locale`
- `layout`

### Current behavior

- requires an authenticated current user
- delegates persistence to the user-settings repository
- returns the saved settings object on success
- returns `500` if persistence fails unexpectedly

## `POST /api/reset-account`

### Purpose

Deletes user-scoped account data.

### Current destructive scope

The handler deletes, for the current user:

- todos
- non-default tags
- saved user settings

### Current response

Returns a success object including a human-readable reset message.

## `GET /api/me/raw`

### Purpose

Returns the raw JWT payload for debugging.

### Documentation note

This endpoint is useful for auth diagnostics, but it should not be treated as the stable primary current-user contract. `/api/me` is the canonical frontend-facing identity endpoint.

## Related canonical documents

- [validation-auth-and-error-behavior.md](validation-auth-and-error-behavior.md)
- [todo-endpoints.md](todo-endpoints.md)
- [../backend/auth-user-attachment-and-rbac.md](../backend/auth-user-attachment-and-rbac.md)
- [../product/onboarding-profile-and-preferences.md](../product/onboarding-profile-and-preferences.md)
