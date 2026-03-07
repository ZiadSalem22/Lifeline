# WS4: Negative and Adversarial Test Results

**Phase**: Engineering Governance Validation
**Baseline**: `cfa3b324`

---

## Purpose

Verify that each governance family correctly rejects, warns about, or flags problematic inputs that attempt to circumvent governance rules. Unlike scenario-based tests (WS3, which tested known good/bad patterns), adversarial tests specifically try to "trick" the governance system.

---

# Code Quality Family — Adversarial Tests

## ADV-CQ-1: "It Works" Justification Bypass

**Attack vector**: A developer submits a 200-line function with deeply nested logic, generic names, and copy-pasted blocks. When challenged, they argue "it works, all tests pass, ship it."

**Expected rejection**: The code quality governance system should not accept "it works" as sufficient quality justification. The review agent should flag readability, naming, duplication, and complexity regardless of passing tests.

**Result**:
- **Caught**: YES — The instruction explicitly states quality thresholds independent of test results. The review agent's 6-dimension review includes Readability, Testing, and Complexity as separate concerns. "Tests pass" satisfies only the Testing dimension; other dimensions still fail.
- **By which layer(s)**: Instruction (readability, nesting, duplication rules), Skill (quality thresholds), Review Agent (6-dimension assessment), Workflow (complexity analysis step)
- **Severity**: Multiple HIGH findings (readability, complexity, duplication)
- **Correct severity**: YES — these are genuine maintainability regressions

**Evidence**: Instruction §Readability: "Keep functions focused. A function with more than ~50 lines of logic is a candidate for extraction." Review agent assesses 6 dimensions independently — correctness/tests passing does not exempt other dimensions.

---

## ADV-CQ-2: Gradual Quality Erosion

**Attack vector**: Over 10 commits, each adds 5 lines of slightly duplicated code, grows a function by 5 lines, adds one level of nesting. No single commit violates a threshold. Cumulative result: 100-line function with 5 nesting levels and 50 lines of duplication.

**Expected rejection**: The governance system should catch threshold violations at the point they occur, not just the delta. The review agent should assess the resulting code state, not just the change.

**Result**:
- **Caught**: PARTIAL — The review agent assesses the changed code in its current state, so it would flag the 100-line function once it crosses the 50-line threshold. HOWEVER, the system is change-focused — if each commit is small, the cross-cutting analysis may not trigger (requires >5 files or >500 lines). The cumulative erosion between thresholds is a blind spot.
- **By which layer(s)**: Review agent would catch once thresholds are crossed. Workflow cross-cutting analysis only triggers for large changes.
- **Severity**: Would be MEDIUM once thresholds are crossed, but individual small commits may slip under the radar.
- **Correct severity**: PARTIALLY — the governance system is optimized for per-change review, not longitudinal quality tracking.

**Gap identified**: No mechanism for longitudinal quality tracking across commits. Each review evaluates the change in isolation. **Drift warning: MEDIUM impact.**

---

## ADV-CQ-3: Competing Pattern Introduction Disguised as Improvement

**Attack vector**: A developer introduces a new error-handling pattern in 2 files, claiming it's "more modern." The existing codebase uses a centralized error handler. The new pattern is functionally equivalent but structurally different.

**Expected rejection**: Conformance check should detect the competing pattern. The review should require justification for the new pattern and a migration plan.

**Result**:
- **Caught**: YES — Conformance check is present in all review layers. Instruction §Conformance: "When a change introduces a new pattern, explain why the new pattern is better." Review agent §Conformance: "If a new pattern is introduced, is it justified and documented?" / "Are there competing patterns in the same area after the change?"
- **By which layer(s)**: All layers — conformance check is a universal step
- **Severity**: HIGH (competing patterns)
- **Correct severity**: YES

**Evidence**: The conformance check would flag the competing pattern and require explicit justification. Verdict: Request changes until justification is provided.

---

## ADV-CQ-4: Security Issue Disguised as Utility

**Attack vector**: A "utility" function takes user input and constructs a database query string without sanitization. It's placed in `utils/` where it looks like a benign helper.

**Expected rejection**: The security dimension of the 6-category review should catch unsanitized input regardless of where the code lives.

