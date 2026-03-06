# Data Model Overview and Current Source of Truth

## Purpose

This document defines the current persistence source of truth for Lifeline and summarizes the active authenticated-mode data model.

## Canonical sources used for this document

- [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/infra/db/entities/UserEntity.js](../../backend/src/infra/db/entities/UserEntity.js)
- [backend/src/infra/db/entities/UserProfileEntity.js](../../backend/src/infra/db/entities/UserProfileEntity.js)
- [backend/src/infra/db/entities/UserSettingsEntity.js](../../backend/src/infra/db/entities/UserSettingsEntity.js)
- [backend/src/infra/db/entities/TodoEntity.js](../../backend/src/infra/db/entities/TodoEntity.js)
- [backend/src/infra/db/entities/TagEntity.js](../../backend/src/infra/db/entities/TagEntity.js)
- [backend/src/infra/db/entities/TodoTagEntity.js](../../backend/src/infra/db/entities/TodoTagEntity.js)
- [backend/src/infra/db/data-source-options.js](../../backend/src/infra/db/data-source-options.js)
- [backend/src/infrastructure](../../backend/src/infrastructure)

## Current persistence source of truth

The active database model is the PostgreSQL TypeORM model defined by:

1. the current entity schemas under [backend/src/infra/db/entities](../../backend/src/infra/db/entities)
2. the active Postgres schema migration in [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js)
3. repository behavior under [backend/src/infrastructure](../../backend/src/infrastructure), which shows how rows are created, updated, queried, and interpreted at runtime

Historical raw SQL and MSSQL artifacts remain useful only as migration history context. They are not the canonical definition of the live schema.

## Active database platform

The current backend is wired for PostgreSQL through TypeORM.

Key current characteristics:

- `type` is `postgres`
- schema synchronization is disabled with `synchronize: false`
- SSL is environment-driven through `PGSSL` and `PGSSL_ALLOW_SELF_SIGNED`
- the app can connect either by `DATABASE_URL` or by discrete `PG*` and `POSTGRES_*` variables
- JSON-heavy fields use PostgreSQL `jsonb`

## Current persistent scope

The authenticated server-side persistence model currently covers:

- `users`
- `user_profiles`
- `user_settings`
- `todos`
- `tags`
- `todo_tags`

These tables support authenticated mode only.

## Guest-mode boundary

`guest mode` is not represented in the server database model. Guest-mode tasks and tags are managed client-side and should not be described as part of the backend relational schema.

## Current ownership model

The core ownership rules are:

- every persisted todo belongs to one user through `todos.user_id`
- every profile belongs to one user through `user_profiles.user_id`
- every settings row belongs to one user through `user_settings.user_id`
- custom tags belong to one user through `tags.user_id`
- default tags are global rows with `user_id IS NULL` and `is_default = true`
- todo-to-tag relationships are represented through the `todo_tags` join table

## Current table set at a glance

| Table | Role |
| --- | --- |
| `users` | Authenticated identity record and coarse access tier metadata |
| `user_profiles` | Onboarding and profile fields that drive product behavior |
| `user_settings` | Theme, locale, and persisted layout JSON |
| `todos` | Main task records, including recurrence, subtasks, numbering, and archive state |
| `tags` | Global default tags plus user-owned custom tags |
| `todo_tags` | Many-to-many bridge between todos and tags |

## Constraints that materially shape runtime behavior

Important live constraints include:

- unique Auth0 subject per user
- unique non-null email across users
- one profile row per user
- one settings row per user
- per-user unique `task_number`
- tag ownership rule that separates default tags from user-owned custom tags
- recurrence stored only as JSON objects or `NULL`
- subtasks stored only as JSON arrays

## What is intentionally not in the current schema

The current authenticated Postgres model does not define dedicated tables for:

- notifications
- AI conversations
- audit logs
- sessions
- attachments
- guest-mode data

If a behavior exists without one of those tables, it is either computed at runtime, stored elsewhere, disabled, or not currently implemented.

## Related canonical documents

- [users-profiles-and-settings.md](users-profiles-and-settings.md)
- [todos-tags-and-relationships.md](todos-tags-and-relationships.md)
- [recurrence-subtasks-and-task-numbering.md](recurrence-subtasks-and-task-numbering.md)
- [migrations-and-historical-schema-context.md](migrations-and-historical-schema-context.md)
- [../backend/runtime-composition.md](../backend/runtime-composition.md)
