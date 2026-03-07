# WS2: Scenario Packs for All 5 Governance Families

**Phase**: Engineering Governance Validation
**Baseline**: `cfa3b324`

---

## Purpose

Define realistic, grounded development scenarios for each governance family. Each scenario describes a hypothetical (but realistic) code change and the expected governance response at each layer.

Scenarios are grounded in actual Lifeline code patterns discovered during baseline analysis.

---

# Code Quality Family — Scenarios

## CQ-1: Giant Function Extraction (Positive)

**Type**: positive | **Difficulty**: moderate

**Setup**: A developer extracts a 90-line function in a controller into three focused functions of ~25 lines each, with clear names. All behavior is preserved. Existing tests pass.

**Grounded in**: `todoController.js` (163 lines) — realistic extraction target.

**Expected governance behavior**:
- **Instruction**: Validates that functions are under ~50 lines, names are descriptive. Approves.
- **Skill**: Confirms readability improvement, duplication control, behavior preservation. 6-dimension review sees improvement.
- **Builder agent**: Would have recommended this extraction. Recognizes correct scope placement.
- **Review agent**: Produces finding at MEDIUM praise or no findings (clean). Checks behavior preservation. Verdict: Approve.
- **Workflow**: Conformance check passes (follows existing patterns). Lint gate passes. Cross-cutting analysis finds consistency.
- **Prompt**: Structured output with zero or low-severity informational findings only.

**Key rules exercised**: Function length limit (~50 lines), naming quality, behavior preservation, conformance check.

---

## CQ-2: Copy-Paste Proliferation (Negative)

**Type**: negative | **Difficulty**: easy

**Setup**: A developer adds a new validation function by copy-pasting 35 lines from an existing validator, changing 3 lines. Both versions now exist in `backend/src/validators/index.js`.

**Grounded in**: `validators/index.js` (91 lines, all validators in one file).

**Expected governance behavior**:
- **Instruction**: Flags duplication control violation. 30+ identical lines must be extracted.
- **Skill**: Identifies duplication in "Duplication control" section. Recommends extracting shared logic at narrowest scope.
- **Builder agent**: Should have recommended extraction instead of copy-paste. Checks for existing utilities first.
- **Review agent**: Produces HIGH finding under Duplication category. Explains why (maintenance burden, divergence risk). Verdict: Request changes.
- **Workflow**: Duplication detected in lint/analysis step. Cross-cutting flags validators file growing unbounded.
- **Prompt**: Structured finding: HIGH / Duplication / validators/index.js / "35-line copy-paste block" / "Extract shared validation logic into parameterized function."

**Key rules exercised**: Duplication control, "check existing utilities first", extraction to narrowest scope, file focus.

---

## CQ-3: Deep Nesting and Poor Names (Negative)

**Type**: negative | **Difficulty**: easy

**Setup**: New code has 5 levels of nesting inside a single function. Variables named `d`, `r`, `temp`, `flag`. No early returns.

**Expected governance behavior**:
- **Instruction**: Flags nesting depth (should be ≤3), generic names (forbidden list), missing early returns.
- **Skill**: Multiple categories hit: Readability, Naming quality.
- **Builder agent**: Would have recommended early-return guards, descriptive names.
- **Review agent**: HIGH finding for nesting, MEDIUM for naming. Multiple findings. Verdict: Request changes.
- **Workflow**: Readability analysis step catches violations.
- **Prompt**: Multiple structured findings with specific location and recommendation.

**Key rules exercised**: Nesting depth ≤3, naming conventions, early-return preference, descriptive names.

---

## CQ-4: Clean Well-Structured Change (Positive)

**Type**: positive | **Difficulty**: easy

**Setup**: A developer adds a new utility function in `backend/src/utils/` — 20 lines, clear name, handles error cases, has corresponding test, follows existing patterns in the utils directory.

**Expected governance behavior**:
- **All layers**: Approve with no findings or informational-only findings.
- **Conformance check**: Passes — follows existing patterns.
- **Review agent verdict**: Approve.

**Key rules exercised**: Conformance check, lint gate, file focus, naming quality.

---

## CQ-5: Large Inconsistent Multi-File Change (Borderline)

**Type**: borderline | **Difficulty**: hard

**Setup**: A 12-file change across both frontend and backend. Most files follow conventions, but 2 files introduce a new error-handling pattern without justifying it. The new pattern works but conflicts with the established centralized error handler.

