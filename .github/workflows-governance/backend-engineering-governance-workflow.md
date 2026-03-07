# Backend Engineering Governance Workflow

## Purpose

Define the repeatable execution path for backend engineering governance in Lifeline.

This workflow sits above the backend-engineering-governance skill, agents, and team and turns them into a practical review sequence for backend changes.

## Built on

- `.github/skills/backend-engineering-governance.md`
- `.github/skills/code-quality-governance.md`
- `.github/agents/backend-builder-agent.md`
- `.github/agents/backend-review-agent.md`
- `.github/teams/backend-engineering-governance-team.md`

## Inputs

- proposed or completed backend change
- changed files in `backend/src/`
- change description or PR context
- code quality review findings when available
- API contract context when known

## Workflow sequence

### Pre-implementation (builder guidance)
1. Inspect the proposed backend work scope.
2. **Conformance check**: study 2–3 existing files in the same layer to learn the established pattern.
3. Recommend which layer should contain the new logic.
4. Recommend file placement and naming following the established pattern.
5. Validate dependency direction — inner layers must not import outer layers.
6. Recommend validation strategy (middleware, use-case, domain).
7. Recommend error handling approach.
8. Identify auth/user-scoping requirements.
9. Identify API contract implications.
10. **Security check**: no hardcoded secrets, sanitized input, auth coverage on new endpoints.
11. **Performance check**: no N+1 patterns, pagination for lists, indexes for queries.
12. Emit backend implementation guidance.

### Post-implementation (lint gate)
1. Run `npm run lint` from `backend/`.
2. Fix any new lint warnings or errors before review.

### Post-implementation (review)
1. Inspect the changed backend files.
2. Assess layer discipline: is logic in the correct layer?
3. **Dependency direction**: do dependencies flow inward? Any inner-layer imports of outer layers?
4. Assess controller thinness: are controllers limited to orchestration?
5. Assess repository encapsulation: is data access contained?
6. Assess validation placement: correct layer for each type of validation?
7. Assess error handling: async safety, structured errors, no silent suppression?
8. Assess auth/user-scoping: correct identity usage, user ID filtering, no leakage?
9. **Security review**: hardcoded secrets, exposed error details, unsanitized input, auth gaps, rate limiting?
10. **Performance review**: N+1 queries, unbounded lists, missing indexes, blocking operations, missing timeouts?
11. **Reliability review**: missing error handling on I/O, missing timeouts, resource leaks?
12. Verify contract compliance: preserved shapes, explicit changes, documented updates?
13. **Conformance check**: does the change follow established patterns in the same layer?
14. Check search/stats/export/import behavior consistency.
15. Apply code quality governance for general readability, naming, and complexity.
16. Determine whether the change genuinely improved backend structure.
17. Classify findings with severity: CRITICAL / HIGH / MEDIUM / LOW.
18. Produce verdict: Approve / Request changes / Needs discussion.
19. Determine cross-family triggers:
    - Documentation governance: if API contracts or backend behavior changed
    - Data-model governance: if entity or repository changes affect schema
    - CI/CD governance: if deployment surfaces are affected
    - Refactor governance: if deeper restructuring is needed
    - ADR: if durable backend architecture decisions were made

### Cross-cutting analysis (for multi-layer changes)
For changes that span multiple layers:
1. Check internal consistency across all changed layers.
2. Verify dependency direction is maintained.
3. Check for missing changes — layers that should have been updated but were not.
4. Ensure shared patterns are applied consistently.

## Rules it enforces

- Routes contain only HTTP binding — no business logic
- Controllers are thin orchestrators — ≤30 lines per method
- Use-cases contain business logic — one operation per use-case
- Repositories encapsulate all data access — no ORM outside repositories
- Request validation is in middleware; business validation in use-cases/domain
- Errors are handled explicitly with structured responses
- Auth identity comes from middleware — not re-derived
- User-scoped queries filter by authenticated user ID
- API contract changes are explicit and documented
- Search/stats/export/import behavior remains consistent

## Outputs it produces

- Backend engineering assessment (pass / conditional pass / fail)
- Layer discipline findings
- Controller thinness assessment
- Repository encapsulation assessment
- Validation and error handling findings
- Auth/user-scoping safety assessment
- Contract compliance findings
- Cross-family trigger signals
- Documentation update requirements

## Failure modes and warnings

Emit warnings when:
- business logic is placed in route or controller files
- controllers exceed thinness thresholds
- direct ORM calls appear outside repository files
- validation is in the wrong layer
- async operations lack error handling
- errors are silently suppressed
- user-scoped queries lack user ID filtering
- API response shapes change without contract documentation
- controller or route files mix multiple unrelated operations

## Anti-patterns this workflow prevents

- fat controllers that contain business logic and data access
- routes that bypass the controller/use-case pattern
- repositories that leak ORM details to consumers
- silent error handling that hides failures
- cross-user data leakage from missing user ID filters
- undocumented contract changes
- auth re-derivation instead of using middleware identity
