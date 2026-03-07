# Lifeline MCP Backend Capability Mapping

## Purpose

This artifact maps proposed MCP task tools to the current Lifeline backend surfaces and classifies each tool as:

- **Ready to reuse**
- **Reusable with small adapter work**
- **Missing bounded backend support**

This mapping is grounded in the current live runtime, not the unused route/controller prototype files.

## Source surfaces reviewed

- `backend/src/index.js`
- `backend/src/application/CreateTodo.js`
- `backend/src/application/ListTodos.js`
- `backend/src/application/UpdateTodo.js`
- `backend/src/application/ToggleTodo.js`
- `backend/src/application/SearchTodos.js`
- `backend/src/application/DeleteTodo.js`
- `backend/src/application/CompleteRecurringTodo.js`
- `backend/src/application/RecurrenceService.js`
- `backend/src/infrastructure/TypeORMTodoRepository.js`
- `backend/src/middleware/validateTodo.js`
- `client/src/providers/TodoProvider.jsx`
- `client/src/utils/api.js`
- `docs/api/todo-endpoints.md`
- `docs/backend/todo-services-and-use-cases.md`
- `docs/product/task-lifecycle.md`
- `docs/product/recurrence-behavior.md`

---

## Summary table

| Proposed MCP tool | Current backend surface | Classification | Notes |
| --- | --- | --- | --- |
| `search_tasks` | `GET /api/todos/search`, `SearchTodos`, `TypeORMTodoRepository.findByFilters()` | Ready to reuse | Strongest direct match. Already supports text, tags, priority, status, date range, duration, flag, pagination, and task number lookup. |
| `get_task` | `GET /api/todos/by-number/:taskNumber`, repository `findByTaskNumber()` | Reusable with small adapter work | Best if MCP treats `taskNumber` as the primary external handle. There is no live `GET /api/todos/:id`. |
| `list_today` | `GET /api/todos`, `ListTodos`, client-side day filtering in `TodoProvider` | Reusable with small adapter work | Current day semantics are partly client-side, especially for `dateRange` recurrence. MCP should mirror current filter logic or add a bounded backend day-filter adapter. |
| `list_upcoming` | `GET /api/todos`, optional `GET /api/todos/search` | Reusable with small adapter work | Can be built from active-task listing plus MCP-side date filtering. Exact dateRange parity is not already centralized in backend search. |
| `find_similar_past_tasks` | `GET /api/todos/search`, repository search/filter support | Reusable with small adapter work, but semantic gap exists | No first-class similarity feature exists. V1 can approximate with search + past-date filtering + MCP-side ranking. Exact similarity semantics would be a new bounded backend feature. |
| `create_task` | `POST /api/todos`, `CreateTodo`, `validateTodoCreate` | Ready to reuse | Reuses existing creation, task numbering, recurrence expansion, and free-tier enforcement. |
| `update_task` | `PATCH /api/todos/:id`, `UpdateTodo`, `validateTodoUpdate` | Ready to reuse | Good direct match for bounded field updates. |
| `complete_task` | `POST /api/todos/batch` with `action=complete`; alternatively `PATCH /api/todos/:id/toggle` | Reusable with small adapter work | Prefer explicit complete semantics through batch with one id. Avoid exposing raw toggle as the main MCP contract. |
| `uncomplete_task` | `POST /api/todos/batch` with `action=uncomplete`; alternatively `PATCH /api/todos/:id/toggle` | Reusable with small adapter work | Same reasoning as `complete_task`. |
| `delete_task` | `DELETE /api/todos/:id`, `DeleteTodo`, repository `delete()` | Ready to reuse | Current behavior is archive-oriented removal from active set, not immediate hard delete. |

---

## Detailed mapping

## 1. `search_tasks`

### Current reusable surfaces

- `GET /api/todos/search`
- `SearchTodos.execute(userId, filters)`
- `TypeORMTodoRepository.findByFilters()`

### Existing supported filters

- text query `q`
- `tags`
- `priority`
- `status`
- `startDate`
- `endDate`
- `minDuration`
- `maxDuration`
- `flagged`
- `sortBy`
- `taskNumber`
- pagination (`page`, `limit`)

### Classification

**Ready to reuse**

### MCP note

This should be the backbone for search-oriented MCP operations.

---

## 2. `get_task`

### Current reusable surfaces

- `GET /api/todos/by-number/:taskNumber`
- repository `findByTaskNumber(userId, taskNumber)`

### Missing current surface

- no live `GET /api/todos/:id`

### Classification

**Reusable with small adapter work**

### MCP recommendation

Use `taskNumber` as the default public lookup handle.

If MCP accepts UUID `id` as input too, planning should add a bounded backend lookup route rather than forcing list-and-filter hacks.

---

## 3. `list_today`

### Current reusable surfaces

