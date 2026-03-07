# Lifeline MCP Step-03 Implementation — Slice 04 Report

## Slice

`step-03 implementation, slice-04: lifeline-mcp service scaffold`

## Scope completed

This slice implemented the bounded separate `lifeline-mcp` service scaffold and the smallest backend addition required to let that service resolve API-key principals safely without direct database access.

Implemented scope:

- separate Node-based `services/lifeline-mcp/` package scaffold
- real remote HTTP MCP transport using the official MCP SDK
- stateless Streamable HTTP `/mcp` endpoint in JSON-response mode
- bounded API-key auth resolution through backend-internal `/internal/mcp/auth/resolve-api-key`
- normalized principal creation inside the new service
- thin backend adapter client over the existing `/internal/mcp/*` read/write surfaces
- first approved thin task tool registrations for MCP v1
- `taskNumber`-preferred selector resolution for write operations
- focused service and backend regression coverage for the new scaffold

Out of scope and intentionally not implemented here:

- OAuth/Auth0 support for MCP clients
- direct database access from `lifeline-mcp`
- public deployment wiring, Docker, or Nginx changes
- API-key issuance/management UX
- `find_similar_past_tasks`
- archive/unarchive MCP tools

---

## Code changes made

## 1. Backend-internal API-key resolution surface

Added a bounded backend application/use-route path for service-side API-key verification:

- `backend/src/application/ResolveMcpApiKeyPrincipal.js`
- `backend/src/internal/mcp/authHandlers.js`
- `backend/src/internal/mcp/authRouter.js`
- `backend/src/internal/mcp/router.js`

Behavior:

- parses presented API keys safely
- validates hashed key material against the DB-backed key scaffold from slice 01
- rejects revoked, expired, inactive, or unknown keys clearly
- resolves the Lifeline user tied to the key
- returns a normalized internal principal payload for `lifeline-mcp`
- records usage metadata on a best-effort basis so audit-write failures do not block valid authentication
- uses server-observed client metadata for usage tracking instead of trusting body overrides

## 2. Separate `lifeline-mcp` service scaffold

Added a new isolated package at `services/lifeline-mcp/` with:

- `package.json`
- `package-lock.json`
- `.env.example`
- `src/` runtime files
- `test/` coverage

The service stays thin by handling:

- MCP transport
- API-key authentication
- scope enforcement
- task selector safety
- backend adapter delegation

It does **not** reimplement Lifeline task business rules.

## 3. Real MCP transport and app bootstrap

Added the initial service runtime under:

- `services/lifeline-mcp/src/app.js`
- `services/lifeline-mcp/src/index.js`
- `services/lifeline-mcp/src/mcp/serverFactory.js`

Behavior:

- exposes `GET /health`
- exposes `POST /mcp`
- uses official `@modelcontextprotocol/sdk`
- creates a per-request stateless Streamable HTTP transport
- returns JSON-RPC-style error envelopes for bootstrap/auth failures
- rejects non-`POST` methods on `/mcp`

## 4. Principal, auth, and backend adapter layers

Added:

- `services/lifeline-mcp/src/auth/principal.js`
- `services/lifeline-mcp/src/auth/apiKeyAuth.js`
- `services/lifeline-mcp/src/backend/internalBackendClient.js`
- `services/lifeline-mcp/src/constants.js`
- `services/lifeline-mcp/src/config.js`
- `services/lifeline-mcp/src/errors.js`

Behavior:

- extracts Bearer or `x-api-key` credentials
- resolves principals through the backend-internal auth surface
- normalizes scopes and principal fields locally in the service
- forwards internal shared-secret auth plus normalized principal headers to the backend
- normalizes backend failures into service-facing errors

## 5. First thin MCP task tools

Added:

- `services/lifeline-mcp/src/mcp/toolResults.js`
- `services/lifeline-mcp/src/mcp/taskSelectors.js`
- `services/lifeline-mcp/src/mcp/taskTools.js`

Registered v1 task tools:

- `search_tasks`
- `get_task`
- `list_today`
- `list_upcoming`
- `create_task`
- `update_task`
- `complete_task`
- `uncomplete_task`
- `delete_task`

Behavior:

- all tools are principal-driven
- read tools require `tasks:read`
- mutating tools require `tasks:write`
- write paths resolve `taskNumber` to exact UUID through the backend before mutation
- mismatched `id` plus `taskNumber` selectors fail explicitly instead of guessing

---

## Important files touched

### Backend code

- `backend/src/application/ResolveMcpApiKeyPrincipal.js`
- `backend/src/internal/mcp/authHandlers.js`
- `backend/src/internal/mcp/authRouter.js`
- `backend/src/internal/mcp/router.js`

### Backend tests

