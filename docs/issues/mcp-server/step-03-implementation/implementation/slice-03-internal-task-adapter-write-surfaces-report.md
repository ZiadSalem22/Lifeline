# Lifeline MCP Step-03 Implementation — Slice 03 Report

## Slice

`step-03 implementation, slice-03: internal task adapter write surfaces`

## Scope completed

This slice implemented the bounded backend-internal write adapter surfaces needed for later MCP v1 write tools.

Implemented scope:

- private internal write routes under `/internal/mcp/tasks/*`
- internal create adapter support
- internal exact-id update adapter support
- explicit idempotent complete/uncomplete adapter support
- internal archive-oriented delete adapter support
- small application-layer helpers for internal create policy and explicit completion semantics
- explicit write-field restrictions for internal update behavior
- focused route and behavior tests for the new internal write surfaces

Out of scope and intentionally not implemented here:

- separate `lifeline-mcp` service
- external MCP transport/runtime
- `taskNumber`-selector write routes
- archive/unarchive MCP tools
- API key issuance/management flows
- OAuth/Auth0 for MCP clients
- tag-management MCP tools
- `find_similar_past_tasks`

---

## Code changes made

## 1. Internal task write route surface

Added bounded internal write routes under the existing `/internal/mcp/tasks` surface:

- `POST /internal/mcp/tasks`
- `PATCH /internal/mcp/tasks/:id`
- `POST /internal/mcp/tasks/:id/complete`
- `POST /internal/mcp/tasks/:id/uncomplete`
- `DELETE /internal/mcp/tasks/:id`

These routes remain behind:

- internal shared-secret service authentication
- explicit normalized principal enforcement

## 2. Internal create adapter

Added backend-internal create handling that reuses existing Lifeline creation behavior via the existing `CreateTodo` use case.

To preserve current create semantics without moving business policy into the route/handler layer, this slice added a small application-layer wrapper:

- `CreateTodoForInternalMcp`

This wrapper:

- resolves the current user record
- preserves the current free-tier max-task check
- delegates to existing `CreateTodo`
- preserves current recurrence and task-number creation behavior

## 3. Internal update adapter

Added exact UUID-targeted internal update handling.

Behavior:

- validates the target task as user-owned before mutation
- reuses existing `UpdateTodo` behavior
- only allows the bounded mutable fields already supported by the current backend update path:
  - `title`
  - `description`
  - `dueDate`
  - `dueTime`
  - `tags`
  - `isFlagged`
  - `duration`
  - `priority`
  - `subtasks`

This slice intentionally rejects unsupported internal update fields explicitly instead of silently ignoring them.

## 4. Explicit complete/uncomplete semantics

Added dedicated internal completion routes and a small application-layer helper:

- `SetTodoCompletion`

This use case:

- resolves the task within explicit user scope
- sets the completion state explicitly
- preserves idempotent behavior by returning early when the task is already in the requested state
- avoids exposing raw toggle semantics as the MCP-facing internal contract

This slice chose the small dedicated single-item service path rather than tunneling through toggle behavior.

## 5. Internal delete adapter

Added exact UUID-targeted internal delete support that reuses existing archive-oriented delete behavior.

The internal delete result is explicit about semantics:

- `deleted: true`
- `deleteMode: archived`

This makes it clear that the current backend behavior is active-set removal backed by archival behavior, not guaranteed physical erasure.

## 6. Shared write-side helper refinements

Reused and extended the existing internal MCP helper structure by:

- continuing to use the existing exact task-resolution helper for user-owned lookups
- reusing normalized internal task payload mapping from slice 02
- adding explicit internal update-field validation for a safer write contract

---

## Important files touched

### Backend code

- `backend/src/application/CreateTodoForInternalMcp.js`
- `backend/src/application/SetTodoCompletion.js`
- `backend/src/internal/mcp/router.js`
- `backend/src/internal/mcp/taskWriteRouter.js`
- `backend/src/internal/mcp/taskWriteHandlers.js`

### Existing shared helpers reused/touched in behavior

- `backend/src/internal/mcp/taskResolution.js`
- `backend/src/internal/mcp/taskPayloads.js`

