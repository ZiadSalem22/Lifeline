# Production Runtime and Rollback

## Purpose

This document describes the current production runtime shape, deployment environment expectations, and rollback behavior.

## Canonical sources used for this document

- [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml)
- [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh)
- [compose.production.yaml](../../compose.production.yaml)
- [Dockerfile](../../Dockerfile)
- [services/lifeline-mcp/Dockerfile](../../services/lifeline-mcp/Dockerfile)
- [deploy/nginx/lifeline.a2z-us.com.conf](../../deploy/nginx/lifeline.a2z-us.com.conf)
- [deploy/nginx/mcp.lifeline.a2z-us.com.conf](../../deploy/nginx/mcp.lifeline.a2z-us.com.conf)
- [backend/scripts/start-container.js](../../backend/scripts/start-container.js)
- [docs/operations/DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)

## Current production model

Current host access uses the reachable `root` account on the VPS. Do not assume a `ziyad` Linux user exists. If a dedicated deploy user is introduced later, it must be created, granted the required Docker/Nginx/release permissions, and then reflected in the deployment secret configuration before cutover work switches away from `root`.

Lifeline uses the `deploy-branch production model`.

The current production target is a VPS that hosts:

- release directories under `/opt/lifeline/releases`
- the active symlink at `/opt/lifeline/current`
- a shared production environment file at `/opt/lifeline/shared/.env.production`
- an Nginx reverse proxy
- Docker containers for the app, MCP service, and PostgreSQL

## Production runtime components

### `lifeline-app`

The application container:

- is built from the repo Dockerfile
- serves the Express API
- serves built frontend assets
- waits for PostgreSQL before startup
- runs migrations before listening

### `lifeline-postgres`

The Postgres container:

- runs `postgres:16-alpine`
- persists data through the named volume `lifeline-postgres-data`
- exposes health through `pg_isready` inside the compose healthcheck

### `lifeline-mcp`

The MCP container:

- is built from [services/lifeline-mcp/Dockerfile](../../services/lifeline-mcp/Dockerfile)
- runs the separate MCP HTTP service on its internal MCP port
- publishes only to the VPS loopback port configured by `MCP_PORT`
- reaches the backend through `http://lifeline-app:3000`
- depends on the backend internal shared-secret boundary instead of direct database access

### Nginx

Nginx proxies:

- `lifeline.a2z-us.com` to `http://127.0.0.1:3020`
- `mcp.lifeline.a2z-us.com` to `http://127.0.0.1:3030`

That keeps both Node services off the public network interface and makes Nginx the public edge.

## Runtime environment expectations

The production compose file expects environment values for:

- PostgreSQL credentials and database name
- auth settings such as Auth0 domain and audience when auth is enabled
- allowed origins and app origins
- logging and SSL behavior
- internal app port mapping through `APP_PORT`
- MCP bind and public URL settings through `MCP_PORT`, `MCP_BIND_HOST`, and `MCP_PUBLIC_BASE_URL`
- MCP internal adapter settings through `LIFELINE_BACKEND_BASE_URL` and `MCP_INTERNAL_SHARED_SECRET`
- backend API-key verification support through `MCP_API_KEY_PEPPER`

The shared production env file is the main runtime source for those values.

The first-cutover operator workflow, MCP API-key issuance path, and real client validation steps live in [lifeline-mcp-first-cutover-runbook.md](lifeline-mcp-first-cutover-runbook.md).

## Production deployment flow summary

At a high level, production deployment does the following:

1. package the `deploy` branch commit
2. upload the release archive to the VPS
3. extract it into a new release directory
4. repoint `/opt/lifeline/current`
5. clear stale listeners from the reserved MCP loopback port if the configured `MCP_PORT` listener, which now defaults to `127.0.0.1:3030`, is still occupied
6. run `docker compose up -d --build`
7. verify database health, internal MCP health, public app info response, loopback-only app and MCP bindings, and the MCP-to-backend internal adapter path
8. sync the MCP Nginx host config, run `nginx -t`, reload Nginx, and verify the public MCP health endpoint

The deploy workflow currently supports VPS layouts that use either `/etc/nginx/conf.d/` or `/etc/nginx/sites-available` plus `/etc/nginx/sites-enabled`.

## Automatic rollback behavior

The deploy helper captures the previous active release before switching the symlink.

If deployment fails after the symlink switch:

- the trap handler restores `/opt/lifeline/current` to the previous release
- diagnostic output is collected from Docker and the affected containers
- the deployment exits as failed

## Release retention behavior

The deploy helper keeps only a limited set of recent releases through `KEEP_RELEASES` and prunes older directories while preserving the active and previous release paths.

## Manual rollback

A manual rollback can be performed by:

1. repointing `/opt/lifeline/current` to a previous release directory
2. rerunning the compose startup against that release with the shared production env file

## Operational risks to watch

Important operational assumptions include:

- the app container must stay bound to `127.0.0.1:3020` in production
- the MCP container must stay bound to `127.0.0.1:${MCP_PORT:-3030}` in production
- the shared env file must exist and be valid
- migrations must succeed before the app can start normally
- the public domains and Nginx proxy targets must remain aligned with the compose port mappings
- `lifeline-mcp` health only proves the MCP edge is listening; backend availability still depends on `lifeline-app` and the internal shared-secret path remaining healthy

## Related canonical documents

- [DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)
- [deployment-verification-and-smoke-checks.md](deployment-verification-and-smoke-checks.md)
- [lifeline-mcp-first-cutover-runbook.md](lifeline-mcp-first-cutover-runbook.md)
- [local-development-and-runtime-setup.md](local-development-and-runtime-setup.md)
- [../architecture/runtime-topology.md](../architecture/runtime-topology.md)
