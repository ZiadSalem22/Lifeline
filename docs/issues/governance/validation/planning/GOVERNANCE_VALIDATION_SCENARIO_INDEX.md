# Governance Validation Scenario Index

## Documentation governance scenarios

### Baseline scenarios

- DG-01 frontend-only UX change
- DG-02 backend business-rule change
- DG-03 API contract change
- DG-04 data-model and persistence change
- DG-05 architecture-impacting deployment/design change
- DG-06 output/report-placement case
- DG-07 mixed multi-domain change

### Negative or adversarial scenarios

- DG-N1 root report placement attempt
- DG-N2 collapse product/backend/API docs into one output
- DG-N3 archive-as-current-truth misuse
- DG-N4 missing ADR escalation
- DG-N5 wrong docs-domain routing
- DG-N6 stale-doc defer-without-warning case

## CI/CD governance scenarios

### Baseline scenarios

- CG-01 deploy workflow modification preserving invariants
- CG-02 Compose/runtime binding change
- CG-03 smoke-check modification
- CG-04 release-model change
- CG-05 secret-boundary handling change
- CG-06 Nginx/reverse-proxy shape change
- CG-07 deploy-branch trigger change
- CG-08 documentation-only deployment clarification
- CG-09 Azure-era path reintroduction check

### Negative or adversarial scenarios

- CG-N1 public bind exposure on `0.0.0.0:3020`
- CG-N2 runtime secrets moved into git or workflow env
- CG-N3 smoke-check removal or weakening
- CG-N4 bypassing the `deploy` branch production model
- CG-N5 Azure-era deployment path restoration
- CG-N6 runtime topology change without docs impact evaluation

## Real-world sanity check

- CG-S1 docs-only deploy-branch sanity deployment with public verification
