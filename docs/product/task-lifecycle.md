# Task Lifecycle

## Purpose

This document defines the canonical product lifecycle of a task in Lifeline, from creation through update, completion, archival behavior, searchability, and account reset.

## Canonical sources used for this document

- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx)
- [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js)
- [backend/src/application/CreateTodo.js](../../backend/src/application/CreateTodo.js)
- [backend/src/application/UpdateTodo.js](../../backend/src/application/UpdateTodo.js)
- [backend/src/application/CompleteRecurringTodo.js](../../backend/src/application/CompleteRecurringTodo.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/domain/Todo.js](../../backend/src/domain/Todo.js)
- [backend/src/index.js](../../backend/src/index.js)

## Lifecycle states

A task moves through these practical product states:

1. created
2. active
3. optionally edited repeatedly
4. optionally flagged or reprioritized
5. optionally completed
6. optionally archived
7. optionally surfaced again through unarchive flows or historical export

The product does not expose a separate project or workspace lifecycle for tasks. The task itself is the main lifecycle unit.

## Creation

### Required input

The only hard user-facing requirement for creation is a non-empty title.

### Optional fields captured at creation time

A task may also include:

- due date
- due time
- tags
- flagged state
- duration
- priority
- subtasks
- description
- recurrence

### Task numbering

On creation, a task receives a user-scoped sequential `taskNumber`.

Important behavior:

- authenticated mode assigns the next server-side per-user number
- guest mode computes the next number from locally stored tasks
- the number is intended to remain stable for the life of the task
- new tasks increment the sequence rather than filling holes from archived or deleted items

### Template loading

The create flow also supports loading an existing task by `taskNumber` to prefill a new draft.

When a task is loaded as a template:

- title, description, tags, flag state, priority, subtasks, and duration can be copied into the create form
- due time is explicitly reset
- recurrence is explicitly reset
- scheduled date is explicitly cleared so the new task is treated as a fresh item

## Active state

Once created, a task is active until it is archived.

Active tasks participate in:

- day-based filtering
- search
- sorting
- statistics
- tagging
- export
- normal dashboard display

Authenticated free-tier task limits are enforced against active non-archived tasks, not against archived ones.

## Editing

The live implementation allows updating an existing task's mutable fields.

Editable product fields include:

- title
- description
- due date
- due time
- tags
- flagged state
- duration
- subtasks
- priority

The task's identity and `taskNumber` are not product-editable fields.

## Completion

### Standard completion behavior

Completion toggles the task between incomplete and complete.

User-visible consequences include:

- the task remains part of the task set
- statistics can count it as completed
- the dashboard can still display it, typically after incomplete tasks

### Recurring-task completion behavior

Completion is more nuanced for recurring tasks:

- the codebase includes recurrence-completion helper logic that can create a follow-on occurrence
- when that helper logic is used, subtasks for the new occurrence are reset to incomplete state
- the next occurrence depends on the recurrence pattern
- the main authenticated toggle flow currently persists the completion change without universally generating the next occurrence automatically
- `dateRange` recurrence is special and does not create a next generated occurrence when helper-driven recurrence completion runs

This distinction is important enough that recurrence-specific behavior is documented separately in [recurrence-behavior.md](recurrence-behavior.md).

## Flagging and priority changes

A task can be emphasized without changing its completion state.

The product supports:

- toggling a flagged state
- setting priority to `low`, `medium`, or `high`

These are orthogonal to completion. A task can be flagged and completed, or high-priority and still incomplete.

## Search and lookup state

Tasks remain searchable by more than just title.

Search-related product behavior includes:

- text search against title and description
- task-number-aware search behavior
- advanced filtering by tag, priority, status, date range, and duration in authenticated search flows

The `taskNumber` therefore participates in the lifecycle as a long-lived reference handle, not just as display metadata.

## Deletion and archival behavior

### Product meaning

From a user perspective, removing a task from the active workspace behaves like deletion.

### Backend implementation truth

In authenticated mode, repository-level delete behavior archives the task instead of hard-deleting it immediately.

That means:

- the task is removed from active lists
- the task no longer counts as an active task for free-tier limits
- the record can still exist in persistence and export contexts depending on the flow used

### Explicit archive and unarchive flows

The backend also has dedicated archive and unarchive behavior.

So the canonical product model is:

- active tasks are the normal working set
- archived tasks are intentionally out of the active working set
- unarchive can restore a task to active visibility where supported by the application flow

### Archive-first lifecycle in MCP

Through the MCP agent interface, archive is the primary removal action:

- `archive_task` marks a task as archived
- `restore_task` brings an archived task back to active status
- `batch_restore` restores multiple archived tasks at once
- `delete_task` is deprecated in favor of `archive_task` and retained only for backward compatibility
- Mutations (update, complete, uncomplete) on archived tasks are blocked with a `409 TASK_ARCHIVED` response — the agent must restore the task first

This archive-first model is formalized in [ADR 0004](../adr/0004-archive-first-lifecycle.md).

### Hard deletion context

The product does have true destructive deletion in account reset workflows, where user-scoped data is removed in bulk.

That is distinct from day-to-day task removal.

## Ordering and display order

Tasks also carry ordering information used for drag-and-drop reorder behavior.

This ordering affects how tasks appear in the UI, but it is a presentation concern layered on top of the lifecycle rather than a separate lifecycle state.

## Reset and transfer scenarios

### Export

Tasks can be exported in authenticated mode to:

- JSON
- CSV

Export includes task details such as tags, subtasks, recurrence, and summary statistics.

### Import

Authenticated users can import tasks using:

- merge mode
- replace mode

Import is a lifecycle re-entry path for tasks because it can add back task data that originated elsewhere.

### Reset account

Authenticated reset-account behavior deletes:

- todos
- custom tags
- saved user settings

This is the strongest destructive account-level lifecycle event.

## Lifecycle rules that other docs should preserve

- creation requires a title but supports rich optional metadata
- `taskNumber` is immutable product identity metadata for lookup purposes
- completion and archival are distinct concepts
- recurrence-completion helper logic can generate the next occurrence, but the main toggle flow does not universally do so today
- authenticated delete behavior is archive-oriented in normal flows
- account reset is separate from normal task removal

## Related canonical documents

- [core-product-concepts.md](core-product-concepts.md)
- [recurrence-behavior.md](recurrence-behavior.md)
- [../frontend/dashboard-and-day-routing.md](../frontend/dashboard-and-day-routing.md)
- [../backend/todo-services-and-use-cases.md](../backend/todo-services-and-use-cases.md)
- [../api/todo-endpoints.md](../api/todo-endpoints.md)