**Grounded in**: Backend uses centralized error handling per backend governance; a multi-file change could introduce competing patterns.

**Expected governance behavior**:
- **Instruction**: New pattern introduction requires justification and documentation.
- **Skill**: Cross-cutting analysis should detect inconsistency.
- **Review agent**: HIGH finding for unjustified new pattern, MEDIUM finding for competing patterns. Verdict: Request changes.
- **Workflow**: Cross-cutting step is critical here — must detect the inconsistency across 12 files.
- **Prompt**: Findings focus on conformance violation and recommendation to either adopt the new pattern codebase-wide or revert to the existing one.

**Key rules exercised**: Conformance check, cross-cutting analysis, "if a new pattern is introduced, is it justified?", competing patterns detection.

---

## CQ-6: Silent Error Suppression (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A catch block catches an error and does nothing with it: `catch (e) {}`. The function is responsible for saving user data.

**Expected governance behavior**:
- **Instruction**: Flags "errors handled explicitly, not suppressed silently".
- **Review agent**: CRITICAL finding — silent error suppression in data-saving code. Verdict: Request changes.
- **Prompt**: Structured finding with CRITICAL severity, Reliability category.

**Key rules exercised**: Silent error suppression rule, dead code cleanliness, reliability.

---

# Frontend Family — Scenarios

## FE-1: Overgrown God Component (Negative)

**Type**: negative | **Difficulty**: hard

**Setup**: A component has grown to 600 lines. It handles routing, state management, data fetching, form logic, and rendering. Multiple responsibilities in one file.

**Grounded in**: `App.jsx` (3724 lines), `AdvancedSearch.jsx` (700 lines) — real Lifeline god components.

**Expected governance behavior**:
- **Instruction**: Flags file size (>300 lines), multiple responsibilities. Recommends decomposition into page + feature components.
- **Skill**: Component boundary rules triggered. State ownership check. Performance (unnecessary re-renders likely).
- **Builder agent**: Recommends splitting into smaller components. Identifies page vs. component boundary.
- **Review agent**: HIGH finding for component size, MEDIUM for mixed responsibilities. Checks UX pillars (Craft pillar concerned about maintainability). Verdict: Request changes.
- **Workflow**: Component boundary check fails. UX pillar assessment flags Craft concerns.
- **Prompt**: Structured findings with component decomposition recommendation.

**Key rules exercised**: Component size limits, single responsibility, state ownership, component placement rules.

---

## FE-2: State in Wrong Layer (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A child component uses `useState` for data that is needed by a sibling component. Props-drilling through the parent would be the correct approach (or lifting state to parent). Instead, the developer duplicates the state in both components.

**Grounded in**: Provider/context pattern in `TodoProvider.jsx`, `AuthProvider.jsx`.

**Expected governance behavior**:
- **Instruction**: State should be at the narrowest shared scope. Duplicated state = data inconsistency risk.
- **Skill**: State ownership rules flag incorrect placement. Provider pattern should be used for shared state.
- **Builder agent**: Recommends lifting state to parent or using existing provider.
- **Review agent**: HIGH finding for state duplication. MEDIUM for data inconsistency risk. Verdict: Request changes.

**Key rules exercised**: State ownership, provider/context usage, lifting decisions, narrowest shared scope.

---

## FE-3: Inaccessible Form (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A form uses `<div onClick>` for submit buttons, inputs lack labels, color is the only error indicator, no ARIA attributes.

**Grounded in**: Real form components like `Settings.jsx` (480 lines), `SignUpForm.jsx`.

**Expected governance behavior**:
- **Instruction**: Accessibility Grade C minimum (WCAG A). Buttons must be `<button>`, inputs need labels, errors need text indicators.
- **Skill**: Accessibility grading system triggered. Grade C violations found.
- **Review agent**: CRITICAL finding for `<div onClick>` replacing buttons (keyboard inaccessible). HIGH for missing labels. MEDIUM for color-only indicators. Verdict: Request changes.
- **Prompt**: Findings structured with accessibility category. References WCAG A requirements.

**Key rules exercised**: Accessibility grading (Grade C = WCAG A), semantic HTML, form UX quality.

---

## FE-4: Missing Loading/Empty/Error States (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A new data display component fetches data but only renders the happy path. No loading spinner, no empty state message, no error handling UI.