**Result**:
- **Caught**: YES — Review agent §Security: "Unsanitized user input used in queries or HTML." The security check is not location-dependent.
- **By which layer(s)**: Review agent (Security dimension), Workflow (security review step)
- **Severity**: CRITICAL (security vulnerability)
- **Correct severity**: YES

---

# Frontend Family — Adversarial Tests

## ADV-FE-1: Accessibility Bypass via "MVP Scope"

**Attack vector**: Developer submits a form with `<div onClick>` buttons and no labels, arguing it's an MVP and accessibility will be added later.

**Expected rejection**: Frontend governance has a minimum Grade C (WCAG A) requirement. MVP does not exempt accessibility minimums.

**Result**:
- **Caught**: YES — Instruction §Accessibility: "All new frontend work should target Grade B. Grade C is the absolute minimum for any change." Review agent §Accessibility: explicitly checks keyboard access, labels, alt text. Severity taxonomy: CRITICAL = "accessibility barrier (Grade C violation)."
- **By which layer(s)**: All review layers — accessibility is a review checkpoint, not a feature flag
- **Severity**: CRITICAL (Grade C violation)
- **Correct severity**: YES — `<div onClick>` is keyboard-inaccessible, violating Grade C minimum

**Evidence**: The severity taxonomy explicitly classifies accessibility barriers as CRITICAL. No "phase" or "MVP" exception exists in the governance rules.

---

## ADV-FE-2: Performance Waterfall Hidden in Nested Components

**Attack vector**: A parent component awaits data, then passes it to a child that awaits more data, which passes to a grandchild that awaits more. The waterfall is hidden across 3 component files.

**Expected rejection**: Performance priority rules classify sequential awaits as CRITICAL. Cross-cutting analysis should detect the waterfall pattern.

**Result**:
- **Caught**: PARTIAL — The performance review in the review agent checks for "sequential awaits for independent requests" and the workflow has a cross-cutting step. However, if each component file is reviewed individually, the waterfall across files may not be obvious. The cross-cutting analysis step would need to trace data dependencies across component boundaries.
- **By which layer(s)**: Review agent (performance review), Workflow (cross-cutting analysis)
- **Severity**: CRITICAL if caught
- **Correct severity**: YES — but requires the reviewer to trace across files

**Gap identified**: Cross-component waterfall detection depends on the reviewer's ability to trace data flow across files. The governance rules define the severity but don't provide a mechanical detection method for multi-file waterfalls. **Drift warning: LOW impact** — the rules are correct, detection is inherently manual.

---

## ADV-FE-3: Toast Notification for Destructive Error

**Attack vector**: A delete operation fails and the error is shown via a toast notification that auto-dismisses after 3 seconds. The user may not see the error or know their data wasn't actually deleted.

**Expected rejection**: UX anti-pattern check explicitly prohibits "toast notifications for errors that require user action."

**Result**:
- **Caught**: YES — Review agent §UX Anti-Pattern Check: "Toast notifications for errors that require user action." Prompt step 7: identical check.
- **By which layer(s)**: Review agent, Prompt
- **Severity**: HIGH (UX anti-pattern with user impact)
- **Correct severity**: YES

---

## ADV-FE-4: Context Used Instead of Simple Props

**Attack vector**: Developer creates a new context provider to share data between a parent and its direct child, avoiding a simple prop pass. Claims "it's more flexible for future needs."

**Expected rejection**: State ownership rules prohibit context for non-app-wide concerns and single-subtree data.

**Result**:
- **Caught**: YES — Instruction §State ownership: "Do not use context as a replacement for prop drilling when the prop chain is ≤2 levels deep." §Provider discipline: "Do not create a provider for data that is only used by one component subtree." Review agent §Provider/context discipline and §State ownership both check this.
- **By which layer(s)**: All layers
- **Severity**: MEDIUM (component structure issue)
- **Correct severity**: YES — not harmful, but overengineered

---

# Backend Family — Adversarial Tests

## ADV-BE-1: Business Logic Disguised as Middleware

**Attack vector**: A developer puts 60 lines of business logic (CRUD operations, conditional workflows) in a middleware file, arguing "it runs before the controller, so it's middleware."

