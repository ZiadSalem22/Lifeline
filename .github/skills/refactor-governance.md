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
- smell family detection and smell-to-refactoring mapping
- named refactoring transformation selection
- refactoring type classification (preparatory / comprehension / litter-pickup)
- dead code cleanup
- large-scale refactoring strategies (Branch by Abstraction)

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

### Refactoring types
Classify each refactoring by trigger:
- **Preparatory** — restructure code to make an upcoming feature easier.
- **Comprehension** — restructure code to improve understanding.
- **Litter-pickup** — fix small structural problems found while working on something else.

### Rule of Three
1st occurrence: inline. 2nd: note duplication but tolerate. 3rd: extract shared abstraction.
Do not extract prematurely unless duplication is large (10+ lines) and identical in intent.

### Named refactoring catalog (scoped to Lifeline JS/React)
| Refactoring | When to use |
|-------------|-------------|
| Extract Function | Function does more than one thing |
| Extract Component | JSX block has independent concern |
| Extract Hook | Stateful logic reused across components |
| Move Function | Function lives in wrong module |
| Inline Function | Indirection adds no value |
| Rename | Name no longer describes purpose |
| Replace Conditional with Guard Clause | Deeply nested if/else |
| Decompose Conditional | Complex boolean expression |

### Smell families and smell-to-fix mapping
| Smell family | Examples | Typical fix |
|--------------|----------|-------------|
| **Bloaters** | Long function, large file, long parameter list | Extract Function, Extract Component, Introduce Parameter Object |
| **Change Preventers** | Divergent change, shotgun surgery | Extract Module, Move Function |
| **Dispensables** | Dead code, speculative generality, duplication | Delete, Inline, Extract shared |
| **Couplers** | Feature envy, inappropriate intimacy | Move Function, Extract Component |

### Dead code cleanup
- Dead code is a first-class refactoring target.
- Remove unreachable code, unused exports, commented-out code, unused variables.
- Search all references before removing suspected dead code.
- Prefer a dedicated commit for dead code removal.

### Large-scale refactoring strategies
- **Branch by Abstraction**: introduce abstraction → migrate consumers → remove old implementation.
- Never leave half-migrated state. Each step must be independently deployable.

### React-specific refactoring guidance
- Extract Hook when stateful logic is shared across 2+ components.
- Extract Component when JSX block has its own state or its own concern.
- Prefer moving business logic out of components into hooks or utility functions.
- When refactoring context providers, ensure consumer components still receive the same shape.
- When extracting from a page component, ensure route behavior is preserved.

### Severity taxonomy
| Severity | Meaning |
|----------|----------|
| CRITICAL | Behavior change without acknowledgment, data loss risk, or broken functionality |
| HIGH | Missing preserved-behavior statement, scope creep, or bad abstraction |
| MEDIUM | Incomplete justification, missing regression test, or naming quality gap |
| LOW | Style preference, minor documentation gap, or cosmetic structure choice |

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
11. Is the refactoring type classified (preparatory / comprehension / litter-pickup)?
12. Was the safe refactoring loop followed (test → refactor → test → commit)?
13. Was dead code removed or flagged for removal?
14. For large-scale refactors, is Branch by Abstraction used correctly?
15. Is each finding classified with severity (CRITICAL / HIGH / MEDIUM / LOW)?

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
