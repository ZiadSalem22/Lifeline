# Schema Change Review

Trigger a data-model governance review for schema, entity, or migration changes.

## When to use
Use this prompt when you want an assessment of entity correctness, migration safety, relation integrity, or persistence discipline for data-model changes.

## Steps

1. Identify the changed entity, migration, or repository files.
2. Read the current entity definitions in `backend/src/infra/db/entities/` as the primary schema source.
3. For each change, assess against Lifeline's data-model standards:
   - **Entity correctness**: column types, relations, table name, EntitySchema pattern
   - **Migration safety**: idempotent, handles fresh/existing DB, no applied-migration modification
   - **Relation integrity**: foreign keys, cascade behavior, orphan prevention
   - **Ownership compliance**: userId on user-scoped entities, ownership chain respected
   - **JSONB discipline**: shape documented, changes treated as schema changes
   - **Index quality**: justified by query patterns
4. Verify that entity definitions (not migrations) are treated as current schema truth.
5. Produce findings with severity (blocker / warning / note), location, and recommendation.
6. Assess whether the change maintained data integrity.
7. Identify cross-family triggers:
   - Documentation impact for `docs/data-model/` and `docs/api/`
   - Backend governance for repository/domain impacts
   - CI/CD governance for deployment database impacts
   - Refactor governance if schema evolution requires code restructuring

## Sources
- `.github/skills/data-model-governance.md`
- `.github/instructions/data-model-governance.instructions.md`
- `.github/agents/data-model-review-agent.md`

## Output
Return a data-model governance assessment with specific findings, severity levels, and actionable recommendations.
