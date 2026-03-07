# Lifeline MCP v1 Planning Report

## Purpose

This planning artifact defines the bounded implementation plan for a new VPS-hosted `lifeline-mcp` service.

It builds on the completed discovery baseline in:

- `docs/issues/mcp-server/step-01-discovery/discovery/lifeline-mcp-discovery-report.md`
- `docs/issues/mcp-server/step-01-discovery/discovery/backend-capability-mapping.md`

This report is implementation-oriented. It does **not** start coding and does **not** propose a rewrite of the existing Lifeline backend.

## Planning scope

This plan covers MCP v1 only:

- separate Node-based `lifeline-mcp` service
- remote HTTP MCP transport
- API key auth for first desktop/CLI clients
- future-compatible auth design for later Auth0/OAuth 2.0 support
- strict per-user isolation
- bounded task-management tool surface
- deployment alongside the current Lifeline VPS stack

---

## Canonical inputs

Planning is grounded in these current repo truths:

- the live todo runtime is still centered in `backend/src/index.js`
- task behavior already exists in `CreateTodo`, `UpdateTodo`, `ToggleTodo`, `DeleteTodo`, `SearchTodos`, `CompleteRecurringTodo`, `RecurrenceService`, and `TypeORMTodoRepository`
- current production runtime is VPS + Docker Compose + Nginx
- current app auth is Auth0-backed JWT validation plus `attachCurrentUser`
- `taskNumber` already exists as a per-user stable identifier
- archive/unarchive is currently unsafe to expose because route-level user scoping is incomplete

---

# 1. Resolved planning decisions

## 1.1 Service topology

### Decision

Implement `lifeline-mcp` as a **separate Node.js service/container**.

### Rationale

This matches the current repo runtime stack and keeps MCP-specific concerns isolated from the main browser/API service.

### Exact call path

`MCP client -> HTTPS -> Nginx -> lifeline-mcp -> internal HTTP -> lifeline-app backend adapter -> existing Lifeline use cases / repository behavior`

### Runtime stack

Recommended v1 stack:

- Node.js 20
- HTTP-based remote MCP server runtime
- internal JSON/HTTP client for backend adapter calls
- Docker container deployed beside the current app

## 1.2 Backend integration strategy

### Decision

For v1, the backend adapter should be **private internal HTTP routes**, recommended as `/internal/mcp/*` on the existing Lifeline backend.

### Why this beats the alternatives for v1

#### Better than extracting a shared service module now

The repo does not currently expose a clean shared backend service boundary. The live runtime is still assembled in `backend/src/index.js`. Extracting a reusable service package first would increase scope and implementation risk.

#### Better than direct DB access

Direct database access would bypass existing task behavior, duplicate domain semantics, and weaken isolation guarantees.

### Boundary rule

These internal routes are **not public product API routes**. They are a private adapter surface for `lifeline-mcp` only.

## 1.3 Task identity strategy

### Decision

Use **both** `taskNumber` and UUID `id`.

### Split of responsibilities

- `taskNumber`: preferred user-facing MCP handle
- UUID `id`: internal precise identifier for backend update/delete/complete flows

### Why

This best matches current Lifeline behavior:

- `taskNumber` is already stable, per-user, and human-usable
- writes today are mostly UUID-based in backend routes
- using both avoids new friction while preserving exact backend targeting

## 1.4 Auth architecture

### Decision

Use **DB-backed hashed API keys** in v1, mapped 1:1 to Lifeline users and scopes.

### Principal model

Normalize all authenticated identities into one internal principal shape in `lifeline-mcp`, for example:

- `subjectType`: `api_key` or later `oauth_access_token`
- `lifelineUserId`
- `authMethod`
- `scopes`
- `keyId` or `oauthClientId`
- `displayName` or `keyLabel` where useful

This normalized principal becomes the only input consumed by MCP tool handlers.

### Future-compatibility rule

Later Auth0/OAuth support must plug into principal resolution only. Tool handlers must remain unchanged.

## 1.5 MCP transport assumption

### Decision

Use **remote HTTP MCP transport** for v1.

### Why

The stated deployment target is a VPS-hosted service for desktop/CLI clients now, with later ChatGPT-app compatibility. That fits remote HTTP better than stdio-first designs.

## 1.6 Tool-surface scope decision

### In v1

- `search_tasks`
- `get_task`
- `list_today`
- `list_upcoming`
- `create_task`
- `update_task`
- `complete_task`
- `uncomplete_task`
- `delete_task`

