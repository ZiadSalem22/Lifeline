# Recurrence, Subtasks, and Task Numbering

## Purpose

This document describes how Lifeline persists recurring-task metadata, embedded subtasks, recurring lineage, and per-user task numbering.

## Canonical sources used for this document

- [backend/src/infra/db/entities/TodoEntity.js](../../backend/src/infra/db/entities/TodoEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/application/CreateTodo.js](../../backend/src/application/CreateTodo.js)
- [backend/src/application/RecurrenceService.js](../../backend/src/application/RecurrenceService.js)
- [backend/src/application/CompleteRecurringTodo.js](../../backend/src/application/CompleteRecurringTodo.js)
- [backend/src/domain/Todo.js](../../backend/src/domain/Todo.js)
- [backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js](../../backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js)
- [backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js](../../backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js)

## Recurrence persistence model

Recurring-task state is stored inside the `todos` table rather than in a separate recurrence table.

The relevant columns are:

- `recurrence` as `jsonb`
- `next_recurrence_due` as optional `timestamptz`
- `original_id` as an optional self-reference to another todo row

## `recurrence` JSON shape

The schema enforces that `recurrence` is either:

- `NULL`, or
- a JSON object

The database does not impose a more detailed JSON schema than that. The exact payload shape is controlled by application logic.

### Current modern shapes

Current UI-backed recurrence modes persist JSON objects using `mode`-oriented shapes such as:

- `mode: 'daily'`
- `mode: 'dateRange'`
- `mode: 'specificDays'`

These may also carry fields such as:

- `startDate`
- `endDate`
- `selectedDays`

### Legacy accepted shapes

The backend still accepts legacy recurrence payloads that use `type` and `interval`, including:

- `type: 'daily'`
- `type: 'weekly'`
- `type: 'monthly'`
- `type: 'custom'`

That compatibility matters because historical data and import flows may still contain those shapes.

## How recurrence affects row creation

The current persistence behavior is row-based, not template-only.

### Non-recurring tasks

A normal task creates one `todos` row.

### `daily` mode

The create use case expands the date range and persists one `todos` row per day.

### `specificDays` mode

The create use case expands the selected-day pattern across the range and persists one `todos` row per matched day.

### `dateRange` mode

The create use case persists a single logical todo row anchored to the range start, with the range semantics preserved inside the `recurrence` JSON.

### Legacy interval-based modes

The create use case expands dates by interval and persists one row per generated occurrence.

## Completion-time recurrence behavior

The current persisted schema supports recurring lineage through `original_id`, and the codebase contains a `CompleteRecurringTodo` helper that can create a follow-up occurrence row.

However, the main authenticated toggle flow currently uses `ToggleTodo`, which only toggles and saves the existing row.

That means the live runtime should not be documented as universally generating a new occurrence row on completion.

The safe current statement is:

- the schema supports recurring follow-up rows
- helper logic exists for that pattern
- the main toggle path currently persists the updated row without automatically creating the next row

## `original_id` lineage rule

`original_id` creates a self-referential lineage chain within `todos`.

The active schema uses:

- foreign key `original_id -> todos.id`
- `ON DELETE SET NULL`

This means a recurring child can keep lineage when the original exists, but the database will null out the reference if the original row disappears.

## Subtasks persistence model

Subtasks are embedded directly inside `todos.subtasks` as JSON rather than normalized into a separate table.

### Current shape

The domain and application layers treat subtasks as an array of objects with fields such as:

- `id`
- `title`
- `isCompleted`

### Constraint

The active schema only enforces that `subtasks` is a JSON array. It does not enforce the internal structure of each element.

### Recurrence interaction

When recurrence logic creates the next occurrence from an existing task, it clones the subtask objects and resets each subtask completion state to `false`, assigning fresh subtask ids.

## Task numbering model

`task_number` is the per-user sequential task identifier surfaced to users as the stable task number.

### Persistence guarantees

The active schema enforces:

- `task_number` is required
- `task_number` must be positive
- `(user_id, task_number)` must be unique

### Assignment behavior

The repository and create use case assign task numbers by:

1. querying the current max task number for the user
2. incrementing it
3. saving the new row with that number

This makes numbering user-scoped, increasing, and intended to be immutable once assigned.

### Ordering distinction

`task_number` is not the same as `order`.

- `task_number` is the persistent human-facing identity number
- `order` is the mutable UI ordering field used for presentation and drag/drop-like ordering semantics

## Historical task-number migrations

The archived migrations show that task numbering was introduced after earlier schemas existed without it.

Those migrations:

- added the `task_number` column
- backfilled per-user sequences
- fixed rows where `task_number` remained null

That history matters because older artifacts may describe todo rows without task numbers, but the current live schema requires them.

## Related canonical documents

- [todos-tags-and-relationships.md](todos-tags-and-relationships.md)
- [migrations-and-historical-schema-context.md](migrations-and-historical-schema-context.md)
- [../product/task-lifecycle.md](../product/task-lifecycle.md)
- [../product/recurrence-behavior.md](../product/recurrence-behavior.md)
