# Refactor Governance Instructions

Use this instruction file when planning, executing, or reviewing refactoring work across the Lifeline codebase.

## Purpose

Enforce behavior-preserving refactor discipline, safe decomposition, incremental change management, and justification/scope control for all codebase improvements.

## Inherits from

This instruction set builds on top of:
- `.github/instructions/code-quality-governance.instructions.md` for general quality standards
- `.github/instructions/frontend-engineering-governance.instructions.md` for frontend-specific constraints
- `.github/instructions/backend-engineering-governance.instructions.md` for backend-specific constraints
- `.github/instructions/data-model-governance.instructions.md` for schema-related constraints

Refactoring must respect all applicable domain governance rules.

## Required behavior

### Behavior-preserving discipline
- Every refactor must explicitly state what behavior is being preserved.
- Structural changes (rename, move, extract, inline) must produce zero behavior change unless behavior change is the explicit goal.
- If a refactor accidentally changes behavior, the change must be reverted or the behavior change must be explicitly acknowledged and documented.
- Use the preserved-behavior statement format: "This refactor preserves: [specific behavior]."
- When uncertain whether behavior is preserved, add a regression test before refactoring.

### Safe decomposition
- When decomposing large files, extract one concern at a time.
- Each extraction step should be independently reviewable and independently revertable.
- After extraction, the original file should still work identically.
- New files created by extraction must have clear names reflecting their responsibility.
- Do not extract into a file that already has unrelated responsibilities.

### Safe extraction of reusable logic
- Before extracting shared logic, verify that the duplicated code is truly identical in intent — not just similar in shape.
- Extract to the narrowest shared scope, not a global dump.
- After extraction, verify that all original call sites behave identically.
- If extraction changes the interface (different parameters, different return values), document the interface change.

### Duplication removal without bad abstractions
- Small duplication (2-3 lines) is acceptable to avoid premature abstraction.
- Large duplication (10+ lines of identical intent) should be extracted.
- The extracted abstraction must be simpler to understand than the duplicated code it replaces.
- If the abstraction requires `if/else` branches for different callers, the code may not be truly duplicated — it may be coincidentally similar.
- Prefer explicit duplication over a bad abstraction.

### Incremental change discipline
- Large refactors must be broken into incremental steps.
- Each step should be a single, coherent change that can be committed independently.
- No step should leave the codebase in a broken state.
- Prefer many small PRs over one massive PR.
- Each step should have a clear description of what changed and what was preserved.

### Refactor justification and scope control
- Every refactor must have a stated justification: what makes the code better after the refactor?
- Valid justifications: reduced duplication, clearer boundaries, simpler structure, better naming, reduced complexity, fixed separation of concerns.
- Invalid justifications: "feels cleaner" without specifics, "modern style" without concrete benefit, reorganization for reorganization's sake.
- Scope creep is the primary risk of refactoring. Stay within the stated scope.
- If a refactor reveals additional problems, log them as separate tasks — do not fix everything at once.

### Regression discipline
- For behavior-critical code, add or verify regression tests before refactoring.
- After refactoring, run existing tests to confirm behavior preservation.
- If tests don't exist for the affected area, consider adding test coverage before the refactor.
- For UI refactors, verify visual behavior has not changed.

### Safe refactoring loop
Every refactoring step must follow the cycle:
1. **Test** — verify existing tests pass (or add tests if none exist).
2. **Refactor** — make one structural change.
3. **Test** — verify all tests still pass.
4. **Commit** — commit the atomic change with preserved-behavior statement.

Never combine multiple refactoring operations into a single commit without intermediate test verification.

### Refactoring types
Classify each refactoring by its trigger:
- **Preparatory** — restructure code to make an upcoming feature easier to add.
- **Comprehension** — restructure code to make it easier to understand (naming, extraction, simplification).
- **Litter-pickup** — fix small structural problems encountered while working on something else.

State the refactoring type in your preserved-behavior statement.

### Rule of Three
- First occurrence: write it inline.
- Second occurrence: note the duplication but tolerate it.
- Third occurrence: extract a shared abstraction.

Do not extract prematurely before the third occurrence unless the duplication is large (10+ lines) and identical in intent.