- `backend/test/internal/internalMcpAuthResolveRoutes.test.js`

### New service package

- `services/lifeline-mcp/package.json`
- `services/lifeline-mcp/package-lock.json`
- `services/lifeline-mcp/.env.example`
- `services/lifeline-mcp/src/constants.js`
- `services/lifeline-mcp/src/config.js`
- `services/lifeline-mcp/src/errors.js`
- `services/lifeline-mcp/src/auth/principal.js`
- `services/lifeline-mcp/src/auth/apiKeyAuth.js`
- `services/lifeline-mcp/src/backend/internalBackendClient.js`
- `services/lifeline-mcp/src/mcp/toolResults.js`
- `services/lifeline-mcp/src/mcp/taskSelectors.js`
- `services/lifeline-mcp/src/mcp/taskTools.js`
- `services/lifeline-mcp/src/mcp/serverFactory.js`
- `services/lifeline-mcp/src/app.js`
- `services/lifeline-mcp/src/index.js`
- `services/lifeline-mcp/test/mcpService.test.js`

---

## Validation performed

## Service tests

Executed from `services/lifeline-mcp/`:

`npm test`

Result:

- **5/5 tests passed**

Covered behavior:

- health endpoint
- missing API-key rejection
- representative end-to-end read/write MCP flow through the internal backend adapter
- scope denial for write tools with read-only keys
- conflicting `id` and `taskNumber` selector rejection on mutations

## Targeted backend MCP regression suite

Executed from `backend/`:

`npm test -- --runInBand test/internal/internalMcpRoutes.test.js test/internal/internalMcpAuthResolveRoutes.test.js test/internal/internalMcpTaskReadRoutes.test.js test/internal/internalMcpTaskWriteRoutes.test.js test/internal/mcpPrincipal.test.js test/internal/mcpApiKeyScaffold.test.js`

Result:

- **6/6 suites passed**
- **32/32 tests passed**

Covered behavior:

- internal service-auth boundary
- API-key resolution route
- read/write adapter routes
- normalized principal helpers
- API-key scaffold behavior
- auth-resolution reliability when usage recording fails

## Diagnostics

Checked edited slice-04 files for editor errors.

Result:

- no file-level diagnostics remained in checked files

## Lint gate note

Checked lint availability in both touched packages.

Commands executed:

- `services/lifeline-mcp`: `npm run lint`
- `backend`: `npm run lint`

Result:

- both packages currently have **no `lint` script**
- lint validation is therefore not currently available as a runnable repo command for this slice

Because of that repo-state limitation, slice validation relied on:

- focused automated tests
- editor diagnostics
- repo-native governance review

---

## Governance usage note

This slice was implemented using the repo-native governance stack, not outside it.

Materially used governance layers:

- **backend engineering governance**
  - preserved the backend as the source of truth for task behavior
  - kept the new service thin and adapter-oriented
  - kept auth and task targeting explicit and user-scoped

- **code-quality governance**
  - kept responsibilities narrow across auth, transport, backend client, and tool registration layers
  - preserved explicit error handling and avoided hidden mutation behavior

- **refactor governance**
  - applied in bounded form only
  - avoided broad extraction or public API redesign while still adding the smallest backend auth-resolution surface needed by the service

- **documentation governance**
  - routed the retained implementation artifact into the scoped non-root implementation path for this initiative
  - did not update canonical public docs because this slice added internal adapter behavior plus a separate service scaffold, not a new public product contract

- **repo-native builder/reviewer pattern**
  - post-implementation review outcome after fixes: **Approve with minor notes addressed**
  - review confirmed the thin-service boundary was preserved and auth/per-user task targeting were safe for the bounded slice

---

## Documentation impact note

No canonical `docs/api/`, `docs/backend/`, `docs/architecture/`, or `docs/operations/` pages were updated in this slice.

Reason:

- this slice establishes the new service scaffold and a backend-internal auth adapter surface
- production/runtime topology and deployment documentation should be updated once deployment wiring is implemented in a later slice

---

## Slice result

This slice established a working, test-covered `lifeline-mcp` service scaffold over the existing internal backend adapter without expanding scope into deployment or OAuth.

The codebase now has:

- a separate MCP service package
- real MCP HTTP transport
- bounded API-key principal resolution through the backend
- normalized principal handling inside the service
- thin task tool delegation over the existing internal backend routes
- safe `taskNumber`-preferred mutation targeting
- focused end-to-end coverage for the scaffold

---

## Recommended next slice

`step-03 implementation, slice-05: deployment and runtime wiring for lifeline-mcp`

Recommended focus:

- production compose service addition
- environment wiring
- Dockerfile/runtime packaging for `lifeline-mcp`
- Nginx host routing for MCP
- operational and architecture documentation updates
