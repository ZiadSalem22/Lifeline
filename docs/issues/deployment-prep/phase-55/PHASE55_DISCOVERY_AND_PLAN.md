# Phase 5.5 Discovery and Plan

## 1. Executive Summary

Phase 5.5 discovery and planning is complete.

The current environment has strong GitHub access for repository-level automation work:
- git remote access is working
- authenticated GitHub CLI access is working
- repository admin visibility is confirmed
- push capability is confirmed
- existing GitHub Actions state is inspectable
- existing repository secrets are inspectable by name

The current deployment shape is also already suitable for simple CI/CD:
- production deploy root exists at `/opt/lifeline`
- release-style layout already exists (`releases`, `shared`, `current`)
- production env file already lives on the VPS
- deployment already uses a production compose file
- live smoke check path already exists at `https://lifeline.a2z-us.com/api/health/db`

The simplest safe CI/CD model for this repo is:
- GitHub Actions
- trigger on push to `deploy`
- build a release artifact from the repo
- SSH to the VPS
- upload and extract into a new release directory under `/opt/lifeline/releases`
- repoint `/opt/lifeline/current`
- run `docker compose` against `compose.production.yaml`
- run smoke checks
- fail the workflow if unhealthy

The agent can implement a large part of this, but not everything is confirmed safe to do automatically from this environment without a deliberate write pass to GitHub settings. The most accurate current classification is: partially implementable by the agent alone.

## 2. Locked Inputs

The following were treated as fixed during this discovery + planning pass:
- VPS host: `187.124.7.88`
- deployment root: `/opt/lifeline`
- app runs behind host Nginx
- public domain: `https://lifeline.a2z-us.com`
- app bind: `127.0.0.1:3020`
- Docker and Docker Compose are already installed on the VPS
- TLS is already issued and working
- existing `a2z-us.com` site must remain intact
- app container: `lifeline-app`
- database container: `lifeline-postgres`
- production env file already exists on the VPS
- deployment is already working manually on the VPS
- desired branch model:
  - `main` for normal dev/integration
  - `deploy` for production deployment
  - push to `deploy` should trigger production automation

## 3. GitHub Capability Findings

### Confirmed possible

#### Git remote access
Confirmed possible.

Evidence:
- remote `origin` is configured and reachable
- remote URL is `https://github.com/ZiadSalem22/Lifeline.git`
- remote branches are visible

#### Push capability
Confirmed possible.

Evidence:
- `git push --dry-run origin HEAD:refs/heads/deploy` succeeded
- `git push --dry-run origin HEAD:refs/heads/copilot-capability-check-temp` also succeeded

Implication:
- pushing commits to existing remote branches is confirmed
- creating a new remote branch by push appears possible from this environment

#### Push workflow files to the repo
Confirmed possible in practice.

Evidence:
- local workspace is writable
- `.github/workflows` is present in the repo
- remote push capability is confirmed

Implication:
- the agent can add or modify workflow files in the repo and push them

#### GitHub CLI availability
Confirmed possible.

Evidence:
- `gh` is installed
- reported version: `2.52.0`

#### GitHub authentication
Confirmed possible.

Evidence:
- `gh auth status` succeeded
- active account: `ZiadSalem22`
- token scopes reported: `gist`, `read:org`, `repo`, `workflow`

#### Repo access and permission inspection
Confirmed possible.

Evidence:
- `gh repo view --json ...` succeeded
- repo: `ZiadSalem22/Lifeline`
- `viewerPermission` reported as `ADMIN`
- repo visibility reported as public

#### Inspect current GitHub Actions/workflow state
Confirmed possible.

Evidence:
- `gh workflow list` succeeded
- Actions permissions endpoint was readable
- workflow inventory endpoint was readable

#### Inspect current repo secrets by name
Confirmed possible.

Evidence:
- `gh secret list` succeeded
- current repo secrets are visible by name

#### Inspect current GitHub Environments
Confirmed possible.

