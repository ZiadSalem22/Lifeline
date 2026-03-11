# Subtask Operations

## Purpose

This document describes the subtask identity contract and the application-layer subtask operations available in Lifeline.

## Canonical sources used for this document

- [backend/src/domain/SubtaskContract.js](../../backend/src/domain/SubtaskContract.js)
- [backend/src/application/SubtaskOperations.js](../../backend/src/application/SubtaskOperations.js)
- [backend/src/internal/mcp/subtaskHandlers.js](../../backend/src/internal/mcp/subtaskHandlers.js)
- [backend/src/internal/mcp/subtaskRouter.js](../../backend/src/internal/mcp/subtaskRouter.js)
- [backend/src/domain/Todo.js](../../backend/src/domain/Todo.js)
- [docs/adr/0003-subtask-identity-contract.md](../../docs/adr/0003-subtask-identity-contract.md)

## Subtask identity contract

### Background

Subtasks are embedded as a JSONB array inside `todos.subtasks`. Before the identity contract, subtasks had no stable identifier — agents and clients could only reference subtasks by array index, which is fragile across concurrent edits.

### Contract shape

Every subtask now carries:

| Field | Type | Description |
| --- | --- | --- |
| `subtaskId` | UUID string | Stable unique identifier. Auto-generated if missing. |
| `title` | string | Required, max 500 characters, trimmed. |
| `isCompleted` | boolean | Defaults to `false`. |
| `position` | integer | 1-based sequential position, auto-assigned by normalization. |

### Normalization behavior

`normalizeSubtasks(array)` enforces:

- Maximum 50 subtasks per task
- Each element must be a non-null object
- Missing `subtaskId` values receive a new `crypto.randomUUID()`
- Positions are re-sequenced to a contiguous 1-based series
- Title is trimmed and validated for length

Normalization runs automatically:

- On `Todo` domain construction
- On `UpdateTodo` when subtasks are modified
- On every `SubtaskOperations` mutation

### Validation helper

`isValidSubtaskId(value)` checks that a string matches the standard UUID format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). All subtask mutation operations validate the `subtaskId` parameter before proceeding.

## SubtaskOperations service

`SubtaskOperations` is the application-layer service for granular subtask mutations. It is injected with a `todoRepository` and exposed through the internal MCP subtask router.

### Archive guard

All operations first load the parent task and check its `archived` flag. If the task is archived, the operation throws a `ValidationError` instructing the caller to restore the task first.

### Available operations

#### `addSubtask(userId, taskId, { title })`

Appends a new subtask to the parent task's subtask array. The new subtask receives a UUID `subtaskId` and is positioned after existing subtasks. Returns the updated task.

#### `completeSubtask(userId, taskId, subtaskId)`

Sets `isCompleted: true` for the subtask identified by `subtaskId`. Throws `NotFoundError` if the subtask does not exist in the array.

#### `uncompleteSubtask(userId, taskId, subtaskId)`

Sets `isCompleted: false` for the identified subtask.

#### `updateSubtask(userId, taskId, subtaskId, updates)`

Updates the title and/or completion state of the identified subtask. Title is trimmed and validated for non-emptiness.

#### `removeSubtask(userId, taskId, subtaskId)`

Removes the identified subtask from the array. Remaining subtasks are re-normalized with updated positions.

### Error behavior

| Error | Condition |
| --- | --- |
| `ValidationError` | Invalid subtaskId format, empty title, archived parent task |
| `NotFoundError` | Parent task not found or subtask not found in array |

## Integration path

The subtask operations flow through:

1. MCP tool invocation (e.g., `add_subtask`)
2. MCP service calls `internalBackendClient` method
3. Backend subtask router receives the HTTP request
4. Subtask handler resolves the parent task and delegates to `SubtaskOperations`
5. `SubtaskOperations` mutates the subtask array and saves through the repository
6. Normalization runs on save, ensuring consistent identity and positions

## Related canonical documents

- [todo-services-and-use-cases.md](todo-services-and-use-cases.md)
- [../api/internal-mcp-task-endpoints.md](../api/internal-mcp-task-endpoints.md)
- [../data-model/subtask-contract.md](../data-model/subtask-contract.md)
- [../adr/0003-subtask-identity-contract.md](../adr/0003-subtask-identity-contract.md)
