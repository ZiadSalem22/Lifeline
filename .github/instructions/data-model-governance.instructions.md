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

### Zero-downtime migration discipline
When a schema change is destructive or touches production data, follow the blue-green 5-phase pattern:
1. **Add** — add the new column/table alongside the old one.
2. **Dual-write** — deploy code that writes to both old and new.
3. **Backfill** — migrate existing data from old to new.
4. **Read-from-new** — deploy code that reads from new; old is now vestigial.
5. **Remove** — drop the old column/table in a follow-up migration.

Non-destructive changes (adding a nullable column, adding an index) do not require the full 5-phase pattern.

### Rollback strategies
Every migration must have a viable rollback path documented in comments or in the migration's `down()` method:
- **Transaction-based**: wrap in a transaction so a failure automatically rolls back.
- **Checkpoint-based**: create a backup table or snapshot before the migration so data can be restored.
- If a migration cannot be safely rolled back (e.g., data-lossy), document this explicitly and require approval before applying.

### Column operation safety rules
| Operation | Safe approach |
|-----------|---------------|
| Add column | Add with DEFAULT or as nullable; never add NOT NULL without a default on an existing table |
| Rename column | 3-step zero-downtime: add new → copy data → drop old (separate migrations) |
| Remove column | Remove application reads first, then drop in a follow-up migration |
| Change type | Add new column → copy/cast data → rename → drop old |
| Add NOT NULL constraint | Add as nullable → backfill → add constraint in follow-up migration |

### Common migration pitfalls
Flag these during any migration review:
1. **Not testing rollback** — every migration must be tested with its `down()` method.
2. **Breaking changes without downtime strategy** — destructive changes without blue-green phases.
3. **NULL handling** — failing to set defaults or handle NULLs during backfill.
4. **Index performance** — creating indexes on large tables without `CONCURRENTLY`.
5. **Foreign key constraints** — adding FK constraints to tables with orphan data.
6. **Migrating too much data at once** — large backfills should be batched.

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

## Severity taxonomy

| Severity | Meaning |
|----------|----------|
| CRITICAL | Data loss, broken referential integrity, or production outage risk |
| HIGH | Migration safety gap, missing rollback, or ownership chain violation |
| MEDIUM | Missing JSONB documentation, speculative index, or convention drift |
| LOW | Style, naming, or minor documentation gap |

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
- Destructive schema changes without zero-downtime migration plan
- Migrations without rollback strategy or `down()` method
- Adding NOT NULL column to existing table without default value
- Large data backfills without batching
- Creating indexes on large tables without CONCURRENTLY
- Foreign key constraints added to tables with potential orphan data

## Documentation impact

Data-model changes must trigger `docs/data-model/` review. Entity changes that affect API response shapes should also trigger `docs/api/` review. Ownership or relation changes may trigger `docs/architecture/` review. Significant schema evolution decisions should evaluate ADR impact.
