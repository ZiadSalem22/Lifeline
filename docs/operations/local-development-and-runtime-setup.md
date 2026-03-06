# Local Development and Runtime Setup

## Purpose

This document describes the current supported local development and local runtime setup paths for Lifeline.

## Canonical sources used for this document

- [backend/package.json](../../backend/package.json)
- [client/package.json](../../client/package.json)
- [client/vite.config.js](../../client/vite.config.js)
- [compose.yaml](../../compose.yaml)
- [Dockerfile](../../Dockerfile)
- [backend/scripts/start-container.js](../../backend/scripts/start-container.js)
- [backend/scripts/verify-local-postgres-runtime.js](../../backend/scripts/verify-local-postgres-runtime.js)
- [backend/scripts/verify-compose-runtime.js](../../backend/scripts/verify-compose-runtime.js)

## Supported local workflow shapes

There are two practical local paths:

1. split frontend/backend development
2. local Docker Compose runtime

## Split frontend/backend development

### Backend

From [backend](../../backend):

- install dependencies with `npm install`
- run the development server with `npm run dev`

The backend dev server listens on `http://localhost:3000` by default.

### Frontend

From [client](../../client):

- install dependencies with `npm install`
- run Vite with `npm run dev`

The frontend dev server uses port `5173` by default.

When local certificates are present in [client/dev.key](../../client/dev.key) and [client/dev.crt](../../client/dev.crt), Vite serves over HTTPS. Otherwise it falls back to HTTP.

### Frontend-to-backend proxying

Vite proxies `/api` calls to `http://localhost:3000` by default through `VITE_DEV_API_PROXY_TARGET`.

That keeps the browser-facing frontend dev server separate from the backend dev server while still allowing local API usage.

## Local compose runtime

The repo also supports a combined containerized local runtime through [compose.yaml](../../compose.yaml).

Current local compose characteristics:

- builds the same multi-stage app image used for production-style runtime
- starts a `lifeline-postgres` container
- starts a `lifeline-app` container
- publishes the app on `${APP_PORT:-3020}`
- defaults local auth bypass to enabled with `AUTH_DISABLED=1`
- defaults local build-time frontend auth bypass through `BUILD_LOCAL_MODE=1`

## Database expectations

### Split development

Split development expects a reachable PostgreSQL database configured through the backend environment variables.

### Compose runtime

Compose runtime provisions PostgreSQL automatically inside Docker and wires the app container to it through `PGHOST=lifeline-postgres`.

## Container startup behavior

In containerized runtime, the app startup script:

1. waits for PostgreSQL
2. runs TypeORM migrations
3. starts the backend server

That means local compose runs are expected to self-apply migrations before the app begins serving traffic.

## Useful local scripts

### Backend scripts

Notable backend scripts include:

- `npm run migration:run`
- `npm run migration:revert`
- `npm run db:init:postgres`
- `npm run reset-db`
- `npm run soft-reset-db`
- `npm run verify:local`
- `npm run verify:compose`

### Frontend scripts

Notable frontend scripts include:

- `npm run build`
- `npm run preview`
- `npm test`
- `npm run test:run`

## Local verification options

### API/runtime verification

[backend/scripts/verify-local-postgres-runtime.js](../../backend/scripts/verify-local-postgres-runtime.js) exercises:

- `/api/me`
- profile save/reload
- settings save/reload
- tag creation and listing
- todo creation, update, toggle, and listing
- stats
- export
- notifications-disabled behavior

### Compose verification

[backend/scripts/verify-compose-runtime.js](../../backend/scripts/verify-compose-runtime.js) additionally checks:

- frontend shell on `/`
- SPA fallback on `/statistics`
- database health endpoint
- representative authenticated CRUD flows

## Related canonical documents

- [QUICK_START.md](QUICK_START.md)
- [production-runtime-and-rollback.md](production-runtime-and-rollback.md)
- [deployment-verification-and-smoke-checks.md](deployment-verification-and-smoke-checks.md)
- [../architecture/runtime-topology.md](../architecture/runtime-topology.md)