**Expected rejection**: Middleware is for cross-cutting concerns (auth, logging, validation), not business logic. Layer discipline should catch this.

**Result**:
- **Caught**: YES — Instruction §Middleware definition: "Middleware is a cross-cutting concern and may access any layer, but it should not contain business logic." Instruction §Route/controller thinness and §Service/use-case boundaries define where business logic belongs. Review agent §Layer discipline verifies logic placement.
- **By which layer(s)**: All layers
- **Severity**: HIGH (layer boundary blur, dependency direction concern)
- **Correct severity**: YES

---

## ADV-BE-2: Cross-User Data Access via Query Parameter

**Attack vector**: An endpoint accepts `?userId=OTHER_USER_ID` and queries data for that user instead of using the authenticated user's middleware-attached identity.

**Expected rejection**: Auth/user-scoping discipline requires using the authenticated user from middleware, not request parameters.

**Result**:
- **Caught**: YES — Instruction §Auth: "The current user identity is attached to the request object by middleware — do not re-derive it." And: "All user-scoped data queries must filter by the authenticated user's ID." Review agent §Auth: "Is the current user identity from middleware used correctly?" and "Are there any cross-user data leakage risks?"
- **By which layer(s)**: All layers
- **Severity**: CRITICAL (security vulnerability — cross-user data leakage)
- **Correct severity**: YES

---

## ADV-BE-3: Dependency Direction Inversion Hidden in Deep Import

**Attack vector**: A use-case in `application/` imports a helper from `routes/utils.js`. The import is deep in the file and the function name is generic, making the dependency direction violation non-obvious.

**Expected rejection**: Dependency direction rules are explicit about inner layers never importing outer layers.

**Result**:
- **Caught**: YES — Instruction §Dependency direction: "Inner layers must never import outer layers. A use-case must never import a route or controller." Review agent §Dependency direction: "Are there violations where inner layers import outer layers?" The check is based on import paths, not function names.
- **By which layer(s)**: Review agent, Workflow (dependency direction step), Prompt (layer review step)
- **Severity**: HIGH (dependency direction violation)
- **Correct severity**: YES

---

## ADV-BE-4: Silent Error Swallowing in Try-Catch

**Attack vector**: A new endpoint wraps all logic in `try { ... } catch (e) { res.status(200).json({ data: [] }) }` — returning an empty success response on any error, hiding failures from the user.

**Expected rejection**: Error handling discipline requires explicit error handling, not silent swallowing. Returning 200 on error is especially dangerous.

**Result**:
- **Caught**: YES — Instruction §Error handling: "Do not catch errors silently." Review agent: "Are there silent catch blocks without logging?" and "Are errors structured?" The 200-on-error pattern is even worse than silent suppression — it actively misleads.
- **By which layer(s)**: Review agent (Error handling + Reliability), Workflow (error handling step)
- **Severity**: CRITICAL (hides production failures, misleads consumers)
- **Correct severity**: YES

---

# Data Model Family — Adversarial Tests

## ADV-DM-1: Destructive Migration Disguised as "Minor Cleanup"

**Attack vector**: A commit labeled "chore: cleanup unused column" drops a column that is still read by 3 endpoints. The developer claims "I checked and nothing uses it" but didn't verify.

**Expected rejection**: Column removal rules require application read removal first, then column drop in a follow-up migration. The review should verify no remaining reads.

**Result**:
- **Caught**: YES — Instruction §Column safety: "Remove column: Remove application reads first, then drop in a follow-up migration." Review agent §Column operation safety: checks the removal pattern. The zero-downtime assessment would flag dropping without verifying read removal.
- **By which layer(s)**: All review layers
- **Severity**: CRITICAL (data loss risk if column is still read)
- **Correct severity**: YES

---

## ADV-DM-2: Circumventing Migration via Direct SQL in Code

**Attack vector**: Instead of creating a migration file, a developer adds `ALTER TABLE` statements in application startup code, arguing "it self-heals the schema."

**Expected rejection**: Schema changes require migration files. Direct SQL in application code (outside repositories) is also a backend governance violation.