### Deferred from v1

- `find_similar_past_tasks`
- archive/unarchive tools
- tag-management tools
- stats/export/import tools

### Out of scope for v1

- direct DB-backed MCP behavior
- destructive bulk account operations
- any tool that bypasses current task logic

## 1.7 `find_similar_past_tasks` decision

### Decision

**Defer from v1.**

### Why

Discovery established that there is no first-class backend similarity feature yet. Forcing it into v1 would introduce underdefined behavior into the first release.

### What to preserve

Planning should leave a clear extension point so a later phase can add:

- approximate MCP-layer similarity, or
- bounded backend similarity support

without reshaping the core tool layer.

---

# 2. Recommended architecture

## 2.1 `lifeline-mcp` internal modules

Recommended v1 modules/components:

1. **transport layer**
   - exposes MCP over remote HTTP
   - handles request/session framing

2. **auth layer**
   - validates API keys
   - resolves normalized principal
   - enforces scopes

3. **tool registry / handlers**
   - one handler per MCP tool
   - no direct DB access
   - no embedded auth-specific branching beyond principal/scopes

4. **handle resolver**
   - resolves `taskNumber` to UUID `id` when needed
   - prevents ambiguous writes

5. **backend adapter client**
   - calls private `/internal/mcp/*` routes on `lifeline-app`
   - sends service-to-service trust header/credential
   - never calls public browser endpoints for core operations if private adapter exists

6. **response normalization layer**
   - maps backend payloads to MCP tool outputs
   - standardizes errors for machine clients

7. **audit/logging layer**
   - logs key usage, write actions, and auth failures without leaking secrets

## 2.2 Backend adapter modules on Lifeline backend

Recommended backend-side additions:

1. **internal adapter auth middleware**
   - validates service-to-service secret from `lifeline-mcp`
   - rejects public/unauthorized access

2. **internal principal injection middleware**
   - constructs a minimal internal user principal from headers/body after service auth succeeds
   - ensures every operation is executed against an explicit `userId`

3. **internal MCP route group**
   - mounted under `/internal/mcp`
   - delegates to current use cases/repository methods
   - keeps user scoping explicit

4. **small bounded read/write helpers**
   - only where required to avoid awkward reuse of public routes

## 2.3 Exact v1 call path by operation type

### Read flow

`MCP client -> lifeline-mcp auth -> tool handler -> backend adapter client -> /internal/mcp/... -> use case/repository -> response -> MCP output`

### Write flow

`MCP client -> lifeline-mcp auth + scope check + handle resolution -> backend adapter client -> /internal/mcp/... -> use case/repository -> response -> MCP output`

---

# 3. Backend integration plan

## 3.1 Recommended private adapter endpoints

Recommended backend adapter endpoints for v1:

- `GET /internal/mcp/tasks/search`
- `GET /internal/mcp/tasks/by-number/:taskNumber`
- `GET /internal/mcp/tasks/day/:dateToken`
- `GET /internal/mcp/tasks/upcoming`
- `POST /internal/mcp/tasks`
- `PATCH /internal/mcp/tasks/:id`
- `POST /internal/mcp/tasks/:id/complete`
- `POST /internal/mcp/tasks/:id/uncomplete`
- `DELETE /internal/mcp/tasks/:id`

## 3.2 Why these adapter routes are preferred over reusing public routes directly

They allow the backend to:

- accept internal user context without teaching public routes API-key auth
- preserve strict user scoping
- expose idempotent complete/uncomplete semantics without forcing MCP to use raw toggle
- centralize day/upcoming parity logic where helpful
- keep future MCP/OAuth changes out of the browser-facing API contract

## 3.3 Existing backend behavior reusable mostly untouched

These can be reused with little or no domain change:

- search filters via `SearchTodos` and repository filtering
- creation via `CreateTodo`
- updates via `UpdateTodo`
- delete behavior via `DeleteTodo` / repository archive-oriented delete
- task-number lookup via `findByTaskNumber`
- free-tier active-task cap enforcement already present in create flow
- recurrence creation semantics already present in `CreateTodo`

## 3.4 Small backend changes required before MCP exposure

### Required in backend prep slice

