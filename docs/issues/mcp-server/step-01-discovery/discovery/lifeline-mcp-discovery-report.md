# Lifeline MCP Server Discovery Report

## Scope

This is a bounded discovery artifact for adding a new VPS-hosted `lifeline-mcp` service.

It is grounded in the current repo implementation and deployment model. It does **not** propose a rewrite, direct database access from MCP clients, or replacement of existing Lifeline task logic.

## Canonical implementation surfaces reviewed

- `backend/src/index.js`
- `backend/src/middleware/auth0.js`
- `backend/src/middleware/attachCurrentUser.js`
- `backend/src/middleware/roles.js`
- `backend/src/middleware/validateTodo.js`
- `backend/src/application/CreateTodo.js`
- `backend/src/application/UpdateTodo.js`
- `backend/src/application/ToggleTodo.js`
- `backend/src/application/SearchTodos.js`
- `backend/src/application/CompleteRecurringTodo.js`
- `backend/src/application/RecurrenceService.js`
- `backend/src/domain/Todo.js`
- `backend/src/infrastructure/TypeORMTodoRepository.js`
- `backend/src/infra/db/entities/TodoEntity.js`
- `client/src/providers/AuthAdapterProvider.jsx`
- `client/src/providers/AuthProvider.jsx`
- `client/src/providers/TodoProvider.jsx`
- `client/src/utils/api.js`
- `compose.production.yaml`
- `compose.production.env.example`
- `deploy/nginx/lifeline.a2z-us.com.conf`
- `deploy/scripts/apply-release.sh`
- `.github/workflows/deploy-production.yml`
- `docs/api/todo-endpoints.md`
- `docs/api/validation-auth-and-error-behavior.md`
- `docs/backend/todo-services-and-use-cases.md`
- `docs/product/task-lifecycle.md`
- `docs/product/recurrence-behavior.md`
- `docs/architecture/runtime-topology.md`
- `docs/operations/production-runtime-and-rollback.md`

---

## Executive answer

### Recommended implementation path

**Recommended first implementation:**

`remote MCP clients -> lifeline-mcp service -> bounded internal backend adapter -> existing Lifeline application/repository logic`

### Why this is the best fit for the repo as it exists now

1. The current backend already contains reusable task business logic and persistence behavior.
2. The current public todo API is usable for some MCP operations, but it is tightly shaped around Auth0-backed browser/API calls and is not a clean fit for API-key-authenticated machine clients.
3. A separate `lifeline-mcp` service can stay thin if it handles external MCP protocol/auth concerns while the existing Lifeline backend remains the source of truth for task behavior.
4. A **small internal backend adapter surface** is safer than either:
   - teaching the existing public API to accept several new machine auth modes immediately, or
   - letting MCP talk directly to Postgres.

### Cleanest attachment point from repo truth

**Do not attach to the unused route/controller prototype in `backend/src/routes/todoRoutes.js` and `backend/src/controllers/todoController.js`.**

Those files are present but not wired into the live authenticated runtime.

**Attach to the live backend runtime centered in `backend/src/index.js`, backed by the existing use cases and `TypeORMTodoRepository`.**

---

## A. Repo and architecture truth

## 1. Current backend architecture

The live backend is a single Express runtime with:

- auth middleware in `middleware/`
- business logic mostly in `application/`
- TypeORM repositories in `infrastructure/`
- entity schemas in `infra/db/entities/`
- the live authenticated todo routes registered directly in `backend/src/index.js`

Important consequence:

- the repo has useful use-case classes, but the actual HTTP surface is still assembled inside `index.js`
- there is **not** currently a clean exported backend service module or app factory for another process to import directly

### Practical integration implication

A separate MCP service **can** reuse existing backend behavior, but there is currently no polished shared package boundary for that reuse.

That makes these options rank as follows:

