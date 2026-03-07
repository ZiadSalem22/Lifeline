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
2. Verify the change against the current entity definitions (source of truth).
3. Recommend entity structure, column types, and relation declarations.
4. Recommend migration approach (TypeORM JS or raw SQL).
5. Identify cascade and ownership chain implications.
6. Identify JSONB shape documentation needs.
7. Identify index requirements.
8. Emit schema implementation guidance.

### Post-implementation (review)
1. Inspect the changed entity and migration files.
2. Verify entity correctness: column types, relations, table name, EntitySchema pattern.
3. Verify migration safety: idempotent/transactional, handles fresh and existing DBs, no modification of applied migrations.
4. Verify relation integrity: foreign keys, cascade behavior, orphan prevention.
5. Verify ownership compliance: userId on user-scoped entities, ownership chain respected.
6. Verify JSONB discipline: shape documented, changes treated as schema changes.
7. Verify index quality: justified by query patterns, not speculative.
8. Confirm source-of-truth clarity: entities are primary, migrations are history.
9. Apply code quality governance for naming and structure.
10. Determine whether the change maintained data integrity.
11. Emit data-model review findings with severity levels.
12. Determine cross-family triggers:
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
