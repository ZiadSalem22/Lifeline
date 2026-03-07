# Phase 5 Plan

## 1. Objective

Deploy Lifeline to the VPS at `187.124.7.88` using the simplest safe production shape that matches the current application architecture and the completed Phase 5 discovery findings.

The goal of Phase 5 is to move from a locally verified Docker/Compose deployment to a VPS-hosted production deployment with:
- host Nginx serving `https://lifeline.a2z-us.com`
- Lifeline app bound privately at `127.0.0.1:3020`
- Nginx proxying to `127.0.0.1:3020`
- Postgres kept internal to Docker only
- Auth0 enabled for the real public domain
- a practical smoke verification and restart verification pass
- simple recovery posture if deployment fails

This phase is deployment planning only. No implementation is performed in this plan.

## 2. Locked Inputs

The following are treated as fixed inputs for Phase 5 planning.

### App/runtime state
- local Docker/Compose stack works
- app service: `lifeline-app`
- database service: `lifeline-postgres`
- local app/browser port: `3020`
- same-origin app/API model works
- locally verified routes:
  - `/api/me`
  - `/api/profile`
  - `/api/settings`
  - `/api/tags`
  - `/api/todos`
  - `/api/stats`
  - `/api/export`

### Auth0/browser origins
- production: `https://lifeline.a2z-us.com`
- local: `http://localhost:3020`

### Deployment posture
- downtime is acceptable
- no zero-downtime requirement
- no dual-write requirement
- no continuity engineering requirement
- simple rollout is preferred

### Discovery findings that remain in force
- repo is broadly ready for simple Docker + Nginx VPS deployment
- current Compose path is suitable for production adaptation
- production env/defaults still need tightening
- frontend Auth0 values are build-time
- backend Auth0 values are runtime env
- production should not publish the app on all interfaces
- recommended production bind is `127.0.0.1:3020 -> container:3000`
- SSH access exists to `root@187.124.7.88`
- VPS is Ubuntu 24.04.x
- Nginx is installed and active
- Certbot is installed
- Docker is not installed
- Docker Compose is not installed
- `a2z-us.com` is already live on host Nginx
- existing app currently proxies to `localhost:3010`
- `lifeline.a2z-us.com` is currently NXDOMAIN
- current TLS cert does not include `lifeline.a2z-us.com`
- recommended deployment directory candidate: `/opt/lifeline`

## 3. Recommended Phase 5 Strategy

Use a host-Nginx + Docker Compose deployment model.

Recommended target shape:
- host Nginx remains the public entry point on `80/443`
- Lifeline app runs in Docker and is published only to loopback as `127.0.0.1:3020`
- Nginx proxies `lifeline.a2z-us.com` to `http://127.0.0.1:3020`
- Postgres runs in Docker without public host exposure
- a production-only env file is stored on the VPS under `/opt/lifeline`
- production frontend Auth0 values are provided during image build
- production backend Auth0 values are provided at container runtime
- TLS is issued only after DNS for `lifeline.a2z-us.com` resolves to the VPS

This is the recommended strategy because it:
- matches the verified same-origin runtime model
- avoids exposing the app directly to the internet
- leaves the existing `a2z-us.com` site intact behind the same host Nginx
- avoids unnecessary architecture changes
- fits the acceptable-downtime constraint
- keeps production operations simple

## 4. Phase 5 Workstreams

### Workstream 1
- name: VPS host preparation
- purpose: prepare the VPS to run Dockerized Lifeline safely without disturbing the existing live site
- main surfaces/files/systems:
  - VPS OS packages
  - Docker engine
  - Docker Compose plugin
  - `/opt/lifeline`
  - host filesystem permissions
  - host Nginx awareness of the new app
- deliverables:
  - Docker installed and working
  - Docker Compose plugin installed and working
  - deployment directory created under `/opt/lifeline`
  - production deployment layout decided and documented
  - no unintended changes to the existing `a2z-us.com` site
- dependencies:
  - SSH access to the VPS
  - root-level package installation ability
- exit criteria:
  - `docker` works on the VPS
  - Docker Compose works on the VPS
  - `/opt/lifeline` exists and is ready for deployment assets
  - existing Nginx site remains healthy
- risk level: medium

### Workstream 2
- name: Production env and secret preparation
- purpose: define and place the production configuration required for Postgres, backend runtime, and frontend build-time Auth0 values
- main surfaces/files/systems:
  - production env file under `/opt/lifeline`
  - backend runtime env values
  - frontend build args / env inputs
  - Postgres credentials
  - Auth0 production values
