# Internal MCP Task Endpoints

## Purpose

This document describes the internal backend endpoints consumed by the MCP service for task operations introduced in the step-09 everyday-task-fluency initiative. These endpoints extend the existing internal MCP adapter surface.

## Canonical sources used for this document

- [backend/src/internal/mcp/taskReadRouter.js](../../backend/src/internal/mcp/taskReadRouter.js)
- [backend/src/internal/mcp/taskWriteRouter.js](../../backend/src/internal/mcp/taskWriteRouter.js)
- [backend/src/internal/mcp/subtaskRouter.js](../../backend/src/internal/mcp/subtaskRouter.js)
- [backend/src/internal/mcp/taskReadHandlers.js](../../backend/src/internal/mcp/taskReadHandlers.js)
- [backend/src/internal/mcp/taskWriteHandlers.js](../../backend/src/internal/mcp/taskWriteHandlers.js)
- [backend/src/internal/mcp/subtaskHandlers.js](../../backend/src/internal/mcp/subtaskHandlers.js)
- [backend/src/internal/mcp/taskDateFilters.js](../../backend/src/internal/mcp/taskDateFilters.js)

## Authentication

All internal MCP endpoints require two layers of authentication:

1. Service-level shared secret via `requireInternalServiceAuth()`
2. Per-request principal identity via `requireInternalMcpPrincipal()`

The principal's `userId` is extracted from `req.mcpPrincipal` for all data-scoped operations.

## Window query endpoints

### `GET /internal/mcp/tasks/window/:windowToken`

Lists tasks that fall within a resolved date window.

#### Supported window tokens

| Token | Resolution |
| --- | --- |
| `this_week` | Start to end of the current calendar week |
| `next_week` | Start to end of the following calendar week |
| `this_month` | First to last day of the current month |
| `next_month` | First to last day of the following month |
| `overdue` | All tasks with due dates before today |
| `YYYY-MM` | First to last day of the specified month |

Week boundaries respect the user's `startDayOfWeek` preference when available.

#### Query parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `includeCompleted` | boolean | `false` | When `true`, includes completed tasks in the results |

#### Responses

| Status | Meaning |
| --- | --- |
| `200` | Tasks matching the window, with resolved `start` and `end` dates in the response |
| `400` | Invalid window token |

#### Response shape

```json
{
  "tasks": [ ... ],
  "windowStart": "YYYY-MM-DD",
  "windowEnd": "YYYY-MM-DD",
  "windowToken": "this_week"
}
```

## Similarity search endpoint

### `GET /internal/mcp/tasks/similar`

Finds tasks with titles similar to the provided query using PostgreSQL `pg_trgm` trigram similarity.

#### Query parameters

| Parameter | Type | Default | Constraints | Description |
| --- | --- | --- | --- | --- |
| `title` | string | required | non-empty | Title text to search against |
| `limit` | integer | `5` | 1–20 | Maximum number of results |
| `threshold` | number | `0.3` | 0.1–1.0 | Minimum similarity score |

#### Responses

| Status | Meaning |
| --- | --- |
| `200` | Array of similar tasks with similarity scores |
| `400` | Missing or invalid `title` parameter |

## Archive lifecycle endpoints

### `POST /internal/mcp/tasks/:id/restore`

Restores an archived task back to active status.

#### Responses

| Status | Meaning |
| --- | --- |
| `200` | Task restored successfully |
| `404` | Task not found |

### Mutation guards on archived tasks

The following write endpoints return `409 TASK_ARCHIVED` when the target task is archived:

- `PATCH /internal/mcp/tasks/:id` (update)
- `POST /internal/mcp/tasks/:id/complete`
- `POST /internal/mcp/tasks/:id/uncomplete`

The guard message instructs the caller to restore the task first.

### Optimistic concurrency

`PATCH /internal/mcp/tasks/:id` accepts an optional `If-Match` header or `expectedUpdatedAt` body field. When provided and the task's `updatedAt` does not match, the endpoint returns `409 STALE_UPDATE`.

## Subtask endpoints

All subtask routes are mounted under `/internal/mcp/tasks/:taskId/subtasks`.

### `POST /internal/mcp/tasks/:taskId/subtasks`

Adds a new subtask to the parent task.

#### Request body

```json
{
  "title": "Subtask title"
}
```

#### Responses

| Status | Meaning |
| --- | --- |
| `201` | Subtask added, returns updated task |
| `400` | Missing or empty title |
| `404` | Parent task not found |
| `409` | Parent task is archived |

### `POST /internal/mcp/tasks/:taskId/subtasks/:subtaskId/complete`

Marks a subtask as completed.

#### Responses

| Status | Meaning |
| --- | --- |
| `200` | Subtask completed, returns updated task |
| `404` | Task or subtask not found |
| `409` | Parent task is archived |

### `POST /internal/mcp/tasks/:taskId/subtasks/:subtaskId/uncomplete`

Marks a subtask as not completed.

#### Responses

| Status | Meaning |
| --- | --- |
| `200` | Subtask uncompleted, returns updated task |
| `404` | Task or subtask not found |
| `409` | Parent task is archived |

### `PATCH /internal/mcp/tasks/:taskId/subtasks/:subtaskId`

Updates a subtask's title or completion state.

#### Request body

```json
{
  "title": "Updated title"
}
```

#### Responses

| Status | Meaning |
| --- | --- |
| `200` | Subtask updated, returns updated task |
| `400` | Empty title or invalid subtaskId |
| `404` | Task or subtask not found |
| `409` | Parent task is archived |

### `DELETE /internal/mcp/tasks/:taskId/subtasks/:subtaskId`

Removes a subtask from the parent task.

#### Responses

| Status | Meaning |
| --- | --- |
| `200` | Subtask removed, returns `{ removed: true }` and updated task |
| `404` | Task or subtask not found |
| `409` | Parent task is archived |

## Batch operations update

`POST /internal/mcp/tasks/batch` now supports a `restore` action in addition to existing `archive`, `complete`, and `uncomplete` actions.

Archive guards apply to `complete` and `uncomplete` actions within a batch. Archived tasks in those actions are skipped with an error entry in the response.

## Search filter additions

`GET /internal/mcp/tasks/search` now accepts:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `includeArchived` | boolean | `false` | When `true`, includes archived tasks in search results |

## Response payload additions

All task payloads now include:

- `createdAt` — task creation timestamp
- `updatedAt` — last modification timestamp

These fields support optimistic concurrency and audit trail visibility.

## Related canonical documents

- [mcp-server-endpoints-and-auth.md](mcp-server-endpoints-and-auth.md)
- [todo-endpoints.md](todo-endpoints.md)
- [validation-auth-and-error-behavior.md](validation-auth-and-error-behavior.md)
- [../backend/subtask-operations.md](../backend/subtask-operations.md)
- [../backend/similarity-search.md](../backend/similarity-search.md)
