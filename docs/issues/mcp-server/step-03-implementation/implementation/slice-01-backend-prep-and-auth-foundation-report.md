# Lifeline MCP Step-03 Implementation — Slice 01 Report

## Slice

`step-03 implementation, slice-01: backend prep and auth foundation`

## Scope completed

This slice implemented the bounded backend/auth foundation needed for a later separate `lifeline-mcp` service.

Implemented scope:

- private internal backend route foundation under `/internal/mcp/*`
- internal service-to-service auth middleware using a dedicated shared-secret header
- normalized MCP principal contract helper
- DB-backed MCP API key persistence scaffolding
- archive/unarchive user-scoping fix
- Auth0 role-claim namespace consistency fix
- bounded test coverage for the new foundation

Out of scope and intentionally not implemented here:

- separate `lifeline-mcp` service
- MCP transport/runtime
- full `/internal/mcp/tasks/*` adapter surface
- OAuth/Auth0 for MCP clients
- similarity search or fuzzy matching

---

## Code changes made

## 1. Internal route foundation

Added a new internal router at `/internal/mcp`.

Current bounded endpoint:

- `GET /internal/mcp/health`

This endpoint is protected by internal service auth and exists to prove the route boundary and auth pattern.

## 2. Service-to-service auth middleware

Added dedicated middleware that validates a shared secret from:

- header: `x-lifeline-internal-service-secret`
- env var: `MCP_INTERNAL_SHARED_SECRET`

Behavior:

- rejects missing auth
- rejects invalid auth
- returns `503` if internal MCP auth is not configured
- sets `req.internalServiceAuth` only after successful service authentication
- does not treat user-principal headers as authenticated on their own

## 3. Normalized MCP principal contract

Added a concrete principal helper contract for later MCP work.

Defined fields include:

- `subjectType`
- `lifelineUserId`
- `authMethod`
- `scopes`
- `subjectId`
- `displayName`

This contract now gives later slices one stable principal shape for both:

- future API-key-authenticated MCP users
- future Auth0/OAuth-authenticated MCP users

## 4. MCP API key persistence scaffolding

Added bounded backend scaffolding for DB-backed hashed MCP API keys:

- TypeORM entity/schema for `mcp_api_keys`
- migration scaffold creating the table and indexes
- repository scaffold for key lookup/save/usage tracking
- hashing/verification helper for secret material

The scaffolding stores:

- `key_prefix`
- `key_hash`

and does **not** store plaintext keys.

## 5. Unsafe archive/unarchive scoping fix

Fixed the known user-scoping gap by passing `req.currentUser.id` through the live archive/unarchive route calls.

## 6. Auth0 role-claim namespace consistency fix

Added one shared Auth0 claims helper that:

- treats `https://lifeline-api/roles` as canonical
- accepts `https://lifeline.app/roles` as legacy-compatible fallback
- deduplicates merged roles
- centralizes primary-role derivation

Updated both:

- `attachCurrentUser`
- `TypeORMUserRepository.ensureUserFromAuth0Claims()`

to use the same helper.

## 7. Frontend SPA fallback reservation update

Reserved `/internal` in frontend fallback path checks so internal MCP paths are not accidentally treated as SPA routes.

---

## Important files touched

### Backend code

- `backend/src/index.js`
- `backend/src/infra/db/data-source-options.js`
- `backend/src/middleware/requireInternalServiceAuth.js`
- `backend/src/internal/mcp/router.js`
- `backend/src/internal/mcp/constants.js`
- `backend/src/internal/mcp/principal.js`
- `backend/src/auth/auth0Claims.js`
- `backend/src/infrastructure/TypeORMUserRepository.js`
- `backend/src/middleware/attachCurrentUser.js`
- `backend/src/infra/db/entities/McpApiKeyEntity.js`
- `backend/src/infrastructure/TypeORMMcpApiKeyRepository.js`
- `backend/src/utils/mcpApiKeys.js`
- `backend/src/migrations/1772862400000-add-mcp-api-keys.js`

### Tests

- `backend/test/internal/internalMcpRoutes.test.js`
- `backend/test/internal/mcpPrincipal.test.js`
- `backend/test/internal/mcpApiKeyScaffold.test.js`
- `backend/test/auth/auth0Claims.test.js`
- `backend/test/routes/archive_unarchive.test.js`

---

## Validation performed

## Test run

Executed targeted backend tests covering:

- internal MCP auth boundary
- normalized principal contract
- MCP API key scaffolding helper behavior
- Auth0 role-claim normalization
- archive/unarchive user scoping
- adjacent attach-current-user behavior
- adjacent task-number route behavior

Command executed from `backend/`:

`npm test -- --runInBand test/internal/internalMcpRoutes.test.js test/internal/mcpPrincipal.test.js test/internal/mcpApiKeyScaffold.test.js test/auth/auth0Claims.test.js test/routes/archive_unarchive.test.js test/middleware/attachCurrentUser.test.js test/routes/todosByNumber.test.js`

Result:

- **7/7 test suites passed**
- **18/18 tests passed**

## Data-source and migration registration check

Executed a direct Node verification from `backend/` to confirm:

- `McpApiKey` is registered in TypeORM data-source options
- the new migration module loads successfully

Result:

- entity list included `McpApiKey`
- migration class loaded with name `AddMcpApiKeys1772862400000`

## Editor diagnostics

Checked modified source/test files for errors.

Result:

- no file-level errors reported in edited files

---

## Slice result

This slice established the minimum safe backend foundation needed for later MCP slices without implementing the separate MCP service or the full tool surface.

The backend now has:

- a private `/internal/mcp` boundary
- a concrete service-auth pattern
- a normalized principal contract
- MCP API key persistence scaffolding
- corrected archive/unarchive user scoping
- unified Auth0 role-claim handling

---

## Recommended next slice

`step-03 implementation, slice-02: internal task adapter read surfaces`

Recommended focus:

- `GET /internal/mcp/tasks/search`
- `GET /internal/mcp/tasks/by-number/:taskNumber`
- day-listing adapter support for `list_today`
- upcoming-list adapter support for `list_upcoming`
- safe task handle resolution support for later write slices
