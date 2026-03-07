# Schema Change Review

Trigger a data-model governance review for schema, entity, or migration changes.

## When to use
Use this prompt when you want an assessment of entity correctness, migration safety, relation integrity, or persistence discipline for data-model changes.

## Steps

1. Identify the changed entity, migration, or repository files.
2. Read the current entity definitions in `backend/src/infra/db/entities/` as the primary schema source.
3. **Conformance check**: read sibling entity files and existing migrations to match conventions.
4. For each entity change, assess **entity correctness**:
   - Column types, relations, table name, EntitySchema pattern
   - Cascade behavior explicitly set
   - Ownership chain respected
5. For each migration, assess **migration safety**:
   - Idempotent or transaction-wrapped
   - Handles fresh and existing DB
   - No modification of already-applied migrations
   - Data transformation included when needed
6. Assess **zero-downtime compliance**:
   - Are destructive changes (column removal, type change, rename) following the blue-green 5-phase pattern?
   - Non-destructive changes (add nullable column, add index) handled with single migration?
7. Assess **rollback safety**:
   - Does the migration have a `down()` method or documented rollback strategy?
   - Transaction-based or checkpoint-based approach?
   - If rollback is impossible, is this documented and approved?
8. Assess **column operation safety**:
   - New columns added nullable or with DEFAULT? (never bare NOT NULL on existing table)
   - Renames using 3-step zero-downtime pattern?
   - Removals preceded by app read removal?
   - Type changes using add-copy-rename-drop pattern?
9. Assess **relation integrity**:
   - Foreign keys backed by TypeORM relation declarations
   - Cascade behavior set, orphan prevention
   - Many-to-many using explicit join entities
10. Assess **ownership compliance**:
    - userId on user-scoped entities
    - Ownership chain respected
11. Assess **JSONB discipline**:
    - Shape documented, changes treated as schema changes
    - Validation in application layer
12. Assess **index quality**:
    - Justified by query patterns, not speculative
    - Large tables use CONCURRENTLY
13. Verify entity definitions (not migrations) are treated as current schema truth.
14. For multi-entity or multi-layer changes, perform **cross-cutting analysis**: verify consistency across related entities, repositories, and domain objects.
15. Classify each finding with severity (CRITICAL / HIGH / MEDIUM / LOW).
16. Emit review verdict: **Approve** / **Request changes** / **Needs discussion**.
17. Identify cross-family triggers:
    - Documentation impact for `docs/data-model/` and `docs/api/`
    - Backend governance for repository/domain impacts
    - CI/CD governance for deployment database impacts
    - Refactor governance if schema evolution requires code restructuring

## Severity taxonomy

| Severity | Meaning |
|----------|----------|
| CRITICAL | Data loss, broken referential integrity, or production outage risk |
| HIGH | Migration safety gap, missing rollback, or ownership chain violation |
| MEDIUM | Missing JSONB docs, speculative index, or convention drift |
| LOW | Style, naming, or minor documentation gap |

## Sources
- `.github/skills/data-model-governance.md`
- `.github/instructions/data-model-governance.instructions.md`
- `.github/agents/data-model-review-agent.md`

## Output format

```markdown
## Schema Change Review — [change description]

### Verdict: [Approve | Request changes | Needs discussion]

### Findings

#### Finding 1
- **File**: [path]
- **Severity**: [CRITICAL / HIGH / MEDIUM / LOW]
- **Category**: [Entity Correctness / Migration Safety / Zero-Downtime / Rollback / Column Safety / Relation Integrity / Ownership / JSONB / Index / Conformance]
- **Why**: [description]
- **Recommendation**: [fix]

### Cross-family triggers
- [ ] Documentation: `docs/data-model/`, `docs/api/`
- [ ] Backend governance: repository/domain impacts
- [ ] CI/CD governance: deployment database impacts
- [ ] Refactor governance: schema-driven restructuring
- [ ] ADR: significant schema evolution decision
```
