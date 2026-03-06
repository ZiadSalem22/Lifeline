# Phase 4 Discovery Report

## 1. Executive Summary

Phase 4 discovery indicates that Dockerization and a local Compose stack are feasible, but not low-risk.

The current application works locally on PostgreSQL after Phase 3, but the repository is still shaped around separate frontend and backend development workflows rather than a unified containerized app service. The backend is already reasonably close to container readiness because it is runtime-configured through environment variables and has an explicit PostgreSQL migration path. The main Phase 4 discovery pressure is on packaging and deployment shape: the frontend is a Vite-built SPA that currently expects a separate API base URL and existing Azure-oriented assumptions, while the backend does not currently serve the built frontend.

The current best risk assessment for Phase 4 is **medium-risk**.

The main reasons it is not low-risk are:
- no existing Dockerfiles or Compose files are present
- the app is not yet packaged as a single deployable service
- the frontend still carries Azure Static Web Apps and remote-backend assumptions
- runtime environment handling will need to be normalized for containers
- startup/migration ordering will need an intentional Compose strategy

## 2. Current App Packaging State

### 2.1 Backend packaging state
Relevant files:
- `backend/package.json`
- `backend/src/index.js`
- `backend/src/infra/db/data-source-options.js`
- `backend/src/middleware/auth0.js`

Current state:
- backend runs as a Node/Express app via `node src/index.js`
- backend dev uses `nodemon src/index.js`
- there is no backend build/compile step; runtime is source-based Node execution
- backend is configured entirely from environment variables
- backend exposes HTTP on `PORT` with default `3000`
- backend already has a DB health endpoint at `/api/health/db`
- backend does not serve a built frontend bundle today
- the only static asset serving observed is Swagger UI under `/swagger-ui`

Implication for Phase 4:
- the backend can be containerized directly with a Node runtime image
- but a single `lifeline-app` service will still need an explicit strategy for delivering the frontend build alongside the backend process

### 2.2 Frontend packaging state
Relevant files:
- `client/package.json`
- `client/vite.config.js`
- `client/src/app/main.jsx`
- `client/src/hooks/useApi.js`
- `client/src/utils/api.js`
- `client/staticwebapp.config.json`

Current state:
- frontend runs separately via Vite dev server on port `5173`
- frontend builds to `client/dist` with `vite build`
- postbuild copies `staticwebapp.config.json` into `dist`
- frontend requires `VITE_API_BASE_URL`
- frontend also requires Auth0 browser env vars such as:
  - `VITE_AUTH0_DOMAIN`
  - `VITE_AUTH0_CLIENT_ID`
  - `VITE_AUTH0_AUDIENCE`
  - optionally `VITE_AUTH0_SCOPE`
- `client/vite.config.js` still contains a dev proxy target pointed at a remote Azure backend URL
- routing is browser-history SPA routing with `basename="/"`

Implication for Phase 4:
- frontend containerization is straightforward as a build artifact, but the runtime delivery model is not yet unified with the backend
- if the future deployment shape remains one `lifeline-app` service, Phase 4 planning must choose how that service will serve the built SPA
- existing Azure SWA assumptions should not be blindly carried into Docker/Compose

### 2.3 Single app service implication
Locked direction says the app service may contain both frontend and backend.

Discovery finding:
- that direction remains feasible
- but it is not implemented today
- current repo state is closer to “separate frontend build + separate backend server” than to “single packaged service”

Phase 4 planning will need a packaging decision such as:
- Node backend serves the built frontend statically, or
- a small internal reverse-proxy/static-serving layer is added inside the single app container

## 3. PostgreSQL Containerization Readiness

### 3.1 What is already ready
Relevant files:
- `backend/src/infra/db/data-source-options.js`
- `backend/.env.example`
- `backend/data-source-migrations.js`
- `backend/scripts/init-db.js`
- `backend/src/migrations/1764826105992-initial_migration.js`

Current readiness strengths:
- backend is already PostgreSQL-only in the supported path
- connection settings support either:
  - `DATABASE_URL`, or
  - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- SSL behavior is already env-configurable
