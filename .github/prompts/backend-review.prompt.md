# Backend Review

Trigger a backend engineering review for changed backend files.

## When to use
Use this prompt when you want an assessment of backend layering, service boundaries, error handling, auth safety, or API contract discipline for backend changes.

## Steps

1. Identify the changed files in `backend/src/`.
2. For each changed file, determine which layer it belongs to (route, controller, use-case, middleware, repository, domain).
3. Assess against Lifeline's backend standards:
   - **Layer discipline**: is logic in the correct layer?
   - **Controller thinness**: ≤30 lines, orchestration only
   - **Repository encapsulation**: all data access contained, no ORM leakage
   - **Validation placement**: middleware for request shape, use-case for business rules
   - **Error handling**: structured errors, async safety, no silent suppression
   - **Auth/user-scoping**: correct identity usage, user ID filtering
   - **Contract compliance**: response shape preserved, changes documented
4. Apply code quality governance for general readability, naming, and complexity.
5. Produce findings with severity (blocker / warning / note), location, and recommendation.
6. Assess whether the change genuinely improved backend structure.
7. Identify cross-family triggers:
   - Documentation impact if API contracts or backend behavior changed
   - Data-model governance if entity/repository changes affect schema
   - CI/CD governance if deployment surfaces affected
   - Refactor governance if deeper restructuring needed

## Sources
- `.github/skills/backend-engineering-governance.md`
- `.github/instructions/backend-engineering-governance.instructions.md`
- `.github/agents/backend-review-agent.md`

## Output
Return a backend engineering assessment with specific findings, severity levels, and actionable recommendations.
