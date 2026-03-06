# Phase 4 Implementation Report

## 1. Executive Summary

Phase 4 completed successfully.

Lifeline now has a working single-service app container that serves the built frontend and backend API together, a two-service local Compose stack with PostgreSQL persistence, a normalized local container env contract, explicit database wait-and-migrate startup behavior, and repeatable local Compose verification.

The implemented local Compose target is:
- `lifeline-app`
- `lifeline-postgres`

The implemented serving model is:
- frontend built with Vite during image build
- built frontend packaged into the app image
- backend remains the long-running process
- backend serves built frontend assets
- `/api` stays on the same origin

## 2. Packaging and Serving Model Implemented

Implemented in the backend runtime:
- built frontend asset detection and serving in `backend/src/index.js`
- SPA fallback routing in `backend/src/index.js`
- same-origin delivery of frontend and API from the app container
- preservation of existing reserved backend paths such as `/api`, `/api-docs`, `/swagger-ui`, and `/swagger.json`

Implemented runtime behavior:
- static frontend assets are served from `client/dist`
- non-API browser-history routes resolve to `index.html`
- API routes continue to be handled by Express under `/api`

## 3. Docker Build Artifacts Implemented

Implemented artifacts:
- root `Dockerfile`
- root `.dockerignore`
- root `compose.yaml`
- root `compose.env.example`

Docker build strategy implemented:
- multi-stage frontend build stage using Vite
- backend dependency stage using production-only install
- final runtime image containing:
  - backend source
  - backend runtime scripts
  - migration datasource wiring
  - Swagger JSON
  - built frontend assets
  - production backend dependencies

Image-scope protections implemented:
- excluded `database/phase3/runs/**`
- excluded legacy `db/`
- excluded local env files
- excluded logs, coverage, temp output, and local DB artifacts
- kept DB-local retained evidence outside runtime images

## 4. Environment Contract Changes

### Backend/runtime contract
Implemented container/runtime env handling for:
- `PORT`
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `PGSSL`
- `PGSSL_ALLOW_SELF_SIGNED`
- `DB_WAIT_TIMEOUT_MS`
- `DB_WAIT_INTERVAL_MS`
- `TYPEORM_LOGGING`
- `LOG_LEVEL`
- `AUTH_DISABLED`
- `AUTH_LOCAL_USER_ID`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_AUDIENCE_ALT`
- `CORS_ORIGIN`
- `FRONTEND_ORIGIN`
- `APP_ORIGIN`

Implemented changes:
- `backend/.env.example` now documents compose-relevant wait and same-origin settings
- backend CORS defaults now include same-origin local app access
- PostgreSQL wait timing is configurable for container boot sequencing

### Frontend/build-time contract
Implemented build-time handling for:
- `VITE_API_BASE_URL`
- `VITE_AUTH_DISABLED`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_AUTH0_SCOPE`

Implemented changes:
- `client/.env.example` now documents same-origin and local compose verification mode
- frontend API base handling now defaults safely to same-origin when needed
- duplicated API base normalization was centralized into `client/src/utils/apiBase.js`

### Local auth adapter
Implemented local container verification support:
- `client/src/providers/AuthAdapterProvider.jsx`
- `client/src/hooks/useAuth.js`
- `client/src/hooks/useApi.js`
- `client/src/hooks/useApiAuth.js`

Behavior:
- when `VITE_AUTH_DISABLED=1`, the frontend uses a local authenticated adapter
- this allows the containerized frontend to exercise backend-backed flows locally without requiring live Auth0 configuration
- when disabled mode is off, the normal Auth0 provider path remains available

## 5. Compose Stack Implemented

Implemented Compose services:
- `lifeline-postgres`
- `lifeline-app`

Implemented stack behavior:
- named PostgreSQL volume: `lifeline-postgres-data`
- PostgreSQL healthcheck via `pg_isready`
- app healthcheck via `GET /api/health/db`
- app dependency on healthy PostgreSQL service
- default published app port moved to `3020` to avoid common local `3000` conflicts

Implemented app service behavior:
- build from root `Dockerfile`
- runtime env injected at container start
- frontend env injected during image build
- app exposed on host port `3020` by default

## 6. Migration / Init Sequencing Implemented

Implemented runtime scripts:
- `backend/scripts/wait-for-postgres.js`
- `backend/scripts/start-container.js`

Implemented package scripts:
- `start:container`
- `db:wait`
- `verify:compose`

