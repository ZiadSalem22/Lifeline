# Migrations and Historical Schema Context

## Purpose

This document explains which schema artifacts define the current live model and which older migrations or database scripts should now be treated as historical context only.

## Canonical sources used for this document

- [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/migrations/archived](../../backend/src/migrations/archived)
- [backend/migrations](../../backend/migrations)
- [backend/db/mssql-init.sql](../../backend/db/mssql-init.sql)
- [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](../reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md)

## Current live migration baseline

The current authoritative migration for the authenticated Postgres schema is [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js).

It defines the current Postgres-native baseline for:

- users
- user profiles
- user settings
- todos
- tags
- todo-tag relationships
- constraints
- indexes
- seeded default tags

When current entities and older historical scripts disagree, this migration and the active entity schemas win.

## Why older migration artifacts still exist

The repository contains older migration material because the project moved through earlier persistence eras.

Those artifacts are still useful for explaining how the model evolved, but they are not the live source of truth.

## Historical artifact groups

### Raw SQL migrations under `backend/migrations`

The SQL files under [backend/migrations](../../backend/migrations) represent earlier schema work, including:

- initial user/profile/todo/tag structures
- email-nullability changes
- start-day additions and constraint adjustments

These files are historical because they reflect an older SQL-first and MSSQL-shaped view of the schema.

Important examples:

- [backend/migrations/001_initial_migration.sql](../../backend/migrations/001_initial_migration.sql)
- [backend/migrations/005_add_start_day_to_user_profiles.sql](../../backend/migrations/005_add_start_day_to_user_profiles.sql)
- [backend/migrations/006_add_check_constraint_start_day.sql](../../backend/migrations/006_add_check_constraint_start_day.sql)

### Archived TypeORM migrations under `backend/src/migrations/archived`

The archived JS migrations document incremental schema evolution before the project consolidated around the new Postgres baseline.

They capture steps such as:

- adding role and subscription fields to users
- creating user profiles
- widening todo schema and adding archive support
- adding `user_id` ownership to todos and tags
- adding default-tag support
- introducing and backfilling task numbers
- adding user settings

These files are helpful for history, especially when reconciling old docs or older databases, but they are not the main canonical migration set now.

### MSSQL bootstrap script

[backend/db/mssql-init.sql](../../backend/db/mssql-init.sql) is a historical local-bootstrap script for an older MSSQL-oriented schema.

It is no longer authoritative because:

- it uses MSSQL types and conventions
- it does not reflect the current Postgres `jsonb` model
- it lacks the full current user/profile/settings/tag-ownership constraints
- it predates the consolidated Postgres migration baseline

## Important historical differences from the current live model

Examples of historical drift that should not be copied forward as current truth:

- older schemas used MSSQL `NVARCHAR` and `DATETIME` patterns rather than Postgres `text`, `timestamptz`, and `jsonb`
- some older profile schemas used a separate profile id instead of the current `user_id` primary-key pattern
- earlier settings artifacts used different column shapes, including a separate settings id
- old start-day constraints were narrower than the current seven-day canonical list
- old migrations introduced task numbers incrementally, while the current baseline requires them from the start

## Practical documentation rule

Use historical migration material only to explain evolution, not to define the active runtime schema.

For canonical documentation, prefer this priority order:

1. current entity schemas
2. current Postgres migration baseline
3. repository behavior
4. historical migrations only as explanatory context

## Related canonical documents

- [overview-and-current-source-of-truth.md](overview-and-current-source-of-truth.md)
- [users-profiles-and-settings.md](users-profiles-and-settings.md)
- [todos-tags-and-relationships.md](todos-tags-and-relationships.md)
- [recurrence-subtasks-and-task-numbering.md](recurrence-subtasks-and-task-numbering.md)
