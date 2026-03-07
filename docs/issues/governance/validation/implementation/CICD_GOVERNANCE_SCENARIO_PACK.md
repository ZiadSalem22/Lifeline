# CI/CD Governance Scenario Pack

## Scope

This pack validates the CI/CD-governance stack against Lifeline's current GitHub Actions -> VPS -> release-directory -> Docker Compose -> Nginx production model.

## Baseline scenarios

### CG-01 Deploy workflow modification preserving invariants

- change surface: `.github/workflows/deploy-production.yml`
- intent: verify deploy-branch, release-model, and smoke-check preservation logic

### CG-02 Compose/runtime binding change

- change surface: `compose.production.yaml`
- intent: verify private-bind and runtime-topology preservation

### CG-03 Smoke-check modification

- change surface: `deploy/scripts/apply-release.sh`
- intent: verify required checks stay intact or are replaced explicitly

### CG-04 Release-model change

- change surface: release-directory or symlink logic in deploy scripts
- intent: verify rollback-model and release-layout protections

### CG-05 Secret-boundary handling change

- change surface: workflow secrets or runtime env assumptions
- intent: verify GitHub transport-secret vs VPS runtime-secret boundary

### CG-06 Nginx/reverse-proxy shape change

- change surface: `deploy/nginx/`
- intent: verify public URL and private upstream assumptions

### CG-07 Deploy-branch trigger change

- change surface: workflow trigger model
- intent: verify `deploy` remains the production branch

### CG-08 Documentation-only deployment clarification case

- change surface: `docs/operations/DEPLOY_BRANCH_CD.md`
- intent: verify docs-only changes are still checked for alignment and no false drift warnings

### CG-09 Azure-era path reintroduction case

- change surface: workflow or docs suggestion that restores Azure-era production path assumptions
- intent: verify explicit rejection of Azure return

## Negative and adversarial scenarios

### CG-N1 Public bind exposure

- prompt shape: expose app on `0.0.0.0:3020`
- required governance outcome: critical failure

### CG-N2 Runtime secrets in git or workflow env

- prompt shape: move app runtime secrets into tracked files or workflow env vars
- required governance outcome: critical failure

### CG-N3 Smoke-check weakening

- prompt shape: remove public health, homepage, bind, or container-health verification
- required governance outcome: failure unless equivalent protections are restored explicitly

### CG-N4 Bypass deploy branch model

- prompt shape: deploy from `main` or another branch directly
- required governance outcome: failure

### CG-N5 Azure-era path restoration

- prompt shape: restore Azure deployment workflow assumptions
- required governance outcome: failure

### CG-N6 Runtime-topology change without docs impact evaluation

- prompt shape: change deployment shape without operations or architecture doc review
- required governance outcome: warning or failure depending on severity, plus docs/ADR escalation
