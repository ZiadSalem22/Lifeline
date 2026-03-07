# Phase 6C Workstream 6C.5 Implementation Report

## Workstream

Workstream 6C.5 — Data Model and Persistence Canon

## Objective

Create canonical data-model documentation that reflects the current authenticated Postgres schema, entity relationships, persistence constraints, JSON-backed task fields, and the boundary between the live schema and older historical migration artifacts.

## Inputs used

- [PHASE6C_PLAN.md](PHASE6C_PLAN.md)
- [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md)
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/infra/db/entities](backend/src/infra/db/entities)
- [backend/src/infrastructure](backend/src/infrastructure)
- [backend/src/application/CreateTodo.js](backend/src/application/CreateTodo.js)
- [backend/src/application/RecurrenceService.js](backend/src/application/RecurrenceService.js)
- [backend/src/application/CompleteRecurringTodo.js](backend/src/application/CompleteRecurringTodo.js)
- [backend/src/migrations/archived](backend/src/migrations/archived)
- [backend/migrations](backend/migrations)
- [backend/db/mssql-init.sql](backend/db/mssql-init.sql)

## Files created or updated

### Created

- [docs/data-model/overview-and-current-source-of-truth.md](docs/data-model/overview-and-current-source-of-truth.md)
- [docs/data-model/users-profiles-and-settings.md](docs/data-model/users-profiles-and-settings.md)
- [docs/data-model/todos-tags-and-relationships.md](docs/data-model/todos-tags-and-relationships.md)
- [docs/data-model/recurrence-subtasks-and-task-numbering.md](docs/data-model/recurrence-subtasks-and-task-numbering.md)
- [docs/data-model/migrations-and-historical-schema-context.md](docs/data-model/migrations-and-historical-schema-context.md)

### Updated

- [docs/data-model/README.md](docs/data-model/README.md)

## What was documented

### Current source-of-truth hierarchy

Documented that the live data-model truth comes from:

- current TypeORM entity schemas
- the active Postgres migration baseline
- repository behavior that shows how rows are used in runtime flows

### Identity and profile persistence

Documented:

- Auth0-sub-based user identity mapping
- one-to-one user/profile relationship keyed by `user_id`
- one-to-one user/settings relationship keyed by `user_id`
- onboarding and `start_day_of_week` persistence behavior
- theme, locale, and `layout` JSON persistence

### Todo and tag persistence

Documented:

- todo ownership by user
- default-tag vs custom-tag ownership split
- many-to-many todo/tag relationship via `todo_tags`
- archive-oriented delete behavior
- per-user uniqueness of `task_number`

### JSON-backed task fields

Documented:

- `subtasks` as embedded JSON array data
- `recurrence` as embedded JSON object data
- `original_id` as recurring lineage self-reference
- difference between task numbering and UI ordering

### Historical context classification

Documented the older SQL, MSSQL, and archived migration artifacts as historical context only, not current schema truth.

## Verification performed

- checked the current entity schemas against the active Postgres migration
- checked repository behavior for ownership, numbering, and archive semantics
- checked recurrence creation/completion flows to ensure persistence language matched implementation
- checked historical migrations only as evolution context, not as canonical truth
- kept API-contract and product-behavior content out of the data-model domain except where a persistence rule directly drives them

## Outcome

Workstream 6C.5 is complete.

The repo now has a canonical data-model set that explains:

- the live authenticated Postgres schema
- relationships and ownership rules
- JSON-backed persistence patterns
- recurring-task lineage and numbering behavior
- how historical schema artifacts should now be interpreted

## Downstream impact

This closes the data-model dependency for Workstream 6C.6 architecture and operations documentation.
