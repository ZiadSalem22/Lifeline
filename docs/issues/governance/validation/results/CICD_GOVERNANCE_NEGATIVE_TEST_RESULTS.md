# CI/CD Governance Negative-Test Results

## Negative scenarios executed

### CG-N1 Public bind exposure

- expected: critical failure for exposing the app on `0.0.0.0:3020`
- observed result: Pass
- notes: the skill, workflow, and deploy helper all explicitly preserve `127.0.0.1:3020`

### CG-N2 Runtime secrets in git or workflow env

- expected: critical failure
- observed result: Pass
- notes: secret-boundary guidance is strong across skill, agent, team, and workflow

### CG-N3 Smoke-check weakening

- expected: failure or hard warning when critical checks are removed
- observed result: Pass with drift warnings
- notes: smoke-check weakening is clearly forbidden, but the workflow and agent layers can state the exact required smoke-check set more explicitly
- hardening candidate: enumerate the exact required check set in agent and workflow outputs

### CG-N4 Bypass deploy branch model

- expected: failure
- observed result: Pass
- notes: branch-model protection is explicit and repeated

### CG-N5 Azure-era path restoration

- expected: failure
- observed result: Pass
- notes: Azure return is explicitly forbidden across the stack

### CG-N6 Runtime-topology change without docs impact evaluation

- expected: warning or failure plus architecture/operations docs escalation
- observed result: Pass with drift warnings
- notes: operations-doc impact is strong, but architecture-doc escalation for topology-shape changes can be clearer in the workflow and expected output model
- hardening candidate: add explicit architecture-doc warning and docs-only alignment wording

## Negative-test verdict

CI/CD governance negative-test result: Pass with drift warnings.

Hardening is recommended for smoke-check specificity and topology-doc escalation clarity.
