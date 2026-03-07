# Skill: code-quality-governance

## Purpose

Enforce consistent code quality, readability, maintainability, and structural discipline across all Lifeline code.

This skill is the foundational quality baseline for the repo. The frontend, backend, data-model, and refactor governance families inherit its general rules and add domain-specific layers on top.

## Scope

Use this skill to assess and guide:
- readability and naming quality
- duplication detection and reduction
- file and function complexity
- separation of concerns
- modularity and cohesion
- behavior-preserving change discipline
- hack and accidental-complexity avoidance
- dead code and commented-out code cleanup
- lint/format gate compliance
- security surface awareness (hardcoded secrets, error exposure, input handling)
- performance surface awareness (N+1 patterns, unbounded allocations, blocking operations)
- cross-cutting consistency for multi-file changes

## When to use it

Use this skill when:
- writing new code in any part of the codebase
- reviewing code changes for quality
- deciding whether to extract, inline, rename, or reorganize code
- assessing whether a change genuinely improved quality or just moved things around
- evaluating pull requests for code quality standards
- assessing whether a proposed abstraction is justified

## Sources of truth

Consult first:
- `.github/instructions/code-quality-governance.instructions.md`
- `.github/copilot-instructions.md`

Then consult the implementation surface:
- `client/src/` for frontend code structure
- `backend/src/` for backend code structure

## What this skill must know

### Lifeline-specific quality context
- The codebase is plain JavaScript (no TypeScript) — naming and structure are the primary safety net.
- Frontend uses React with JSX, CSS Modules, functional components, and hooks.
- Backend uses Express with a layered architecture: routes → controllers → application/use-cases → domain → infrastructure/repositories.
- Both sides have `utils/` directories that can become dumping grounds without discipline.
- The backend has a known `infra/` vs `infrastructure/` split that is a structural debt, not a pattern to imitate.

### Quality thresholds (guidance, not hard gates)
- Files over ~300 lines of logic: decomposition candidate
- Functions over ~50 lines of logic: extraction candidate
- Nesting deeper than 3 levels: refactor candidate
- Functions with more than 4 parameters: options-object candidate
- Copy-paste blocks over ~10 lines: extraction candidate
- More than 2 responsibilities in a single file: separation candidate

### Naming rules
- `camelCase` for variables and functions
- `PascalCase` for React components, classes, entities, and EntitySchema names
- Boolean variables as questions: `isLoading`, `hasAccess`, `canEdit`
- Handler functions with action verbs: `handleSubmit`, `onDelete`
- Plural collections: `todos`, `tags`
- No generic names (`data`, `info`, `temp`) unless scope is trivially small

### Duplication rules
- Small duplication (2-3 lines) is tolerable to avoid bad abstractions
- Large duplication (10+ lines) must be extracted
- Extracted shared logic goes at the narrowest shared scope, not a global dump
- Before creating a utility, check existing `utils/` directories

### Anti-pattern recognition
- God files mixing unrelated concerns
- God functions doing multiple things
- Deeply nested conditionals
- Dead code and commented-out code
- Magic numbers and strings without named constants
- Catch-all error suppression without logging
- Circular dependencies
- Boolean flag parameters that change function behavior
- Barrel re-exports that re-export everything
- Utility files that grow into unrelated grab-bags

### Severity taxonomy

When reporting quality findings, use these severity levels consistently:

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Correctness risk, data loss potential, or security exposure — must fix |
| **HIGH** | Significant maintainability or reliability regression — should fix in same change |
| **MEDIUM** | Quality regression increasing future cost — fix if practical |
| **LOW** | Style or minor readability — informational, fix opportunistically |

### Review categories

Quality review examines six dimensions (adapted from TerminalSkills and timi-ty code-review practices):

1. **Correctness** — logic errors, off-by-one, null handling, edge cases, race conditions
2. **Security** — hardcoded secrets, exposed error details, unsanitized inputs, missing auth checks
3. **Performance** — N+1 queries, unbounded allocations, blocking operations, missing pagination
4. **Reliability** — missing error handling, missing timeouts, resource leaks, no retry for transient failures
5. **Readability** — naming, nesting, function size, file focus, self-documenting intent
6. **Testing** — missing tests for new behavior, tests that don't assert meaningful outcomes, untested edge cases

### Lint and format gate

Every code change must pass the project lint commands before being declared complete:
- Backend: `npm run lint` from `backend/`
- Frontend: `npm run lint` from `client/`
- Never disable a lint rule globally to silence one violation — use an inline disable with an explanation

### Conformance discipline

Before writing new code or reviewing changes:
- Study 2–3 existing files that do similar work to learn the established pattern
- Follow the existing pattern unless the change is explicitly improving it
- Do not introduce competing patterns — converge on one approach per concern

### Large-change handling

For changes touching more than 5 files or exceeding ~500 changed lines:
- Perform cross-cutting analysis: check for internal consistency across all changed files
- Check for new dependencies introduced and whether they follow the existing dependency direction
- Verify that shared abstractions are used consistently in all call sites
- Look for missing changes — files that should have been updated but were not

## Practical checklist

When reviewing code for quality:
1. Can you understand each function's purpose from its name?
2. Is each file focused on one coherent concern?
3. Are there copy-paste blocks that should be extracted?
4. Is nesting depth reasonable (≤3 levels)?
5. Are names descriptive and consistent within the file?
6. Is dead code or commented-out code present?
7. Are magic values replaced with named constants?
8. Does the change preserve existing behavior when structural?
9. Are there hacks or TODOs without plans?
10. Is the code genuinely cleaner, or just different?
11. Does the change pass lint (`npm run lint`) with no new warnings?
12. Are there any security concerns (hardcoded secrets, exposed errors, unsanitized input)?
13. Are there any performance concerns (N+1 queries, unbounded allocations, missing pagination)?
14. For multi-file changes: is the change internally consistent across all files?
15. Always explain **why** something is a problem, not just what — enable the developer to learn the principle.

## Cross-family integration

### Triggers documentation governance when
- Module boundaries or file organization changes affect documented architecture
- Public APIs or file exports change in ways that affect documented contracts

### Triggers refactor governance when
- A quality improvement requires restructuring beyond the current file
- Duplication reduction requires cross-module extraction

### Referenced by
- frontend-engineering-governance (inherits general quality rules)
- backend-engineering-governance (inherits general quality rules)
- data-model-governance (inherits naming and structure rules)
- refactor-governance (uses quality thresholds as refactor triggers)

## What this skill must not do

- Override framework-specific rules from frontend or backend governance
- Override schema/migration rules from data-model governance
- Apply quality pressure that breaks existing behavior without explicit intent
- Treat all abstractions as good — bad abstractions are worse than duplication
- Insist on DRY at the expense of readability
- Flag style preferences as quality violations