- `GET /api/todos`
- `ListTodos.execute(userId)`
- frontend day-filter logic in `client/src/providers/TodoProvider.jsx`

### Important semantic detail

Current app behavior includes special handling for `dateRange` tasks so they appear on covered days even if the stored `dueDate` is the range start.

### Classification

**Reusable with small adapter work**

### MCP recommendation

For exact current behavior, v1 should either:

- fetch active tasks and apply the same date-aware filter logic in `lifeline-mcp`, or
- add one bounded backend adapter endpoint for day-specific listing

---

## 4. `list_upcoming`

### Current reusable surfaces

- `GET /api/todos`
- `GET /api/todos/search`

### Current gap

There is no first-class backend “upcoming” endpoint or canonical upcoming sort/filter contract.

### Classification

**Reusable with small adapter work**

### MCP recommendation

Compute upcoming from active tasks using date filtering in the MCP layer first. Add backend support only if pagination/scale or recurrence parity makes that necessary.

---

## 5. `find_similar_past_tasks`

### Current reusable surfaces

- `GET /api/todos/search`
- repository text search over title, description, and serialized subtasks
- date-range filters
- status filters

### Current semantic gap

The repo has no explicit similarity service, no relevance model, and no dedicated past-task helper.

### Classification

**Reusable with small adapter work, but semantic gap exists**

### MCP recommendation

Possible v1 approach:

1. run search against title/description text
2. filter to due dates before today and optionally completed status
3. rank/select in MCP service using a simple deterministic heuristic

If the product later depends on this heavily, move it into a bounded backend feature.

---

## 6. `create_task`

### Current reusable surfaces

- `POST /api/todos`
- `validateTodoCreate`
- `CreateTodo.execute(...)`
- repository `getMaxTaskNumber()` and `save()`

### Behavior already reused automatically

- per-user task numbering
- recurrence expansion
- priority, due time, subtasks, description support
- free-tier active-task limit check

### Classification

**Ready to reuse**

---

## 7. `update_task`

### Current reusable surfaces

- `PATCH /api/todos/:id`
- `validateTodoUpdate`
- `UpdateTodo.execute(userId, id, updates)`

### Current supported mutable fields

- `title`
- `description`
- `dueDate`
- `dueTime`
- `tags`
- `isFlagged`
- `duration`
- `priority`
- `subtasks`

### Classification

**Ready to reuse**

### MCP note

If recurrence updates are allowed in MCP, planning should verify the current backend mutation semantics are acceptable and documented.

---

## 8. `complete_task`

### Current reusable surfaces

- `POST /api/todos/batch` with `action=complete`
- `PATCH /api/todos/:id/toggle`

### Important behavior detail

`toggle` is not idempotent. Batch `complete` is explicit and safer for MCP.

### Classification

**Reusable with small adapter work**

### MCP recommendation

Use batch complete for idempotent semantics, even for single-task operations.

---

## 9. `uncomplete_task`

### Current reusable surfaces

- `POST /api/todos/batch` with `action=uncomplete`
- `PATCH /api/todos/:id/toggle`

### Classification

**Reusable with small adapter work**

### MCP recommendation

Same as `complete_task`: prefer explicit batch action rather than toggle.

---

## 10. `delete_task`

### Current reusable surfaces

- `DELETE /api/todos/:id`
- `DeleteTodo.execute(userId, id)`
- repository `delete(id, userId)`

### Important current behavior

Delete is archive-oriented:

- task leaves the active set
- tag relations are cleared
- row is not immediately hard-deleted in normal flows

### Classification

**Ready to reuse**

### MCP note

Tool descriptions should describe this as removal from the active working set, not guaranteed physical erasure.

---

## Surfaces that should not be treated as v1-ready

## `archive_task` / `unarchive_task`

### Why not ready

The live routes currently call repository methods without passing `userId`.

### Planning implication

Do not expose these until user scoping is corrected.

## Direct shared-library reuse from `backend/src/routes` and `backend/src/controllers`

### Why not ready

These files are not wired into the live authenticated runtime.

### Planning implication

Target the live runtime in `backend/src/index.js` and the use-case/repository layer underneath it.

---

## Recommended v1 handle strategy

To minimize new backend work while preserving good MCP ergonomics:

1. return both `taskNumber` and `id`
2. let read-oriented tool inputs prefer `taskNumber`
3. resolve to UUID internally for update/delete/complete flows

This is the cleanest way to reuse what the repo already has.

---

## Recommended implementation sequence implied by this mapping

1. define MCP tool contracts around existing task fields and `taskNumber`
2. decide the internal auth bridge between `lifeline-mcp` and backend
3. reuse current search/create/update/delete flows first
4. expose explicit complete/uncomplete using batch semantics
5. either mirror current client day-filter logic in MCP or add a bounded backend day-filter adapter
6. defer archive/unarchive until user-scoping is fixed
7. defer exact similarity semantics unless a concrete consumer requires them in v1
