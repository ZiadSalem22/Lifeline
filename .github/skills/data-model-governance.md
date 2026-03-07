# Skill: data-model-governance

## Purpose

Protect Lifeline's data-model correctness, schema evolution discipline, migration safety, and persistence integrity across the PostgreSQL/TypeORM data layer.

This skill builds on code-quality-governance for naming and structure, and connects with backend-engineering-governance for layer boundaries around repositories and entities.

## Scope

Use this skill to assess and guide:
- TypeORM EntitySchema correctness and completeness
- ownership chain and relation integrity
- migration authoring and safety
- JSONB shape discipline
- index and query awareness
- historical vs current schema clarity
- safe schema evolution practices
- zero-downtime migration patterns
- rollback strategy planning
- column operation safety
- migration pitfall detection

## When to use it

Use this skill when:
- creating or modifying TypeORM entities
- creating or reviewing migrations (TypeORM JS or raw SQL)
- changing column types, relations, or constraints
- adding or modifying JSONB columns
- adding indexes
- reviewing data-model pull requests
- evaluating whether a change respects the current schema source of truth

## Sources of truth

Consult first:
- `.github/instructions/data-model-governance.instructions.md`
- `.github/skills/code-quality-governance.md`
- `.github/copilot-instructions.md`

Schema source of truth:
- `backend/src/infra/db/entities/` — current entity definitions (PRIMARY)
- `backend/src/migrations/` — TypeORM migration history
- `backend/migrations/` — raw SQL migration history

Implementation context:
- `backend/src/infrastructure/` — repositories consuming entities
- `backend/src/domain/` — domain objects (not schema truth)
- `backend/src/infra/db/data-source.js` — data-source configuration

## What this skill must know

### Lifeline data-model facts
- PostgreSQL database
- TypeORM with `EntitySchema` pattern (not decorators)
- 6 entities: User, UserProfile, UserSettings, Todo, Tag, TodoTag
- All user-scoped entities have `userId` column
- TodoTag is an explicit join entity (not implicit many-to-many)
- JSONB columns may exist — shape must be documented
- Two migration systems coexist: TypeORM JS and raw SQL

### Ownership chain
```
User
├── UserProfile (one-to-one)
├── UserSettings (one-to-one)
├── Todo (one-to-many)
│   └── TodoTag (one-to-many, join with Tag)
└── Tag (one-to-many, user-scoped)
```

### Entity file map
- `backend/src/infra/db/entities/UserEntity.js`
- `backend/src/infra/db/entities/UserProfileEntity.js`
- `backend/src/infra/db/entities/UserSettingsEntity.js`
- `backend/src/infra/db/entities/TodoEntity.js`
- `backend/src/infra/db/entities/TagEntity.js`
- `backend/src/infra/db/entities/TodoTagEntity.js`

### Migration locations
- TypeORM JS: `backend/src/migrations/` (timestamp-based)
- Raw SQL: `backend/migrations/` (sequential numbering, gap at 003)

### Known data-model debt
- Dual migration systems require awareness of both when reviewing schema changes
- Domain layer is thin — some entities lack explicit domain objects
- Default tags loaded via `infra/db/defaultTags.js`, not via migration

### Zero-downtime migration pattern (blue-green 5-phase)
For destructive schema changes on production data:
1. **Add** — add new column/table alongside old.
2. **Dual-write** — deploy code writing to both old and new.
3. **Backfill** — migrate existing data from old to new.
4. **Read-from-new** — deploy code reading from new; old is vestigial.
5. **Remove** — drop old column/table in follow-up migration.

Non-destructive changes (nullable column, new index) skip the full pattern.

### Rollback strategies
- **Transaction-based**: wrap migration in transaction; failure auto-rolls back.
- **Checkpoint-based**: create backup table/snapshot before migration.
- If rollback is impossible (data-lossy), document explicitly and require approval.

### Column operation safety rules
| Operation | Safe approach |
|-----------|---------------|
| Add column | Add nullable or with DEFAULT; never NOT NULL without default on existing table |
| Rename column | 3-step: add new → copy data → drop old (separate migrations) |
| Remove column | Remove app reads first → drop column in follow-up |
| Change type | Add new column → copy/cast → rename → drop old |
| Add NOT NULL | Add nullable → backfill → add constraint in follow-up |

### Common migration pitfalls
1. Not testing rollback (`down()` method).
2. Destructive changes without zero-downtime strategy.
3. NULL handling failures during backfill.
4. Creating indexes on large tables without `CONCURRENTLY`.
5. FK constraints on tables with orphan data.
6. Large backfills without batching.

### Severity taxonomy
| Severity | Meaning |
|----------|----------|
| CRITICAL | Data loss, broken referential integrity, or production outage risk |
| HIGH | Migration safety gap, missing rollback, or ownership chain violation |
| MEDIUM | Missing JSONB docs, speculative index, or convention drift |
| LOW | Style, naming, or minor documentation gap |

## Practical checklist

When reviewing schema/data-model changes:
1. Does the entity definition in `infra/db/entities/` match the intended schema?
2. Is there a corresponding migration for the schema change?
3. Does the migration handle both fresh and existing databases?
4. Are foreign keys and relations properly declared?
5. Are cascades explicitly set (not left to defaults)?
6. Is user-scoping enforced (userId column, query filtering)?
7. Are JSONB columns documented with shape expectations?
8. Are indexes justified by actual query patterns?
9. Is the change consistent with the ownership chain?
10. Is the migration idempotent or transaction-wrapped?
11. Does the migration have a viable rollback path (`down()` or documented strategy)?
12. Do destructive changes follow the zero-downtime 5-phase pattern?
13. Do column operations follow the safety rules (no bare NOT NULL on existing tables)?
14. Are large backfills batched and indexes created with CONCURRENTLY?
15. Is the severity of each finding classified as CRITICAL / HIGH / MEDIUM / LOW?

## Cross-family integration

### Triggers documentation governance when
- Entity or relation changes affect `docs/data-model/`
- Schema changes affect API response shapes → `docs/api/`
- Ownership changes affect architecture documentation

### Triggers backend governance when
- Repository interfaces need to change for new entity structure
- Domain objects need updating for new schema

### Triggers CI/CD governance when
- Migration changes affect database setup in deployment
- Schema changes affect Docker/Compose database initialization

### Triggers refactor governance when
- Schema evolution requires application code restructuring
- Migration system duality should be addressed

### Referenced by
- backend-engineering-governance (layer boundaries for persistence)
- refactor-governance (schema safety during refactors)

## What this skill must not do

- Treat migration files as the current schema (entities are the primary source)
- Treat domain objects as the schema source of truth
- Let archived phase artifacts override current entity definitions
- Recommend migration system consolidation during normal feature work
- Approve JSONB shape changes without documentation
- Approve entities without ownership chains
- Approve schema changes without migrations