1. **Best:** MCP service calls bounded backend adapter routes over internal HTTP.
2. **Possible later:** extract a shared backend service factory for multi-runtime reuse.
3. **Do not recommend:** direct DB access from MCP.

## 2. Where task rules actually live

### Primary task business logic

Task behavior is split across:

- `CreateTodo`
- `UpdateTodo`
- `ToggleTodo`
- `DeleteTodo`
- `SearchTodos`
- `CompleteRecurringTodo`
- `RecurrenceService`
- `TypeORMTodoRepository`

### Where lifecycle semantics are enforced

The repo does **not** keep all task behavior in one layer.

Current truth:

- create/update/toggle/delete/search have application-service classes
- task numbering, archive behavior, filtering, pagination, export/stats helpers, and some meaningfully business-relevant logic live in `TypeORMTodoRepository`
- some HTTP-specific orchestration and action mapping still live inline in `backend/src/index.js`

### Recurrence truth

Recurrence behavior is already implemented and should be reused rather than rebuilt.

Current supported shapes:

- modern `mode`-based recurrence: `daily`, `dateRange`, `specificDays`
- legacy compatibility shapes using `type` and `interval`

Important current semantic details:

- `daily` expands into multiple persisted rows
- `specificDays` expands into matched weekdays within a range
- `dateRange` is a **single logical spanning task**, not an endless repeated series
- helper logic exists to create the next recurring occurrence on completion, but the main authenticated toggle path currently uses `ToggleTodo` and **does not universally create follow-on occurrences**

## 3. Is there already an API surface suitable for reuse?

### Yes, but only partially

The current authenticated todo API already covers:

- list active tasks
- create task
- update task
- search/filter with pagination
- toggle completion
- toggle flag
- delete to archive
- batch complete/uncomplete/delete
- lookup by stable per-user `taskNumber`

### Important mismatch for MCP use

The current public API is optimized for the main app and Auth0 bearer tokens.

It is **not** yet a clean machine-facing façade because:

- it assumes `checkJwt` + `attachCurrentUser`
- it has no direct machine auth path
- it has no direct `GET /api/todos/:id`
- single-item idempotent complete/uncomplete is exposed indirectly through batch or non-idempotent toggle semantics
- `archive` and `unarchive` currently call repository helpers **without passing `userId`**, which is unsafe to expose to MCP without fixing first

## 4. Current user-scoping guarantees and gaps

### Good current scoping

Most live todo operations correctly pass `req.currentUser.id` into use cases or repository methods.

That is true for:

- list
- create
- lookup by task number
- search
- reorder
- update
- toggle
- delete
- batch complete/uncomplete/delete

### Dangerous current gaps

These matter for MCP planning:

1. **Archive/unarchive scoping gap**
   - the live routes call `todoRepository.archive(id)` and `todoRepository.unarchive(id)` without `userId`
   - repository methods support `userId`, but the route does not pass it
   - result: this route shape is not safe to reuse as-is for MCP

2. **Auth0 role-claim namespace drift**
   - `attachCurrentUser` reads roles from `https://lifeline-api/roles`
   - `TypeORMUserRepository.ensureUserFromAuth0Claims()` reads roles from `https://lifeline.app/roles`
   - this is a future auth-hardening concern before adding more auth modes

3. **Unused legacy route/controller files are not trustworthy integration anchors**
   - they do not reflect the live authenticated runtime

---

## B. Deployment and operations truth

## 1. Current production shape

Production is currently:

`Internet -> Nginx on VPS -> lifeline-app on 127.0.0.1:3020 -> Express on 3000 -> lifeline-postgres on 5432`

The deploy branch workflow:

- packages the repo on pushes to `deploy`
- uploads a release archive to the VPS
- extracts into `/opt/lifeline/releases/<release-id>`
- repoints `/opt/lifeline/current`
- runs `docker compose -f compose.production.yaml up -d --build`
- verifies health and loopback-only binding

## 2. Where `lifeline-mcp` fits

