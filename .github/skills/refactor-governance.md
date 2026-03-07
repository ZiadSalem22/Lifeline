# Skill: refactor-governance

## Purpose

Protect Lifeline's codebase during refactoring by enforcing behavior-preserving discipline, safe decomposition, incremental change management, and scope control.

This skill references all four domain governance families (frontend, backend, data-model, code-quality) as safety constraints and ensures refactors genuinely improve the codebase without breaking behavior or introducing worse structure.

## Scope

Use this skill to assess and guide:
- behavior-preserving refactor planning
- safe file decomposition
- safe logic extraction
- duplication removal quality
- incremental change sequencing
- refactor justification and scope control
- regression requirements
- preserved-behavior statement quality

## When to use it

Use this skill when:
- planning a refactoring initiative
- executing a decomposition or extraction
- reviewing a refactor PR
- assessing whether a refactor genuinely improved the codebase
- evaluating whether a refactor preserved behavior
- deciding whether to extract shared logic or tolerate duplication
- assessing scope creep during refactoring work

## Sources of truth

Consult first:
- `.github/instructions/refactor-governance.instructions.md`
- `.github/skills/code-quality-governance.md`
- `.github/copilot-instructions.md`

Domain-specific constraints:
- `.github/skills/frontend-engineering-governance.md` for frontend refactors
- `.github/skills/backend-engineering-governance.md` for backend refactors
- `.github/skills/data-model-governance.md` for schema-related refactors

Implementation context:
- `client/src/` for frontend code
- `backend/src/` for backend code
- `backend/src/infra/db/entities/` for schema context

## What this skill must know

### Refactor safety principles
1. **Behavior preservation is non-negotiable** — state explicitly what behavior is preserved
2. **Incremental is safer** — small steps over big bangs
3. **Extraction quality matters** — bad abstractions are worse than duplication
4. **Scope control prevents cascading changes** — log new problems, don't fix everything at once
5. **Regression verification is required** — test before and after
6. **Justification prevents waste** — "feels cleaner" is not justification

### Lifeline-specific refactor context
- Codebase is plain JavaScript — no type system to catch refactor errors
- Frontend and backend are separate concerns with different governance rules
- Known structural debt exists but should be addressed through planned refactor initiatives, not ad-hoc fixes
- Dual migration system (TypeORM + SQL) is intentional — do not consolidate casually
- `infra/` vs `infrastructure/` split is known debt — consolidation is a planned refactor, not a bug

### Preserved-behavior statement format
```
Preserved behavior:
- [Behavior 1 that remains unchanged]
- [Behavior 2 that remains unchanged]

Intentional changes (if any):
- [Behavior change 1 with justification]
```

### Refactor justification categories
Valid:
- Reduced duplication (with specific metric: N lines → shared function)
- Clearer boundaries (with specific improvement: mixed concerns → separated files)
- Simpler structure (with specific reduction: N levels of nesting → M)
- Better naming (with before/after comparison)
- Reduced complexity (with specific metric)
- Fixed separation of concerns (with specific layer correction)

Invalid:
- "Feels cleaner" without specifics
- "Modern style" without concrete benefit
- Reorganization for its own sake
- "Best practice" without repo-specific applicability

## Practical checklist

When reviewing a refactor:
1. Is there a clear preserved-behavior statement?
2. Is the refactor scope well-defined and contained?
3. Is the justification specific and valid?
4. Are changes incremental (not a big-bang)?
5. Are new files clearly named for their responsibility?
6. Did extraction create a clean abstraction (not a worse one)?
7. Were regression tests run or added?
8. Did domain-specific governance rules remain satisfied?
9. Is there scope creep (fixing more than stated)?
10. Is the code genuinely better, not just different?

## Cross-family integration

### Always consults
- code-quality-governance for quality thresholds and naming rules
- Relevant domain family (frontend, backend, data-model) for domain-specific constraints

### Triggers documentation governance when
- Module boundaries or file organization changes
- Public APIs or exports change
- Architecture-level restructuring occurs

### Triggers CI/CD governance when
- Refactored code affects deployment surfaces

### Triggered by
- code-quality-governance (when quality issues need restructuring beyond one file)
- frontend-engineering-governance (when frontend restructuring is needed)
- backend-engineering-governance (when backend restructuring is needed)
- data-model-governance (when schema evolution requires code restructuring)

## What this skill must not do

- Approve refactors without preserved-behavior statements
- Approve scope-creeping refactors
- Approve extractions that create worse abstractions
- Treat code movement as inherent improvement
- Override domain-specific governance rules during refactoring
- Recommend big-bang refactors
- Recommend refactoring without regression verification
- Confuse refactoring with feature work — refactors are structural, not behavioral
