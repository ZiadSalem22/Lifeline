# Backend Review

Trigger a backend engineering review for changed backend files.

## When to use
Use this prompt when you want an assessment of backend layering, service boundaries, error handling, auth safety, or API contract discipline for backend changes.

## Steps

1. **Identify scope**: Identify the changed files in `backend/src/`.
2. **Lint gate**: Verify changes pass `npm run lint` from `backend/`. If lint fails, report as CRITICAL.
3. **Layer identification**: For each changed file, determine which layer it belongs to (route, controller, use-case, middleware, repository, domain).
4. **Layer and structure review**: Assess against Lifeline's backend standards:
   - **Layer discipline**: is logic in the correct layer?
   - **Dependency direction**: do dependencies flow inward? Any inner-layer imports of outer layers?
   - **Controller thinness**: ≤30 lines, orchestration only
   - **Repository encapsulation**: all data access contained, no ORM leakage
   - **Validation placement**: middleware for request shape, use-case for business rules
   - **Error handling**: structured errors, async safety, no silent suppression
   - **Auth/user-scoping**: correct identity usage, user ID filtering
   - **Contract compliance**: response shape preserved, changes documented
5. **Security review**:
   - Hardcoded secrets, API keys, or tokens
   - Internal error details exposed in responses
   - Unsanitized user input in queries or HTML
   - Missing auth middleware on new endpoints
6. **Performance review**:
   - N+1 queries (database calls inside loops)
   - Unbounded list endpoints (missing pagination)
   - Missing database indexes for queried columns
   - Event-loop-blocking synchronous operations
7. **Reliability review**:
   - Missing error handling on I/O operations
   - Missing timeouts on external calls
   - Resource leaks (unclosed connections, handles)
8. **Conformance check**: does the change follow patterns in sibling files of the same layer?
9. Apply code quality governance for general readability, naming, and complexity.
10. **Classify findings**: CRITICAL / HIGH / MEDIUM / LOW with category and location.
11. **Verdict**: Approve / Request changes / Needs discussion.
12. **Cross-family triggers**:
    - Documentation impact if API contracts or backend behavior changed
    - Data-model governance if entity/repository changes affect schema
    - CI/CD governance if deployment surfaces affected
    - Refactor governance if deeper restructuring needed

## Severity taxonomy

| Severity | Meaning |
|----------|----------|
| CRITICAL | Security vulnerability, data loss, or production outage risk |
| HIGH | Dependency direction violation, missing error handling, or N+1 query |
| MEDIUM | Missing validation, weak logging, or layer boundary blur |
| LOW | Style preference, naming, or minor documentation gap |

## Sources

## Output format

```markdown
## Backend Review Summary
**Verdict**: [Approve | Request changes | Needs discussion]
**Findings**: [count by severity]

### [SEVERITY] Category: Brief title
**File**: path — layer / function
**Issue**: description
**Why**: explanation of impact
**Recommendation**: actionable fix
```

Repeat the finding block for each issue. End with cross-family triggers.
