# Todo Services and Use Cases

## Purpose

This document describes the backend services and use cases that implement todo behavior in Lifeline.

## Canonical sources used for this document

- [backend/src/application/CreateTodo.js](../../backend/src/application/CreateTodo.js)
- [backend/src/application/ListTodos.js](../../backend/src/application/ListTodos.js)
- [backend/src/application/UpdateTodo.js](../../backend/src/application/UpdateTodo.js)
- [backend/src/application/ToggleTodo.js](../../backend/src/application/ToggleTodo.js)
- [backend/src/application/DeleteTodo.js](../../backend/src/application/DeleteTodo.js)
- [backend/src/application/CompleteRecurringTodo.js](../../backend/src/application/CompleteRecurringTodo.js)
- [backend/src/application/RecurrenceService.js](../../backend/src/application/RecurrenceService.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/domain/Todo.js](../../backend/src/domain/Todo.js)
- [backend/src/index.js](../../backend/src/index.js)

## Service inventory

The todo runtime is centered around these application services:

- `CreateTodo`
- `ListTodos`
- `UpdateTodo`
- `ToggleTodo`
- `DeleteTodo`
- `CompleteRecurringTodo`
- `RecurrenceService`
- repository-driven helpers exposed through `TypeORMTodoRepository`

## `CreateTodo`

`CreateTodo` handles the most complex task creation path.

### Non-recurring creation

Without recurrence, it:

- asks the repository for the user's current maximum `taskNumber`
- assigns the next sequential number
- builds a `Todo` domain object
- saves it through the repository

### Recurrence-aware creation

With recurrence, it supports both:

- modern `mode`-based recurrence
- legacy `type`-based recurrence

Current behaviors:

- `daily` creates one task per day in range
- `dateRange` creates one logical spanning task
- `specificDays` creates tasks only for matching weekdays in range
- legacy `daily`, `weekly`, `monthly`, and `custom` types expand according to interval and optional end date

## `ListTodos`

`ListTodos` is intentionally thin.

It delegates to the repository's active-task listing behavior using the authenticated user's id.

## `UpdateTodo`

`UpdateTodo`:

- loads the todo by id and user id
- mutates supported fields in memory
- saves the updated todo through the repository

Mutable fields currently include:

- title
- priority
- due date
- due time
- tags
- flagged state
- duration
- subtasks
- description

## `ToggleTodo`

`ToggleTodo` toggles completion state for a user-owned todo.

The current implementation uses the user-scoped overload that:

- loads by `id` and `userId`
- flips completion
- saves through the repository

## `DeleteTodo`

`DeleteTodo` delegates to the repository delete behavior.

Important backend meaning:

- repository delete is archive-oriented rather than an immediate hard delete for normal task removal

## `CompleteRecurringTodo`

`CompleteRecurringTodo` exists to support recurrence-aware completion.

Current behavior:

- loads the task
- toggles completion
- saves the completed task
- if the task is recurring and now completed, attempts to create the next occurrence
- does **not** create a follow-on occurrence for `dateRange`

This service captures the main recurrence-completion rule that differs from simple toggle logic.

Important runtime caveat:

- the main authenticated route currently uses `ToggleTodo` for normal completion changes
- `CompleteRecurringTodo` documents available helper behavior, but it is not the universal live path for completion toggles today

## `RecurrenceService`

`RecurrenceService` provides reusable recurrence logic for:

- calculating the next due date
- generating the next occurrence payload
- rendering human-readable recurrence text
- converting weekday numbers into names

It understands both modern and legacy recurrence shapes.

## Repository responsibilities that matter to todo behavior

`TypeORMTodoRepository` is a major part of todo behavior, not just a storage adapter.

Important backend responsibilities include:

- mapping domain todo objects to TypeORM entities
- assigning `taskNumber` when needed
- loading tags for persistence
- filtering active versus archived tasks
- task-number lookup
- search with filters, sorting, and pagination
- archive and unarchive operations
- count queries used for free-tier limit enforcement
- export and statistics helpers

## Search-related repository behavior

The todo repository search flow supports:

- text search over title, description, and serialized subtasks
- task-number-aware search
- priority filtering
- status filtering
- date-range filtering
- duration-range filtering
- flagged filtering
- tag filtering
- multiple sort modes
- pagination through `limit` and `offset`

## Archive and active-task semantics

The repository currently distinguishes:

- active tasks
- archived tasks

Important rules:

- normal listing returns only non-archived tasks
- free-tier count enforcement counts non-archived tasks
- delete marks a task archived after clearing tag relationships on the persisted entity
- dedicated archive and unarchive helpers also exist

## Task numbering behavior

`taskNumber` is persisted as a user-scoped sequential number.

The repository supports:

- `getMaxTaskNumber(userId)`
- `findByTaskNumber(userId, taskNumber)`

That makes task numbering a backend-supported lookup primitive rather than a UI-only convenience.

## Related canonical documents

- [runtime-composition.md](runtime-composition.md)
- [tag-search-stats-and-data-transfer-services.md](tag-search-stats-and-data-transfer-services.md)
- [../api/todo-endpoints.md](../api/todo-endpoints.md)
- [../product/task-lifecycle.md](../product/task-lifecycle.md)
- [../product/recurrence-behavior.md](../product/recurrence-behavior.md)