- deliverables:
  - one clear production env source for deployment
  - explicit backend Auth0 runtime values
  - explicit frontend Auth0 build-time values
  - explicit production origins for `APP_ORIGIN`, `FRONTEND_ORIGIN`, and `CORS_ORIGIN`
  - explicit Postgres credentials
- dependencies:
  - final production Auth0 values
  - final production origin and DNS target
  - deployment artifact strategy from Workstream 3
- exit criteria:
  - all required production variables are known
  - no production deployment depends on local defaults
  - auth is enabled in both frontend and backend configuration
- risk level: medium

### Workstream 3
- name: Production Compose and deployment artifact preparation
- purpose: adapt the local Compose path into a production-safe VPS deployment artifact set
- main surfaces/files/systems:
  - [compose.yaml](compose.yaml)
  - [Dockerfile](Dockerfile)
  - [compose.env.example](compose.env.example)
  - optional production compose override or production-specific compose file
  - deployment layout under `/opt/lifeline`
- deliverables:
  - production env file template or actual VPS-only env file
  - production-safe Compose binding strategy using `127.0.0.1:3020:3000`
  - clear command path to build and start the stack on VPS
  - documented deployment directory structure
- dependencies:
  - Workstream 2 env values
  - host preparation from Workstream 1
- exit criteria:
  - deployment artifacts no longer rely on local-only origins or auth-disabled defaults
  - app bind is loopback-only
  - Postgres has no public host port exposure
  - build and start commands are defined for VPS execution
- risk level: medium

### Workstream 4
- name: DNS, Nginx, and TLS setup
- purpose: make the real production domain route safely to Lifeline without disrupting the existing live `a2z-us.com` site
- main surfaces/files/systems:
  - DNS for `lifeline.a2z-us.com`
  - host Nginx site configuration
  - Nginx site enablement
  - Certbot certificate issuance
  - existing `a2z-us.com` Nginx configuration
- deliverables:
  - DNS A record for `lifeline.a2z-us.com`
  - separate Nginx server block for Lifeline
  - TLS certificate covering `lifeline.a2z-us.com`
  - validated proxy path to `127.0.0.1:3020`
- dependencies:
  - DNS control
  - app internal binding available from Workstream 3
  - host Nginx remaining healthy
- exit criteria:
  - `lifeline.a2z-us.com` resolves to the VPS
  - Nginx config test passes
  - HTTPS loads for `lifeline.a2z-us.com`
  - existing `a2z-us.com` remains unaffected
- risk level: high

### Workstream 5
- name: Container bring-up and production smoke verification
- purpose: build the production image, start the stack, and verify that the deployment works end-to-end at the infrastructure and route level
- main surfaces/files/systems:
  - Docker image build
  - Docker Compose up/down lifecycle
  - app health endpoint
  - core API routes
  - container health and logs
  - restart behavior
- deliverables:
  - running `lifeline-app` and `lifeline-postgres` containers
  - healthy app and database services
  - verified internal app reachability at `127.0.0.1:3020`
  - verified public HTTPS reachability through Nginx
  - verified restart persistence
- dependencies:
  - Workstreams 1 through 4
  - correct production env values
- exit criteria:
  - containers are healthy
  - frontend loads over HTTPS
  - internal and public route checks pass
  - restart and persistence checks pass
- risk level: medium

### Workstream 6
- name: Auth0 live-domain verification
- purpose: verify that the real public-domain login/logout flow works with the production Auth0 configuration
- main surfaces/files/systems:
  - Auth0 application settings
  - frontend build-time Auth0 values
  - backend runtime Auth0 validation values
  - public browser flow on `https://lifeline.a2z-us.com`
- deliverables:
  - verified production callback/logout/web-origin alignment
  - successful login on the live public domain
  - successful authenticated access to protected routes
- dependencies:
  - Workstream 5 public deployment working
  - correct DNS and TLS
  - final Auth0 production values
- exit criteria:
  - login succeeds on the public domain
  - logout returns cleanly to the public domain
  - protected API requests succeed with production tokens
- risk level: medium

### Workstream 7
- name: Data move and recovery posture
- purpose: define the simplest data migration path if data must be moved and define what to do if the rollout fails
- main surfaces/files/systems:
  - local/Postgres data source if needed
  - VPS Postgres container
  - dump/restore path
  - deployment rollback commands
  - Nginx enable/disable posture
- deliverables:
  - explicit decision whether data move is needed
  - simple dump/restore plan if needed
  - practical rollback checklist
- dependencies:
  - target VPS Postgres service available
  - deployment shape from Workstream 5
- exit criteria:
  - team knows whether data move is required
  - rollback path is documented and tested conceptually
- risk level: low

## 5. Recommended Execution Order

