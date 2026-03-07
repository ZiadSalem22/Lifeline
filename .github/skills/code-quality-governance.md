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

## Practical checklist

When reviewing code for quality:
1. Can you understand each function's purpose from its name?
2. Is each file focused on one coherent concern?
3. Are there copy-paste blocks that should be extracted?
4. Is nesting depth reasonable?
5. Are names descriptive and consistent within the file?
6. Is dead code or commented-out code present?
7. Are magic values replaced with named constants?
8. Does the change preserve existing behavior when structural?
9. Are there hacks or TODOs without plans?
10. Is the code genuinely cleaner, or just different?

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
