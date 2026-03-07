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
2. Recommend file and function decomposition.
3. Recommend naming conventions for new code.
4. Check for existing utilities before new creation.
5. Identify behavior preservation requirements for changes to existing code.
6. Emit structure and approach guidance.

### Post-implementation (review)
1. Inspect the changed files.
2. Assess readability: naming, nesting, function size, file focus.
3. Assess duplication: copy-paste blocks, missed reuse opportunities, extraction quality.
4. Assess complexity: file size, function size, nesting depth, parameter count.
5. Assess cohesion: single responsibility, explicit dependencies, clean exports.
6. Assess naming consistency within and across changed files.
7. Check for dead code, commented-out code, magic values, silent error suppression.
8. Verify behavior preservation for structural changes.
9. Determine whether the change genuinely improved quality.
10. Emit quality findings with severity levels.
11. Determine cross-family triggers:
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
