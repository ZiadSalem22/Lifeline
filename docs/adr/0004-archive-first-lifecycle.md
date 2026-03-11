# ADR 0004: Archive-first lifecycle for MCP task removal

## Status

Accepted

## Date

2026-03-11

## Context

The existing `delete_task` MCP tool performs a soft-delete that archives the task (sets `archived = true` and clears tags). However, there is no way to restore an archived task through MCP, and the tool name "delete" implies permanent destruction.

MCP agents occasionally archive tasks by mistake or at the user's request and then need to undo the action. Users also ask about previously archived tasks when planning new work, and agents need to be able to surface and restore them.

Additionally, mutation handlers (`updateTask`, `completeTask`, `uncompleteTask`) do not guard against operating on archived tasks, which could silently succeed on tasks the user considers removed.

## Decision

Adopt an archive-first lifecycle for task removal in the MCP surface:

1. **`archive_task`** — new canonical tool that sets `archived = true`. Replaces `delete_task` as the recommended removal tool. Non-destructive, reversible.
2. **`restore_task`** — new tool that sets `archived = false`, returning the task to the active set. Requires the task to currently be archived.
3. **`batch_restore`** — new batch tool that restores multiple tasks by task number.
4. **`delete_task`** — retained for backward compatibility but its description is updated to clarify it archives rather than destroys. The `destructiveHint` annotation remains `true`.

Mutation guards:
- `updateTask`, `completeTask`, and `uncompleteTask` handlers reject requests for archived tasks with a 409 Conflict response and a message directing the agent to restore first.
- `deleteTask` (archive) is idempotent — archiving an already-archived task is a no-op success.

Backend changes:
- A new `POST /internal/mcp/tasks/:id/restore` route calls `todoRepository.unarchive`.
- The `batchAction` handler gains a `'restore'` action.
- Read handlers continue to exclude archived tasks by default; `search_tasks` gains an `includeArchived` filter for explicit access.

## Consequences

### Positive

- Agents can undo accidental archives without user intervention.
- The lifecycle model is explicit: active → archived → restored, with no ambiguity.
- Mutation guards prevent silent writes to archived tasks.

### Tradeoffs

- Two additional MCP tools (`archive_task`, `restore_task`) expand the tool surface.
- Existing agent sessions that rely on `delete_task` continue to work but may see updated descriptions.
- The 409 guard on archived-task mutations is a new error path that agents must handle.
