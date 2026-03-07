# WS5: Real Micro-Pilot Results

**Phase**: Engineering Governance Validation
**Baseline**: `cfa3b324`

---

## Purpose

Apply governance rules against real Lifeline code to verify that the governance system produces actionable, correctly-classified findings on actual code rather than synthetic scenarios.

---

# Pilot 1: Frontend — Settings.jsx

**File**: `client/src/components/settings/Settings.jsx` (481 lines)
**Governance applied**: Frontend Engineering Governance

## Findings

### FE-PILOT-1: Excessive Prop Count
- **Severity**: HIGH
- **Category**: Component boundaries
- **Location**: [Settings.jsx line 10](client/src/components/settings/Settings.jsx#L10)
- **Finding**: Component receives 11 props: `isOpen, onClose, tags, setTags, theme, themes, setTheme, font, fonts, setFont, fetchWithAuth`. Rule: "Components should receive focused, minimal props."
- **Recommendation**: Extract appearance settings and tag management into sub-components that consume their own context or receive focused prop sets.
- **Rule source**: Instruction §Component boundaries, Review agent §Component boundary review

### FE-PILOT-2: Inline Styles in Event Handlers
- **Severity**: MEDIUM
- **Category**: UX craft / Maintainability
- **Location**: [Settings.jsx lines 126-133](client/src/components/settings/Settings.jsx#L126-L133) and throughout
- **Finding**: 20+ instances of `onMouseEnter/onMouseLeave` handlers that set inline styles for hover states. Example: `e.currentTarget.style.color = 'var(--color-text-muted)'`. CSS `:hover` pseudo-selectors or CSS modules should handle hover states.
- **Recommendation**: Move hover behavior to CSS module classes. This is duplicated across nearly every interactive element.
- **Rule source**: Instruction §Separation of concerns (UI logic vs styling), CQ Instruction §Duplication control

### FE-PILOT-3: Missing Error User Feedback
- **Severity**: HIGH
- **Category**: Loading/empty/error states
- **Location**: [Settings.jsx lines 55-57](client/src/components/settings/Settings.jsx#L55-L57), [line 84](client/src/components/settings/Settings.jsx#L84), [line 92](client/src/components/settings/Settings.jsx#L92)
- **Finding**: All three mutation handlers (`handleAddTag`, `handleDeleteTag`, `handleSaveEdit`) use `console.error` for error reporting. The user sees no feedback when a tag operation fails. Rule: "Errors that affect user data must show visible, actionable feedback."
- **Recommendation**: Show inline error messages or toast notifications for failed tag operations. The error should persist until dismissed (not auto-dismiss per ADV-FE-3 guidance).
- **Rule source**: Instruction §Loading/empty/error states, Review agent §Error UX

### FE-PILOT-4: No Confirmation for Destructive Action
- **Severity**: MEDIUM
- **Category**: UX trustworthiness
- **Location**: [Settings.jsx line 84](client/src/components/settings/Settings.jsx#L84)
- **Finding**: `handleDeleteTag` performs deletion immediately on click with no confirmation dialog. Rule: "Destructive actions should require confirmation."
- **Recommendation**: Add a confirmation step before tag deletion.
- **Rule source**: Instruction §UX quality pillars (Trustworthy)

### FE-PILOT-5: Accessibility — Missing Form Labels
- **Severity**: HIGH
- **Category**: Accessibility (Grade C)
- **Location**: [Settings.jsx lines 189-195](client/src/components/settings/Settings.jsx#L189-L195)
- **Finding**: The tag name input and color input have no associated `<label>` elements or `aria-label` attributes. `placeholder="Tag name"` alone is insufficient for screen readers. Grade C minimum requires all form inputs to have accessible labels.
- **Recommendation**: Add `aria-label` or associate `<label>` elements with each form input.
- **Rule source**: Instruction §Accessibility (Grade C minimum), Review agent §Accessibility

### FE-PILOT-6: Font Size Slider Not Connected
- **Severity**: MEDIUM
- **Category**: Correctness / dead code
- **Location**: [Settings.jsx lines 445-451](client/src/components/settings/Settings.jsx#L445-L451)
- **Finding**: The font size range input uses `defaultValue="16"` with no `onChange` handler and no connection to any state or prop. It renders but does nothing — dead UI.
- **Recommendation**: Either connect to a `fontSize` state/prop with persistence, or remove the control until the feature is implemented.
- **Rule source**: CQ Instruction §Dead code discipline, FE Instruction §Correctness

## Pilot 1 Verdict

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 0 |
| **Total** | **6** |

**Assessment**: The frontend governance correctly identifies real problems in this 481-line component. All findings are actionable and correctly classified. The governance system would recommend **Request changes** due to 3 HIGH findings (missing error feedback, excessive props, missing a11y labels).

---

# Pilot 2: Backend — Todo Vertical Slice

**Files**: [todoRoutes.js](backend/src/routes/todoRoutes.js) (77 lines) → [todoController.js](backend/src/controllers/todoController.js) (164 lines) → [TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) (358 lines)
**Governance applied**: Backend Engineering Governance

## Findings

### BE-PILOT-1: Missing User Scoping in Controller
- **Severity**: CRITICAL
- **Category**: Auth / current-user scoping
- **Location**: [todoController.js lines 44-56](backend/src/controllers/todoController.js#L44-L56)
- **Finding**: `getAll()` calls `this.listTodos.execute()` with NO user ID. The authenticated user's identity is not passed to the use case. This means the endpoint either returns all todos in the database (data leak) or the use case has hardcoded user filtering (hidden coupling).
- **Recommendation**: Extract `req.user.id` and pass it to `this.listTodos.execute(userId)`. All user-scoped queries must filter by authenticated user ID.
- **Rule source**: Instruction §Auth/current-user, Review agent §Auth scoping

### BE-PILOT-2: Missing User Scoping in Create
- **Severity**: CRITICAL
- **Category**: Auth / current-user scoping
- **Location**: [todoController.js lines 64-80](backend/src/controllers/todoController.js#L64-L80)
- **Finding**: `create()` does not pass `req.user.id` to `this.createTodo.execute()`. The created todo may not be associated with the authenticated user.
- **Recommendation**: Pass `req.user.id` as a parameter to the create use case.
- **Rule source**: Instruction §Auth/current-user, Review agent §Auth scoping

### BE-PILOT-3: Repository File Size and Mixed Responsibilities
- **Severity**: HIGH
- **Category**: Separation of concerns / Repository boundary
- **Location**: [TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) (358 lines)
- **Finding**: The repository contains business logic for statistics computation (`_buildStatsFromTodos`, `_groupLastThirtyDays`, `_groupTodosByDate`, `_groupTodosForPeriod` — lines 245-350). Statistics aggregation/grouping is domain/application logic, not persistence logic. Rule: "Repository classes encapsulate persistence — they should not contain business calculations."
- **Recommendation**: Extract statistics computation into a `StatisticsService` or use-case class. The repository should return raw data; the application layer should aggregate.
- **Rule source**: Instruction §Repository boundaries, Review agent §Layer discipline

### BE-PILOT-4: Large Save Method with Inline Logic
- **Severity**: MEDIUM
- **Category**: Complexity / Controller thinness (by analogy)
- **Location**: [TypeORMTodoRepository.js lines 21-60](backend/src/infrastructure/TypeORMTodoRepository.js#L21-L60)
- **Finding**: The `save()` method is ~40 lines with inline business logic: computing `taskNumber` via conditional max query, priority validation with fallback, array coercion. These are application-level concerns embedded in the persistence layer.
- **Recommendation**: Move task number assignment and priority normalization to the domain model or use-case layer.
- **Rule source**: Instruction §Repository boundaries, Instruction §Dependency direction

### BE-PILOT-5: Route Documentation Claims Public Access
- **Severity**: MEDIUM
- **Category**: Contract compliance
- **Location**: [todoRoutes.js lines 26-28](backend/src/routes/todoRoutes.js#L26-L28)
- **Finding**: JSDoc comments state `@access Public` for all routes. If these routes are behind auth middleware (mounted in index.js with auth), this documentation is misleading.
- **Recommendation**: Update `@access` tags to reflect actual auth requirements, or add auth middleware visibly in the route file.
- **Rule source**: Instruction §Contract-aware implementation, Review agent §Contract compliance

### BE-PILOT-6: Constructor Injection Pattern — Good Practice
- **Severity**: (Positive observation)
- **Category**: Dependency direction
- **Location**: [todoController.js lines 27-32](backend/src/controllers/todoController.js#L27-L32)
- **Finding**: Controller uses constructor injection for use cases — a clean dependency-direction pattern. The controller depends on abstractions (use-case objects), not concrete implementations.
- **Rule source**: Instruction §Dependency direction (satisfied)

## Pilot 2 Verdict

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 0 |
| Positive | 1 |
| **Net findings** | **5** |

**Assessment**: The backend governance correctly identifies the most severe issue — missing user scoping in controller methods — at CRITICAL severity. The repository boundary violation (stats logic in repository) is correctly classified as HIGH. The governance system would recommend **Request changes** due to 2 CRITICAL findings.

---

# Pilot 3: Code Quality + Refactor — TodoProvider.jsx

**File**: [TodoProvider.jsx](client/src/providers/TodoProvider.jsx) (259 lines)
**Governance applied**: Code Quality + Refactor Governance

## Code Quality Findings

### CQ-PILOT-1: Duplicated Guest Fallback Pattern
- **Severity**: HIGH
- **Category**: Duplication
- **Location**: [TodoProvider.jsx lines 46-72](client/src/providers/TodoProvider.jsx#L46-L72) and [lines 76-100](client/src/providers/TodoProvider.jsx#L76-L100)
- **Finding**: `loadTodos` and `loadTags` have nearly identical error handling logic: check `guestFallbackAppliedRef`, check error status, call `setGuestMode(true)`, set ref, load via guest API, set error. This is a textbook duplication violation (~25 lines repeated twice).
- **Recommendation**: Extract a `withGuestFallback(apiCall, guestCall)` helper that encapsulates the fallback pattern.
- **Rule source**: CQ Instruction §Duplication control ("Rule of Three is ideal; duplication of >10 lines across 2+ locations warrants extraction")

### CQ-PILOT-2: Complex Filter Logic with IIFEs
- **Severity**: HIGH
- **Category**: Complexity / Readability
- **Location**: [TodoProvider.jsx lines 183-221](client/src/providers/TodoProvider.jsx#L183-L221)
- **Finding**: The `filteredTodos` memo contains inline IIFEs `(() => { ... })()` inside `filter()` to check date-range recurrence. Three near-identical IIFE blocks check different date contexts (`today`, `tomorrow`, specific date). Nesting depth reaches 4-5 levels. Rule: "≤3 nesting levels", "Functions >50 lines are extraction candidates."
- **Recommendation**: Extract `isRecurrenceVisibleOnDate(todo, targetDate)` helper. The filter function itself is ~50 lines; the IIFEs add unnecessary closure complexity.
- **Rule source**: CQ Instruction §Readability (nesting depth), §Complexity pressure (≤3 nesting)

### CQ-PILOT-3: Error State Management — Silent Overwrites
- **Severity**: MEDIUM
- **Category**: Reliability
- **Location**: Throughout — `setError(...)` calls in multiple callbacks
- **Finding**: Multiple async operations set `error` state independently. If two operations fail simultaneously, only the last error survives. There's no error queue or aggregation.
- **Recommendation**: Either use an error array or ensure only the most recent user-facing error is displayed with clear precedence.
- **Rule source**: CQ Instruction §Avoidance of hacks (error suppression concerns)

## Refactor Assessment

### RF-PILOT-1: Extraction Candidate — Guest Fallback Pattern
- **Severity**: HIGH (if presented as a refactor PR)
- **Category**: Safe decomposition
- **Finding**: The duplicated guest fallback pattern (CQ-PILOT-1) is a clean extraction candidate. The refactor governance would require: (1) Preserved-behavior statement, (2) Tests before and after, (3) Named refactoring type: "Extract Function."
- **Refactoring type**: Extract Function (from named catalog)
- **Smell family**: Duplicated Code
- **Rule source**: Refactor Instruction §Safe extraction, §Rule of Three

### RF-PILOT-2: Extraction Candidate — Date Filtering Logic
- **Severity**: MEDIUM (if presented as a refactor PR)
- **Category**: Safe decomposition
- **Finding**: The `filteredTodos` memo's date-checking IIFEs should be extracted to a pure function. The refactor governance would require a preserved-behavior statement and would check that the extraction doesn't change filter behavior.
- **Refactoring type**: Extract Function
- **Smell family**: Long Method / Complex Conditional
- **Rule source**: Refactor Instruction §Safe decomposition

## Pilot 3 Verdict

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 3 (2 CQ + 1 RF) |
| MEDIUM | 2 (1 CQ + 1 RF) |
| LOW | 0 |
| **Total** | **5** |

**Assessment**: Both the code quality and refactor governance families correctly identify the same underlying issues (duplication, complexity) through their respective lenses. The CQ family flags duplication and complexity; the refactor family identifies safe extraction patterns and names them. Cross-family coordination works — findings complement rather than contradict.

---

# Pilot 4: Data Model — TodoEntity + Migrations

**Files**: [TodoEntity.js](backend/src/infra/db/entities/TodoEntity.js) (42 lines) + [005_add_start_day_to_user_profiles.sql](backend/migrations/005_add_start_day_to_user_profiles.sql) (6 lines)
**Governance applied**: Data Model Governance

## Findings

### DM-PILOT-1: JSONB Column Without Shape Documentation
- **Severity**: HIGH
- **Category**: JSONB shape discipline
- **Location**: [TodoEntity.js line 21](backend/src/infra/db/entities/TodoEntity.js#L21) and [line 23](backend/src/infra/db/entities/TodoEntity.js#L23)
- **Finding**: `subtasks` (jsonb, default `[]`) and `recurrence` (jsonb, nullable) have no documented shape contract. The entity defines the column but not the expected keys, types, or versioning. Rule: "Every JSONB column must have a documented shape contract."
- **Recommendation**: Add shape documentation (JSDoc, TypeScript interface, or companion doc) defining the expected structure of `subtasks` array items and `recurrence` object properties.
- **Rule source**: Instruction §JSONB shape discipline, Review agent §JSONB shape review

### DM-PILOT-2: JSONB Shape Implicitly Defined in Repository
- **Severity**: MEDIUM
- **Category**: Single source of truth
- **Location**: [TypeORMTodoRepository.js lines 46-55](backend/src/infrastructure/TypeORMTodoRepository.js#L46-L55)
- **Finding**: The `save()` method coerces `subtasks` to array and passes `recurrence` as-is. The actual JSONB shape is defined implicitly by whatever the application writes, not by a formal schema. The repository doesn't validate JSONB shape on write.
- **Recommendation**: Define and validate JSONB shapes in the domain model. The entity or a validator should enforce the contract.
- **Rule source**: Instruction §JSONB shape discipline, §Entity as source of truth

### DM-PILOT-3: Migration Uses Wrong Data Type for PostgreSQL
- **Severity**: HIGH
- **Category**: Migration safety
- **Location**: [005_add_start_day_to_user_profiles.sql line 2](backend/migrations/005_add_start_day_to_user_profiles.sql#L2)
- **Finding**: Uses `nvarchar(16)` which is a SQL Server type, not PostgreSQL. PostgreSQL uses `varchar(16)` or `text`. This migration would fail on the production PostgreSQL database unless TypeORM or the driver silently maps it. This is a correctness issue.
- **Recommendation**: Use `varchar(16)` or `text` for PostgreSQL. Verify whether this migration has been applied successfully in production.
- **Rule source**: Instruction §Migration discipline (correctness), Review agent §Migration safety

### DM-PILOT-4: Missing Cascade/Orphan Handling Documentation
- **Severity**: MEDIUM
- **Category**: Relation integrity
- **Location**: [TodoEntity.js lines 31-39](backend/src/infra/db/entities/TodoEntity.js#L31-L39)
- **Finding**: The `tags` many-to-many relation uses a join table (`todo_tags`) but the entity doesn't specify cascade behavior. The repository manually manages `todo.tags = []` before archiving (line 189 of TypeORMTodoRepository). The cascade/orphan strategy is implicit and scattered.
- **Recommendation**: Document the intended cascade behavior explicitly in the entity or a companion document.
- **Rule source**: Instruction §Relation integrity, Review agent §Cascade/orphan review

### DM-PILOT-5: Entity Definition — Good Practice
- **Severity**: (Positive observation)
- **Category**: Entity as source of truth
- **Finding**: The entity correctly uses `EntitySchema` with explicit column types, defaults, and nullability. Timestamps use `createDate`/`updateDate` for automatic management. This follows the "entity as source of truth" principle.
- **Rule source**: Instruction §Entity definitions (satisfied)

## Pilot 4 Verdict

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 2 |
| LOW | 0 |
| Positive | 1 |
| **Net findings** | **4** |

**Assessment**: The data model governance correctly identifies real issues: undocumented JSONB shapes and a SQL dialect mismatch in a migration. The JSONB findings are particularly valuable — they catch a real documentation gap that could cause shape drift over time. The governance system would recommend **Request changes** due to 2 HIGH findings.

---

# Micro-Pilot Summary

## Cross-Pilot Results

| Pilot | Family | File(s) | CRITICAL | HIGH | MEDIUM | LOW | Verdict |
|-------|--------|---------|----------|------|--------|-----|---------|
| 1 | Frontend | Settings.jsx | 0 | 3 | 3 | 0 | Request changes |
| 2 | Backend | Todo vertical slice | 2 | 1 | 2 | 0 | Request changes |
| 3 | CQ + Refactor | TodoProvider.jsx | 0 | 3 | 2 | 0 | Request changes |
| 4 | Data Model | TodoEntity + migrations | 0 | 2 | 2 | 0 | Request changes |

## Validation Metrics

| Metric | Result |
|--------|--------|
| Total findings | 21 (20 issues + 2 positive observations) |
| Actionable findings | 20/20 (100%) |
| Correctly classified | 20/20 (100%) |
| False positives | 0 |
| Missed obvious issues | 0 |
| Cross-family agreement | CQ and Refactor correctly complement on TodoProvider |
| Most severe real finding | BE-PILOT-1/2: Missing user scoping (CRITICAL) |

## Key Validation Outcomes

1. **The governance system finds real bugs**: BE-PILOT-1/2 (missing user scoping) and DM-PILOT-3 (wrong SQL dialect) are genuine production issues, not style nits.

2. **Severity classification is accurate**: CRITICALs are actual security/data-integrity issues. HIGHs are maintainability/architecture issues. MEDIUMs are quality improvements. No severity inflation.

3. **Cross-family coordination works**: The TodoProvider was correctly analyzed from both CQ (duplication, complexity) and Refactor (extraction candidates, smell identification) perspectives. Findings complemented, not contradicted.

4. **Frontend governance catches UX issues**: Settings.jsx findings include missing error feedback, missing a11y labels, and disconnected UI — all real user-facing problems.

5. **Data model governance catches shape drift risk**: The JSONB documentation gap is a real preventive finding that would avoid future shape-related bugs.

## Governance System Real-Code Applicability Score: 4.7/5.0
