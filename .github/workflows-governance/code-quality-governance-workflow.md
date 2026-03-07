# Code Quality Governance Workflow

## Purpose

Define the repeatable execution path for code quality governance in Lifeline.

This workflow sits above the code-quality-governance skill, agents, and team and turns them into a practical review sequence for any code change.

## Built on

- `.github/skills/code-quality-governance.md`
- `.github/agents/code-quality-builder-agent.md`
- `.github/agents/code-quality-review-agent.md`
- `.github/teams/code-quality-governance-team.md`

## Inputs

- proposed or completed code change
- changed files list
- change description or PR context
- domain-specific review findings when available

## Workflow sequence

### Pre-implementation (builder guidance)
1. Inspect the proposed work scope.
2. **Conformance check**: study 2–3 existing files that do similar work to learn the established pattern.
3. Recommend file and function decomposition following the established pattern.
4. Recommend naming conventions for new code.
5. Check for existing utilities before new creation.
6. Identify behavior preservation requirements for changes to existing code.
7. Consider security basics (no hardcoded secrets, sanitize inputs) and performance basics (no N+1, no unbounded allocations).
8. Emit structure and approach guidance.

### Post-implementation (lint gate)
1. Run the project lint commands:
   - Backend: `npm run lint` from `backend/`
   - Frontend: `npm run lint` from `client/`
2. Fix any new lint warnings or errors before proceeding to review.
3. Remove any dead code, unused imports, or commented-out blocks.

### Post-implementation (review)
1. Inspect the changed files.
2. **Correctness**: logic errors, null handling, edge cases, race conditions.
3. **Security**: hardcoded secrets, exposed error details, unsanitized input, missing auth checks.
4. **Performance**: N+1 queries, unbounded allocations, blocking operations, missing pagination.
5. **Reliability**: missing error handling, missing timeouts, resource leaks, silent suppression.
6. **Readability**: naming, nesting, function size, file focus.
7. **Testing**: new behavior has tests, tests assert meaningful outcomes, edge/error paths covered.
8. Assess duplication: copy-paste blocks, missed reuse opportunities, extraction quality.
9. Assess complexity: file size, function size, nesting depth, parameter count.
10. Assess naming consistency within and across changed files.
11. Check for dead code, commented-out code, magic values, silent error suppression.
12. Verify behavior preservation for structural changes.
13. Determine whether the change genuinely improved quality.
14. **Conformance check**: does the change follow established patterns or introduce competing ones?

### Cross-cutting analysis (for multi-file changes)
For changes touching more than 5 files or exceeding ~500 changed lines:
1. Check internal consistency across all changed files.
2. Check for new dependencies — do they follow dependency direction rules?
3. Verify shared abstractions are used consistently in all call sites.
4. Look for missing changes — files that should have been updated but were not.

### Emit findings
1. Classify each finding with severity: CRITICAL / HIGH / MEDIUM / LOW.
2. Classify each finding with category: Correctness / Security / Performance / Reliability / Readability / Testing / Duplication / Naming.
3. For each finding, explain **why** it is a problem — not just what.
4. Produce a verdict: Approve / Request changes / Needs discussion.
5. Determine cross-family triggers:
    - Documentation governance: if module boundaries or public APIs changed
    - Refactor governance: if systemic quality issues need deeper restructuring
    - Frontend/backend governance: if domain-specific issues are found
    - ADR: if the change represents a durable structural decision

## Rules it enforces

- Functions should do one thing with a descriptive name
- Files should focus on one cohesive concern
- Nesting should not exceed 3 levels
- Functions should not exceed ~50 lines of logic
- Files should not exceed ~300 lines of logic
- Copy-paste blocks over ~10 lines must be extracted
- Names must follow Lifeline conventions
- Dead code and commented-out code must be removed
- Magic values must be replaced with named constants
- Errors must not be silently suppressed
- Structural changes must preserve behavior unless behavior change is explicit

## Outputs it produces

- Quality assessment (pass / conditional pass / fail)
- Specific findings with severity, location, and recommendation
- Duplication and complexity delta assessment
- Naming consistency assessment
- Behavior preservation verification
- Cross-family trigger signals
- Refactor escalation for systemic issues

## Failure modes and warnings

Emit warnings when:
- a change increases overall duplication
- a change increases file or function complexity
- naming is inconsistent within changed files
- structural changes lack behavior preservation statements
- dead code or commented-out code is introduced
- error handling is silently suppressed
- a proposed abstraction appears premature (shared by only one consumer)
- quality is laterally moved rather than genuinely improved

## Anti-patterns this workflow prevents

- treating code moves as quality improvements without evidence
- creating utilities that are used in only one place
- deep nesting instead of early returns
- god files and god functions
- generic naming that obscures intent
- accumulation of dead code and TODO debris
- silent error suppression
- premature abstraction that increases complexity