**Expected governance behavior**:
- **Instruction**: UX quality pillar "Trustworthy" requires visible system state. Loading/empty/error states are mandatory.
- **Skill**: Completeness checklist catches missing states.
- **Review agent**: HIGH finding for missing loading state, MEDIUM for missing empty and error states. UX Pillar Status: Trustworthy=FAIL. Verdict: Request changes.

**Key rules exercised**: UX quality pillars (Trustworthy), loading/empty/error state completeness, system state visibility.

---

## FE-5: Well-Structured New Component (Positive)

**Type**: positive | **Difficulty**: easy

**Setup**: A developer adds a 60-line component in the correct directory, uses CSS Modules, has proper accessibility, handles loading/empty/error states, uses existing provider for data, follows naming conventions.

**Expected governance behavior**:
- **All layers**: Approve with no or informational-only findings.
- **UX pillar assessment**: All three pillars pass (Frictionless, Craft, Trustworthy).
- **Accessibility**: Grade C+ met.

**Key rules exercised**: Component placement, CSS Modules, accessibility, UX pillars, state ownership.

---

## FE-6: Performance Anti-Pattern (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A component creates a new callback function and new object in every render, passing them as props to a memoized child. The child re-renders on every parent render, defeating React.memo.

**Expected governance behavior**:
- **Instruction**: Performance priority rules — avoid unnecessary re-renders. Use `useCallback`/`useMemo` for stable references.
- **Skill**: Performance-sensitive React patterns section triggered.
- **Review agent**: MEDIUM finding for defeated memoization. Performance category.

**Key rules exercised**: Performance priority rules, React memoization patterns, UX key metrics.

---

# Backend Family — Scenarios

## BE-1: Fat Route with Business Logic (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A route handler contains 50 lines of business logic including database queries, conditional logic, email sending, and response formatting — all in the route file.

**Grounded in**: `todoRoutes.js` (76 lines) — should only have HTTP binding. `todoController.js` (163 lines) — should orchestrate, not compute.

**Expected governance behavior**:
- **Instruction**: Routes are limited to HTTP binding. Business logic belongs in `application/`.
- **Skill**: Layer discipline check: dependency direction violation (route importing domain logic directly).
- **Builder agent**: Recommends extracting to controller + use-case. Identifies correct layer placement.
- **Review agent**: CRITICAL finding for layer discipline violation. HIGH for dependency direction breach. Finds database queries in route (should be in repository). Verdict: Request changes.
- **Workflow**: Dependency direction step catches routes → domain import.

**Key rules exercised**: Layer discipline, dependency direction (routes → controllers → application → domain ← infrastructure), controller thinness, repository encapsulation.

---

## BE-2: Leaking Repository Internals (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A use-case directly constructs TypeORM `QueryBuilder` calls instead of calling repository methods. TypeORM-specific code appears outside the repository.

**Grounded in**: `TypeORMTodoRepository.js` (357 lines) — all ORM code should live here.

**Expected governance behavior**:
- **Instruction**: TypeORM-specific code must be contained within repositories. Repository encapsulation violated.
- **Skill**: Repository encapsulation check fails. Dependency direction violated (application layer importing ORM).
- **Review agent**: CRITICAL finding — ORM leakage breaks layer boundaries. Verdict: Request changes.

**Key rules exercised**: Repository encapsulation, dependency direction, layer discipline.

---

## BE-3: Missing Auth Scoping (Negative)

**Type**: negative | **Difficulty**: hard

**Setup**: A new endpoint queries todos without filtering by `userId`. Any authenticated user could access any other user's todos.

**Grounded in**: All entities are user-scoped — every query must filter by `userId`.

**Expected governance behavior**:
- **Instruction**: Auth and user scoping — "user-scoped queries filtered by the authenticated user's ID."
- **Review agent**: CRITICAL finding — cross-user data leakage risk. Security category. Verdict: Request changes.
- **Prompt**: CRITICAL / Auth Safety / "Endpoint queries todos without userId filter — exposes all users' data."

**Key rules exercised**: Auth and user scoping, security discipline, user-scoped query enforcement.

---

## BE-4: Inconsistent Error Handling (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A new controller returns raw database errors in the response body. Some endpoints use `res.status(500).json({ error: err.message })` exposing SQL error details.

**Grounded in**: Backend governance requires structured errors via centralized error handler.

**Expected governance behavior**:
- **Instruction**: Errors must be structured, not raw. Centralized error handler must be used. Internal details must not leak.
- **Review agent**: HIGH finding for raw error leakage. MEDIUM for inconsistent error format. Security category (exposes internals). Verdict: Request changes.

