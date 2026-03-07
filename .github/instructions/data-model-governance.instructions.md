# Data Model Governance Instructions

Use this instruction file when creating, modifying, or reviewing schema, entities, migrations, or persistence behavior in Lifeline.

## Purpose

Enforce data-model correctness, schema evolution discipline, migration safety, and persistence integrity across Lifeline's PostgreSQL/TypeORM data layer.

## Inherits from

This instruction set builds on top of `.github/instructions/code-quality-governance.instructions.md` for general quality. It also references `.github/instructions/backend-engineering-governance.instructions.md` for layer boundaries.

## Required behavior

### Single source of truth
- TypeORM EntitySchema definitions in `backend/src/infra/db/entities/` are the primary schema source of truth.
- Domain objects in `backend/src/domain/` describe domain concepts but are not the schema source.
- SQL migration files describe historical evolution, not the current schema shape.
- Archived or historical migration artifacts are reference material, not the authoritative current state.
- When in doubt about current schema, read the entity definitions first.

### Entity definitions
- All entities live in `backend/src/infra/db/entities/` using the `EntitySchema` pattern.
- Current entities: `TagEntity`, `TodoEntity`, `TodoTagEntity`, `UserEntity`, `UserProfileEntity`, `UserSettingsEntity`.
- Entity file names follow `<Name>Entity.js` convention.
- Each entity must declare: columns, relations, and table name.
- Column types must match the PostgreSQL column types in production.
- JSONB columns must have documented shape expectations (even as comments).

### Ownership rules
- `User` owns `UserProfile` and `UserSettings` (one-to-one).
- `User` owns `Todo` items (one-to-many via `userId`).
- `Todo` owns `TodoTag` join records (many-to-many through `TodoTag`).
- `Tag` is user-scoped — each user has their own tags.
- Every user-scoped entity must have a `userId` column and enforce user-scoping in queries.
- Do not create entities without a clear ownership chain.

### Relation integrity
- All foreign keys must have corresponding TypeORM relation declarations.
- Cascade behavior must be explicitly declared, not left to defaults.
- Orphan records (e.g., `TodoTag` entries referencing deleted todos) must be prevented by cascades or application-level cleanup.
- Many-to-many relationships must use explicit join entities (`TodoTag`), not TypeORM's implicit many-to-many.

### Migration discipline
- Schema changes require a migration file.
- TypeORM JS migrations live in `backend/src/migrations/`.
- Raw SQL migrations live in `backend/migrations/` (legacy path — use for targeted DDL when TypeORM migration is impractical).
- Each migration must be idempotent or wrapped in a transaction.
- Migration naming: TypeORM auto-generates timestamps; SQL migrations use sequential numbering.
- Never modify an already-applied migration — create a new one.
- Migration gap in numbering (no `003`) is intentional historical artifact — do not renumber.
- Test migrations against a clean database and against an existing database before merging.

### JSONB shape discipline
- JSONB columns must have documented shape expectations.
- Do not silently add or remove keys from JSONB objects — treat shape changes as schema changes.
- Validate JSONB shape in the application layer when reading, not just when writing.
- If JSONB shape evolves, create a migration that handles existing data transformation.

### Index and query awareness
- Add indexes for columns used in WHERE clauses, JOIN conditions, or ORDER BY expressions.
- Do not create indexes speculatively — only for measured or predictable query patterns.
- Review query plans when adding indexes for complex queries.
- User-scoped queries should use the `userId` index.

### Historical vs current schema clarity
- Current schema = entity definitions in `backend/src/infra/db/entities/`.
- Historical schema evolution = migration files (both TypeORM and SQL).
- `database/phase3/` and `backend/database/phase3/` contain phase-specific historical artifacts — not current truth.
- `docs/data-model/` should describe the current data model, not historical phases.

## Lifeline-specific data-model context

### Current entity inventory
| Entity | Table | Owner | Key relations |
|--------|-------|-------|---------------|
| UserEntity | users | — | Has UserProfile, UserSettings, Todos |
| UserProfileEntity | user_profiles | User | Belongs to User |
| UserSettingsEntity | user_settings | User | Belongs to User |
| TodoEntity | todos | User | Has TodoTags |
| TagEntity | tags | User | Has TodoTags |
| TodoTagEntity | todo_tags | Todo+Tag | Join entity |

### Known data-model debt
- Two parallel migration systems (TypeORM JS + raw SQL) — both are valid but require different governance
- `UserProfile` has a `startDay` column added via SQL migration `005` — verify entity definition matches
- No TypeORM-based seed migration — default tags are loaded via `infra/db/defaultTags.js`

## Anti-patterns to flag

- Entity changes without corresponding migrations
- Migrations that modify already-applied migrations
- JSONB shape changes without documentation or data transformation
- Missing foreign keys on ownership relations
- Missing `userId` on user-scoped entities
- Orphan-producing cascades (or lack of cascades)
- Speculative indexes without query justification
- Using historical migration files as current schema reference
- Creating entities outside `infra/db/entities/`
- Direct SQL in application code outside repositories

## Documentation impact

Data-model changes must trigger `docs/data-model/` review. Entity changes that affect API response shapes should also trigger `docs/api/` review. Ownership or relation changes may trigger `docs/architecture/` review. Significant schema evolution decisions should evaluate ADR impact.