**Result**:
- **Caught**: YES — Instruction §Migration discipline: "Schema changes require a migration file." Backend instruction: "Direct SQL in application code outside repositories" is an anti-pattern. Both families converge on rejection.
- **By which layer(s)**: Data model review agent (migration safety), Backend review agent (layer discipline, repository encapsulation)
- **Severity**: CRITICAL (untracked schema changes, no rollback, no idempotency)
- **Correct severity**: YES

---

## ADV-DM-3: JSONB Shape Change via Feature Flag

**Attack vector**: Code conditionally writes new JSONB keys based on a feature flag. When the flag is off, old shape is used. When on, new keys appear. No migration handles the shape transition.

**Expected rejection**: JSONB shape changes are schema changes regardless of how they're introduced. Feature flags don't exempt the migration requirement.

**Result**:
- **Caught**: PARTIAL — Instruction §JSONB: "Do not silently add or remove keys from JSONB objects — treat shape changes as schema changes." The rule is clear. However, if the review only sees the feature-flagged code path and the flag is initially off, the reviewer might consider the change "not yet active." The governance rules don't have a specific feature-flag exception, which is correct — but the enforcement depends on the reviewer recognizing the conditional JSONB write as a shape change.
- **By which layer(s)**: Review agent (JSONB discipline), Workflow (JSONB review step)
- **Severity**: HIGH (undocumented shape change, no migration for transition)
- **Correct severity**: YES

**Gap identified**: The governance rules correctly prohibit this, but feature-flagged JSONB changes are a subtle edge case where the reviewer must recognize conditional writes as shape changes. **Drift warning: LOW impact** — rules are correct, edge-case-specific.

---

## ADV-DM-4: Modifying Applied Migration "Just for Comments"

**Attack vector**: A developer modifies `001_initial_migration.sql` to add comments and fix whitespace, arguing "it's not a functional change."

**Expected rejection**: The never-modify-applied-migration rule is absolute — it doesn't have a "non-functional change" exception.

**Result**:
- **Caught**: YES — Instruction §Migration discipline: "Never modify an already-applied migration — create a new one." The rule is unconditional. Any modification to an applied migration file triggers this rule regardless of whether the change is "functional."
- **By which layer(s)**: All layers
- **Severity**: CRITICAL (even comment-only changes can cause checksum mismatches in TypeORM migration tracking)
- **Correct severity**: YES — TypeORM tracks migration checksums; any change can break the migration system

---

# Refactor Family — Adversarial Tests

## ADV-RF-1: Feature Addition Hidden in Refactor PR

**Attack vector**: A PR titled "refactor: simplify todo creation flow" also adds a new "priority" field to todos — a feature addition disguised as refactoring.

**Expected rejection**: Scope discipline requires refactoring and feature work to be separate. Behavior-preserving discipline requires acknowledging behavior changes.

**Result**:
- **Caught**: YES — Instruction §Scope control: "Scope creep is the primary risk of refactoring. Stay within the stated scope." §Behavior-preserving: "If a refactor accidentally changes behavior, the change must be reverted or the behavior change must be explicitly acknowledged." Review agent §Scope discipline and §Behavior preservation both catch this.
- **By which layer(s)**: All layers
- **Severity**: CRITICAL (behavior change without acknowledgment), HIGH (scope creep)
- **Correct severity**: YES

---

## ADV-RF-2: "Refactor" That Deletes Tests

**Attack vector**: A refactoring commit removes test files, claiming "the tests were for the old structure and are no longer relevant."

**Expected rejection**: Safe refactoring loop requires tests before and after. Removing tests during a refactor is a regression discipline violation.

**Result**:
- **Caught**: YES — Instruction §Regression discipline: "After refactoring, run existing tests to confirm behavior preservation." §Safe refactoring loop: "Test → Refactor → Test → Commit." Removing tests breaks the loop. Review agent: would flag missing test coverage in the Testing dimension (from inherited code-quality rules).
- **By which layer(s)**: Review agent, Workflow (safe refactoring loop step)
- **Severity**: CRITICAL (lost behavior verification)
- **Correct severity**: YES

---

## ADV-RF-3: Branch by Abstraction Left Half-Migrated

**Attack vector**: A developer starts a Branch by Abstraction, migrates 2 of 5 consumers, then declares the refactor "done" with the old implementation still in place and 3 consumers still using it.

**Expected rejection**: Branch by Abstraction must not leave the codebase half-migrated.

