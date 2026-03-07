# Lifeline MCP Step-03 Implementation — Slice 02 Report

## Slice

`step-03 implementation, slice-02: internal task adapter read surfaces`

## Scope completed

This slice implemented the bounded backend-internal read adapter surfaces needed for later MCP v1 read tools.

Implemented scope:

- private internal read routes under `/internal/mcp/tasks/*`
- explicit internal principal validation for adapter routes
- user-scoped internal search adapter support
- user-scoped exact `taskNumber` lookup support
- backend-centralized day-listing support with `dateRange` inclusion parity
- deterministic upcoming-list support
- bounded read-side task-resolution helper groundwork for later write slices
- focused route and behavior tests for the new internal surfaces

Out of scope and intentionally not implemented here:

- separate `lifeline-mcp` service
- external MCP transport/runtime
- write adapter routes
- API key issuance/management flows
- archive/unarchive MCP exposure
- `find_similar_past_tasks`

---

## Code changes made

## 1. Internal task read route surface

Extended the internal MCP router to mount a dedicated internal task read router under:

- `GET /internal/mcp/tasks/search`
- `GET /internal/mcp/tasks/by-number/:taskNumber`
- `GET /internal/mcp/tasks/day/:dateToken`
- `GET /internal/mcp/tasks/upcoming`

The health route remains service-auth only, while task routes now also require explicit principal context.

## 2. Explicit internal principal validation

Added bounded internal principal middleware that:

- resolves the normalized MCP principal from internal headers
- rejects requests that have service auth but no Lifeline user context
- attaches `req.mcpPrincipal` for internal adapter handlers

This preserves the slice-01 principle that service authentication alone is not enough to authorize user-scoped task access.

## 3. `search_tasks` internal adapter

Added internal search handling that:

- reuses existing `SearchTodos` behavior
- maps internal query input to the current backend filter model
- keeps pagination deterministic
- preserves user scoping through `req.mcpPrincipal.lifelineUserId`

Supported filters in this slice:

- `query`
- `tags`
- `priority`
- `status`
- `startDate`
- `endDate`
- `flagged`
- `minDuration`
- `maxDuration`
- `sortBy`
- `page`
- `limit`
- `taskNumber`

Response shape is intentionally bounded for later MCP reuse:

- `tasks`
- `total`
- `page`
- `limit`

## 4. `get_task` internal adapter

Added exact user-scoped lookup by `taskNumber`.

Behavior:

- `taskNumber` is validated as a positive integer
- lookup is executed only within the explicit Lifeline user scope
- result returns a single normalized task payload
- missing task returns a clear `404`

## 5. Day-listing adapter with `dateRange` parity

Added backend-centralized day-list support using a concrete `dateToken` convention:

- `today`
- `tomorrow`
- explicit `YYYY-MM-DD`

This slice intentionally centralized the current client-derived `dateRange` inclusion rule so spanning tasks are included when the requested day falls within the configured range.

That reduces later MCP parity risk instead of pretending generic search already matches current app behavior.

## 6. Deterministic upcoming-list adapter

Added a bounded upcoming-list implementation that:

- executes within explicit user scope
- excludes unscheduled tasks
- excludes completed tasks
- includes in-progress `dateRange` tasks when their end date is still current/future
- sorts deterministically by:
  1. effective upcoming date ascending
  2. `order` ascending
  3. `taskNumber` ascending

The response also makes these semantics explicit with:

- `fromDate`
- `includesUnscheduled: false`
- `ordering: effectiveDateAsc,orderAsc,taskNumberAsc`
- `count`

## 7. Read-side handle resolution groundwork

Added a small reusable task-resolution helper for internal use that already supports:

- `taskNumber`
- optional UUID `id`

This slice only uses the `taskNumber` path directly, but the helper is bounded and reusable for later write slices without introducing fuzzy selection behavior.

---

## Important files touched

### Backend code

- `backend/src/internal/mcp/router.js`
- `backend/src/internal/mcp/principalMiddleware.js`
- `backend/src/internal/mcp/taskReadRouter.js`
- `backend/src/internal/mcp/taskReadHandlers.js`
- `backend/src/internal/mcp/taskDateFilters.js`
- `backend/src/internal/mcp/taskPayloads.js`
- `backend/src/internal/mcp/taskResolution.js`

### Tests

- `backend/test/internal/internalMcpTaskReadRoutes.test.js`

---

## Validation performed

## Focused route validation

Executed focused backend tests covering:

- rejection of missing internal service auth
- rejection of missing internal user principal context
- user-scoped internal search behavior
- exact per-user `taskNumber` lookup
- day-list `dateRange` inclusion behavior
- deterministic upcoming ordering and unscheduled-task exclusion
- adjacent regression coverage for prior MCP/auth foundation and existing public todo paths

Command executed from `backend/` shell context:

`npm test -- --runInBand test/internal/internalMcpRoutes.test.js test/internal/internalMcpTaskReadRoutes.test.js test/internal/mcpPrincipal.test.js test/internal/mcpApiKeyScaffold.test.js test/auth/auth0Claims.test.js test/routes/archive_unarchive.test.js test/middleware/attachCurrentUser.test.js test/routes/todosByNumber.test.js`

Result:

- **8/8 test suites passed**
- **26/26 tests passed**

## Editor diagnostics

Checked modified source/test files for errors.

Result:

- no file-level errors reported in edited files

---

## Parity and tradeoff notes

## Day-listing

This slice intentionally moved `dateRange` day inclusion into backend-internal helper logic so later MCP readers do not need to guess at client-only parity behavior.

## Upcoming behavior

This slice chose the smallest deterministic upcoming behavior that is safe and explainable:

- unscheduled tasks are excluded
- completed tasks are excluded
- ongoing `dateRange` tasks are included

That is a bounded implementation choice for MCP-facing upcoming reads and should be preserved or explicitly revised in later slices rather than allowed to drift implicitly.

## Documentation impact

No canonical public API docs were updated in this slice because the new endpoints are backend-internal adapter routes only.

Canonical backend/architecture documentation can be updated later once the broader MCP internal surface is more complete.

---

## Slice result

This slice established the backend-internal read adapter surface needed for future MCP v1 read tools without implementing the external MCP service.

The backend now has:

- explicit internal principal enforcement for task adapter routes
- internal user-scoped search support
- exact internal `taskNumber` read lookup
- backend-centralized day/date-range parity handling
- deterministic upcoming-list behavior
- reusable read-side task resolution groundwork

---

## Recommended next slice

`step-03 implementation, slice-03: internal task adapter write surfaces`

Recommended focus:

- `POST /internal/mcp/tasks`
- `PATCH /internal/mcp/tasks/:id`
- explicit `complete` / `uncomplete` internal routes
- `DELETE /internal/mcp/tasks/:id`
- reuse of the new read-side resolution helper for exact task targeting
