# Runtime Topology

## Purpose

This document describes the current runtime topology for local development, compose-based runtime checks, and production deployment.

## Canonical sources used for this document

- [compose.yaml](../../compose.yaml)
- [compose.production.yaml](../../compose.production.yaml)
- [Dockerfile](../../Dockerfile)
- [services/lifeline-mcp/Dockerfile](../../services/lifeline-mcp/Dockerfile)
- [deploy/nginx/lifeline.a2z-us.com.conf](../../deploy/nginx/lifeline.a2z-us.com.conf)
- [deploy/nginx/mcp.lifeline.a2z-us.com.conf](../../deploy/nginx/mcp.lifeline.a2z-us.com.conf)
- [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh)
- [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml)
- [backend/scripts/start-container.js](../../backend/scripts/start-container.js)
- [backend/src/index.js](../../backend/src/index.js)
- [services/lifeline-mcp/src/app.js](../../services/lifeline-mcp/src/app.js)
- [../adr/0001-lifeline-mcp-runtime-boundary.md](../adr/0001-lifeline-mcp-runtime-boundary.md)

## Production topology

The current production runtime is:

`Internet -> Nginx on VPS -> lifeline-app on 127.0.0.1:3020 -> Express app on container port 3000 -> lifeline-postgres on 5432`

and, for MCP traffic:

`Internet -> Nginx on VPS -> lifeline-mcp on 127.0.0.1:3030 -> internal HTTP -> lifeline-app on Docker network -> lifeline-postgres on 5432`

## Production node roles

### Nginx on the VPS

Nginx terminates the public HTTP(S) entrypoints for:

- `lifeline.a2z-us.com` → `http://127.0.0.1:3020`
- `mcp.lifeline.a2z-us.com` → `http://127.0.0.1:3030`

That keeps both application containers off the public interface and preserves Nginx as the only public edge.

### App container

The `lifeline-app` container runs the Node runtime that:

- waits for PostgreSQL
- runs TypeORM migrations
- starts the Express backend
- serves the built frontend shell when client assets are present

### MCP container

The `lifeline-mcp` container runs the separate MCP edge service that:

- exposes `POST /mcp` and `GET /health`
- exposes OAuth discovery metadata for `/mcp` at:
	- `GET /.well-known/oauth-protected-resource/mcp`
	- `GET /.well-known/oauth-authorization-server`
- accepts either MCP API keys or Auth0 OAuth bearer tokens at the public edge
- resolves API-key principals through the backend-internal auth surface
- validates Auth0 bearer tokens against the configured Auth0 issuer JWKS
- resolves validated Auth0 claims into a Lifeline principal through the backend-internal OAuth resolver
- delegates task operations to `http://lifeline-app:3000/internal/mcp/*`
- does not connect to PostgreSQL directly

### Postgres container

The `lifeline-postgres` container provides the durable authenticated-mode relational store.

## Release-directory topology on the VPS

Production releases live under:

- `/opt/lifeline/releases/<release-id>` for extracted release contents
- `/opt/lifeline/current` as the active symlink
- `/opt/lifeline/shared/.env.production` for shared runtime configuration

This layout supports rollback by restoring the `current` symlink to the previous release.

## Network and port model

### Inside the app container

- Express listens on port `3000`

### On the VPS host

- the app container is published as `127.0.0.1:${APP_PORT:-3020}:3000` in production
- the MCP container is published as `127.0.0.1:${MCP_PORT:-3030}:${MCP_PORT:-3030}` in production
- the production deployment script verifies that the binding remains limited to `127.0.0.1:3020`
- the same deploy helper verifies that the MCP bind remains limited to `127.0.0.1:${MCP_PORT:-3030}`

### Database network path

- the app container reaches PostgreSQL through the compose service name `lifeline-postgres`
- the backend uses `PGHOST=lifeline-postgres` and port `5432`

### Internal MCP adapter path

- the MCP container reaches the backend through the compose service name `lifeline-app`
- the MCP runtime uses `LIFELINE_BACKEND_BASE_URL=http://lifeline-app:3000`
- backend-internal MCP routes stay private behind Docker networking plus the shared-secret header boundary

## Local runtime topology options

### Split local development

The main local developer shape is:

- backend dev server on `http://localhost:3000`
- frontend Vite dev server on `http://localhost:5173` or `https://localhost:5173` when local certs are present
- Vite proxies `/api` requests to the backend dev server

### Compose runtime

The repo also supports a local compose runtime that builds the same combined app image and publishes it on `${APP_PORT:-3020}`.

Unlike production, the local compose file publishes the container on all interfaces by default rather than restricting it to loopback.

## Build topology

The Dockerfile uses a multi-stage build:

1. build the frontend with Vite
2. install backend production dependencies
3. assemble a runtime image containing backend code, backend dependencies, and frontend build output

This produces a single application image that can both serve API traffic and return the SPA shell.

## Startup sequence in containerized runtime

At container start, the runtime:

1. waits for PostgreSQL availability
2. runs migrations with `typeorm migration:run`
3. starts the Express app on the configured port

## Health and verification surfaces

The main runtime verification surfaces are:

- `/api/health/db`
- `/api/health/db/schema`
- `/`
- `mcp.lifeline.a2z-us.com/health`
- `mcp.lifeline.a2z-us.com/.well-known/oauth-protected-resource/mcp`
- `mcp.lifeline.a2z-us.com/.well-known/oauth-authorization-server`
- SPA fallback routes such as `/statistics`

## Related canonical documents

- [system-overview.md](system-overview.md)
- [frontend-backend-data-boundaries.md](frontend-backend-data-boundaries.md)
- [../operations/DEPLOY_BRANCH_CD.md](../operations/DEPLOY_BRANCH_CD.md)
- [../operations/production-runtime-and-rollback.md](../operations/production-runtime-and-rollback.md)
- [../operations/deployment-verification-and-smoke-checks.md](../operations/deployment-verification-and-smoke-checks.md)
- [../operations/lifeline-mcp-auth0-oauth-runbook.md](../operations/lifeline-mcp-auth0-oauth-runbook.md)