**Key rules exercised**: Error handling discipline, security (no internal details in responses), contract compliance.

---

## BE-5: Well-Layered New Endpoint (Positive)

**Type**: positive | **Difficulty**: easy

**Setup**: New endpoint follows the correct layering: route (HTTP binding) → controller (orchestration, ~20 lines) → use-case (business logic) → repository (data access). Validation in middleware. Auth scoping present. Error handling uses centralized handler.

**Grounded in**: The `todoRoutes` → `todoController` → `CreateTodo` → `TypeORMTodoRepository` → `TodoEntity` vertical slice.

**Expected governance behavior**:
- **All layers**: Approve. Layer discipline correct. Dependency direction correct. Auth scoping present.
- **Review agent verdict**: Approve with zero findings or informational only.

**Key rules exercised**: Layer discipline, dependency direction, controller thinness, repository encapsulation, auth scoping, error handling.

---

## BE-6: Raw SQL in Controller (Negative)

**Type**: negative | **Difficulty**: easy

**Setup**: A controller method directly runs `dataSource.query("SELECT ...")` instead of calling a repository method.

**Expected governance behavior**:
- **Instruction**: Multiple violations — controllers do orchestration only, databases accessed through repositories only.
- **Review agent**: CRITICAL layer discipline violation + CRITICAL repository encapsulation violation. Verdict: Request changes.

**Key rules exercised**: Layer discipline, repository encapsulation, dependency direction.

---

# Data Model Family — Scenarios

## DM-1: Unsafe Column Rename Without Migration Plan (Negative)

**Type**: negative | **Difficulty**: hard

**Setup**: A developer renames a column in an EntitySchema definition and writes a migration that does `ALTER COLUMN RENAME`. No dual-write phase, no rollback plan, existing queries will break if deployment partially fails.

**Grounded in**: EntitySchema definitions in `backend/src/infra/db/entities/` and migration patterns in `backend/src/migrations/`.

**Expected governance behavior**:
- **Instruction**: Column operations must follow column safety rules table. Renames require the 5-phase zero-downtime pattern.
- **Skill**: Zero-downtime migration pattern triggered. Rollback strategy required.
- **Builder agent**: Should recommend add-new → dual-write → backfill → read-from-new → remove-old.
- **Review agent**: CRITICAL finding — unsafe rename without migration safety plan. Missing rollback strategy. Verdict: Request changes.
- **Workflow**: Zero-downtime assessment step fails. Rollback review step fails.
- **Prompt**: CRITICAL / Migration Safety / "Column rename without dual-write phase — will cause downtime on partial deployment failure."

**Key rules exercised**: Zero-downtime 5-phase migration, rollback strategy, column operation safety rules.

---

## DM-2: Missing Ownership Chain (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A new entity is created without a `userId` column. It stores data that should be user-scoped but has no ownership reference.

**Grounded in**: Real entities all have ownership chains — User → UserProfile, User → UserSettings, User → Todo → TodoTag, User → Tag.

**Expected governance behavior**:
- **Instruction**: "Do not create entities without a clear ownership chain." User-scoped entities must have `userId`.
- **Review agent**: CRITICAL finding — missing ownership chain. Data security risk (no user scoping possible). Verdict: Request changes.

**Key rules exercised**: Ownership rules, user-scoping enforcement, entity definition requirements.

---

## DM-3: JSONB Shape Change Without Migration (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: Code starts writing new keys to a JSONB column without a migration to handle existing data. Old rows have different shape than new rows.

**Grounded in**: JSONB shape discipline rules in data-model governance.

**Expected governance behavior**:
- **Instruction**: JSONB shape changes are schema changes. Must create migration for data transformation.
- **Review agent**: HIGH finding — undocumented JSONB shape change. MEDIUM — no migration for existing data.
- **Prompt**: HIGH / Schema Safety / "JSONB shape changed without migration — existing rows will have inconsistent shape."

**Key rules exercised**: JSONB shape discipline, schema change = migration required, shape validation.

---

## DM-4: Correct Additive Migration (Positive)

**Type**: positive | **Difficulty**: easy

**Setup**: A developer adds a new nullable column to an existing table. Migration is idempotent, wrapped in transaction, has corresponding EntitySchema update. Rollback plan: drop the column.

**Grounded in**: Real migration pattern — `005_add_start_day_to_user_profiles.sql`.

