# Deploy-Branch Production CD

This repository uses a deploy-branch production deployment model.

## Production deployment trigger

- `main` remains the normal development and integration branch.
- `deploy` is the production deployment branch.
- Every push to `deploy` triggers the production workflow in [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml).
- Manual reruns are also available through `workflow_dispatch`.

## Deployment flow

The workflow performs the following steps:

1. Checks out the `deploy` branch commit.
2. Creates a release id and packages the tracked repository contents into a release archive.
3. Uploads the archive to the VPS over SSH.
4. Extracts the archive into `/opt/lifeline/releases/<release-id>`.
5. Runs [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh) on the VPS.
6. Repoints `/opt/lifeline/current` to the new release.
7. Runs `docker compose` with [compose.production.yaml](../../compose.production.yaml) and `/opt/lifeline/shared/.env.production`.
8. Verifies container health, public health, homepage availability, and the private `127.0.0.1:3020` bind.

## Required GitHub deployment secrets

Production runtime secrets stay on the VPS in `/opt/lifeline/shared/.env.production`.

GitHub only needs deployment automation secrets:

- `VPS_SSH_HOST`
- `VPS_SSH_USER`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_SSH_PORT`
- `VPS_SSH_KNOWN_HOSTS`

The workflow expects these secrets in the `production` GitHub environment.

## Manual operator flow

1. Merge or cherry-pick the desired commit(s) from `main` into `deploy`.
2. Push `deploy`.
3. Watch the GitHub Actions run for `Deploy Lifeline Production`.
4. If needed, rerun the workflow manually from GitHub Actions.

## Rollback

- Previous releases are preserved under `/opt/lifeline/releases`.
- The deploy helper restores `/opt/lifeline/current` to the previous release automatically if the new deployment fails.
- For a manual rollback, repoint `/opt/lifeline/current` to a previous release and rerun:
  - `docker compose -p lifeline --env-file /opt/lifeline/shared/.env.production -f compose.production.yaml up -d --build`