Startup sequence implemented:
1. wait for PostgreSQL connection readiness
2. run TypeORM migrations
3. start the Express app
4. rely on app and DB healthchecks for steady-state validation

Implemented behavior:
- first boot applies schema automatically
- restart path detects and skips already-applied migrations cleanly
- app startup is no longer dependent on an ad hoc manual sequence
- compose restarts preserve data through the named volume

## 7. Azure-Era Config Treatment

Azure/SWA-era config was isolated from the Compose runtime path.

Implemented treatment:
- `client/package.json`
  - default `build` no longer copies `staticwebapp.config.json`
  - Azure/SWA-specific build behavior moved behind `build:swa`
- `client/vite.config.js`
  - dev proxy no longer hardcodes the Azure backend
  - dev proxy now uses `VITE_DEV_API_PROXY_TARGET` with a local backend default
- `client/staticwebapp.config.json`
  - preserved as a historical/deployment-specific artifact
  - not used by the default Docker/Compose runtime build path

Result:
- Compose behavior is no longer shaped by the older Azure Static Web Apps path
- historical Azure artifacts remain available without controlling the new container path

## 8. Local Compose Verification Results

### Build and startup verification
Executed successfully:
- `docker compose -f compose.yaml --env-file compose.env.example config`
- `docker compose -f compose.yaml --env-file compose.env.example build`
- `docker compose -f compose.yaml --env-file compose.env.example up -d`

Observed result:
- both services reached healthy state
- migrations applied successfully on first boot
- later app restart reported `No migrations are pending`
- frontend assets were served from `/app/client/dist`

### Functional verification
Executed successfully:
- `npm run build` in `client/`
- `npm run verify:compose` in `backend/` against `http://localhost:3020`

Verified successfully through the Compose stack:
- frontend shell from `/`
- SPA fallback from `/statistics`
- `/api/health/db`
- `/api/me`
- `/api/profile`
- `/api/settings`
- `/api/tags`
- `/api/todos`
- `/api/stats`
- `/api/export`

### Persistence and restart verification
Executed successfully:
- app container rebuild/recreate with persistent DB volume retained
- full restart of both `lifeline-postgres` and `lifeline-app`
- repeat verification after restart

Persistence evidence observed:
- first verification run returned `todoCount: 1`
- second verification run after app recreate returned `todoCount: 2`
- third verification run after restarting both services returned `todoCount: 3`

This confirmed:
- PostgreSQL persistence survived app recreation
- PostgreSQL persistence survived DB+app restart
- wait-and-migrate startup sequencing remained stable after restart

## 9. Files / Artifacts Produced

Main produced artifacts:
- `Dockerfile`
- `.dockerignore`
- `compose.yaml`
- `compose.env.example`
- `backend/scripts/wait-for-postgres.js`
- `backend/scripts/start-container.js`
- `backend/scripts/verify-compose-runtime.js`
- `client/src/providers/AuthAdapterProvider.jsx`
- `client/src/utils/apiBase.js`

Main updated files:
- `backend/package.json`
- `backend/.env.example`
- `backend/src/index.js`
- `backend/src/infra/db/data-source-options.js`
- `client/package.json`
- `client/vite.config.js`
- `client/.env.example`
- `client/src/app/main.jsx`
- `client/src/hooks/useAuth.js`
- `client/src/hooks/useApi.js`
- `client/src/hooks/useApiAuth.js`
- `client/src/utils/api.js`
- `client/src/utils/apiClient.js`

## 10. Remaining Risks / Narrow Deferrals

Remaining narrow risks:
- the verified local Compose path uses `AUTH_DISABLED=1` and `VITE_AUTH_DISABLED=1`; a full live Auth0-backed container verification was not executed in this phase
- backend production image still carries some legacy runtime dependencies from `backend/package.json` such as `mssql` and `sqlite3`; these do not block Phase 4 but still add weight
- Compose verification was intentionally limited to local container readiness and correctness, not VPS rollout or reverse-proxy work

Narrow deferrals kept out of scope:
- host-level Nginx/TLS work
- final VPS deployment execution
- production Auth0 end-to-end rollout wiring
- broader dependency cleanup unrelated to containerization
- Phase 5 infrastructure and hardening work

## 11. Completion Status

Phase 4 completed successfully.

Delivered outcomes:
- proper Dockerization of the working app
- reproducible local Compose stack
- single app service `lifeline-app`
- single database service `lifeline-postgres`
- clean build/runtime env contract for the container path
- predictable PostgreSQL readiness and migration sequencing
- successful local Compose verification including restart/persistence checks
