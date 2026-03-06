# Phase 4 Plan

## 1. Objective

Phase 4 is the containerization and deployment-prep planning phase for Lifeline.

Its purpose is to define the exact implementation path for turning the current working PostgreSQL-backed application into:
- a properly Dockerized application
- a reproducible local Compose stack
- a cleanly defined app serving model
- a normalized environment contract for frontend, backend, Auth0, and PostgreSQL
- a predictable database readiness and migration sequencing model
- a deployment-ready container shape that can later be moved to a VPS with minimal architectural churn

Phase 4 is still planning-only. It does not execute Dockerization, Compose implementation, or VPS rollout.

In practical terms, Phase 4 planning must define how to reach this target shape:
- one Compose stack
- one app service: `lifeline-app`
- one database service: `lifeline-postgres`
- one clean local developer workflow for bringing the stack up and validating it
- one later deployment path toward host-level reverse-proxy + persistent database volume on a VPS

## 2. Locked Inputs

This plan is based on the following fixed inputs.

### Current application/runtime state
- Phase 1 is complete
- Phase 2 is complete
- Phase 2.5 is complete
- Phase 3 is complete
- post-Phase-3 cleanup is complete
- Phase 4 discovery is complete
- the supported backend runtime is PostgreSQL-only
- local PostgreSQL-backed app behavior works
- a full MSSQL → PostgreSQL rehearsal succeeded

### Locked Phase 4 discovery conclusion
Phase 4 is feasible and medium-risk.

The main reasons are:
- app packaging is still split between frontend and backend workflows
- the single-service serving model is not implemented yet
- frontend build-time env handling and backend runtime env handling are different in important ways
- startup ordering and migration sequencing are not containerized yet
- Azure/SWA-era configuration still exists and must be treated intentionally rather than implicitly reused

### Locked deployment target shape
Use this as the planning target:
- one Compose stack
- one app service: `lifeline-app`
- one database service: `lifeline-postgres`

The app service may contain both frontend and backend.

### Locked operational simplifications
This plan assumes:
- no zero-downtime requirement
- no dual-write requirement
- no complex cutover
- simple local and later VPS deployment is acceptable
- app correctness and deployment clarity matter more than continuity engineering

### Authoritative discovery/history inputs
- `docs/issues/db-migration-prep/phase-3/PHASE3_PLAN.md`
- `docs/issues/db-migration-prep/phase-3/PHASE3_IMPLEMENTATION_REPORT.md`
- `docs/issues/deployment-prep/phase-4/PHASE4_DISCOVERY_REPORT.md`
- `docs/issues/repo-hygiene/phase-35/PHASE35_CLEANUP_REPORT.md`

### Technical state discovered for planning
- backend runs as Node/Express without a compile/build stage
- frontend builds via Vite into a static SPA
- backend does not currently serve the built frontend bundle
- frontend currently expects `VITE_API_BASE_URL`
- frontend Auth0 browser configuration is Vite env driven
- backend PostgreSQL configuration is runtime env driven
- local Postgres container use was already proven during Phase 3
- no Dockerfiles, Compose files, or `.dockerignore` files exist yet

## 3. Recommended Phase 4 Strategy

The recommended strategy is to treat Phase 4 as a packaging-and-runtime-contract phase, not merely a Dockerfile-writing phase.

The recommended order is:
1. lock the single-service packaging and serving model
2. define the unified env contract for build-time and runtime values
3. define the container build surfaces and exclusions
4. define the Compose stack, DB readiness, and migration sequencing model
5. define local verification and readiness gates
6. define the minimum VPS-prep assumptions that Phase 4 must preserve

This strategy is recommended because the major risk in Phase 4 is not raw container syntax. The main risk is introducing a containerized shape that does not match how the app actually needs to run.

Phase 4 planning should therefore optimize for:
- one explicit app serving model
- one explicit environment contract
- one explicit migration/init policy
- one explicit healthcheck/readiness policy
- one explicit boundary between local-only artifacts and runtime images

## 4. Pre-Planning Database Directory Governance Result

A small focused governance pass was completed before planning.

