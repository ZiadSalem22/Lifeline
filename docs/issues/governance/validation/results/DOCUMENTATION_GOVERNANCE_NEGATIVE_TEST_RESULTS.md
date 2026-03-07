# Documentation Governance Negative-Test Results

## Negative scenarios executed

### DG-N1 Root report placement attempt

- expected: reject repo-root report placement and derive scoped issue-history path
- observed result: Pass
- notes: root is explicitly disallowed as a default report destination across instructions, skill, agent, team, and workflow

### DG-N2 Generic-doc collapse attempt

- expected: preserve product/backend/API/frontend separation and warn about collapse
- observed result: Pass
- notes: domain separation is explicit and repeated across the stack

### DG-N3 Archive-as-current-truth misuse

- expected: warn that archive or stale issue-history material cannot be treated as current truth
- observed result: Pass with drift warnings
- notes: archive boundary is defined, but the stack is stronger on placement rules than on explicitly naming stale-source misuse as a warning category
- hardening candidate: add explicit stale-source warning language to the documentation-governance agent and workflow

### DG-N4 Missing ADR escalation

- expected: trigger ADR-needed signal for durable structural change
- observed result: Pass
- notes: ADR heuristics are strong and repeated across skill, agent, team, and workflow

### DG-N5 Wrong docs-domain routing

- expected: correct the routing and name missing domains
- observed result: Pass
- notes: frontend-vs-backend and business-rule-vs-API distinctions are explicit

### DG-N6 Silent stale-doc deferral

- expected: force explicit statement of deferred docs debt
- observed result: Pass with drift warnings
- notes: the instructions require explicit deferral statements, but the negative-case wording around stale-doc debt could be stronger in the workflow warnings section
- hardening candidate: add explicit stale-doc-debt warning language to workflow and agent outputs

## Negative-test verdict

Documentation governance negative-test result: Pass with drift warnings.

Hardening is recommended for stale-source misuse and stale-doc-debt warning specificity.
