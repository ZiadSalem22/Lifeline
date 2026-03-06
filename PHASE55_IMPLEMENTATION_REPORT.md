# Phase 5.5 Implementation Report

## 1. Executive Summary

Phase 5.5 implementation is complete at the repository and VPS automation layer.

The Azure-era deployment workflow has been replaced with a deploy-branch VPS workflow that targets the already-working production layout at `/opt/lifeline`.

The new deployment path is:
- push to `deploy`
- GitHub Actions packages the tracked repository contents
- the release archive is uploaded to the VPS over SSH
- the archive is extracted into `/opt/lifeline/releases/<release-id>`
- `/opt/lifeline/current` is repointed to the new release
- `docker compose` is run with `compose.production.yaml` and `/opt/lifeline/shared/.env.production`
- smoke checks verify container health, public health, homepage availability, and private loopback binding

Production runtime secrets remain on the VPS and are not moved into git or GitHub Actions.

## 2. Workflow / Repo Changes Applied

- removed the legacy Azure workflow at [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)
- added the new production workflow at [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)
- added the VPS deploy helper at [deploy/scripts/apply-release.sh](deploy/scripts/apply-release.sh)
- added deploy-branch operator documentation at [docs/guides/DEPLOY_BRANCH_CD.md](docs/guides/DEPLOY_BRANCH_CD.md)
- updated [docs/README.md](docs/README.md) to link the new deploy guide
- updated [README.md](README.md) with the production deploy-branch summary

Workflow characteristics now in place:
- trigger on push to `deploy`
- optional manual run through `workflow_dispatch`
- concurrency lock so only one production deployment runs at a time
- environment target set to `production`
- release archive built from tracked repository contents with `git archive`
- SSH upload and remote extraction into `/opt/lifeline/releases/<release-id>`
- remote execution of the deploy helper script
- failure diagnostics captured from the VPS if the run fails

## 3. VPS Deploy Automation Changes Applied

Added [deploy/scripts/apply-release.sh](deploy/scripts/apply-release.sh) to handle the VPS-side deployment steps.

Implemented behavior:
- validates release directory and shared env file
- captures the previous `/opt/lifeline/current` target
- repoints `/opt/lifeline/current` to the new release
- runs `docker compose -p lifeline --env-file /opt/lifeline/shared/.env.production -f compose.production.yaml up -d --build`
- waits for `lifeline-postgres` and `lifeline-app` to become healthy
- verifies:
  - internal health at `http://127.0.0.1:3020/api/health/db`
  - public health at `https://lifeline.a2z-us.com/api/health/db`
  - homepage at `https://lifeline.a2z-us.com/`
  - private port bind remains `127.0.0.1:3020`
- prints `docker ps` status after success
- restores the previous symlink and prints container logs if deployment fails
- prunes older releases conservatively while keeping the current and previous release

## 4. GitHub Settings / Secrets Actions Attempted

Completed GitHub-side write attempts:

- created the `production` GitHub environment
- created production environment secrets:
  - `VPS_SSH_HOST`
  - `VPS_SSH_USER`
  - `VPS_SSH_PORT`
  - `VPS_SSH_PRIVATE_KEY`
  - `VPS_SSH_KNOWN_HOSTS`
- generated a dedicated GitHub Actions SSH keypair for deployment and authorized its public key on the VPS for `root`
- disabled the legacy Azure workflows so they no longer represent an active production path
- enabled a custom deployment branch policy on the `production` environment
- added a deployment branch policy so only the `deploy` branch can use the `production` environment

GitHub settings state after implementation:

- active workflow:
  - `Deploy Lifeline Production`
- disabled legacy workflows:
  - `Deploy Backend to Azure`
  - `Build and deploy Node.js app to Azure Web App - lifeline-backend-app`
- production environment exists and is restricted to the `deploy` branch

GitHub settings not applied in this phase:

- repository branch protection rules were not added to `main` or `deploy`
- required reviewers / manual approval rules were not added

Reason they were not applied:
- they would materially change the repository push and deployment governance model
- the requested automatic deploy path does not require them to function
- they should remain an explicit user governance choice rather than an implicit automation change

## 5. Verification Performed

Verified locally and remotely:

- confirmed the dedicated deployment SSH key can authenticate to the VPS
- confirmed the `production` environment exists
- confirmed all required production deployment secrets exist in the `production` environment
- confirmed the `production` environment is limited to the `deploy` branch
- confirmed only `Deploy Lifeline Production` remains active in GitHub Actions

Verified through GitHub Actions:

- pushed commit `84ab87e1` to `main`
- pushed the same commit to `deploy`
- observed workflow run [Deploy Lifeline Production](https://github.com/ZiadSalem22/Lifeline/actions/runs/22782409436)
- first attempt failed because `VPS_SSH_KNOWN_HOSTS` had been populated with an empty value
- corrected `VPS_SSH_KNOWN_HOSTS`
- reran the workflow successfully
- final workflow result: success

Verified on the VPS after the successful workflow run:

- current release now points to `/opt/lifeline/releases/lifeline-20260306212039-84ab87e`
- `lifeline-app` is healthy
- `lifeline-postgres` is healthy
- public health check `https://lifeline.a2z-us.com/api/health/db` returns success
- homepage `https://lifeline.a2z-us.com/` responds with HTTP `200`
- app container bind remains `127.0.0.1:3020`

## 6. What Still Requires Manual User Action

No manual action is required for the basic automatic deploy path.

Optional manual actions the user may still choose to take later:

- add repository branch protection rules for `main` and/or `deploy`
- add required reviewers or manual approval rules to the `production` environment
- rotate the GitHub Actions deploy key on a schedule if desired
- remove any now-unused Azure-era repository secrets from GitHub

## 7. Risks / Notes

- Production runtime secrets remain host-side by design.
- The workflow requires GitHub deployment secrets for SSH transport only.
- The deploy workflow currently uses a dedicated SSH key attached to the `root` account on the VPS for simplicity.
- If stricter hardening is desired later, the next improvement should be replacing `root`-based deployment with a dedicated deployment user.
- Existing Azure-era workflow entries were explicitly disabled, but Azure-era repository secrets may still be cleaned up manually later.
- The first workflow attempt failed because the initial `VPS_SSH_KNOWN_HOSTS` secret was empty; this was corrected and the rerun succeeded.

## 8. Completion Status

Completed.

Automatic deploy from `deploy` is fully working.