### What was found
- the repo-level `database/` directory was acceptable, but needed stronger guardrails so it stays intentional
- the preserved successful Phase 3 rehearsal evidence was still justified
- the directory needed clearer governance language so it does not become a future dump folder

### What changed
- tightened `database/README.md` to clarify that `database/` is for intentional DB-local assets only
- tightened `database/phase3/README.md` with explicit retention rules
- added comments to `database/phase3/runs/.gitignore` so generated runs remain ignored by default unless intentionally preserved
- kept the successful rehearsal evidence under `database/phase3/runs/2026-03-06T11-29-47-387Z/`

### Commit status
A commit was made before planning:
- commit: `998ea353`
- message: `chore(repo): tighten database artifact structure before phase 4 planning`

## 5. Phase 4 Workstreams

### Workstream 1: Packaging and Serving Model Lock
- **Purpose**
  - Decide exactly how the single `lifeline-app` service will build, contain, and serve the frontend and backend together.

- **Main surfaces/files**
  - `backend/src/index.js`
  - `backend/package.json`
  - `client/package.json`
  - `client/vite.config.js`
  - frontend API/env usage surfaces such as:
    - `client/src/hooks/useApi.js`
    - `client/src/utils/api.js`
    - `client/src/app/main.jsx`

- **Deliverables**
  - one explicit `lifeline-app` serving model
  - decision on whether the Express backend serves `client/dist` directly or a small internal serving layer is used inside the same container
  - decision on how `/api` and non-API SPA routes will be handled
  - decision on how built frontend assets are produced and included in the final app image

- **Dependencies**
  - locked Phase 4 discovery findings

- **Exit criteria**
  - the final runtime model for `lifeline-app` is explicitly chosen
  - `/api` behavior and SPA route behavior are defined
  - no unresolved ambiguity remains about how frontend and backend coexist inside one app service

- **Risk level**
  - High
  - Reason: this is the central architectural decision for containerization and affects all later Docker and Compose work

### Workstream 2: Docker Build Surface and Image Scope Definition
- **Purpose**
  - Define exactly what files, dependencies, stages, and exclusions are required to build the app image cleanly and reproducibly.

- **Main surfaces/files**
  - `backend/package.json`
  - `backend/package-lock.json`
  - `backend/src/**`
  - `backend/public/swagger-ui/**`
  - `backend/scripts/**`
  - `client/package.json`
  - `client/src/**`
  - `client/public/**`
  - `client/index.html`
  - `client/vite.config.js`
  - future `.dockerignore` surfaces

- **Deliverables**
  - explicit build context definition
  - explicit runtime-image inclusion list
  - explicit exclusions list for local-only artifacts and bulky/unneeded content
  - decision on multi-stage build boundaries for frontend build and backend runtime image assembly

- **Dependencies**
  - Workstream 1

- **Exit criteria**
  - all required files for image build are identified
  - local-only assets are explicitly excluded from images
  - build-time vs runtime image contents are clearly separated

- **Risk level**
  - Medium
  - Reason: technically straightforward once the serving model is chosen, but image bloat and accidental artifact inclusion are real risks

### Workstream 3: Environment Contract Normalization
- **Purpose**
  - Define the canonical environment model across frontend build-time config, backend runtime config, Auth0 integration, CORS handling, and PostgreSQL connectivity.

- **Main surfaces/files**
  - `backend/.env.example`
  - `backend/src/infra/db/data-source-options.js`
  - `backend/src/middleware/auth0.js`
  - `backend/src/index.js`
  - `client/src/app/main.jsx`
  - `client/src/hooks/useApi.js`
  - `client/src/utils/api.js`
  - `client/src/utils/apiClient.js`

- **Deliverables**
  - canonical backend runtime env contract
  - canonical frontend build-time env contract
  - explicit Auth0 env contract split between browser app and backend API validation
  - explicit CORS/origin contract for Compose and later VPS deployment
  - clear rule for what is injected at image build vs container start

- **Dependencies**
  - Workstream 1

- **Exit criteria**
  - all required env vars are categorized and documented
  - no critical runtime ambiguity remains between Vite build-time env and backend runtime env
  - local Compose env management is defined cleanly

