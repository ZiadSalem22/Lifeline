# MCP API Key Management

## Purpose

This document describes the backend behavior for Lifeline's user-scoped MCP API key lifecycle.

## Canonical sources used for this document

- [backend/src/routes/mcpApiKeyRoutes.js](../../backend/src/routes/mcpApiKeyRoutes.js)
- [backend/src/controllers/McpApiKeyController.js](../../backend/src/controllers/McpApiKeyController.js)
- [backend/src/application/IssueMcpApiKey.js](../../backend/src/application/IssueMcpApiKey.js)
- [backend/src/application/mcpApiKeys/CreateSelfServeMcpApiKey.js](../../backend/src/application/mcpApiKeys/CreateSelfServeMcpApiKey.js)
- [backend/src/application/mcpApiKeys/ListCurrentUserMcpApiKeys.js](../../backend/src/application/mcpApiKeys/ListCurrentUserMcpApiKeys.js)
- [backend/src/application/mcpApiKeys/RevokeCurrentUserMcpApiKey.js](../../backend/src/application/mcpApiKeys/RevokeCurrentUserMcpApiKey.js)
- [backend/src/application/ResolveMcpApiKeyPrincipal.js](../../backend/src/application/ResolveMcpApiKeyPrincipal.js)
- [backend/src/infrastructure/TypeORMMcpApiKeyRepository.js](../../backend/src/infrastructure/TypeORMMcpApiKeyRepository.js)
- [backend/src/validators/index.js](../../backend/src/validators/index.js)
- [backend/src/index.js](../../backend/src/index.js)

## Route group and auth model

The self-serve product routes live under `/api/mcp-api-keys`.

They are protected by the normal authenticated product middleware chain:

- `/api` prefix auth middleware (`checkJwt` + `attachCurrentUser`)
- `requireAuth()` at the route-group mount

That means all MCP API key lifecycle actions are current-user scoped product actions, not internal MCP routes.

## Supported backend operations

### List current user's keys

`ListCurrentUserMcpApiKeys` loads the current user's records through the repository and returns metadata only.

Important behavior:

- records are returned newest first
- only the authenticated user's records are visible
- the response never includes the stored hash or any plaintext secret
- status is normalized for runtime truth, so a key with a past `expires_at` is surfaced as `expired`

### Create a self-serve key

`CreateSelfServeMcpApiKey` wraps the existing `IssueMcpApiKey` use-case rather than reimplementing secret generation.

That wrapper is responsible for product-facing restrictions:

- it accepts only `read_only` and `read_write` scope presets
- it accepts only the bounded expiry presets `1_day`, `7_days`, `30_days`, `90_days`, and `never`
- it maps those presets to the underlying persisted scopes and expiry timestamp

The underlying `IssueMcpApiKey` use-case still performs the core issuance work:

- normalize and validate the key name
- generate a unique `lk_<prefix>` key prefix
- generate the secret
- hash the secret with the configured pepper
- persist only the hash and metadata
- return the plaintext key once at creation time

### Revoke a current user's key

`RevokeCurrentUserMcpApiKey` looks up the key by `id + userId` and updates the persisted record through the repository.

Important behavior:

- the lookup is user-scoped, so one user cannot revoke another user's key
- a missing or non-owned key returns a `404`
- an already revoked key returns current metadata idempotently
- revocation stores `status = revoked`, `revoked_at`, and a bounded reason of `user_self_service`

## Repository behavior

`TypeORMMcpApiKeyRepository` now provides the lifecycle operations needed by the product surface:

- `listByUserId(userId)`
- `findByIdForUser(id, userId)`
- `findByKeyPrefix(keyPrefix)`
- `save(record)`
- `recordUsage(id, usage)`
- `revokeByIdForUser(id, userId, details)`

This keeps TypeORM persistence details inside the repository boundary.

## Validation behavior

Request-shape validation is handled before the controller.

Current self-serve validation rules include:

- `name` must be present and non-blank
- `scopePreset` must be `read_only` or `read_write`
- `expiryPreset` must be one of the bounded preset values
- revoke route id uses the existing UUID route-param validation

## Security behavior to preserve

- user scoping always comes from `req.currentUser.id`
- plaintext key material is returned only from create and only once
- list and revoke return metadata only
- broader operator scopes such as `tasks:*` or `*` are not exposed by the self-serve route
- the operator script path remains separate from the user-facing product path

## MCP compatibility path

The self-serve feature does not add a new auth system.

Compatibility stays anchored in the existing path:

1. self-serve create persists the hashed key record
2. `ResolveMcpApiKeyPrincipal` validates the presented key by prefix + secret
3. the internal MCP auth handler converts that into the normalized principal contract
4. `lifeline-mcp` consumes that normalized principal through its backend adapter path

This keeps the user-facing key lifecycle and the MCP auth runtime on the same source of truth.

## Related canonical documents

- [auth-user-attachment-and-rbac.md](auth-user-attachment-and-rbac.md)
- [../api/auth-profile-and-settings-endpoints.md](../api/auth-profile-and-settings-endpoints.md)
- [../data-model/mcp-api-keys.md](../data-model/mcp-api-keys.md)
- [../operations/lifeline-mcp-first-cutover-runbook.md](../operations/lifeline-mcp-first-cutover-runbook.md)
