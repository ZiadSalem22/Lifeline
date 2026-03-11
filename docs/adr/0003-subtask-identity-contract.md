# ADR 0003: Subtask identity contract

## Status

Accepted

## Date

2026-03-11

## Context

Subtasks in Lifeline are stored as a JSONB array inside the `todos.subtasks` column. The existing shape is `{ id, title, isCompleted }` where `id` is an opaque string with no guaranteed stability or uniqueness. MCP tool agents need to reference individual subtasks for targeted mutations (complete a specific subtask, reorder, remove) without replacing the entire array.

The frontend currently treats subtask identity casually — whole-array replacement on every save. MCP agents require a stable, collision-free identifier so that concurrent read-then-mutate cycles do not corrupt subtask state.

## Decision

Each subtask carries two identity fields:

- **`subtaskId`** — a stable UUID (v4) assigned at creation time. Once set, it is immutable. Existing subtasks missing `subtaskId` receive one during a one-time backfill migration.
- **`position`** — a 1-based integer reflecting the display order within the parent task. Adjusted automatically when subtasks are added, removed, or reordered.

The canonical subtask shape is:

```json
{
  "subtaskId": "uuid-v4",
  "title": "string",
  "isCompleted": false,
  "position": 1
}
```

Normalization rules:
- On write, any subtask missing `subtaskId` receives a freshly generated UUID.
- On write, `position` values are re-sequenced to be a contiguous 1-based series.
- The legacy `id` field is preserved if present but is not used for identity by the MCP layer.
- `title` is required and must be a non-empty string (max 500 characters).

Validation is enforced at the domain layer (`SubtaskContract`) and applied in both the internal MCP adapter and the frontend API middleware.

## Consequences

### Positive

- MCP agents can target individual subtasks by `subtaskId` for complete, update, and remove operations.
- Subtask ordering is explicit and deterministic.
- The migration is backward-compatible — existing data gains identity without breaking the frontend.

### Tradeoffs

- A one-time JSONB backfill migration is required for existing data.
- The `subtasks` column grows slightly per subtask (one UUID string + one integer).
- Frontend code that does whole-array replacement continues to work but must preserve `subtaskId` values.