- **Risk level**
  - High
  - Reason: mismanaging build-time versus runtime env behavior is one of the most likely ways to break the containerized app

### Workstream 4: Compose Stack and PostgreSQL Service Plan
- **Purpose**
  - Define the exact Compose model for `lifeline-app` and `lifeline-postgres`, including ports, volumes, healthchecks, and dependencies.

- **Main surfaces/files**
  - PostgreSQL runtime assumptions in `backend/.env.example`
  - migration CLI wiring in `backend/package.json`
  - health endpoints in `backend/src/index.js`
  - Phase 3 Postgres migration files and scripts

- **Deliverables**
  - two-service Compose stack definition
  - service names and port exposure plan
  - Postgres persistence volume plan
  - service dependency and readiness ordering plan
  - DB healthcheck and app healthcheck policy

- **Dependencies**
  - Workstream 1
  - Workstream 3

- **Exit criteria**
  - `lifeline-app` and `lifeline-postgres` are fully defined conceptually
  - port, volume, healthcheck, and dependency decisions are explicit
  - Compose behavior is predictable on first boot and restart

- **Risk level**
  - Medium
  - Reason: Compose mechanics are manageable, but startup readiness and persistence choices need care

### Workstream 5: Migration and Initialization Sequencing Plan
- **Purpose**
  - Decide how PostgreSQL schema initialization and migrations will occur in the containerized workflow.

- **Main surfaces/files**
  - `backend/package.json`
  - `backend/data-source-migrations.js`
  - `backend/src/migrations/1764826105992-initial_migration.js`
  - `backend/scripts/init-db.js`
  - database connection and readiness assumptions

- **Deliverables**
  - chosen migration/init strategy for Compose
  - policy for whether migrations run:
    - on app startup,
    - through a one-shot command,
    - or via a dedicated entrypoint step
  - clear distinction between local Compose Postgres initialization and the Phase 3 ad hoc Docker validation path

- **Dependencies**
  - Workstream 3
  - Workstream 4

- **Exit criteria**
  - database initialization and migration sequencing are defined clearly
  - first-run startup order is predictable
  - later VPS deployment can reuse the same logic with minimal change

- **Risk level**
  - High
  - Reason: DB readiness and migration ordering are among the highest-risk operational edges in the future implementation

### Workstream 6: Azure-Era Config and Deployment-Artifact Treatment Plan
- **Purpose**
  - Explicitly define how older Azure/SWA-era deployment artifacts are treated during the Compose/containerization phase.

- **Main surfaces/files**
  - `client/staticwebapp.config.json`
  - `client/scripts/copy-swa-config.js`
  - `client/vite.config.js`
  - backend CORS env compatibility handling in `backend/src/index.js`

- **Deliverables**
  - explicit treatment policy for Azure-era config
  - classification of those files as:
    - historical/deployment-specific artifacts,
    - ignored for Compose,
    - or adapted only if still relevant
  - prevention of accidental containerization of stale Azure-only assumptions

- **Dependencies**
  - Workstream 1
  - Workstream 3

- **Exit criteria**
  - Azure-era config treatment is explicitly documented
  - Compose planning is not polluted by stale SWA or remote-proxy assumptions

- **Risk level**
  - Medium
  - Reason: not technically hard, but easy to mishandle if left implicit

### Workstream 7: Local Verification and VPS-Prep Readiness Plan
- **Purpose**
  - Define how later Phase 4 implementation success will be verified locally and what minimum VPS-prep assumptions the implementation must preserve.

- **Main surfaces/files**
  - current backend health endpoints
  - current Phase 3 verification expectations
  - current frontend/backend route behavior
  - repo-level documentation entrypoints

- **Deliverables**
  - local Compose verification checklist
  - readiness gates for successful Docker/Compose implementation
  - minimum later VPS-prep assumptions, including:
    - host-level Nginx reverse proxy expectation
    - one public app entrypoint
    - persistent database volume expectation
    - explicit list of artifacts that must never be baked into images

- **Dependencies**
  - Workstream 4
  - Workstream 5
  - Workstream 6

- **Exit criteria**
  - Phase 4 implementation success is measurable
  - VPS-prep implications are captured without expanding into deployment execution
  - local-only artifacts and runtime-image boundaries are clear

