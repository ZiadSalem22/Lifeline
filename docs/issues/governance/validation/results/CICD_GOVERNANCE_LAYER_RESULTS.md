# CI/CD Governance Layer Results

## Evaluation summary

The CI/CD-governance stack was evaluated across nine baseline scenarios.

### CG-01 Deploy workflow modification preserving invariants

- expected: `deploy` branch preserved, release artifact packaging preserved, VPS apply step preserved, smoke-checks preserved
- actual skill output: explicit invariant list and practical checklist present
- actual agent output: risk assessment and invariant-preservation output shape present
- actual team output: grouped protection responsibilities are clear
- actual workflow output: deploy-model, smoke-check, secret-boundary, and release-model review sequence is explicit
- score: 96
- verdict: Pass
- hardening note: none

### CG-02 Compose/runtime binding change

- expected: private bind on `127.0.0.1:3020` preserved and topology/docs impact evaluated
- actual skill output: private-bind rule is explicit
- actual agent output: architecture-doc and ADR escalation path exists
- actual team output: private bind and Nginx proxy shape are protected
- actual workflow output: release and secret checks are explicit; topology-doc review is implied but not called out as strongly as operations-doc review
- score: 85
- verdict: Pass with drift warnings
- hardening note: strengthen architecture-doc warning language for topology-shape changes

### CG-03 Smoke-check modification

- expected: public health, homepage, container-health, and private-bind checks remain intact
- actual skill output: all four required smoke-check classes are named explicitly
- actual agent output: smoke-check preservation checklist expected
- actual team output: smoke-check preservation responsibility present
- actual workflow output: smoke-check preservation is explicit, but the exact four checks are not enumerated in the workflow outputs section
- score: 84
- verdict: Pass with drift warnings
- hardening note: make exact smoke-check coverage explicit in the workflow and agent outputs

### CG-04 Release-model change

- expected: `/opt/lifeline/releases` and `/opt/lifeline/current` rollback model preserved or intentionally escalated
- actual skill output: release layout and rollback assumptions are explicit
- actual agent output: deployment-model drift warnings supported
- actual team output: VPS release-model protection is clear
- actual workflow output: deploy-branch and VPS release-model assumptions are verified
- score: 94
- verdict: Pass
- hardening note: none

### CG-05 Secret-boundary handling change

- expected: GitHub deployment secrets remain transport-only and runtime secrets stay VPS-side
- actual skill output: transport-secret vs runtime-secret boundary is explicit
- actual agent output: secret-boundary warnings are explicit
- actual team output: host-secret/runtime-secret boundary responsibility is explicit
- actual workflow output: secret-boundary review and warnings are explicit
- score: 97
- verdict: Pass
- hardening note: none

### CG-06 Nginx/reverse-proxy shape change

- expected: public URL and private upstream shape preserved, docs or ADR updates triggered if topology changes
- actual skill output: Nginx proxy shape is explicit
- actual agent output: architecture-doc or ADR-needed signals supported
- actual team output: private bind and proxy shape are protected
- actual workflow output: topology protection exists, but architecture-doc review could be surfaced more prominently when proxy shape changes
- score: 86
- verdict: Pass with drift warnings
- hardening note: promote architecture-doc escalation in workflow warnings

### CG-07 Deploy-branch trigger change

- expected: `deploy` remains the only production branch trigger
- actual skill output: explicit branch-model protection exists
- actual agent output: production-branch model is listed among the assumptions to preserve
- actual team output: deploy-branch production model is a team responsibility
- actual workflow output: deploy-branch assumptions are verified directly
- score: 95
- verdict: Pass
- hardening note: none

### CG-08 Documentation-only deployment clarification case

- expected: docs-only clarifications are allowed if aligned with actual deployment behavior
- actual skill output: documentation routing rules exist
- actual agent output: deployment-doc update requirements supported
- actual team output: operations-doc update requirements supported
- actual workflow output: deployment changes without operations-doc updates are warned on, but docs-only alignment checks could be more explicit
- score: 82
- verdict: Pass with drift warnings
- hardening note: add explicit docs-alignment review language for documentation-only deployment clarifications

### CG-09 Azure-era path reintroduction case

- expected: explicit rejection of Azure-era deployment paths
- actual skill output: explicit no-Azure-return rule exists
- actual agent output: Azure reintroduction is a protected assumption
- actual team output: Azure-era reintroduction is forbidden explicitly
- actual workflow output: Azure-era deployment assumptions returning is an explicit warning trigger
- score: 98
- verdict: Pass
- hardening note: none

## Layer verdicts

### Skill

Pass. The skill is strong on invariant specificity and secret-boundary rules.

### Agent

Pass with drift warnings. The output model is strong, but exact smoke-check coverage and docs-alignment wording can be more explicit.

### Team

Pass. Coordination responsibilities protect the right deployment surfaces.

### Workflow

Pass with drift warnings. The workflow is structurally strong, but exact smoke-check coverage and topology-doc escalation can be clearer.

## Workstream result

CI/CD governance baseline validation result: Pass with drift warnings.
