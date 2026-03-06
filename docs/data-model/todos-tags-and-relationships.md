# Todos, Tags, and Relationships

## Purpose

This document describes the core persisted task model, the tag model, and the ownership and join rules that connect them.

## Canonical sources used for this document

- [backend/src/infra/db/entities/TodoEntity.js](../../backend/src/infra/db/entities/TodoEntity.js)
- [backend/src/infra/db/entities/TagEntity.js](../../backend/src/infra/db/entities/TagEntity.js)
- [backend/src/infra/db/entities/TodoTagEntity.js](../../backend/src/infra/db/entities/TodoTagEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/infrastructure/TypeORMTagRepository.js](../../backend/src/infrastructure/TypeORMTagRepository.js)
- [backend/src/infra/db/defaultTags.js](../../backend/src/infra/db/defaultTags.js)

## `todos` table

### Role

`todos` is the primary persisted work-item table for authenticated mode.

Each row represents one task occurrence, including normal one-off tasks and individual persisted records created from recurrence logic.

### Current ownership rule

Every todo row belongs to exactly one user through `todos.user_id`.

The active migration enforces this with a foreign key to `users(id)` and cascade behavior on user deletion.

### Main columns

| Column | Meaning |
| --- | --- |
| `id` | Primary key. Text UUID-like identifier in current runtime usage. |
| `user_id` | Owning authenticated user id. |
| `task_number` | Per-user sequential human-facing task number. |
| `title` | Required task title. |
| `description` | Optional longer task description. |
| `due_date` | Optional due date stored as `timestamptz`. |
| `due_time` | Optional time-of-day string. |
| `is_completed` | Completion flag. |
| `is_flagged` | Flag/attention marker. |
| `duration` | Numeric duration estimate or tracked minutes value. |
| `priority` | `low`, `medium`, or `high`. |
| `subtasks` | JSON array representing embedded subtasks. |
| `order` | Numeric ordering field used by the UI. |
| `recurrence` | Optional JSON object representing recurrence rules. |
| `next_recurrence_due` | Optional next-occurrence date field. |
| `original_id` | Optional pointer to the source/original recurring task chain. |
| `archived` | Archive marker used instead of destructive delete semantics in normal flows. |
| `created_at` / `updated_at` | Timestamps. |

### Runtime query shape

The repository layer usually treats `archived = false` todos as the active task set, while export/statistics and selected admin-like operations can include archived rows.

### Important constraints and indexes

The active migration enforces:

- non-blank ids
- non-blank titles
- `task_number > 0`
- `duration >= 0`
- priority limited to `low`, `medium`, `high`
- `subtasks` must be a JSON array
- `recurrence` must be either a JSON object or `NULL`
- uniqueness of `(user_id, task_number)`

The schema also adds indexes for:

- active/completed filtering by user
- due date lookups
- flagged filtering
- next recurrence lookups
- original-id lookups
- GIN search support on `subtasks` and `recurrence`

## `tags` table

### Role

`tags` stores both:

- global default tags
- user-owned custom tags

### Current ownership model

The current schema intentionally supports two tag ownership modes.

#### Default tags

Default tags are seeded once and have:

- `is_default = true`
- `user_id IS NULL`

#### Custom tags

Custom tags belong to a specific user and have:

- `is_default = false`
- `user_id = <owning user id>`

### Current constraint that protects the split

The active migration enforces:

- `(is_default = true AND user_id IS NULL)` or
- `(is_default = false AND user_id IS NOT NULL)`

This is the key persistence rule that keeps shared default tags separate from per-user custom tags.

### Main columns

| Column | Meaning |
| --- | --- |
| `id` | Primary key. |
| `name` | Tag label. |
| `color` | Tag color string. |
| `user_id` | Owning user for custom tags, otherwise `NULL`. |
| `is_default` | Whether the row is one of the global seeded defaults. |
| `created_at` / `updated_at` | Timestamps. |

### Uniqueness rules

The active schema enforces:

- unique default-tag names globally for `is_default = true` rows
- unique custom-tag names per user for `is_default = false` rows

Both rules are case-insensitive through lowercased unique indexes.

### Default-tag seeding

The current migration seeds ten default tags from [backend/src/infra/db/defaultTags.js](../../backend/src/infra/db/defaultTags.js):

- Work
- Personal
- Health
- Finance
- Study
- Family
- Errands
- Ideas
- Important
- Misc

The repository layer prevents mutation or deletion of default tags through normal API-backed operations.

## `todo_tags` join table

### Role

`todo_tags` is the explicit many-to-many bridge between todos and tags.

### Current structure

- composite primary key: `(todo_id, tag_id)`
- foreign key `todo_id -> todos.id`
- foreign key `tag_id -> tags.id`
- cascade delete on both sides

This means removing a todo or tag automatically clears the bridge rows.

## Relationship summary

| From | To | Cardinality | Notes |
| --- | --- | --- | --- |
| `users` | `todos` | one-to-many | enforced by `todos.user_id` |
| `users` | `tags` | one-to-many for custom tags only | default tags have no owning user |
| `todos` | `tags` | many-to-many | implemented through `todo_tags` |
| `todos` | `todos` | optional self-reference | `original_id` tracks recurring lineage |

## Repository behavior that matters to the schema

`TypeORMTodoRepository`:

- loads tags by id before saving a todo
- writes the many-to-many tag association through TypeORM relations
- archives instead of hard-deleting in the normal delete path
- orders most active-task queries by due date, then `order`, then `task_number`

`TypeORMTagRepository`:

- returns default plus user-owned tags for the current user
- counts only custom tags for free-tier limit enforcement
- blocks modification and deletion of default tags

## Related canonical documents

- [overview-and-current-source-of-truth.md](overview-and-current-source-of-truth.md)
- [recurrence-subtasks-and-task-numbering.md](recurrence-subtasks-and-task-numbering.md)
- [../product/task-lifecycle.md](../product/task-lifecycle.md)
- [../product/recurrence-behavior.md](../product/recurrence-behavior.md)
- [../backend/todo-services-and-use-cases.md](../backend/todo-services-and-use-cases.md)