1. add internal adapter auth middleware
2. add internal adapter route group
3. add explicit single-item complete/uncomplete handlers
4. add bounded day-listing logic that preserves current `dateRange` behavior
5. add bounded upcoming-list logic
6. add safe lookup path for `taskNumber -> id` resolution
7. fix archive/unarchive scoping defect even if those routes stay out of v1, because the unsafe behavior is now a known risk
8. clean up Auth0 role-claim namespace drift before later dual-auth expansion

### Not required in v1 prep

- extracting a shared backend package
- redesigning the public `/api/todos/*` routes
- changing persistence model for tasks

---

# 4. Task handle and identity plan

## 4.1 Formal MCP handle policy

### User-facing handle

Preferred default: `taskNumber`

### Internal precise handle

UUID `id`

## 4.2 Safe resolution rules

### For read tools

- `get_task` should accept `taskNumber` as primary input
- optional support for `id` is acceptable only if clearly distinguished
- if both are provided, `id` must win only when they resolve to the same user-owned task or the request must fail explicitly

### For write tools

Recommended write-handler flow:

1. if client provides `id`, validate it belongs to the current user
2. if client provides `taskNumber`, resolve it to `id` via user-scoped lookup
3. if resolution fails, return explicit not found
4. do not perform fuzzy or multi-match writes

## 4.3 Ambiguity rules

- no fuzzy matching on destructive or mutating operations
- no write action against multiple candidate tasks from a search result unless a future bulk tool explicitly supports it
- if tool inputs are insufficient to uniquely identify a task, return a clarifying error rather than guessing

---

# 5. Auth design

## 5.1 API key data model recommendation

Recommended new record type: `McpApiKey`

Recommended fields:

- `id`
- `user_id`
- `name`
- `key_prefix`
- `key_hash`
- `scopes` (array/json)
- `status` (`active`, `revoked`, `expired`)
- `created_at`
- `expires_at`
- `last_used_at`
- `last_used_ip` or equivalent optional metadata
- `last_used_user_agent` or equivalent optional metadata
- optional `revoked_at`
- optional `revocation_reason`

## 5.2 Storage decision

Key records should live in the Lifeline database.

### Why

This enables:

- per-user mapping
- rotation and revocation
- expiry
- auditability
- future admin UX/API support if desired

## 5.3 Secret handling rule

Only store a **hash** of the secret portion of the key.

Recommended operational pattern:

- present full key once at creation
- store only prefix + hash
- never log full keys

## 5.4 v1 scopes

Recommended minimum scopes:

- `tasks:read`
- `tasks:write`
- `tasks:delete`

Optional but not required in v1:

- `keys:manage`
- `tags:read`
- `tags:write`

## 5.5 Key lifecycle recommendations

v1 should support at least:

- create key
- revoke key
- expire key
- last-used tracking

Planning does **not** require key-management MCP tools in v1. These can be implemented as admin or operational backend surfaces later.

## 5.6 MCP-to-backend trust bridge

### Decision

Use a **service-to-service shared secret** between `lifeline-mcp` and `lifeline-app` for v1 internal adapter calls.

### Expected pattern

- `lifeline-mcp` sends internal auth header(s)
- backend internal middleware validates secret
- backend trusts the caller only after service auth passes
- backend still requires explicit user identity payload/header for every operation

### Safety rule

The internal service secret authenticates the **caller service**, not the end user.

The end user principal must still be carried explicitly per request.

## 5.7 Future Auth0/OAuth compatibility model

### Recommended future direction

Later OAuth support should terminate at `lifeline-mcp`, not at the backend adapter.

### Why

That keeps the backend adapter simple and stable:

- `lifeline-mcp` resolves API key or OAuth token into the same normalized principal
- backend adapter continues to receive explicit internal user context plus service authentication
- the tool layer does not change when OAuth is added

### Relation to current Lifeline Auth0 setup

Planning should assume a **dedicated MCP/Auth0 configuration path** later rather than automatically reusing the current SPA audience/client without review.

That is safer because MCP client flows and browser SPA flows are not identical.

---

# 6. Tool scope and contract decisions

## 6.1 Final v1 tool list

### In v1

- `search_tasks`
- `get_task`
- `list_today`
- `list_upcoming`
- `create_task`
- `update_task`
- `complete_task`
- `uncomplete_task`
- `delete_task`

### Deferred

- `find_similar_past_tasks`
- `archive_task`
- `unarchive_task`
- tag tools
- stats/export/import tools

### Out of scope

- direct database tools
- admin/account reset tools
- any bulk destructive task tool beyond bounded batch semantics explicitly planned later