- migrations are explicit and runnable
- local Dockerized PostgreSQL has already been proven during Phase 3

### 3.2 Containerization mapping
For a Dockerized PostgreSQL service, the current app assumptions map cleanly to:
- `PGHOST=lifeline-postgres`
- `PGPORT=5432`
- `PGUSER=<compose user>`
- `PGPASSWORD=<compose password>`
- `PGDATABASE=<compose db>`

### 3.3 Persistence expectations
The Postgres service will require:
- a persistent named volume for database data
- likely container-side init via standard Postgres env vars rather than the current local-only `db:init:postgres` helper

Discovery implication:
- the current `db:init:postgres` script is useful for local non-container setups but likely not the primary initialization path inside Compose
- migrations should remain part of the app startup/deployment flow

## 4. Dockerization Surface

### 4.1 Backend files needed for Docker build
Main backend surface likely required in a Docker build context:
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/**`
- `backend/public/swagger-ui/**`
- `backend/data-source-migrations.js`
- `backend/scripts/**` only where needed for migration/runtime support
- `backend/.env.example` as reference only, not baked secrets

Potential exclusions or caution areas:
- `backend/node_modules/`
- local logs
- local SQLite leftovers such as `todos_v4.db`
- Phase 3 rehearsal artifacts under `database/`
- test-only or ad hoc scripts not needed in runtime image

### 4.2 Frontend files needed for Docker build
Likely required:
- `client/package.json`
- `client/package-lock.json` if/when present
- `client/src/**`
- `client/public/**`
- `client/index.html`
- `client/vite.config.js`

Caution areas:
- `staticwebapp.config.json` is Azure SWA-specific and may not belong in the future containerized runtime path
- Vite dev proxy configuration is development-only and should not drive container runtime design

### 4.3 Existing deployment-related assumptions that matter
Observed assumptions:
- frontend expects absolute API base env via `VITE_API_BASE_URL`
- frontend Auth0 config is build/runtime env driven
- backend CORS currently assumes explicit frontend origins and multiple Azure-era env aliases
- backend startup currently does not include a built-frontend serving path

### 4.4 OS/package/runtime considerations
Important runtime observations:
- backend uses Node runtime with no transpilation build step
- frontend is static after build
- backend still includes some dependencies not central to the supported PostgreSQL runtime, including legacy-era packages such as `sqlite3`; this is not a Phase 4 blocker but can bloat images if left unreviewed
- no Docker-specific ignore or build optimization files were found during discovery

## 5. Compose Stack Readiness

### 5.1 Expected services
The intended Compose shape is consistent with discovery:
- `lifeline-app`
- `lifeline-postgres`

### 5.2 Ports likely needed
Probable local Compose exposure:
- app service external port for web/API access
- postgres external port only if direct local DB access is desired for debugging; not strictly required for app-only operation

### 5.3 Env handling needs
The future Compose stack will need clear env separation for:
- backend runtime env
- frontend build-time env
- Auth0 browser config
- Auth0 API validation config
- PostgreSQL credentials
- CORS origins

Discovery caution:
- because the frontend is a Vite app, several values are baked at build time rather than dynamically read at runtime
- Phase 4 planning must be explicit about which values are injected during image build versus container start

### 5.4 Volume needs
Expected Compose volume needs:
- persistent Postgres data volume
- likely no durable app volume required for the main service
- local DB evidence under `database/` should remain outside container runtime images

### 5.5 Dependency/order expectations
Compose will likely need:
- postgres healthcheck using `pg_isready`
- app dependency on healthy postgres service
- explicit migration step before or during app startup

Discovery finding:
- there is no current container-ready startup contract that guarantees “wait for DB, run migrations, then start app”
- this must be planned intentionally for Phase 4

### 5.6 Healthcheck readiness
Useful existing app-side healthcheck:
- `/api/health/db`

Useful future DB-side healthcheck:
- standard Postgres `pg_isready`

## 6. Deployment-Prep Findings

### 6.1 VPS-facing architecture clues
Current repo state suggests the later VPS path will likely need:
- a host-level reverse proxy such as Nginx for TLS termination and public routing
- one public entrypoint to the `lifeline-app` container
- one persistent named volume or mounted storage location for Postgres data

### 6.2 Subdomain / routing expectations
Likely future routing expectations:
- web traffic routed to the app service container
- API traffic either:
  - handled by the same service under `/api`, or
  - reverse-proxied internally if a different serving model is chosen

Given current code, the cleanest later VPS direction still appears to be one public app origin with `/api` on the same origin.

### 6.3 Local artifacts that should not enter containers
These should remain outside runtime images:
- `database/phase3/runs/**`
- legacy local DB artifacts under `db/`
- local logs
- test artifacts
- ad hoc migration evidence files

### 6.4 Existing cloud-era config that may need container-era reconsideration
Discovery found Azure-oriented leftovers that matter for Phase 4 planning:
- `client/staticwebapp.config.json`
- Vite dev proxy target pointing to Azure backend
- backend CORS env aliases shaped for older hosted environments

These are not blockers, but they are important planning inputs because they can create confusion if carried into Compose unchanged.

## 7. Risks and Watchouts

### 7.1 Unified app packaging risk
The repo does not currently implement a single deployable app service containing both frontend delivery and backend API serving.

Risk:
- containerization work could drift into architecture decisions unless the serving model is chosen early

### 7.2 Frontend/backend env coupling risk
The frontend requires build-time Vite env configuration, while the backend reads runtime env configuration.

Risk:
- misaligned env injection between image build and container runtime

### 7.3 Azure-era config bleed-through risk
The repo still includes Azure SWA and Azure-backend assumptions.

Risk:
- local Compose behavior may accidentally inherit stale remote-host assumptions

### 7.4 DB startup ordering risk
There is not yet a container-native startup contract for “database ready + migrations applied + app started.”

Risk:
- brittle first-run behavior in Compose if migration/init order is not planned up front

### 7.5 Static asset serving gap
Backend currently does not serve `client/dist`.

Risk:
- Phase 4 could produce a containerized backend and a containerized frontend build artifact without a final runtime delivery path

### 7.6 Documentation drift risk
Some root and project docs still describe older SQLite or split-hosting assumptions.

Risk:
- future Dockerization work may be slowed by outdated docs unless Phase 4 planning explicitly identifies the authoritative runtime/deployment docs

## 8. Recommended Inputs for Phase 4 Planning

Phase 4 planning should enter with explicit decisions on:

1. **Single app service serving model**
   - how `lifeline-app` will serve the built frontend and backend together

2. **Migration/init strategy**
   - whether the app container runs migrations on startup, via a one-shot command, or through a dedicated entrypoint step

3. **Compose env contract**
   - exact env vars for backend runtime, frontend build, Auth0, CORS, and Postgres

4. **Port and routing contract**
   - which public port the app container exposes and how `/api` will be handled

5. **Azure-config treatment**
   - whether Azure SWA config and similar cloud-era files remain as historical deployment artifacts or become explicitly out-of-scope for Compose

6. **Image scope and exclusions**
   - what local-only directories and artifacts must be excluded from Docker build context

7. **Healthcheck and readiness policy**
   - exact healthchecks and startup ordering guarantees for `lifeline-app` and `lifeline-postgres`

## 9. Appendix

### 9.1 Most relevant files inspected
- `backend/package.json`
- `backend/.env.example`
- `backend/src/index.js`
- `backend/src/infra/db/data-source-options.js`
- `backend/src/middleware/auth0.js`
- `backend/data-source-migrations.js`
- `client/package.json`
- `client/vite.config.js`
- `client/staticwebapp.config.json`
- `client/src/app/main.jsx`
- `client/src/hooks/useApi.js`
- `client/src/utils/api.js`
- `client/src/utils/apiClient.js`
- `database/README.md`
- `database/phase3/README.md`

### 9.2 Discovery conclusion
Phase 4 discovery supports moving forward, but not as a purely mechanical containerization task. The repo is ready enough to containerize, yet the next planning phase should treat packaging, env normalization, and startup sequencing as first-class decisions. The current best overall assessment is **medium-risk**.