### Named refactoring catalog (scoped to Lifeline JS/React)
| Refactoring | When to use | Lifeline example |
|-------------|-------------|-------------------|
| Extract Function | Function does more than one thing | Extract validation from a route handler |
| Extract Component | JSX block has independent concern | Extract a form section from a page |
| Extract Hook | Stateful logic reused across components | Extract shared fetch logic |
| Move Function | Function lives in the wrong module | Move business logic from controller to service |
| Inline Function | Indirection adds no value | Inline a one-line wrapper |
| Rename | Name no longer describes purpose | Rename after responsibility changes |
| Replace Conditional with Guard Clause | Deeply nested if/else | Flatten controller error checks |
| Decompose Conditional | Complex boolean expression | Break multi-condition filter into named predicates |

### Smell families and smell-to-fix mapping
Recognize these smell families as refactoring triggers:

| Smell family | Examples | Typical fix |
|--------------|----------|-------------|
| **Bloaters** | Long function, large file, long parameter list | Extract Function, Extract Component, Introduce Parameter Object |
| **Change Preventers** | Divergent change, shotgun surgery | Extract Module, Move Function |
| **Dispensables** | Dead code, speculative generality, duplicate code | Delete, Inline, Extract shared |
| **Couplers** | Feature envy, inappropriate intimacy | Move Function, Extract Component |

### Dead code cleanup
- Dead code is a first-class refactoring target, not a secondary concern.
- Unreachable code, unused exports, commented-out code, and unused variables should be removed.
- Before removing suspected dead code, search for all references across the codebase.
- Prefer removing dead code in a dedicated commit with a clear description.

### Large-scale refactoring strategies
For refactors that span multiple modules or take more than one session:
- **Branch by Abstraction**: introduce an abstraction layer → migrate consumers one by one → remove old implementation.
- Never leave the codebase in a half-migrated state at the end of a session. Each step must be independently deployable.
- Track large refactors as multi-step issues, not single commits.

### Preserved-behavior statements
- Every refactor commit or PR description should include a preserved-behavior statement.
- Format: "Preserved behavior: [specific behavior that remains unchanged]."
- For complex refactors, list each behavior explicitly.
- If any behavior intentionally changed during the refactor, state it separately: "Intentional behavior change: [description]."

## Lifeline-specific refactor context

### Known refactor opportunities (do not execute during governance setup)
- `infra/` vs `infrastructure/` directory consolidation
- Domain layer enrichment (missing domain objects for UserProfile, UserSettings, TodoTag)
- Controller creation for routes with inline logic
- Frontend `context/` vs `providers/` rationalization
- Loose component cleanup (`ProfilePanel.jsx` in components root)
- Validator modularization
- Migration system documentation (not consolidation — both are valid)

### Refactor safety constraints per domain
- **Frontend refactors** must respect component boundaries, state ownership, and UI state patterns from frontend-engineering-governance
- **Backend refactors** must respect layer boundaries, controller thinness, and repository encapsulation from backend-engineering-governance
- **Schema refactors** must respect entity source of truth, migration discipline, and ownership chains from data-model-governance
- **Cross-cutting refactors** must involve all affected domain governance families

## Severity taxonomy

| Severity | Meaning |
|----------|----------|
| CRITICAL | Behavior change without acknowledgment, data loss risk, or broken functionality |
| HIGH | Missing preserved-behavior statement, scope creep, or bad abstraction replacing duplication |
| MEDIUM | Incomplete justification, missing regression test, or naming quality gap |
| LOW | Style preference, minor documentation gap, or cosmetic structure choice |

## Anti-patterns to flag

- Refactors that change behavior without acknowledgment
- "Big bang" refactors that touch many files at once
- Extractions that create bad abstractions worse than the original duplication
- Scope creep (refactoring more than the stated scope)
- Refactors without regression verification
- Missing preserved-behavior statements
- Refactors justified only by style preference
- Extractions that create files mixing unrelated concerns
- Refactors that break existing tests
- Premature extraction before the third occurrence (Rule of Three violation)
- Leaving dead code behind after restructuring
- Half-migrated Branch by Abstraction without cleanup
- Combining multiple refactoring operations in one commit without intermediate testing
- Missing refactoring type classification

## Documentation impact

Refactors that change module boundaries, file organization, or public APIs should trigger documentation-governance review. Large structural refactors may require architecture documentation updates. Refactors that change naming conventions may require broad documentation updates.
