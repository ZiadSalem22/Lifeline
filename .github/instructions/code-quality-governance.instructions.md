# Code Quality Governance Instructions

Use this instruction file when writing, reviewing, or modifying any code across the Lifeline codebase.

## Purpose

Enforce consistent code quality, readability, maintainability, and structural discipline across all Lifeline code — frontend and backend.

## Required behavior

### Readability
- Prefer descriptive names over abbreviations. `getUserProfile` not `getUP`.
- Functions should do one thing and their name should say what that thing is.
- Avoid deeply nested logic. Extract early-return guards or helper functions.
- Keep files focused. A file with more than ~300 lines of logic is a candidate for decomposition.
- Keep functions focused. A function with more than ~50 lines of logic is a candidate for extraction.

### Naming quality
- Use consistent casing: `camelCase` for variables/functions, `PascalCase` for classes/components/entities.
- Name booleans as questions: `isLoading`, `hasAccess`, `canEdit`.
- Name handlers with action verbs: `handleSubmit`, `handleToggle`, `onDelete`.
- Collection variables should be plural: `todos`, `tags`, `users`.
- Avoid generic names: `data`, `info`, `item`, `thing`, `stuff`, `temp`, `result` — unless scope is trivially small.

### Duplication control
- Do not copy-paste blocks of logic. Extract shared functions or modules.
- Before creating a new utility, check `client/src/utils/` and `backend/src/utils/` for existing solutions.
- Tolerate small duplication over bad abstraction. Two near-identical 3-line blocks are fine; two near-identical 30-line blocks are not.
- When extracting shared logic, place it at the narrowest shared scope — not in a global utils dump.

### Complexity pressure
- Avoid more than 3 levels of nesting in any function.
- Avoid functions with more than 4 parameters — use an options object.
- Avoid files that mix unrelated concerns (e.g., a file that does routing AND business logic AND database queries).
- Avoid boolean flag parameters that change function behavior — split into separate functions.

### Separation of concerns
- Frontend: components render UI, hooks manage state, utils do computation, providers supply context.
- Backend: routes bind HTTP, controllers orchestrate, services/use-cases contain logic, repositories access data.
- Do not mix layers. A route handler should not contain business logic. A React component should not make direct API calls outside of hooks.

### Modularity
- Group related code in directories with clear boundaries.
- Export only what consumers need. Avoid barrel re-exports of everything.
- Prefer composition over inheritance.
- A module's public API should be obvious from its exports.

### Behavior-preserving discipline
- When changing existing code, verify the change preserves existing behavior unless behavior change is explicitly intended.
- Name the behavior being preserved in comments or commit messages when making structural changes.
- If a change is purely structural (rename, move, extract), it should produce zero behavior change.

### Avoidance of hacks and accidental complexity
- Do not add `// TODO: fix later` without a concrete plan.
- Do not add `// HACK:` without documenting why the hack exists and when it should be removed.
- Avoid string-based checks that should be enum-based or constant-based.
- Avoid magic numbers and magic strings — use named constants.
- Avoid catch-all error suppression (`catch (e) {}` with no handling).

### Lint and format gate
- Every code change must pass the project lint/check commands before being declared complete.
- Backend: `npm run lint` (ESLint) from `backend/`.
- Frontend: `npm run lint` (ESLint) from `client/`.
- Do not commit code that introduces new lint warnings. Fix them or justify them explicitly.
- If a lint rule is wrong for a specific line, use an inline disable comment with an explanation — never disable a rule globally to silence one violation.

### Dead code discipline
- Remove unused functions, variables, imports, and files as part of every change.
- Do not leave commented-out code blocks. If the code is not needed now, delete it — version control preserves history.
- When removing a function or export, search the codebase for remaining references before deleting.
- Treat dead code accumulation as a quality regression, not a neutral event.

### Conformance and consistency
- Before writing new code, study 2–3 existing files that do similar work to learn the established pattern.
- Follow the pattern already in use unless the existing pattern is explicitly being improved.
- When a change introduces a new pattern, explain why the new pattern is better than the existing one.
- Do not introduce competing patterns — converge on one approach per concern.

## Anti-patterns to flag

- God files (>500 lines mixing concerns)
- God functions (>80 lines doing multiple things)
- Copy-paste blocks larger than 10 lines
- Deeply nested conditionals (>3 levels)
- Inconsistent naming within a single file
- Dead code left in place
- Commented-out code blocks left in place
- Implicit dependencies (relying on module side effects)
- Circular dependencies
- Catch-all error suppression without logging
- Barrel re-exports that re-export everything from a directory
- Functions whose behavior changes based on a boolean flag parameter
- Utility files that grow into unrelated grab-bags

## Severity taxonomy

When reporting quality findings, classify each finding:

| Severity | Meaning | Action |
|----------|---------|--------|
| **CRITICAL** | Correctness risk, data loss potential, or security exposure | Must fix before the change is accepted |
| **HIGH** | Significant maintainability or reliability regression | Should fix in the same change; justify if deferred |
| **MEDIUM** | Quality regression that increases future maintenance cost | Fix if practical; acceptable to defer with explanation |
| **LOW** | Style, naming, or minor readability improvement | Informational; fix opportunistically |

## What this instruction set does not cover

- Framework-specific patterns (covered by frontend/backend governance)
- Schema/migration rules (covered by data-model governance)
- Deployment/CI rules (covered by cicd governance)
- Documentation routing (covered by documentation governance)

## Documentation impact

Code quality changes that alter module boundaries, file organization, or public APIs should trigger documentation-governance review for possible `docs/architecture/` or `docs/backend/` or `docs/frontend/` updates.
