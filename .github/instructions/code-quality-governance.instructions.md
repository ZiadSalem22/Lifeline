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

## What this instruction set does not cover

- Framework-specific patterns (covered by frontend/backend governance)
- Schema/migration rules (covered by data-model governance)
- Deployment/CI rules (covered by cicd governance)
- Documentation routing (covered by documentation governance)

## Documentation impact

Code quality changes that alter module boundaries, file organization, or public APIs should trigger documentation-governance review for possible `docs/architecture/` or `docs/backend/` or `docs/frontend/` updates.