1. VPS host preparation
2. Production env and secret preparation
3. Production Compose and deployment artifact preparation
4. DNS creation for `lifeline.a2z-us.com`
5. Internal stack bring-up on the VPS
6. Nginx server block setup for `lifeline.a2z-us.com`
7. TLS issuance with Certbot after DNS resolves
8. Public HTTPS smoke verification
9. Auth0 live-domain verification
10. Optional data restore if needed
11. Restart/persistence verification
12. Closeout with rollback assets preserved

Rationale:
- Docker/Compose and env work must come before any meaningful deployment test
- DNS must exist before TLS can be issued cleanly
- the app should be confirmed internally before public Nginx exposure is finalized
- Auth0 should be verified only after HTTPS and real-domain routing are live

## 6. Production Binding / Routing Recommendation

Recommended production shape:
- Lifeline app: `127.0.0.1:3020 -> container:3000`
- Nginx public endpoint: `lifeline.a2z-us.com` on `80/443`
- Nginx upstream target: `http://127.0.0.1:3020`
- Postgres: Docker-internal only, no public host port

Recommended reasons:
- preserves the validated internal app port `3020`
- avoids public exposure of the Node app
- keeps TLS termination where the VPS is already configured today: host Nginx
- minimizes risk to the existing `a2z-us.com` site by using a separate server block instead of altering the existing upstream for the main domain

Routing recommendation details:
- do not reuse the existing `a2z-us.com` server block for Lifeline
- create a distinct Nginx site/server block for `lifeline.a2z-us.com`
- test the new Nginx config before reload
- only reload Nginx after syntax validation passes
- do not bind the app to `0.0.0.0:3020`
- do not expose Postgres on the host

## 7. Env / Secrets Recommendation

### Recommended VPS location
Store production deployment secrets in a VPS-only env file under `/opt/lifeline`, for example:
- `/opt/lifeline/.env.production`

This file should not be committed to git.

### Backend runtime values that must be explicit
The production runtime must define at least:
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
- `AUTH_DISABLED=0`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_AUDIENCE_ALT` if actually required
- `APP_ORIGIN=https://lifeline.a2z-us.com`
- `FRONTEND_ORIGIN=https://lifeline.a2z-us.com`
- `CORS_ORIGIN=https://lifeline.a2z-us.com`

Production rule:
- do not allow backend Auth0 middleware to fall back to dev defaults

### Frontend build-time values that must be explicit
The production image build must supply at least:
- `VITE_AUTH_DISABLED=0`
- `VITE_API_BASE_URL=/`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_AUTH0_SCOPE`

Critical rule:
- if any frontend Auth0 value changes, the app image must be rebuilt because these are build-time values

### Postgres values
The production deployment must explicitly define:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

### Recommended secret-handling posture
- keep real production values only on the VPS
- do not commit real secrets to the repo
- use env examples only as placeholders
- keep the single source of truth for deployment-time secrets in the VPS deployment directory

## 8. Verification and Auth0 Live-Domain Recommendation

### Infrastructure verification
After bring-up, verify:
- both containers are running
- both containers are healthy
- app logs show successful startup
- database logs show healthy readiness
- migrations complete successfully

### Internal app verification
Verify from the VPS host:
- `http://127.0.0.1:3020` responds
- app shell loads internally
- health route responds
- key API routes respond as expected

### Public routing verification
Verify publicly:
- `http://lifeline.a2z-us.com` redirects or resolves as intended for HTTPS setup
- `https://lifeline.a2z-us.com` loads successfully
- correct Nginx server block handles the request
- no regression occurs on `a2z-us.com`

### Functional application verification
Verify after public exposure:
- frontend loads fully
- SPA routing works
- same-origin API requests succeed
- verified routes behave correctly:
  - `/api/me`
  - `/api/profile`
  - `/api/settings`
  - `/api/tags`
  - `/api/todos`
  - `/api/stats`
  - `/api/export`

### Auth0 live-domain verification
Verify in the browser on `https://lifeline.a2z-us.com`:
- login redirects to Auth0 correctly
- callback returns to `https://lifeline.a2z-us.com`
- authenticated frontend session is established
- protected API calls succeed with real production tokens
- logout returns cleanly to `https://lifeline.a2z-us.com`

### Persistence and restart verification
Verify before Phase 5 closeout:
- application-created data persists across container restart
- `docker compose restart` does not break the app
- Nginx reload does not break the live site
- the stack comes back cleanly after a service restart

## 9. Rollback / Recovery Recommendation

Use a simple practical rollback posture.