Evidence:
- environments API was readable
- result showed zero environments currently configured

#### Inspect branch protection
Confirmed possible.

Evidence:
- branch protection lookup for `main` was attempted
- GitHub returned `404 Branch not protected`

This confirms current branch protection state is inspectable.

### Confirmed current state

#### Existing remote branches
Confirmed:
- `main` exists remotely
- `deploy` exists remotely

So creating `deploy` is not currently required.

#### Existing workflows
Confirmed:
- local repo currently contains one workflow file:
  - [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)
- GitHub Actions currently reports two registered workflows:
  - `Deploy Backend to Azure`
  - `Build and deploy Node.js app to Azure Web App - lifeline-backend-app`

Important finding:
- GitHub repository contents on the default branch show only one current workflow file in `.github/workflows`
- this strongly suggests at least one registered workflow is a legacy/orphaned Azure workflow entry from earlier automation history

#### Actions settings
Confirmed:
- GitHub Actions are enabled
- allowed actions = `all`
- SHA pinning is not required

#### Branch protection / reviewer rules
Confirmed current state:
- `main` is not protected
- no branch protection is currently configured from what was inspected
- required reviewers / approval rules are therefore not currently configured via branch protection in this repo

#### Existing repo secrets
Confirmed current repo secrets by name:
- `AZUREAPPSERVICE_CLIENTID_...`
- `AZUREAPPSERVICE_SUBSCRIPTIONID_...`
- `AZUREAPPSERVICE_TENANTID_...`
- `AZURE_CREDENTIALS`
- `BACKEND_WEBAPP_NAME`
- `FRONTEND_WEBAPP_NAME`

These are Azure-era secrets and do not match the current VPS deployment model.

### Not directly confirmed in this discovery-only pass

The following write actions were not executed during this pass, so they should not be claimed as fully confirmed even though the environment strongly suggests they may be possible:
- creating GitHub Actions secrets
- creating GitHub Environments
- configuring branch protection rules
- configuring required reviewers / approval rules
- editing other repository settings via write calls

Reason:
- this phase was discovery + planning only
- no write operations to GitHub settings were intentionally executed

Therefore the correct classification is:
- likely possible given `gh` auth + `ADMIN` repo visibility + token scopes
- but not directly write-confirmed in this pass

## 4. Repo and VPS Automation Readiness

### Repo readiness

The repo is already close to automation-ready for VPS deployment.

Relevant files already present:
- [compose.production.yaml](compose.production.yaml)
- [compose.production.env.example](compose.production.env.example)
- [Dockerfile](Dockerfile)
- [deploy/nginx/lifeline.a2z-us.com.conf](deploy/nginx/lifeline.a2z-us.com.conf)
- [backend/src/middleware/auth0.js](backend/src/middleware/auth0.js)

Key readiness points:
- production compose file already exists
- production binding shape is already correct for VPS (`127.0.0.1:3020`)
- frontend build-time Auth0 inputs are already part of the image build path
- backend runtime env model is already separated into the VPS env file
- health check path already exists in the compose config
- the deployment has already been proven manually on the VPS

Important repo issue to address in Phase 5.5 implementation:
- the current workflow file is Azure-focused and no longer matches the live deployment architecture
- it should be replaced or superseded by a VPS deploy workflow
- legacy Azure workflow noise should be cleaned up carefully

### VPS readiness

The VPS is also already suitable for simple deployment automation.

Confirmed deployment layout:
- `/opt/lifeline/releases`
- `/opt/lifeline/shared`
- `/opt/lifeline/current`
- `/opt/lifeline/shared/.env.production`

Confirmed runtime state:
- `lifeline-app` healthy
- `lifeline-postgres` healthy
- public health endpoint responds successfully

Current manual deployment shape already implies a preferred automation path:
1. produce release content from the repo
2. upload to `/opt/lifeline/releases/<release-id>`
3. repoint `/opt/lifeline/current`
4. run `docker compose -p lifeline --env-file /opt/lifeline/shared/.env.production -f compose.production.yaml up -d --build`
5. run smoke checks

