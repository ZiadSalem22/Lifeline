# Todo Endpoints

## Purpose

This document describes the current authenticated todo endpoint group, including create, search, batch operations, task-number lookup, completion, archive, and deletion behavior.

## Canonical sources used for this document

- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/middleware/validateTodo.js](../../backend/src/middleware/validateTodo.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/application/CreateTodo.js](../../backend/src/application/CreateTodo.js)
- [backend/src/application/UpdateTodo.js](../../backend/src/application/UpdateTodo.js)

## Auth expectation

All todo endpoints documented here use `requireAuth()`.

In current backend behavior, callers should expect a `401` response if they are not authenticated.

## Endpoint summary

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/todos` | `GET` | List active todos for the current user |
| `/api/todos` | `POST` | Create a todo |
| `/api/todos/by-number/:taskNumber` | `GET` | Look up a todo by per-user task number |
| `/api/todos/batch` | `POST` | Batch delete or completion update |
| `/api/todos/:id/reorder` | `PATCH` | Update display order |
| `/api/todos/:id` | `PATCH` | Update a todo |
| `/api/todos/search` | `GET` | Search todos with filters and pagination |
| `/api/todos/:id/toggle` | `PATCH` | Toggle completion |
| `/api/todos/:id/flag` | `PATCH` | Toggle flagged state |
| `/api/todos/:id` | `DELETE` | Remove a todo from the active set |
| `/api/todos/:id/archive` | `POST` | Archive a todo explicitly |
| `/api/todos/:id/unarchive` | `POST` | Unarchive a todo |

## `GET /api/todos`

Returns the active non-archived todo list for the current user.

The current route delegates to `ListTodos`, which in turn relies on repository active-task listing.

## `POST /api/todos`

### Request fields

The creation route accepts fields such as:

- `title`
- `dueDate`
- `tags`
- `isFlagged`
- `duration`
- `priority`
- `dueTime`
- `subtasks`
- `description`
- `recurrence`

### Important current behavior

- request body is validated by `validateTodoCreate`
- free-tier authenticated users are blocked at 200 active non-archived tasks
- successful creation returns the created todo object
- recurrence can cause one logical create request to generate multiple persisted tasks depending on the recurrence mode

## `GET /api/todos/by-number/:taskNumber`

### Purpose

Looks up a task by user-scoped `taskNumber`.

### Current error behavior

- invalid or non-positive task number -> `400`
- missing task -> `404`
- missing authenticated user -> `401`

## `POST /api/todos/batch`

### Purpose

Performs batch actions across selected todo ids.

### Current supported actions

- `delete`
- `complete`
- `uncomplete`

### Request shape

The request body must include:

- `action`
- `ids` as an array of UUIDs

### Current response

Returns a summary containing:

- `action`
- `ids`
- `deleted`
- `updated`

## `PATCH /api/todos/:id/reorder`

Updates the `order` field used for display ordering.

Current behavior:

- loads the todo by id and current user
- returns `404` when not found
- persists the new `order` value

## `PATCH /api/todos/:id`

Updates an existing todo.

### Current validation

`validateTodoUpdate` allows updates for fields such as:

- title
- description
- dueDate
- recurrence
- tags
- isFlagged
- duration
- priority
- dueTime
- subtasks

### Current response

Returns the updated todo object.

## `GET /api/todos/search`

### Purpose

Provides paginated todo search and filtering.

### Current query parameters

The handler currently supports:

- `q`
- `tags`
- `tag`
- `priority`
- `status`
- `startDate`
- `endDate`
- `dueDateFrom`
- `dueDateTo`
- `minDuration`
- `maxDuration`
- `flagged`
- `sortBy`
- `taskNumber`
- `page`
- `limit`
- `pageSize`

### Current response shape

Returns an object with:

- `todos`
- `total`
- `page`
- `limit`

## `PATCH /api/todos/:id/toggle`

Toggles completion state for a user-owned todo.

If the todo does not exist for that user, the route returns `404`.

## `PATCH /api/todos/:id/flag`

Toggles the todo's flagged state and returns the updated todo.

## `DELETE /api/todos/:id`

### Important contract note

The route returns `204`, but the repository's current backend behavior is archive-oriented rather than immediate hard deletion.

API consumers should therefore interpret this as removal from the active working set, not necessarily physical row deletion.

## `POST /api/todos/:id/archive` and `POST /api/todos/:id/unarchive`

These routes return small archived-state payloads such as:

- `{ id, archived: true }`
- `{ id, archived: false }`

They support explicit soft-delete lifecycle management.

## Related canonical documents

- [validation-auth-and-error-behavior.md](validation-auth-and-error-behavior.md)
- [tag-endpoints.md](tag-endpoints.md)
- [../backend/todo-services-and-use-cases.md](../backend/todo-services-and-use-cases.md)
- [../product/task-lifecycle.md](../product/task-lifecycle.md)
