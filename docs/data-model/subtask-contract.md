# Subtask Contract — Data Model

## Purpose

This document describes the JSONB shape evolution of the `todos.subtasks` column as formalized by the subtask identity contract.

## Canonical sources used for this document

- [backend/src/domain/SubtaskContract.js](../../backend/src/domain/SubtaskContract.js)
- [backend/migrations/007_backfill_subtask_identity.sql](../../backend/migrations/007_backfill_subtask_identity.sql)
- [backend/src/middleware/validateTodo.js](../../backend/src/middleware/validateTodo.js)
- [docs/adr/0003-subtask-identity-contract.md](../../docs/adr/0003-subtask-identity-contract.md)

## Storage

Subtasks are stored as a JSONB array in the `todos.subtasks` column. There is no separate subtasks table.

## Shape evolution

### Pre-contract shape (legacy)

```json
[
  { "id": "<any-string-or-number>", "title": "...", "isCompleted": false }
]
```

Legacy subtasks had:

- An `id` field with no guaranteed format (could be numeric, short string, or absent)
- No `subtaskId` UUID
- No `position` field
- No enforced max count or title length

### Post-contract shape (current)

```json
[
  {
    "subtaskId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001",
    "title": "Subtask title",
    "isCompleted": false,
    "position": 1
  }
]
```

Current subtasks have:

| Field | Type | Source | Description |
| --- | --- | --- | --- |
| `subtaskId` | UUID string | Auto-generated or preserved | Stable unique identifier |
| `title` | string (1–500 chars) | Required | Trimmed, validated |
| `isCompleted` | boolean | Defaults `false` | Completion state |
| `position` | integer (1-based) | Auto-assigned | Contiguous sequence |

The legacy `id` field is preserved when present but is not used for identity. `subtaskId` is the canonical identifier.

## Migration 007: Backfill

Migration `007_backfill_subtask_identity.sql` is a PL/pgSQL `DO` block that:

1. Iterates all rows in `todos` where `subtasks` is a non-empty JSONB array
2. For each subtask element, adds `subtaskId` (via `gen_random_uuid()`) and `position` (1-based index)
3. Updates the row in place

This is an idempotent, backward-compatible backfill. It does not remove any existing fields.

## Migration 008: pg_trgm index

Migration `008_enable_pg_trgm_similarity.sql` adds:

- The `pg_trgm` PostgreSQL extension
- A GiST index on `todos.title` for trigram similarity queries

This migration supports the similarity search feature but does not affect the subtask JSONB shape.

## Validation enforcement

The Joi schemas in `validateTodo.js` enforce the subtask shape on both CREATE and UPDATE paths:

- `subtaskId`: optional UUID string
- `title`: required string, max 500 characters
- `isCompleted`: optional boolean
- `position`: optional integer
- Maximum 50 subtasks per task

## Constraints summary

| Constraint | Value | Enforced by |
| --- | --- | --- |
| Max subtasks per task | 50 | `SubtaskContract.js`, `validateTodo.js` |
| Max title length | 500 characters | `SubtaskContract.js`, `validateTodo.js` |
| subtaskId format | UUID v4 | `SubtaskContract.js` |
| Position | 1-based contiguous | `SubtaskContract.js` normalization |

## Related canonical documents

- [recurrence-subtasks-and-task-numbering.md](recurrence-subtasks-and-task-numbering.md)
- [todos-tags-and-relationships.md](todos-tags-and-relationships.md)
- [migrations-and-historical-schema-context.md](migrations-and-historical-schema-context.md)
- [../backend/subtask-operations.md](../backend/subtask-operations.md)
- [../adr/0003-subtask-identity-contract.md](../adr/0003-subtask-identity-contract.md)