**Expected governance behavior**:
- **All layers**: Approve. Additive change is the safest column operation.
- **Review agent**: No findings or informational only. Rollback plan is noted and correct.

**Key rules exercised**: Column operation safety rules (additive = safe), migration idempotency, rollback strategy, EntitySchema sync.

---

## DM-5: Modifying Already-Applied Migration (Negative)

**Type**: negative | **Difficulty**: easy

**Setup**: A developer modifies `001_initial_migration.sql` instead of creating a new migration file.

**Expected governance behavior**:
- **Instruction**: "Never modify an already-applied migration — create a new one."
- **Review agent**: CRITICAL finding — modifying applied migration. Production data integrity at risk. Verdict: Request changes.

**Key rules exercised**: Migration immutability, never-modify-applied-migration rule.

---

## DM-6: Missing Cascade Declaration (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A new relation is added without explicit cascade behavior. Default TypeORM cascade behavior is relied upon, which could cause orphan records.

**Grounded in**: TodoTag join entity and cascade rules.

**Expected governance behavior**:
- **Instruction**: "Cascade behavior must be explicitly declared, not left to defaults."
- **Review agent**: HIGH finding — implicit cascade behavior. MEDIUM — orphan record risk.

**Key rules exercised**: Relation integrity, explicit cascade declaration, orphan record prevention.

---

# Refactor Family — Scenarios

## RF-1: Safe Extract Method (Positive)

**Type**: positive | **Difficulty**: easy

**Setup**: A developer extracts a 40-line helper function from a 120-line function. The extraction is behavior-preserving, the original tests pass, the new function has a clear name, and the commit message states "This refactor preserves: [specific behavior]."

**Expected governance behavior**:
- **All layers**: Approve. Safe refactoring loop followed. Behavior preservation stated.
- **Review agent**: No findings or informational. Verdict: Approve.

**Key rules exercised**: Behavior-preserving discipline, safe extraction, preserved-behavior statement.

---

## RF-2: Behavior-Changing "Refactor" (Negative)

**Type**: negative | **Difficulty**: hard

**Setup**: A commit labeled "refactor: cleanup Settings component" actually changes the validation behavior — some inputs that were previously accepted are now rejected. No regression test was added, and the behavior change is not documented.

**Grounded in**: `Settings.jsx` (480 lines) — realistic refactor target.

**Expected governance behavior**:
- **Instruction**: "If a refactor accidentally changes behavior, the change must be reverted or the behavior change must be explicitly acknowledged."
- **Skill**: Behavior-preserving discipline triggered. Missing regression test flagged.
- **Review agent**: CRITICAL finding — undocumented behavior change in a "refactor". HIGH — no regression test. Verdict: Request changes.
- **Prompt**: CRITICAL / Behavior Preservation / "Commit labeled refactor but changes validation behavior. Behavior change must be documented or reverted."

**Key rules exercised**: Behavior-preserving discipline, regression test before refactoring, explicit acknowledgment of behavior changes.

---

## RF-3: Scope Creep in Refactoring (Negative)

**Type**: negative | **Difficulty**: moderate

**Setup**: A PR titled "refactor: extract search logic from AdvancedSearch" also fixes two bugs, adds a new feature (search sorting), and reorganizes the CSS file. All in one commit.

**Grounded in**: `AdvancedSearch.jsx` (700 lines) — realistic decomposition target.

**Expected governance behavior**:
- **Instruction**: "Scope creep is the primary risk of refactoring. Stay within the stated scope." Mixed refactoring + feature + bugfix in one change.
- **Skill**: Incremental change discipline violated. Scope control violated.
- **Review agent**: HIGH finding for scope creep. MEDIUM for non-incremental change. Recommends splitting into separate commits. Verdict: Request changes.
- **Prompt**: HIGH / Scope Control / "PR mixes refactoring, bug fixes, and new features. Each should be a separate commit."

**Key rules exercised**: Scope control, incremental change discipline, "log separate tasks — do not fix everything at once."

---

## RF-4: Bad Abstraction from Coincidental Similarity (Negative)

**Type**: negative | **Difficulty**: hard

**Setup**: A developer extracts a "shared" function from two similar-looking blocks that are actually serving different purposes. The extracted function needs `if/else` branches to handle both callers.