The clean deployment fit is:

- add a new compose service: `lifeline-mcp`
- keep it in the same production compose file
- put it on the same default Docker network as `lifeline-app`
- let it call the backend internally at `http://lifeline-app:3000`

This is consistent with the repo's current service-to-service networking model, where `lifeline-app` already reaches `lifeline-postgres` by compose service name.

## 3. Public routing shape

The MCP service should not be placed behind the same browser SPA hostname/path unless there is a strong external constraint.

### Recommended hostname pattern

Preferred:

- `mcp.lifeline.a2z-us.com`

Acceptable fallback:

- `lifeline-mcp.a2z-us.com`

Reason:

- keeps MCP transport separate from the main SPA/API hostname
- makes Nginx routing and later OAuth callback handling easier
- avoids coupling MCP protocol concerns to the current `/` and `/api` browser surface

## 4. Secret and boundary implications

Later planning will need new runtime secrets/config for:

- MCP external auth config
- API key hashing/signing secrets or pepper
- internal MCP-to-backend trust secret if an internal adapter route is used
- later Auth0 OAuth client configuration for MCP

These should live in the shared production env file and deployment secret chain, not in source.

## 5. CI/CD and ops surfaces that would later change

Planning/implementation will likely need coordinated updates to:

- `compose.production.yaml`
- `compose.production.env.example`
- `deploy/nginx/`
- `deploy/scripts/apply-release.sh` verification expectations
- `.github/workflows/deploy-production.yml` failure diagnostics, if MCP logs should be captured
- likely `docs/operations/` and `docs/architecture/` after implementation

---

## C. Data and contract truth

## 1. Current task shape already available to reuse

Current task/domain fields already present in the backend include:

- `id`
- `userId`
- `taskNumber`
- `title`
- `description`
- `dueDate`
- `dueTime`
- `isCompleted`
- `isFlagged`
- `duration`
- `priority`
- `tags`
- `subtasks`
- `order`
- `recurrence`
- `nextRecurrenceDue`
- `originalId`
- `archived` (repository-augmented in some flows)

This is enough for an MCP task-management façade without adding new product fields.

## 2. Stable handle choice

The repo already treats `taskNumber` as a stable per-user human-facing identifier.

That makes it the best default MCP-facing handle for user interaction, even though backend write routes still execute by UUID `id`.

Recommended MCP behavior:

- return both `id` and `taskNumber`
- prefer `taskNumber` in user-facing tool parameters and responses
- internally resolve `taskNumber -> id` when needed

This avoids exposing raw UUIDs as the only practical handle.

## 3. Current support for “past tasks” behavior

### Already present

- `/api/todos/search` supports text search, status filter, date range, tag filter, duration filter, flag filter, pagination, and task-number-aware lookup
- repository search can include archived rows when a text query or task-number query is present

### Important caveat

There is **not** an existing first-class “similar past tasks” feature or ranking model.

That means:

- exact semantic parity for `find_similar_past_tasks` does not already exist as a backend concept
- a bounded v1 can still be built by combining existing search plus MCP-side ranking/selection logic
- if the product later wants deterministic similarity semantics, that should become a bounded backend feature rather than improvised in many clients

## 4. Today/upcoming behavior truth

The repo's current “today” and “tomorrow” behavior is partly client-derived.

Important detail:

- the frontend filters `/api/todos` results client-side for `today`, `tomorrow`, or a selected day
- it also contains special `dateRange` logic so a spanning task appears on every covered day

Implication:

- a pure `/api/todos/search?startDate=...&endDate=...` implementation will **not** exactly mirror the current app for `dateRange` tasks
- v1 MCP should either:
  - reuse `/api/todos` and apply the same date-aware filter logic in the MCP service, or
  - add a small backend adapter that centralizes this day-filter behavior

---

## D. Auth and security truth

## 1. Current main-app auth model