- **Risk level**
  - Medium
  - Reason: mostly planning and verification design, but crucial for avoiding unclear Phase 4 success criteria

## 6. Recommended Execution Order

The recommended execution order for later Phase 4 implementation is:

1. **Workstream 1: Packaging and Serving Model Lock**
2. **Workstream 3: Environment Contract Normalization**
3. **Workstream 2: Docker Build Surface and Image Scope Definition**
4. **Workstream 4: Compose Stack and PostgreSQL Service Plan**
5. **Workstream 5: Migration and Initialization Sequencing Plan**
6. **Workstream 6: Azure-Era Config and Deployment-Artifact Treatment Plan**
7. **Workstream 7: Local Verification and VPS-Prep Readiness Plan**

### Why this order is recommended
- Workstream 1 comes first because the rest of the containerization plan depends on how `lifeline-app` will actually serve the frontend and backend.
- Workstream 3 comes early because env normalization is tightly coupled to that serving model and affects both build-time and runtime behavior.
- Workstream 2 follows once packaging and env decisions are fixed enough to define Docker build surfaces cleanly.
- Workstream 4 then defines the Compose topology using the established packaging and env contract.
- Workstream 5 comes after the Compose topology because DB readiness and migration sequencing depend on how the services are expected to boot.
- Workstream 6 should happen before implementation starts so Azure-era artifacts do not accidentally shape the Compose path.
- Workstream 7 is last in planning order because it formalizes how later implementation success will be proven.

## 7. Packaging and Serving Model Recommendation

The recommended Phase 4 implementation target is:
- build the frontend with Vite in a build stage
- package the built frontend into the single `lifeline-app` service
- run the backend as the primary long-running process
- have the backend serve the built frontend assets and handle SPA fallback routing
- keep `/api` on the same origin under the backend process

### Why this is the recommended model
- it matches the locked direction of one app service plus one Postgres service
- it simplifies later VPS deployment behind one public reverse proxy entrypoint
- it reduces CORS complexity in the final deployed shape
- it avoids adding a second runtime service purely for static file serving
- it keeps the API and SPA under one origin, which fits the current route model best

### Not recommended as the primary Phase 4 target
- a separate frontend runtime container
- a Compose stack with extra reverse-proxy containers during this phase
- carrying Azure SWA routing behavior forward as the Compose runtime model

## 8. Env and Compose Contract Recommendation

### 8.1 Backend runtime env contract
The backend runtime contract should be standardized around:
- `PORT`
- either `DATABASE_URL` or the PG split vars:
  - `PGHOST`
  - `PGPORT`
  - `PGUSER`
  - `PGPASSWORD`
  - `PGDATABASE`
- `PGSSL`
- `PGSSL_ALLOW_SELF_SIGNED`
- Auth0 API validation env:
  - `AUTH0_DOMAIN`
  - `AUTH0_AUDIENCE`
  - optionally `AUTH0_AUDIENCE_ALT`
- controlled CORS/origin env for local Compose and later deployment

