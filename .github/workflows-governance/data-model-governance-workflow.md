# Data Model Governance Workflow

## Purpose

Define the repeatable execution path for data-model governance in Lifeline.

This workflow sits above the data-model-governance skill, agents, and team and turns them into a practical review sequence for schema, entity, and migration changes.

## Built on

- `.github/skills/data-model-governance.md`
- `.github/skills/code-quality-governance.md`
- `.github/agents/data-model-builder-agent.md`
- `.github/agents/data-model-review-agent.md`
- `.github/teams/data-model-governance-team.md`

## Inputs

- proposed or completed schema change
- changed entity files, migration files, or repository files
- change description or PR context
- backend review findings when available
- API contract context when known

## Workflow sequence

### Pre-implementation (builder guidance)
1. Inspect the proposed schema change scope.
2. **Conformance check**: read sibling entity files and existing migrations to match conventions.
3. Verify the change against the current entity definitions (source of truth).
4. Recommend entity structure, column types, and relation declarations.
5. Recommend migration approach (TypeORM JS or raw SQL).
6. Assess whether the change is destructive or non-destructive.
7. For destructive changes, recommend the blue-green 5-phase zero-downtime pattern.
8. Recommend rollback strategy (transaction-based or checkpoint-based).
9. Apply column operation safety rules (add/rename/remove/type-change).
10. Identify cascade and ownership chain implications.
11. Identify JSONB shape documentation needs.
12. Identify index requirements.
13. Emit schema implementation guidance.

### Post-implementation (review)
1. Inspect the changed entity and migration files.
2. **Conformance check**: verify patterns match sibling entities and existing migrations.
3. Verify entity correctness: column types, relations, table name, EntitySchema pattern.
4. Verify migration safety: idempotent/transactional, handles fresh and existing DBs, no modification of applied migrations.
5. **Zero-downtime assessment**: verify destructive changes follow the 5-phase pattern.
6. **Rollback review**: verify `down()` method or documented rollback strategy exists.
7. **Column operation safety**: verify safe approaches for add/rename/remove/type-change.
8. Verify relation integrity: foreign keys, cascade behavior, orphan prevention.
9. Verify ownership compliance: userId on user-scoped entities, ownership chain respected.
10. Verify JSONB discipline: shape documented, changes treated as schema changes.
11. Verify index quality: justified by query patterns, not speculative; large tables use CONCURRENTLY.
12. Confirm source-of-truth clarity: entities are primary, migrations are history.
13. Apply code quality governance for naming and structure.
14. Determine whether the change maintained data integrity.
15. **Cross-cutting analysis** (multi-entity or multi-layer changes): verify consistency across related entities, repositories, and domain objects.
16. Classify each finding with severity: CRITICAL / HIGH / MEDIUM / LOW.
17. Emit data-model review findings in structured format (File / Severity / Category / Why / Recommendation).
18. Emit review verdict: Approve / Request changes / Needs discussion.
19. Determine cross-family triggers:
    - Documentation governance: `docs/data-model/`, `docs/api/`
    - Backend governance: repository/domain impacts
    - CI/CD governance: deployment database impacts
    - Refactor governance: schema-driven restructuring
    - ADR: significant schema evolution decisions

## Rules it enforces

- Entity definitions in `infra/db/entities/` are the primary schema source of truth
- Every schema change must have a corresponding migration
- Migrations must be idempotent or transaction-wrapped
- Already-applied migrations must never be modified
- All foreign keys must have TypeORM relation declarations
- Cascade behavior must be explicitly set
- User-scoped entities must have userId column
- JSONB columns must have documented shape expectations
- Indexes must be justified by query patterns
- Many-to-many relationships must use explicit join entities

## Outputs it produces

- Data-model governance assessment (pass / conditional pass / fail)
- Entity correctness findings
- Migration safety findings
- Relation integrity findings
- Ownership compliance findings
- JSONB and index findings
- Cross-family trigger signals
- Documentation update requirements

## Failure modes and warnings

Emit warnings when:
- an entity change lacks a corresponding migration
- a migration modifies an already-applied migration
- foreign keys lack TypeORM relation declarations
- cascade behavior is left to defaults
- user-scoped entities lack userId column
- JSONB shape changes lack documentation
- indexes are added without query justification
- historical migration artifacts are treated as current schema
- new entities lack clear ownership chain

## Anti-patterns this workflow prevents

- schema changes without migrations
- treating migration files as current schema truth
- implicit cascade defaults that cause orphan records
- JSONB shape drift without documentation
- speculative indexes without query evidence
- entities outside the established entity directory
- modification of already-applied migrations
- destructive schema changes without zero-downtime migration plan
- migrations without rollback strategy or `down()` method
- adding NOT NULL column to existing table without default value
- large data backfills without batching
- creating indexes on large tables without CONCURRENTLY
- foreign key constraints added to tables with potential orphan data
