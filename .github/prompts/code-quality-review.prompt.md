# Code Quality Review

Trigger a code quality review for changed files.

## When to use
Use this prompt when you want a code quality assessment of recent changes or a specific set of files.

## Steps

1. **Identify scope**: Identify the changed files or target files for review.
2. **Lint gate**: Verify changes pass `npm run lint` in the relevant workspace (`backend/` or `client/`). If lint fails, report failures as CRITICAL findings and stop.
3. **Conformance check**: For each changed file, check whether it follows the patterns established in sibling files. Note any competing or novel patterns.
4. **Six-category review**: For each file, assess against these categories:
   - **Correctness**: logic errors, null handling, edge cases, race conditions
   - **Security**: hardcoded secrets, exposed error details, unsanitized input, missing auth checks
   - **Performance**: N+1 queries, unbounded allocations, blocking operations, missing pagination
   - **Reliability**: missing error handling, missing timeouts, resource leaks, silent suppression
   - **Readability**: naming, nesting depth, function size, file focus, self-documenting code
   - **Testing**: new behavior has tests, tests assert meaningful outcomes, edge/error paths covered
5. **Quality discipline**: Check duplication, complexity, naming consistency, dead code, commented-out code, magic values, and TODO quality.
6. **Behavior preservation**: For structural changes, verify behavior is preserved.
7. **Cross-cutting analysis** (multi-file changes only): Check internal consistency, dependency direction, shared abstraction consistency, and missing changes.
8. **Classify findings**: Each finding gets:
   - **Severity**: CRITICAL / HIGH / MEDIUM / LOW
   - **Category**: Correctness / Security / Performance / Reliability / Readability / Testing / Duplication / Naming
   - **Location**: file path and function/area
   - **Why**: explain why the issue matters, not just what it is
   - **Recommendation**: actionable fix
9. **Verdict**: Approve / Request changes / Needs discussion
10. **Cross-family triggers**:
    - Documentation impact if module boundaries or APIs changed
    - Refactor governance if systemic issues need deeper work
    - Frontend/backend governance if domain-specific issues found

## Severity taxonomy\n\n| Severity | Meaning |\n|----------|----------|\n| CRITICAL | Logic error causing incorrect behavior, security vulnerability, or data loss |\n| HIGH | Missing error handling, dead code risk, or architectural pattern violation |\n| MEDIUM | Convention drift, weak naming, or missing test coverage |\n| LOW | Style preference, minor documentation gap, or cosmetic choice |\n\n## Sources
- `.github/skills/code-quality-governance.md`
- `.github/instructions/code-quality-governance.instructions.md`
- `.github/agents/code-quality-review-agent.md`

## Output format

```markdown
## Quality Review Summary
**Verdict**: [Approve | Request changes | Needs discussion]
**Findings**: [count by severity]

### [SEVERITY] Category: Brief title
**File**: path — function/area
**Issue**: description
**Why**: explanation of impact
**Recommendation**: actionable fix
```

Repeat the finding block for each issue. End with a cross-family triggers section listing any documentation, refactor, or domain governance triggers.
