# Documentation Governance Layer Results

## Evaluation summary

The documentation-governance stack was evaluated across seven baseline scenarios.

### DG-01 Frontend-only UX change

- expected: `docs/frontend/` primary, optional `docs/features/`, no backend/API collapse
- actual skill output: explicit frontend-first routing present
- actual agent output: primary/secondary target structure present
- actual team output: frontend remains first-class, not secondary
- actual workflow output: warns when frontend UX changes are not routed to `docs/frontend/`
- score: 98
- verdict: Pass
- hardening note: none

### DG-02 Backend business-rule change

- expected: `docs/product/` plus `docs/backend/`, optional `docs/features/`
- actual skill output: business-rule heuristic explicitly distinguishes product from API-only changes
- actual agent output: multi-domain routing and rationale supported
- actual team output: preserves product/backend/API distinction
- actual workflow output: warns when business-rule changes are routed only to backend or API docs
- score: 97
- verdict: Pass
- hardening note: none

### DG-03 API contract change

- expected: `docs/api/` primary with `docs/backend/` secondary
- actual skill output: API-primary routing is explicit
- actual agent output: concrete docs-target outputs supported
- actual team output: domain separation preserved
- actual workflow output: route-selection sequence is sufficient
- score: 95
- verdict: Pass
- hardening note: none

### DG-04 Data-model and persistence change

- expected: `docs/data-model/` primary, with backend or architecture support when needed
- actual skill output: schema/entity routing heuristic is explicit
- actual agent output: multiple docs domains can be named
- actual team output: cross-domain coordination covered
- actual workflow output: docs impact mapping is sufficient
- score: 94
- verdict: Pass
- hardening note: none

### DG-05 Architecture-impacting change

- expected: `docs/architecture/` update and ADR evaluation
- actual skill output: ADR heuristics explicitly include deployment model, auth model, persistence model, domain boundaries, and documentation governance itself
- actual agent output: ADR-needed signal supported
- actual team output: ADR-needed recommendation supported
- actual workflow output: includes ADR decision step
- score: 96
- verdict: Pass
- hardening note: none

### DG-06 Output/report-placement case

- expected: exact scoped non-root path chosen before writing output
- actual skill output: exact path decision and scoped pattern are explicit
- actual agent output: exact artifact path recommendation is required
- actual team output: coordination responsibility includes exact path decision
- actual workflow output: exact non-root destination is chosen before writing output
- score: 99
- verdict: Pass
- hardening note: none

### DG-07 Mixed multi-domain change

- expected: multiple docs targets with rationale and warnings if only one target is proposed
- actual skill output: multi-domain heuristics present
- actual agent output: primary and secondary docs targets supported
- actual team output: multi-domain coordination responsibility present
- actual workflow output: warning on single-target routing for multi-domain change is explicit
- score: 96
- verdict: Pass
- hardening note: none

## Layer verdicts

### Skill

Pass. The skill has strong routing heuristics, report-placement logic, and ADR escalation rules.

### Agent

Pass. The agent has concrete output expectations and exact-path placement responsibility.

### Team

Pass. The team layer coordinates multi-domain routing and artifact-placement decisions clearly.

### Workflow

Pass. The workflow sequence is explicit and catches the major routing and root-clutter failure modes.

## Workstream result

Documentation governance baseline validation result: Pass.
