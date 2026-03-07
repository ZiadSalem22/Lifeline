# Documentation Governance Scenario Pack

## Scope

This pack validates the documentation-governance stack against realistic Lifeline change types and adversarial routing cases.

## Baseline scenarios

### DG-01 Frontend-only UX change

- change surface: `client/src/pages/StatisticsPage.jsx`
- intent: validate routing to `docs/frontend/` first, with optional `docs/features/`
- required governance outcome: no backend/API-only routing

### DG-02 Backend business-rule change

- change surface: `backend/src/application/CompleteRecurringTodo.js`
- intent: validate distinction between business behavior and transport details
- required governance outcome: `docs/product/` plus `docs/backend/`, maybe `docs/features/`

### DG-03 API contract change

- change surface: `backend/src/routes/me.js`
- intent: validate API-primary routing with backend-secondary support
- required governance outcome: `docs/api/` primary, `docs/backend/` secondary

### DG-04 Data-model and persistence change

- change surface: `backend/migrations/007_add_todo_priority.sql`
- intent: validate schema-first routing
- required governance outcome: `docs/data-model/` primary, maybe `docs/backend/` and `docs/architecture/`

### DG-05 Architecture-impacting change

- change surface: deploy/runtime topology or durable documentation-governance structure
- intent: validate `docs/architecture/` and ADR escalation rules
- required governance outcome: architecture update plus ADR evaluation

### DG-06 Output/report-placement case

- change surface: request for a discovery report with no explicit valid path
- intent: validate exact non-root artifact-path derivation
- required governance outcome: scoped `docs/issues/<initiative>/<step>/discovery/` target

### DG-07 Mixed multi-domain change

- change surface: feature update touching UI, backend behavior, and endpoint response shape
- intent: validate multi-domain routing and warnings when only one domain is proposed
- required governance outcome: multiple docs targets with rationale

## Negative and adversarial scenarios

### DG-N1 Root report placement attempt

- prompt shape: asks for a phase report at repo root by default
- required governance outcome: reject root placement and route to scoped issue history

### DG-N2 Generic-doc collapse attempt

- prompt shape: asks for one catch-all document covering product, backend, and API change details
- required governance outcome: preserve domain separation and warn about collapsed docs

### DG-N3 Archive-as-current-truth misuse

- prompt shape: uses archived or stale issue-history material as the authoritative current state
- required governance outcome: warn that current truth must come from active docs and implementation surfaces

### DG-N4 Missing ADR escalation

- prompt shape: durable structural change described as routine docs refresh
- required governance outcome: ADR-needed signal

### DG-N5 Wrong docs-domain routing

- prompt shape: frontend change routed only to backend docs, or product-rule change routed only to API docs
- required governance outcome: explicit correction and missing-domain warning

### DG-N6 Silent stale-doc deferral

- prompt shape: docs update deferred without naming impact or debt
- required governance outcome: explicit deferment note and missing-doc warning