### Recommended smoke checks for automation

The automated deploy should at minimum verify:
- containers are up and healthy
- `https://lifeline.a2z-us.com/api/health/db` returns success
- the app is still bound privately on `127.0.0.1:3020`
- Nginx-backed public health still works

Optional but useful:
- check `docker ps` status
- collect recent app logs on failure
- verify the existing `a2z-us.com` site still responds

## 5. Recommended CI/CD Model

Recommended model:
- GitHub Actions on push to `deploy`
- deploy over SSH to the VPS
- reuse the existing `/opt/lifeline` release structure
- rebuild and restart via Docker Compose on the VPS
- run public smoke checks after deploy

### Recommended trigger model
- trigger on push to `deploy`
- optionally allow `workflow_dispatch` for manual reruns

### Recommended deployment shape

The cleanest workflow is:
1. checkout repo on GitHub Actions runner
2. package the deployment-relevant files
3. upload release artifact to VPS over SSH/SCP
4. create `/opt/lifeline/releases/<release-id>`
5. extract artifact there
6. set `/opt/lifeline/current` to the new release
7. run production compose command from the current release
8. verify health
9. fail and preserve logs if unhealthy

### Why this model fits this repo
- it matches the already proven manual deployment path
- it does not require a registry as a first step
- it avoids changing the production runtime shape
- it uses the existing release directory model already present on the VPS
- it keeps the deploy branch behavior simple and predictable

### Recommended workflow responsibilities

#### On the GitHub runner
- checkout code
- derive release id from commit SHA or timestamp
- optionally run light validation before deploy
- upload deployment artifact
- invoke remote deploy script/command

#### On the VPS
- unpack release
- preserve shared env file
- run compose build/start
- run smoke checks
- optionally clean old releases after successful deploy

### Best-practice recommendation for this project

Use one simple production workflow, for example:
- branch: `deploy`
- job: `deploy-to-vps`
- transport: SSH
- deploy method: release upload + symlink switch + compose up
- validation: smoke checks + health endpoint

This is the best fit for the current state.

## 6. User vs Agent Responsibility Split

### What the agent can fully implement

Confirmed or strongly supported by current capability findings:
- create/update CI workflow files in the repo
- create VPS deploy scripts in the repo if needed
- adapt the workflow to package and deploy the current release structure
- implement smoke-check logic in workflow/scripts
- push workflow changes to the repository branches
- target the existing `deploy` branch model

### What the agent can probably implement but did not write-confirm in this pass

These appear likely possible, but were not directly exercised in this discovery-only phase:
- create GitHub Actions secrets
- create GitHub Environments
- configure branch protection
- configure required reviewer rules

Because no write operation was executed against GitHub settings, these should be treated as permission-likely but not write-confirmed.

### What the user likely must still do manually

Depending on how strict the user wants the setup to be, the user may still need to do one or more of the following manually:
- provide or approve the SSH private key handling model for GitHub Actions
- decide the exact GitHub secret names and values
- approve cleanup/removal of legacy Azure workflows and secrets
- approve whether `deploy` should have branch protection and reviewer rules
- approve creation of a GitHub Environment such as `production`
- approve production deployment gating rules if desired

### Minimum manual inputs likely needed

At minimum, CI/CD implementation will likely need these secrets in GitHub:
- VPS SSH host
- VPS SSH user
- VPS SSH private key
- optionally VPS SSH port if non-default

Depending on workflow design, it may also need:
- known hosts fingerprint or a trusted host-key strategy
- optional notification or rollback-related secrets

## 7. Phase 5.5 Implementation Plan

### Step 1: Clean automation target definition
- keep `main` as dev/integration
- keep `deploy` as production deployment branch
- trigger production workflow only from `deploy`

### Step 2: Replace Azure deployment workflow logic
- retire or replace the Azure App Service workflow path
- add a VPS deployment workflow for the current architecture
- document that production deployment now targets the VPS, not Azure App Service