Recommended rollback approach:
1. keep the existing `a2z-us.com` site unchanged throughout the Lifeline rollout
2. do not cut over Lifeline publicly until internal app verification passes
3. if Lifeline public rollout fails:
   - disable or remove the Lifeline Nginx site only
   - reload Nginx
   - stop the Lifeline containers if needed
   - preserve logs and the production env file for diagnosis
4. if container startup fails:
   - inspect app and database logs
   - fix env/config/build issues
   - rebuild and restart without touching the existing `a2z-us.com` site
5. if Auth0 public flow fails:
   - keep the site private or temporarily unavailable rather than exposing a broken login flow
   - correct Auth0 values and rebuild the image if frontend build-time values were wrong
6. if data restore fails:
   - recreate the target database cleanly
   - rerun the dump/restore path before reopening the site

Rollback principle:
- Lifeline should fail independently of the existing main site
- no rollback step should require altering the currently live `a2z-us.com` upstream

## 10. Readiness Gates

Phase 5 should not start implementation until these gates are satisfied:
- DNS control exists for creating `lifeline.a2z-us.com`
- final Auth0 production values are known
- decision is made on the production env file location under `/opt/lifeline`
- decision is made on the production Compose artifact shape
- Docker installation path on Ubuntu is chosen

Phase 5 should not expose the site publicly until these gates are satisfied:
- Docker and Compose are installed
- app binds only to `127.0.0.1:3020`
- Nginx config test passes
- TLS can be issued successfully for `lifeline.a2z-us.com`
- internal app verification passes

Phase 5 should not be considered complete until these gates are satisfied:
- frontend loads over `https://lifeline.a2z-us.com`
- protected routes work with Auth0 on the real domain
- persistence works across restart
- the existing `a2z-us.com` site remains unaffected
- rollback instructions are retained with the deployment assets

## 11. Risks and Safeguards

### Risk: Docker and Compose are missing on the VPS
Safeguard:
- install and verify container tooling before any deployment attempt

### Risk: DNS for `lifeline.a2z-us.com` does not exist yet
Safeguard:
- create DNS before TLS issuance and public verification

### Risk: TLS issuance could interfere with the existing live host setup
Safeguard:
- use a separate Nginx server block for the subdomain
- test config before reload
- issue the cert only for the new subdomain path

### Risk: app could be unintentionally exposed publicly on `3020`
Safeguard:
- bind explicitly to `127.0.0.1:3020`
- do not publish the app on all interfaces
- keep Postgres unexposed

### Risk: wrong Auth0 frontend values require rebuild
Safeguard:
- finalize Auth0 values before production image build
- treat frontend Auth0 changes as rebuild-required

### Risk: backend Auth0 runtime fallback defaults could mask configuration mistakes
Safeguard:
- require explicit production `AUTH0_*` runtime values
- do not rely on fallback defaults in production

### Risk: existing `a2z-us.com` site could be impacted
Safeguard:
- do not modify its upstream target
- use a separate subdomain server block
- verify the existing site after any Nginx change

### Risk: unclear data move requirements cause last-minute confusion
Safeguard:
- explicitly decide before rollout whether data restoration is needed
- if yes, use the simplest supported dump/restore path

## 12. Out of Scope

The following are out of scope for Phase 5 planning and implementation:
- zero-downtime cutover
- blue/green deployment
- canary deployment
- multi-node orchestration
- Kubernetes
- managed database migration to a cloud provider
- HA failover design
- advanced secret vault integration
- observability redesign beyond basic deployment logging and smoke checks
- large-scale continuity engineering

## 13. Recommendation for the Phase 5 Implementation Prompt

The Phase 5 implementation prompt should instruct the implementation pass to execute the whole deployment phase in one practical sequence, including:
- install Docker and Docker Compose on the VPS
- prepare `/opt/lifeline` as the deployment directory
- create the production env file on the VPS
- adapt Compose for production-safe loopback binding
- ensure the app is published as `127.0.0.1:3020 -> container:3000`
- keep Postgres internal only
- build and start the stack on the VPS
- create DNS-aware Nginx config for `lifeline.a2z-us.com`
- issue TLS for `lifeline.a2z-us.com` with Certbot
- verify internal health, public HTTPS, key routes, Auth0 live-domain login, persistence, and restart behavior
- perform a simple data restore only if data movement is actually required
- preserve a simple rollback path that disables only the Lifeline subdomain deployment without disturbing `a2z-us.com`

The implementation prompt should also require the execution pass to:
- avoid changing the existing main-site upstream unless strictly necessary
- validate Nginx before reload
- rebuild the image if frontend Auth0 build-time values change
- produce a Phase 5 implementation report documenting host prep, final deployment shape, verification results, and rollback notes
