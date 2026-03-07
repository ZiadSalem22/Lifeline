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
8. Reserves the MCP loopback port on the VPS by clearing stale listeners on the configured `MCP_PORT` value from `/opt/lifeline/shared/.env.production`, which now defaults to `127.0.0.1:3030`, before the new MCP container starts.
9. Verifies app, MCP, and Postgres container health plus internal and public app runtime checks, including the public app info endpoint and the MCP-to-backend internal adapter path.
10. Syncs [deploy/nginx/mcp.lifeline.a2z-us.com.conf](../../deploy/nginx/mcp.lifeline.a2z-us.com.conf) to the VPS host, tests Nginx, reloads it, and then verifies the public MCP health endpoint.

## Production runtime topology

The current production path is:

- public traffic enters through Nginx on the VPS
- Nginx proxies `lifeline.a2z-us.com` to `127.0.0.1:3020`
- Nginx proxies `mcp.lifeline.a2z-us.com` to `127.0.0.1:3030`
- Docker maps that loopback port to the app container's internal port `3000`
- Docker maps the MCP loopback port to the `lifeline-mcp` container's internal MCP port
- the `lifeline-mcp` container reaches `lifeline-app` over the compose network at `http://lifeline-app:3000`
- the app container connects to the `lifeline-postgres` container over the compose network

## Required GitHub deployment secrets

Production runtime secrets stay on the VPS in `/opt/lifeline/shared/.env.production`.

That shared env file now also carries MCP runtime secrets and settings such as:

- `MCP_INTERNAL_SHARED_SECRET`
- `MCP_API_KEY_PEPPER`
- `MCP_PORT`
- `MCP_PUBLIC_BASE_URL`

GitHub only needs deployment automation secrets:

- `VPS_SSH_HOST`
- `VPS_SSH_USER` (optional only if the current reachable VPS account is still `root`)
- `VPS_SSH_PRIVATE_KEY`
- `VPS_SSH_PORT`
- `VPS_SSH_KNOWN_HOSTS`

The workflow expects these secrets in the `production` GitHub environment.

Current host-access rule:

- do not assume a Linux user named `ziyad`
- use `root` for production SSH access unless and until a dedicated deploy user is intentionally created and validated
- if a dedicated deploy user is created later, update `VPS_SSH_USER` to that account before the next deploy

## Nginx routing note

The GitHub Actions workflow now syncs the MCP host config from the release onto the VPS, runs `nginx -t`, reloads Nginx, and then verifies the public MCP health endpoint. If the VPS ever uses a different include layout than `/etc/nginx/conf.d/` or `/etc/nginx/sites-available` plus `/etc/nginx/sites-enabled`, update the workflow before the next cutover.

For the first MCP cutover checklist, API-key issuance flow, and first real client validation steps, use [lifeline-mcp-first-cutover-runbook.md](lifeline-mcp-first-cutover-runbook.md).

## Manual operator flow

1. Merge or cherry-pick the desired commit(s) from `main` into `deploy`.
2. Push `deploy`.
3. For any manual VPS inspection during the rollout, connect as `root@<vps-host>` unless a dedicated deploy user has been created first.
4. Watch the GitHub Actions run for `Deploy Lifeline Production`.
5. If needed, rerun the workflow manually from GitHub Actions.

## Rollback

- Previous releases are preserved under `/opt/lifeline/releases`.
- The deploy helper restores `/opt/lifeline/current` to the previous release automatically if the new deployment fails.
- For a manual rollback, repoint `/opt/lifeline/current` to a previous release and rerun:
  - `docker compose -p lifeline --env-file /opt/lifeline/shared/.env.production -f compose.production.yaml up -d --build`

## Related canonical documents

- [production-runtime-and-rollback.md](production-runtime-and-rollback.md)
- [deployment-verification-and-smoke-checks.md](deployment-verification-and-smoke-checks.md)
- [lifeline-mcp-first-cutover-runbook.md](lifeline-mcp-first-cutover-runbook.md)
- [../architecture/runtime-topology.md](../architecture/runtime-topology.md)