### Step 3: Add deployment workflow
The workflow should:
- trigger on push to `deploy`
- optionally support `workflow_dispatch`
- checkout the repo
- assemble release artifact
- SSH/SCP to VPS
- create a new release directory under `/opt/lifeline/releases`
- update `/opt/lifeline/current`
- run Docker Compose deploy command
- run smoke checks
- fail loudly if unhealthy

### Step 4: Add or refine VPS deploy script
Prefer a small deploy script in the repo for the VPS steps so the workflow stays simple.

That script should:
- accept release path or release id
- repoint the `current` symlink
- run compose up with the production env file
- show useful diagnostics on failure
- optionally prune older releases after success

### Step 5: Add smoke verification
At minimum:
- `docker ps`
- `curl https://lifeline.a2z-us.com/api/health/db`
- optional internal bind confirmation
- optional `a2z-us.com` regression check

### Step 6: Optional environment hardening
If the user wants safer production governance:
- create a `production` GitHub Environment
- store deploy secrets there
- add branch protection or approval rules around `deploy`
- optionally require manual approval before deployment

### Step 7: Document operator flow
Document clearly:
- how code reaches production
- how `main` moves into `deploy`
- how to rerun a failed deployment
- where to inspect logs
- how to roll back to a previous release

## 8. Risks and Safeguards

### Risk: Legacy Azure workflows or secrets cause confusion
Safeguard:
- explicitly replace or deprecate Azure deployment workflows
- document the new source of truth for production deploys

### Risk: GitHub secrets or settings writes may fail unexpectedly
Safeguard:
- treat GitHub settings writes as permission-likely but not yet confirmed
- implement the repo-side workflow first
- then add secrets/settings with explicit verification

### Risk: Bad deploy from `deploy` branch reaches production automatically
Safeguard:
- consider optional `workflow_dispatch`
- or add branch protections / review rules on `deploy`
- or use a GitHub Environment with approval if desired

### Risk: Workflow breaks live service without enough diagnostics
Safeguard:
- include smoke checks
- include recent `docker logs` output on failure
- preserve release directories for rollback

### Risk: Existing apex site is impacted during deploy
Safeguard:
- keep deployment automation scoped to `/opt/lifeline`
- do not alter the `a2z-us.com` upstream path
- keep Nginx config changes out of normal code deploys unless intentionally required

### Risk: Secrets are handled insecurely
Safeguard:
- store secrets only in GitHub secrets or environments
- do not commit VPS secrets to the repo
- reuse `/opt/lifeline/shared/.env.production` as the runtime source of truth on the host

## 9. Out of Scope

The following are out of scope for Phase 5.5:
- implementing the actual CI/CD workflow in this pass
- changing production Nginx routing architecture
- moving deployment to containers registry / Kubernetes
- redesigning Auth0 production configuration
- replacing VPS deployment with Azure or another hosting platform
- advanced blue/green or canary production rollout
- full GitHub governance redesign beyond deploy-branch needs

## 10. Recommendation for the Phase 5.5 Implementation Prompt

The Phase 5.5 implementation prompt should instruct the implementation pass to:
- create a GitHub Actions workflow for push to `deploy`
- replace or supersede the current Azure deployment workflow
- use SSH-based VPS deployment to `/opt/lifeline`
- reuse the current release-style deployment layout
- upload a release artifact to the VPS
- repoint `/opt/lifeline/current`
- run `docker compose` using `compose.production.yaml` and `/opt/lifeline/shared/.env.production`
- run smoke checks against `https://lifeline.a2z-us.com/api/health/db`
- surface failure diagnostics clearly
- document required GitHub secrets and any manual setup still needed
- avoid changing runtime production secrets already stored on the VPS

The implementation prompt should also require the implementation pass to state clearly:
- which GitHub settings it was able to write directly
- which GitHub settings still require manual user action
- whether legacy Azure workflows were removed, disabled, or left in place
