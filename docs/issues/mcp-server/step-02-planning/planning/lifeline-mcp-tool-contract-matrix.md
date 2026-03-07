# Lifeline MCP v1 Tool Contract Matrix

## Purpose

This artifact defines the planned MCP tool contracts for Lifeline MCP v1.

It is intentionally bounded to the approved v1 tool surface and preserves the current Lifeline backend as the source of truth for task behavior.

---

## Contract conventions

### Identity fields

Planned task outputs should include:

- `id` — UUID internal identifier
- `taskNumber` — preferred user-facing handle

### Common task output shape

Recommended core output fields:

- `id`
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
- `recurrence`
- `originalId`
- `archived` when meaningful to the result

### Handle rules

- read tools should prefer `taskNumber`
- write tools may accept `taskNumber` and/or `id`
- writes must resolve to exactly one user-owned task before execution

---

# In-v1 tools

## 1. `search_tasks`

### Purpose

Search and filter the current user's tasks using existing Lifeline search behavior.

### Recommended inputs

- `query` optional string
- `tags` optional array
- `priority` optional enum
- `status` optional enum (`active`, `completed`)
- `startDate` optional date
- `endDate` optional date
- `flagged` optional boolean
- `minDuration` optional integer
- `maxDuration` optional integer
- `sortBy` optional enum
- `page` optional integer
- `limit` optional integer
- `taskNumber` optional integer

### Recommended outputs

- `tasks` array of normalized task objects
- `total`
- `page`
- `limit`

### Handle behavior

- supports `taskNumber` as an exact narrowing filter
- returns both `taskNumber` and `id`

### Reuse classification

Direct reuse of backend search behavior through internal adapter.

---

## 2. `get_task`

### Purpose

Return one user-owned task by stable handle.

### Recommended inputs

Primary v1 input:

- `taskNumber` required integer

Optional later input:

- `id` optional UUID, if implementation chooses to support it early

### Recommended outputs

- one normalized task object

### Handle behavior

- `taskNumber` is the preferred contract
- if optional `id` support exists, mixed-handle ambiguity must fail explicitly

### Reuse classification

Reuses user-scoped task-number lookup with bounded adapter support.

---

## 3. `list_today`

### Purpose

Return the current user's tasks for today using Lifeline-compatible day semantics.

### Recommended inputs

- none, or optional `timezone` only if implementation later needs it

### Recommended outputs

- `tasks` array
- optional `dateToken` = `today`

### Handle behavior

- returns both `taskNumber` and `id`

### Semantics note

Must preserve current `dateRange` inclusion behavior.

### Reuse classification

Needs adapter logic or backend helper logic beyond plain `/api/todos/search`.

---

## 4. `list_upcoming`

### Purpose

Return upcoming user-owned tasks from the active set.

### Recommended inputs

- optional `limit`
- optional `fromDate`

### Recommended outputs

- `tasks` array
- optional `count`

### Handle behavior

- returns both `taskNumber` and `id`

### Semantics note

Implementation must document ordering and treatment of unscheduled tasks.

### Reuse classification

Needs bounded adapter logic.

---

## 5. `create_task`

### Purpose

Create a new task using existing Lifeline creation logic.

### Recommended inputs

- `title` required
- `description` optional
- `dueDate` optional
- `dueTime` optional
- `tags` optional array
- `isFlagged` optional boolean
- `duration` optional integer
- `priority` optional enum
- `subtasks` optional array
- `recurrence` optional object

### Recommended outputs

- created normalized task object

### Handle behavior

- returns generated `taskNumber` and `id`

### Reuse classification

Direct reuse of `CreateTodo` plus existing recurrence/task-number behavior.

---

## 6. `update_task`

### Purpose

Update mutable fields on one user-owned task.

### Recommended inputs

Selector:

- `taskNumber` preferred, or `id`

Updates object containing bounded mutable fields:

- `title`
- `description`
- `dueDate`
- `dueTime`
- `tags`
- `isFlagged`
- `duration`
- `priority`
- `subtasks`

### Recommended outputs

- updated normalized task object

### Handle behavior

- selector resolves to UUID before write
- no fuzzy updates

### Reuse classification

Direct reuse of `UpdateTodo` with handle-resolution adapter logic.

---

## 7. `complete_task`

### Purpose

Mark one user-owned task complete using explicit semantics.

### Recommended inputs

Selector:

- `taskNumber` preferred, or `id`

### Recommended outputs

- updated normalized task object
- optional `completed: true`

### Handle behavior

- resolve handle first, then execute explicit completion path

### Semantics note

The MCP contract must be idempotent. It must not expose raw toggle behavior.

### Reuse classification

Requires bounded adapter work over current batch or toggle behavior.

---

## 8. `uncomplete_task`

### Purpose

Mark one user-owned task incomplete using explicit semantics.

### Recommended inputs

Selector:

- `taskNumber` preferred, or `id`

### Recommended outputs

- updated normalized task object
- optional `completed: false`

### Handle behavior

- same safe resolution rules as `complete_task`

### Reuse classification

Requires bounded adapter work over current batch or toggle behavior.

---

## 9. `delete_task`

### Purpose

Remove one task from the active set.

### Recommended inputs

Selector:

- `taskNumber` preferred, or `id`

### Recommended outputs

- result object with:
  - `id`
  - `taskNumber` if known
  - `deleted: true`
  - `deleteMode: archived`

### Handle behavior

- no fuzzy delete
- must resolve exactly one task first

### Semantics note

The tool description should explicitly state that current Lifeline behavior is archive-oriented active-set removal, not guaranteed physical deletion.

### Reuse classification

Direct reuse of current delete behavior plus handle-resolution adapter logic.

---

# Deferred tools

## `find_similar_past_tasks`

### Status

Deferred from v1.

### Reason

No first-class backend similarity semantics exist yet.

### Future path

Can later be implemented as:

- MCP-side approximation using search + ranking, or
- bounded backend feature support

## `archive_task` / `unarchive_task`

### Status

Deferred and blocked.

### Reason

Known current scoping risk in live archive/unarchive route behavior.

## Tag/stat/export/import tools

### Status

Deferred.

### Reason

Not required for the first bounded MCP task-management release.

---

# Out-of-scope rules

The following must remain out of scope for v1:

- direct DB access
- guessed or fuzzy destructive writes
- bulk account reset or admin tools
- any tool that depends on unsafe archive/unarchive behavior
- any tool contract that is tightly coupled to API-key-only auth semantics

---

# Recommended implementation notes

1. implement read tools before write tools
2. keep all tool handlers principal-driven, not auth-mechanism-driven
3. keep task handle resolution centralized
4. standardize errors for:
   - not found
   - ambiguous selector
   - forbidden by scope
   - invalid input
   - internal adapter failure