**Result**:
- **Caught**: YES — Instruction §Large-scale refactoring: "Never leave the codebase in a half-migrated state at the end of a session. Each step must be independently deployable." Review agent §Cross-cutting (Branch by Abstraction): "is the migration complete or properly intermediate-deployable?" Workflow anti-patterns: "Half-migrated Branch by Abstraction without cleanup."
- **By which layer(s)**: Review agent, Workflow (cross-cutting analysis, anti-pattern prevention)
- **Severity**: HIGH (half-migrated state)
- **Correct severity**: YES

---

# Adversarial Test Summary

## Results Matrix

| ID | Family | Attack | Caught | Severity | Correct |
|----|--------|--------|--------|----------|---------|
| ADV-CQ-1 | Code Quality | "It works" bypass | ✅ YES | HIGH (multiple) | ✅ |
| ADV-CQ-2 | Code Quality | Gradual erosion | ⚠️ PARTIAL | MEDIUM (delayed) | ⚠️ |
| ADV-CQ-3 | Code Quality | Competing pattern disguise | ✅ YES | HIGH | ✅ |
| ADV-CQ-4 | Code Quality | Security in utility | ✅ YES | CRITICAL | ✅ |
| ADV-FE-1 | Frontend | Accessibility "MVP" bypass | ✅ YES | CRITICAL | ✅ |
| ADV-FE-2 | Frontend | Cross-component waterfall | ⚠️ PARTIAL | CRITICAL (if caught) | ✅ |
| ADV-FE-3 | Frontend | Toast for destructive error | ✅ YES | HIGH | ✅ |
| ADV-FE-4 | Frontend | Unnecessary context | ✅ YES | MEDIUM | ✅ |
| ADV-BE-1 | Backend | Logic in middleware | ✅ YES | HIGH | ✅ |
| ADV-BE-2 | Backend | Cross-user via query param | ✅ YES | CRITICAL | ✅ |
| ADV-BE-3 | Backend | Hidden dependency violation | ✅ YES | HIGH | ✅ |
| ADV-BE-4 | Backend | 200-on-error swallowing | ✅ YES | CRITICAL | ✅ |
| ADV-DM-1 | Data Model | Column drop "cleanup" | ✅ YES | CRITICAL | ✅ |
| ADV-DM-2 | Data Model | Schema via startup SQL | ✅ YES | CRITICAL | ✅ |
| ADV-DM-3 | Data Model | JSONB via feature flag | ⚠️ PARTIAL | HIGH | ✅ |
| ADV-DM-4 | Data Model | Comment-only migration edit | ✅ YES | CRITICAL | ✅ |
| ADV-RF-1 | Refactor | Feature hidden in refactor | ✅ YES | CRITICAL | ✅ |
| ADV-RF-2 | Refactor | Test deletion in refactor | ✅ YES | CRITICAL | ✅ |
| ADV-RF-3 | Refactor | Half-migrated BbA | ✅ YES | HIGH | ✅ |

## Catch Rates

| Metric | Count | Percentage |
|--------|-------|------------|
| Fully caught | 16 | 84% |
| Partially caught | 3 | 16% |
| Missed entirely | 0 | 0% |
| CRITICAL adversarial caught | 10/10 | 100% |
| HIGH adversarial caught | 6/6 | 100% |

## Gaps Identified

1. **ADV-CQ-2 (Gradual erosion)**: No longitudinal quality tracking across commits. Per-change review catches threshold violations but not gradual accumulation between thresholds. **Recommendation**: Document this as a known limitation. Consider periodic codebase health audits as a complement to per-change review.

2. **ADV-FE-2 (Cross-component waterfall)**: Multi-file waterfall detection depends on reviewer tracing data flow across component boundaries. The rules define the severity correctly but detection is inherently manual for cross-file patterns. **Recommendation**: No governance change needed — this is a fundamental limitation of file-level review.

3. **ADV-DM-3 (Feature-flagged JSONB)**: Conditional JSONB writes may not be immediately recognized as shape changes if the feature flag is off. The rules correctly prohibit this, but edge-case awareness could be strengthened. **Recommendation**: Add a note in the JSONB discipline section about feature-flagged shape changes.
