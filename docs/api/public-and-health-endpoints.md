# Public and Health Endpoints

## Purpose

This document covers the public and health-oriented API endpoints that describe runtime availability rather than user task data.

## Canonical sources used for this document

- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/swagger.js](../../backend/src/swagger.js)

## Endpoint group summary

| Endpoint | Method | Auth expectation | Purpose |
| --- | --- | --- | --- |
| `/api/public/info` | `GET` | Public | Returns basic application info and guest-mode guidance |
| `/api/health/db` | `GET` | Public | Checks database connectivity |
| `/api/health/db/schema` | `GET` | Public/internal diagnostic | Returns schema inspection data for debugging |

## `GET /api/public/info`

### Purpose

Returns a small public information payload about the API and the current guest-mode model.

### Current response shape

The handler returns an object with fields including:

- `name`
- `version`
- `guestMode`
- `message`
- `time`

### Product meaning

The current response explicitly states that guest-mode data remains local-only and that authentication is required for sync-like behavior.

## `GET /api/health/db`

### Purpose

Performs a direct database health check.

### Current behavior

The handler:

- initializes the TypeORM data source if necessary
- runs a simple SQL check
- returns `{ db: 'ok' }` on success
- returns `{ db: 'error', message }` on failure

### Status codes

- `200` on success
- `500` on database failure

## `GET /api/health/db/schema`

### Purpose

Returns a schema inspection snapshot for debugging and verification.

### Current status

This is an internal-style diagnostic endpoint rather than a user-facing business endpoint.

Canonical docs should treat it as operational/debugging support, not as a normal client application dependency.

## Swagger and documentation behavior

The backend also serves API documentation through:

- `/api-docs`
- `/api-docs/swagger.json`

These endpoints are documentation surfaces rather than product data endpoints, but they belong to the same public/runtime discovery story.

## Related canonical documents

- [auth-profile-and-settings-endpoints.md](auth-profile-and-settings-endpoints.md)
- [validation-auth-and-error-behavior.md](validation-auth-and-error-behavior.md)
- [../operations/deployment-verification-and-smoke-checks.md](../operations/deployment-verification-and-smoke-checks.md)