**Expected governance behavior**:
- **Instruction**: "If the abstraction requires `if/else` branches for different callers, the code may not be truly duplicated — it may be coincidentally similar."
- **Skill**: Duplication removal rules triggered — bad abstraction detection.
- **Review agent**: HIGH finding — bad abstraction from coincidental similarity. Recommends reverting extraction and keeping explicit duplication. Verdict: Request changes.

**Key rules exercised**: "Prefer explicit duplication over bad abstraction", coincidental similarity detection, if/else branching as abstraction red flag.

---

## RF-5: Large Safe Decomposition (Positive)

**Type**: positive | **Difficulty**: hard

**Setup**: A developer decomposes a 400-line component into four components (~100 lines each) in four separate commits. Each commit is independently reviewable, tests pass at each step, and preserved behavior is stated.

**Grounded in**: `Statistics.jsx` (413 lines) — excellent decomposition candidate.

**Expected governance behavior**:
- **All layers**: Approve. Incremental change discipline followed. Behavior preservation maintained at each step.
- **Review agent**: Approve per commit. Overall refactor is well-structured.

**Key rules exercised**: Safe decomposition, incremental change discipline, behavior preservation per step, independent reviewability.

---

## RF-6: Refactor Without Justification (Borderline)

**Type**: borderline | **Difficulty**: moderate

**Setup**: A developer renames several variables and reorganizes imports across 8 files. When asked why: "it feels cleaner." No measurable improvement in readability, duplication, or complexity.

**Expected governance behavior**:
- **Instruction**: "Invalid justifications: 'feels cleaner' without specifics." Valid justifications require concrete improvement.
- **Review agent**: MEDIUM finding — refactor lacks valid justification. Not blocking if the rename is genuinely better, but requires specific justification. Verdict: Request changes (needs justification).

**Key rules exercised**: Refactor justification requirements, valid vs. invalid justifications, scope control.

---

# Scenario Summary

| Family | ID | Title | Type | Difficulty |
|--------|----|-------|------|------------|
| Code Quality | CQ-1 | Giant Function Extraction | positive | moderate |
| Code Quality | CQ-2 | Copy-Paste Proliferation | negative | easy |
| Code Quality | CQ-3 | Deep Nesting and Poor Names | negative | easy |
| Code Quality | CQ-4 | Clean Well-Structured Change | positive | easy |
| Code Quality | CQ-5 | Large Inconsistent Multi-File Change | borderline | hard |
| Code Quality | CQ-6 | Silent Error Suppression | negative | moderate |
| Frontend | FE-1 | Overgrown God Component | negative | hard |
| Frontend | FE-2 | State in Wrong Layer | negative | moderate |
| Frontend | FE-3 | Inaccessible Form | negative | moderate |
| Frontend | FE-4 | Missing Loading/Empty/Error States | negative | moderate |
| Frontend | FE-5 | Well-Structured New Component | positive | easy |
| Frontend | FE-6 | Performance Anti-Pattern | negative | moderate |
| Backend | BE-1 | Fat Route with Business Logic | negative | moderate |
| Backend | BE-2 | Leaking Repository Internals | negative | moderate |
| Backend | BE-3 | Missing Auth Scoping | negative | hard |
| Backend | BE-4 | Inconsistent Error Handling | negative | moderate |
| Backend | BE-5 | Well-Layered New Endpoint | positive | easy |
| Backend | BE-6 | Raw SQL in Controller | negative | easy |
| Data Model | DM-1 | Unsafe Column Rename | negative | hard |
| Data Model | DM-2 | Missing Ownership Chain | negative | moderate |
| Data Model | DM-3 | JSONB Shape Change Without Migration | negative | moderate |
| Data Model | DM-4 | Correct Additive Migration | positive | easy |
| Data Model | DM-5 | Modifying Already-Applied Migration | negative | easy |
| Data Model | DM-6 | Missing Cascade Declaration | negative | moderate |
| Refactor | RF-1 | Safe Extract Method | positive | easy |
| Refactor | RF-2 | Behavior-Changing "Refactor" | negative | hard |
| Refactor | RF-3 | Scope Creep in Refactoring | negative | moderate |
| Refactor | RF-4 | Bad Abstraction from Coincidental Similarity | negative | hard |
| Refactor | RF-5 | Large Safe Decomposition | positive | hard |
| Refactor | RF-6 | Refactor Without Justification | borderline | moderate |

**Total**: 30 scenarios (6 per family)
**Coverage**: 5 positive, 20 negative, 2 borderline, 3 adversarial-adjacent