## 6.2 Safety semantics

### Complete/uncomplete

Expose **explicit** `complete_task` and `uncomplete_task` semantics.

Do not expose raw toggle as the MCP contract.

### Delete

Describe `delete_task` as:

- removing the task from the active working set
- currently backed by archive-oriented backend behavior
- not guaranteed physical erasure

### Unsafe existing surfaces out of v1

- current archive/unarchive routes
- any route shape that depends on guessed task identity
- raw public API auth behavior as the MCP auth model

---

# 7. Deployment fit plan

## 7.1 Compose placement

Add `lifeline-mcp` to `compose.production.yaml` as a sibling service to:

- `lifeline-app`
- `lifeline-postgres`

## 7.2 Recommended service and network shape

### Service name

- `lifeline-mcp`

### Container name

- `lifeline-mcp`

### Internal backend path

- `http://lifeline-app:3000/internal/mcp/...`

### Host binding

Mirror the current app pattern and bind MCP to loopback only on the VPS host, for example:

- `127.0.0.1:${MCP_PORT}:<container-port>`

This keeps Nginx as the public edge.

## 7.3 Public hostname recommendation

Recommended public host:

- `mcp.lifeline.a2z-us.com`

Fallback:

- `lifeline-mcp.a2z-us.com`

## 7.4 Nginx additions

Planning should assume a new server block that:

- matches the MCP host
- proxies to `127.0.0.1:${MCP_PORT}`
- forwards standard proxy headers
- keeps the MCP service off the public Docker interface

## 7.5 Production env and secret additions

Recommended new env/secrets:

- `MCP_PORT`
- `MCP_PUBLIC_BASE_URL`
- `MCP_INTERNAL_BACKEND_BASE_URL`
- `MCP_INTERNAL_SHARED_SECRET`
- `MCP_API_KEY_PEPPER` or equivalent hashing secret support
- `MCP_LOG_LEVEL`
- later OAuth-related envs, but not all required in v1

If the MCP runtime needs CORS or origin settings for later web-based consumers, those should be deferred unless the chosen transport requires them now.

## 7.6 Later docs/governance surfaces likely touched during implementation

After code implementation, likely canonical doc updates will be needed in:

- `docs/architecture/` for runtime topology and integration boundary updates
- `docs/operations/` for deploy/runtime/env/Nginx updates
- `docs/backend/` for internal adapter/auth behavior
- `docs/api/` only if any public API contracts change
- possibly `docs/adr/` if implementation introduces a durable auth/deployment boundary decision worth formalizing

---

# 8. Risks and tradeoffs

## 8.1 Main tradeoff accepted in this plan

The plan prefers **small private HTTP adapter routes** over a cleaner shared-library extraction.

This is intentionally biased toward bounded implementation risk and speed for v1.

## 8.2 Main risks to manage during implementation

1. accidental user-scoping regression in internal routes
2. leaking service-to-service trust secret
3. fuzzy write behavior if handle resolution is under-specified
4. recurrence/day parity drift if today/upcoming semantics are reimplemented carelessly
5. over-expanding v1 with similarity/tag/admin features

## 8.3 Conservative rules that should remain in force

- no direct Postgres access from MCP
- no public archive/unarchive exposure in v1
- no raw toggle tool
- no broad backend restructuring before first delivery
- no OAuth-specific assumptions in the tool layer

---

# 9. Unresolved decisions

These are narrowed but not fully implementation-resolved:

1. exact remote MCP runtime package/library choice
2. exact shape of service-auth header(s) between `lifeline-mcp` and backend
3. whether `complete_task` / `uncomplete_task` adapter handlers should call batch logic or a new single-item service path under the hood
4. whether an ADR should be added at implementation time for the new internal adapter/auth boundary

These do **not** block implementation start.

---

# 10. Explicit implementation recommendation

Proceed with a bounded implementation that starts with:

1. backend prep for private adapter routes and internal auth
2. API key schema and principal model
3. `lifeline-mcp` scaffold with read-first tool handlers
4. explicit write semantics for complete/uncomplete/delete
5. production compose and Nginx wiring
6. docs and validation pass

## Implementation-ready next phase

The exact next phase after planning should be:

**step-03 implementation, slice 01: backend prep and auth foundation**

That slice should focus on:

- internal backend adapter route group
- service-to-service auth middleware
- API key data model scaffolding
- principal normalization contract
- fixing known unsafe scoping drift before MCP exposure