Current main-app auth is Auth0-backed.

### Frontend

The client uses `@auth0/auth0-react` and obtains access tokens via `getAccessTokenSilently()` with configured audience/scope.

### Backend

The backend uses:

- `express-oauth2-jwt-bearer` for JWT validation
- `attachCurrentUser` to upsert/load the user and attach `req.currentUser`
- `requireAuth()` to enforce authenticated access on protected routes

User identity is effectively anchored on Auth0 `sub`, which is also the persisted `users.id`.

## 2. What that means for MCP phase 1

The current backend does **not** support API-key-authenticated external clients.

Therefore, phase 1 needs a new auth mechanism.

### Recommended API key model

Use a **DB-backed hashed API key model**, not static env-configured per-user keys.

Reason:

- the service must map keys to Lifeline users
- keys need rotation, revocation, expiry, and auditability
- desktop/CLI usage implies multiple users over time, not one deploy-wide machine principal
- config-file key maps would become operational debt quickly and are weak for multi-user isolation

### Recommended API key record shape

A small new backend data model is justified here because API-key auth is a new capability.

Recommended fields:

- key id
- user id
- name/label
- key prefix
- hashed secret
- scopes
- status / revoked flag
- created at
- expires at
- last used at
- optional last used metadata

### Scope model for v1

Keep v1 scopes small and explicit:

- `tasks:read`
- `tasks:write`
- `tasks:delete`

Optional later:

- `tags:read`
- `tags:write`
- `stats:read`

## 3. How API keys should map to users

A key should map to exactly one Lifeline user and a bounded scope set.

Do **not** use shared admin-style keys for normal user task operations.

The MCP service should derive a single user principal from the API key and run every backend action under that user context.

## 4. Best auth evolution path

### Phase 1

- external clients authenticate to `lifeline-mcp` with API keys
- `lifeline-mcp` resolves that key to a Lifeline user principal
- `lifeline-mcp` calls a bounded internal backend adapter using service-to-service trust

### Phase 2

Add OAuth 2.0 / Auth0 support to `lifeline-mcp` **alongside** API keys.

Design principle:

- the MCP tool layer should operate on a normalized internal principal, regardless of whether that principal came from API key auth or Auth0 OAuth

That allows:

- API key auth for desktop/CLI agents now
- OAuth/Auth0 for later native ChatGPT app or browser-mediated clients
- dual-auth without redesigning every tool or handler

## 5. Why not make the main public backend API do everything immediately?

Because the repo currently proves:

- public API auth assumes Auth0 JWTs
- MCP needs machine auth now
- later OAuth for MCP may not match the main SPA token flow exactly

A dedicated MCP edge service is therefore the right place to normalize client auth.

## 6. Security risks planning must not ignore

1. archive/unarchive scoping must be fixed before exposure
2. toggle-based completion is non-idempotent; MCP write tools should prefer explicit complete/uncomplete semantics
3. API keys must be hashed, not stored in plaintext
4. internal MCP-to-backend calls must not rely on an unauthenticated trusted header alone
5. all write/delete actions must preserve per-user scoping all the way through repository calls

---

## E. MCP and client truth

## 1. Best transport/runtime fit

Because the service is VPS-hosted and intended for desktop/CLI clients now and ChatGPT-app compatibility later, the best fit is:

- a **remote HTTP MCP server**
- implemented in Node.js to match the repo's existing runtime and deployment conventions

A local stdio-only MCP server would not fit the stated hosting model.

## 2. Recommended v1 MCP tool surface

### Expose in v1

- `search_tasks`
- `get_task`
- `list_today`
- `list_upcoming`
- `create_task`
- `update_task`
- `complete_task`
- `uncomplete_task`
- `delete_task`

### Defer from v1

- archive/unarchive tools
- tag-management tools unless a concrete MCP consumer needs them immediately
- stats/export/import tools
- any AI-generated “smart planning” tools that invent new task semantics

