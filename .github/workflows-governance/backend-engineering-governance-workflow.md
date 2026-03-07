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
2. Recommend which layer should contain the new logic.
3. Recommend file placement and naming.
4. Recommend validation strategy (middleware, use-case, domain).
5. Recommend error handling approach.
6. Identify auth/user-scoping requirements.
7. Identify API contract implications.
8. Emit backend implementation guidance.

### Post-implementation (review)
1. Inspect the changed backend files.
2. Assess layer discipline: is logic in the correct layer?
3. Assess controller thinness: are controllers limited to orchestration?
4. Assess repository encapsulation: is data access contained?
5. Assess validation placement: correct layer for each type of validation?
6. Assess error handling: async safety, structured errors, no silent suppression?
7. Assess auth/user-scoping: correct identity usage, user ID filtering, no leakage?
8. Verify contract compliance: preserved shapes, explicit changes, documented updates?
9. Check search/stats/export/import behavior consistency.
10. Apply code quality governance for general readability, naming, and complexity.
11. Determine whether the change genuinely improved backend structure.
12. Emit backend review findings with severity levels.
13. Determine cross-family triggers:
    - Documentation governance: if API contracts or backend behavior changed
    - Data-model governance: if entity or repository changes affect schema
    - CI/CD governance: if deployment surfaces are affected
    - Refactor governance: if deeper restructuring is needed
    - ADR: if durable backend architecture decisions were made

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