### 8.2 Frontend build-time env contract
The frontend build contract should be standardized around:
- `VITE_API_BASE_URL`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_AUTH0_SCOPE` if needed
- optional app version/build metadata env if intentionally used

### 8.3 Compose service env recommendation
For local Compose, the recommended conceptual env model is:
- `lifeline-postgres`
  - standard Postgres initialization env
- `lifeline-app`
  - backend runtime env at container start
  - frontend build env provided during image build

### 8.4 CORS/origin recommendation
Recommended final direction:
- treat same-origin `/api` as the target deployed behavior
- local Compose should also aim toward same-origin behavior where practical
- retain backend CORS configuration only as needed for dev flexibility, not as the core deployment model

### 8.5 Artifact/image exclusion recommendation
The following should remain outside app images:
- `database/phase3/runs/**`
- legacy local DB content under `db/`
- logs
- tests not needed in runtime image
- local scratch outputs and ad hoc evidence artifacts

## 9. Readiness Gates

Phase 4 should later be considered successfully implemented only when all of the following are true.

### Packaging and serving gates
- Dockerfiles exist and build successfully
- the selected `lifeline-app` serving model is implemented cleanly
- built frontend assets are served correctly by the app service
- `/api` routes work correctly under the chosen app-serving model
- SPA route fallback works correctly for browser navigation and refreshes

### Environment gates
- backend runtime env contract is clean and documented
- frontend build-time env contract is clean and documented
- Auth0 env handling works correctly in the containerized app
- Compose env management is reproducible and not dependent on ad hoc local setup

### Compose and database gates
- a Compose stack exists for `lifeline-app` and `lifeline-postgres`
- Postgres persistence works across restarts
- DB readiness and migration sequencing work predictably on first boot
- app startup waits for or correctly handles Postgres readiness
- app and DB healthchecks pass

### Verification gates
- the app boots cleanly through Compose
- frontend loads correctly through the single app entrypoint
- `/api/me`, `/api/profile`, `/api/settings`, `/api/tags`, `/api/todos`, `/api/stats`, and `/api/export` behave correctly in the containerized local stack
- local Compose verification passes repeatably

### VPS-prep gates
- the resulting stack maps cleanly to a later host-level Nginx reverse proxy
- one public app entrypoint is preserved
- persistent DB volume expectations are explicit
- local-only artifacts are not baked into runtime images

## 10. Risks and Safeguards

### Risk 1: serving-model ambiguity delays or destabilizes implementation
- **Safeguard**
  - Lock the single-service serving model first and treat it as the primary packaging decision.

### Risk 2: build-time and runtime env values get mixed incorrectly
- **Safeguard**
  - Explicitly separate frontend build-time env from backend runtime env in the plan and later implementation.

### Risk 3: Azure-era config bleeds into Compose behavior
- **Safeguard**
  - Treat Azure SWA and remote-backend settings as explicitly classified legacy/deployment-specific artifacts, not default Compose behavior.

### Risk 4: DB readiness and migration order create fragile startup behavior
- **Safeguard**
  - Define the migration/init strategy before implementation and require DB readiness/healthcheck policy as part of Compose design.

### Risk 5: runtime images accidentally include local artifacts or unnecessary weight
- **Safeguard**
  - Define strict image inclusion/exclusion boundaries and require `.dockerignore` planning as part of the implementation phase.

### Risk 6: Phase 4 expands into deployment execution too early
- **Safeguard**
  - Keep VPS work limited to prep inputs only and explicitly exclude rollout or cutover execution.

### Risk 7: documentation drift causes implementation confusion
- **Safeguard**
  - Use the Phase 4 plan as the authoritative implementation input and do not rely on older hosting-era docs without review.

## 11. Out of Scope

Phase 4 planning and later implementation will not include:
- final VPS deployment or cutover
- host-level Nginx implementation on the VPS
- production TLS issuance and certificate automation
- zero-downtime deployment strategy
- dual-write or continuity engineering
- broad application redesign
- non-container-related repo cleanup work
- Phase 5+ infrastructure, monitoring, autoscaling, or hardening work beyond what is minimally needed to shape later VPS deployment

## 12. Recommendation for the Phase 4 Implementation Prompt

The next implementation prompt should instruct the agent to execute the full Phase 4 implementation as one coordinated containerization phase.

That implementation prompt should explicitly require the agent to:
- use `PHASE4_PLAN.md` and `docs/issues/deployment-prep/phase-4/PHASE4_DISCOVERY_REPORT.md` as the authoritative planning inputs
- implement the recommended single-service `lifeline-app` serving model
- Dockerize the frontend build and backend runtime in a clean image strategy
- create the two-service Compose stack:
  - `lifeline-app`
  - `lifeline-postgres`
- implement the Compose env contract cleanly
- implement DB readiness and migration sequencing intentionally
- define and use appropriate healthchecks
- keep local-only database evidence and artifacts out of the container images
- keep Azure-era config from shaping the Compose runtime path unless explicitly retained for historical reasons
- validate the full local Compose stack thoroughly once implemented

The implementation prompt should also require the agent to:
- stay out of final VPS deployment execution
- avoid broad refactors unrelated to containerization
- produce a final implementation report summarizing what changed, what passed, what remains risky, and what is deferred