## 3. Tool-surface design choice that keeps ChatGPT path open

Design the tools around a stable task resource and normalized auth principal, not around API-key-specific assumptions.

That means:

- auth is a transport/session concern
- tool names and arguments stay stable
- later OAuth support does not require renaming tools or reworking task contracts

## 4. Best external identifier strategy for MCP tools

Prefer `taskNumber` as the default user-facing lookup handle.

Reason:

- it is already stable and user-scoped in the backend
- it is more human-usable than UUIDs
- it reduces friction for desktop/CLI agents

The MCP service can still return UUID `id` for exact follow-up operations.

---

## Recommended deployment shape

## Service naming

Recommended compose service name:

- `lifeline-mcp`

Recommended container name:

- `lifeline-mcp`

## Internal network path

Recommended internal call path:

- `lifeline-mcp -> http://lifeline-app:3000`

## Public routing

Recommended external host:

- `mcp.lifeline.a2z-us.com`

## Reverse proxy shape

Recommended edge model:

- Nginx server block for MCP host
- proxy to host loopback binding for `lifeline-mcp`
- keep the service off the public Docker interface in the same style as `lifeline-app`

---

## Recommended auth architecture

## First phase

- client authenticates to `lifeline-mcp` with API key
- `lifeline-mcp` validates API key and resolves a Lifeline user principal
- `lifeline-mcp` calls a bounded internal backend adapter for task operations
- backend adapter invokes existing use cases/repository methods with explicit `userId`

## Future phase

- add Auth0/OAuth 2.0 acceptance at `lifeline-mcp`
- continue emitting the same normalized principal into the same tool handlers
- keep backend business behavior unchanged except for bounded adapter/auth support

This is the lowest-friction path to later dual-auth.

---

## Risks, unknowns, and blockers

## Risks already visible from repo truth

1. **Current public archive/unarchive routes are not safe to expose as-is**.
2. **Current completion route is toggle-oriented**, which is awkward for idempotent MCP actions.
3. **Role-claim namespace drift exists** and should be cleaned up before broader auth evolution.
4. **Today/upcoming semantics are partly client-side**, especially for `dateRange` tasks.
5. **There is no existing exact “similar past tasks” backend feature**.

## Unknowns planning must resolve

1. Should MCP v1 expose UUID `id`, `taskNumber`, or both as formal handles?
2. Should `find_similar_past_tasks` be a true v1 tool or deferred until bounded backend support is added?
3. Will OAuth/Auth0 for MCP later use a dedicated Auth0 application/client and audience, or share the current API audience model?
4. Should the backend adapter be mounted as private `/internal/mcp/*` routes or as another bounded internal mechanism?
5. What audit level is required for key usage, write actions, and destructive operations?

## Blockers to implementation planning

There are **no discovery blockers that prevent planning**, but there are two design decisions that planning should settle first:

1. the exact auth bridge between `lifeline-mcp` and the Lifeline backend
2. whether `find_similar_past_tasks` is in initial scope or deferred

---

## Explicit go-forward recommendation

### Recommendation

Proceed to a **bounded planning phase** for a separate Node-based `lifeline-mcp` service with:

- remote HTTP MCP transport
- API-key auth in v1
- future Auth0/OAuth support via a normalized principal layer
- internal HTTP calls to the existing Lifeline stack over Docker networking
- a small backend adapter surface that reuses existing task use cases/repository logic

### What planning should avoid

- direct Postgres access from MCP
- broad backend rewrites
- replacing current task lifecycle logic
- exposing unsafe archive/unarchive behavior before fixing scoping
- making toggle semantics the only completion contract for MCP

### Recommended next step

Create a planning package for:

1. target MCP service topology
2. exact auth model and key schema
3. backend adapter contract
4. v1 tool contracts and task handle strategy
5. bounded implementation sequence across backend, deployment, and ops docs