### Tests

- `backend/test/internal/internalMcpTaskWriteRoutes.test.js`

---

## Validation performed

## Focused route and behavior validation

Executed focused backend tests covering:

- rejection of missing internal service auth on write routes
- rejection of invalid internal service auth on write routes
- rejection of missing internal principal context on write routes
- create remaining user-scoped and preserving free-tier and recurrence-aware create delegation behavior
- update remaining exact-targeted and user-scoped
- explicit rejection of unsupported internal update fields
- explicit idempotent complete behavior
- explicit idempotent uncomplete behavior
- archive-oriented delete result behavior
- prior MCP internal auth/read tests remaining green
- adjacent public todo regression coverage remaining green

Command executed from `backend/`:

`npm test -- --runInBand test/internal/internalMcpRoutes.test.js test/internal/internalMcpTaskReadRoutes.test.js test/internal/internalMcpTaskWriteRoutes.test.js test/internal/mcpPrincipal.test.js test/internal/mcpApiKeyScaffold.test.js test/auth/auth0Claims.test.js test/routes/archive_unarchive.test.js test/middleware/attachCurrentUser.test.js test/routes/todosByNumber.test.js`

Result:

- **9/9 test suites passed**
- **37/37 tests passed**

## Diagnostics

Checked modified source/test files for errors.

Result:

- no file-level diagnostics remained in edited files

## Lint gate note

Per repo-native backend/code-quality workflow, the backend lint gate was checked.

Command executed:

`npm run lint`

Result:

- the backend package currently has **no `lint` script**
- lint validation is therefore not currently available as a runnable repo command for this package

Because of that repo-state limitation, slice validation relied on:

- focused automated tests
- editor diagnostics
- governance-guided review

---

## Governance usage note

This slice was implemented through the repo-native governance stack, not outside it.

Materially used governance layers:

- **backend engineering governance**
  - guided route thinness, use-case placement, explicit user scoping, and exact-target mutation behavior
  - directly influenced the decision to move the free-tier create rule into `CreateTodoForInternalMcp` instead of leaving it in the internal handler
  - directly influenced the use of a dedicated `SetTodoCompletion` use case instead of exposing toggle semantics

- **code-quality governance**
  - guided focused file responsibilities and reuse of narrow internal helpers instead of building a generic abstraction framework
  - directly influenced explicit unsupported-field rejection for internal updates rather than silently dropping fields

- **refactor governance**
  - used in bounded preparatory form only
  - this slice preserved behavior while introducing two small application-layer helpers and avoided broader architectural refactoring

- **documentation governance**
  - used to route the implementation artifact into the scoped non-root path for this initiative and phase
  - canonical docs were intentionally deferred because these are backend-internal adapter routes, not public API contract changes

- **repo-native builder/reviewer pattern**
  - backend builder guidance informed where new write behavior should live
  - backend review guidance was explicitly applied after implementation
  - post-implementation backend review outcome for this slice was effectively **Approve**, with only a low-severity note about validator/handler drift to watch in later slices

## Canonical docs note

No canonical `docs/api/` update was made in this slice because:

- these endpoints are internal adapter routes only
- no public API contract changed
- it is more correct to defer durable backend/architecture documentation until the internal MCP surface is more complete

---

## Slice result

This slice established the backend-internal write adapter surface needed for future MCP v1 write tools without implementing the external MCP service.

The backend now has:

- internal create support reusing existing Lifeline creation behavior
- exact user-scoped internal update support
- explicit idempotent complete/uncomplete support
- explicit archive-oriented internal delete behavior
- application-layer helpers for create policy and explicit completion semantics
- focused regression coverage across internal auth, read, and write MCP routes

---

## Recommended next slice

`step-03 implementation, slice-04: lifeline-mcp service scaffold`

Recommended focus:

- create the separate `lifeline-mcp` service workspace structure
- add remote HTTP MCP transport scaffold
- add API-key auth resolution over the existing DB-backed key scaffolding
- add backend adapter client calls into the now-established internal read/write routes
- keep the service thin and principal-driven
