# Phase 5 Discovery Report

## 1. Executive Summary

Phase 5 deployment discovery is complete.

The repository is materially ready for a simple VPS deployment of the existing containerized Lifeline stack: it already has a working `compose.yaml`, image build, Postgres health check, app health check, same-origin frontend serving, and automatic wait-plus-migrate startup behavior.

The main blockers are on the VPS side rather than the app side:
- Docker is not installed
- Docker Compose is not installed
- `lifeline.a2z-us.com` does not currently resolve in DNS
- TLS is configured only for `a2z-us.com` and `www.a2z-us.com`, not for `lifeline.a2z-us.com`
- the existing VPS already serves another app through host Nginx on ports `80` and `443`

Overall, the Phase 5 path currently looks medium-risk: the deployment shape is straightforward, but VPS preparation, subdomain DNS, and TLS for the new subdomain still need to be set up carefully.

## 2. Locked Inputs

Assumed as fixed inputs for this discovery:
- local Docker/Compose stack works
- app container name: `lifeline-app`
- Postgres container name: `lifeline-postgres`
- local browser/app port: `3020`
- verified local routes:
  - `/api/me`
  - `/api/profile`
  - `/api/settings`
  - `/api/tags`
  - `/api/todos`
  - `/api/stats`
  - `/api/export`
- intended Auth0/browser origins:
  - production: `https://lifeline.a2z-us.com`
  - local: `http://localhost:3020`
- downtime is acceptable
- discovery only; no deployment performed
- VPS SSH target inspected: `root@187.124.7.88`

## 3. Repository Deployment Readiness

### What is already ready

The repo already includes the core deployment artifacts for a simple container-based VPS rollout:
- [compose.yaml](compose.yaml)
- [Dockerfile](Dockerfile)
- [compose.env.example](compose.env.example)
- [backend/.env.example](backend/.env.example)
- [backend/scripts/start-container.js](backend/scripts/start-container.js)
- [backend/scripts/wait-for-postgres.js](backend/scripts/wait-for-postgres.js)
- [client/src/providers/AuthAdapterProvider.jsx](client/src/providers/AuthAdapterProvider.jsx)
- [backend/src/middleware/auth0.js](backend/src/middleware/auth0.js)
- [backend/src/index.js](backend/src/index.js)

Key readiness facts:
- the app image is already multi-stage and builds frontend + backend together
- the backend serves the built SPA directly, so the VPS only needs one app service plus one Postgres service
- the app container waits for Postgres and runs migrations automatically on startup
- the Postgres service has a health check via `pg_isready`
- the app service has a health check via `/api/health/db`
- the frontend API base supports same-origin deployment (`/api`)
- Auth0 redirect behavior in the frontend is origin-based (`window.location.origin`), which fits production subdomain deployment cleanly

### Production-sensitive defaults that must change on the VPS

The current repo is locally verified, but some defaults are intentionally local and must not be used as-is for production:
- [compose.env.example](compose.env.example) defaults to:
  - `AUTH_DISABLED=1`
  - `VITE_AUTH_DISABLED=1`
  - local browser origins on `http://localhost:3020`
- [compose.yaml](compose.yaml) currently publishes the app as `0.0.0.0:3020->3000`
  - that is acceptable locally, but on the VPS it should likely be loopback-only behind Nginx, not publicly exposed on all interfaces
- [backend/.env.example](backend/.env.example) still includes extra local dev origins (`localhost:5173`, `localhost:3000`) for convenience
  - production should narrow these to the real public origin
- [backend/src/middleware/auth0.js](backend/src/middleware/auth0.js) has fallback Auth0 defaults if env is missing
  - production must set explicit Auth0 env values so the backend does not silently fall back to dev defaults

### App-side assumptions that may not hold on the VPS

1. Host port publication
- local Compose assumes host publication on `3020`
- on VPS, the safer pattern is:
  - Nginx listens publicly on `80/443`
  - Lifeline app is reachable only internally, likely at `127.0.0.1:3020` or an internal Docker network

2. Frontend Auth0 config is build-time, not runtime
- Vite env values such as `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` are baked into the frontend during image build
- therefore, changing Auth0 frontend values on the VPS requires rebuilding the app image, not only changing runtime env

3. Local verification defaults are auth-disabled by default
- good for local testing, but a production env file must explicitly force:
  - `AUTH_DISABLED=0`
  - `VITE_AUTH_DISABLED=0`

4. Reverse proxy is not yet represented in repo deployment artifacts
- there is no VPS-specific Nginx config yet
- there is no production compose override yet for loopback-only host binding
- there is no production env file template yet specialized to the VPS deployment

### Secrets hygiene status

Good news:
- tracked env examples are examples only
- actual env files are not currently tracked in git
- root `.dockerignore` excludes `backend/.env`, `backend/.env.local`, `client/.env`, and `client/.env.local`
- git tracking check showed these are not committed:
  - `backend/.env`
  - `backend/.env.local`
  - `backend/.env.local.bak`
  - `client/.env`
  - `client/.env.local`

## 4. VPS Host Findings

VPS inspection was actually performed over SSH.

### Host basics
- hostname: `srv1425978`
- OS: Ubuntu 24.04.4 LTS
- kernel: `6.8.0-101-generic`
- root disk: `193G` total, about `189G` free
- memory: `15Gi` total, about `14Gi` available
- swap: none configured

### Container tooling
- Docker: not installed
- Docker Compose plugin: not installed
- `docker` systemd service: inactive / unavailable

This is the biggest immediate Phase 5 prerequisite gap.

### Reverse proxy and TLS tooling
- Nginx: installed and active
- Certbot: installed (`2.9.0`)

### Current public listeners seen
- `22/tcp` — SSH
- `80/tcp` — Nginx
- `443/tcp` — Nginx
- `3010/tcp` — existing Next.js app process

Not currently in use:
- `3000`
- `3020`
- `5432`

### Existing app / web state
Nginx currently serves:
- `a2z-us.com`
- `www.a2z-us.com`

Current Nginx site file proxies:
- `a2z-us.com` / `www.a2z-us.com` -> `http://localhost:3010`

Relevant facts:
- current site file: `/etc/nginx/sites-available/a2z-us.com`
- enabled symlink exists in `/etc/nginx/sites-enabled/a2z-us.com`
- current TLS certificate covers only:
  - `a2z-us.com`
  - `www.a2z-us.com`
- `lifeline.a2z-us.com` is not included in the current certificate

### Existing app directory layout
Observed app content on VPS:
- `/var/www/a2z-us.com` contains an existing Next.js-style site
- `/opt` is essentially unused and available for a new app directory
- `/srv` is essentially unused and available for a new app directory

### Firewall visibility
- `ufw` reports inactive

Implication:
- if Lifeline is published directly on `0.0.0.0:3020`, it will likely be publicly reachable unless Nginx/iptables/network policy is adjusted
- production should avoid exposing the app directly on all interfaces if Nginx is intended to terminate TLS

### Existing process supervision observations
The existing Next.js app is listening on `3010`, but the observed process tree suggests relatively simple shell-based launching rather than a clearly managed Docker or PM2 deployment:
- `next-server` process present on `3010`
- `pm2` not installed / not available in PATH during inspection

This does not block Lifeline, but it suggests the current VPS is not yet standardized around container orchestration.

## 5. Domain / Routing Readiness

### DNS readiness
Current DNS check for `lifeline.a2z-us.com` returned:
- NXDOMAIN

Therefore, production routing is not yet ready.

### Nginx routing readiness
Nginx is already installed and publicly serving the main domain, which is good.

However, there is currently no server block for:
- `lifeline.a2z-us.com`

A new Nginx site/server block will likely be required for Lifeline.

### TLS readiness
Certbot is installed, but the current certificate only covers:
- `a2z-us.com`
- `www.a2z-us.com`

For Lifeline production, TLS will require one of these approaches:
- issue a separate certificate for `lifeline.a2z-us.com`
- or reissue/expand certificates to include `lifeline.a2z-us.com`

### Recommended routing shape for Phase 5
The simplest likely routing design is:
- public traffic:
  - `https://lifeline.a2z-us.com`
- host reverse proxy:
  - Nginx on `80/443`
- Lifeline app behind Nginx:
  - app reachable only internally, preferably on `127.0.0.1:3020`
- Postgres remains internal-only in Docker

This keeps:
- public TLS termination in host Nginx
- browser/Auth0 origin cleanly on `https://lifeline.a2z-us.com`
- direct app-port exposure off the public internet

### Whether the app should stay on internal port `3020`
Yes, likely.

Given the current local validation and acceptable simplicity, the cleanest VPS path is probably:
- keep the app logically on `3020` on the host side
- but bind it to loopback only (`127.0.0.1:3020`) rather than `0.0.0.0:3020`
- let Nginx proxy to `http://127.0.0.1:3020`

That minimizes changes and matches the established local verification port while still fitting a conventional VPS reverse-proxy setup.

## 6. Secrets / Env Readiness

### Backend runtime env needed on the VPS
The backend/runtime side will need explicit production values for at least:
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
- `AUTH0_AUDIENCE_ALT` (only if actually needed)
- `CORS_ORIGIN=https://lifeline.a2z-us.com`
- `FRONTEND_ORIGIN=https://lifeline.a2z-us.com`
- `APP_ORIGIN=https://lifeline.a2z-us.com`

### Frontend build-time env needed on the VPS build path
The frontend build inside the Docker image will need explicit production values for:
- `VITE_AUTH_DISABLED=0`
- `VITE_API_BASE_URL=/`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_AUTH0_SCOPE`

Important:
- these frontend values are build-time inputs, not just runtime inputs
- Phase 5 implementation will need to ensure the production build happens with the production Auth0 values in place

### Postgres env needed on the VPS
The Compose stack also needs:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

### What should not be stored in git
Should remain VPS-only / secret-managed and not committed:
- production Postgres password
- any production compose env file with real secrets
- any runtime `.env` carrying production DB credentials
- any private operational credentials or SSH material

Can still live in env/examples or config templates safely if they are non-secret placeholders:
- Auth0 domain
- Auth0 audience
- Auth0 client ID
- public app origin

Even though Auth0 client IDs are not highly secret, it is still operationally cleaner to keep the real production values in the VPS env file used for image build/deploy.

## 7. Auth0 Production Readiness

### Current app behavior compatibility
The current frontend behavior appears compatible with production Auth0 usage because:
- Auth0 `redirect_uri` is `window.location.origin`
- logout return target also uses `window.location.origin`
- same-origin API path is `/api`

That means production should work cleanly if the browser is actually on:
- `https://lifeline.a2z-us.com`

### Auth0 settings that matter for production
At minimum, the Auth0 application should have production entries aligned with:
- Allowed Callback URLs:
  - `https://lifeline.a2z-us.com`
- Allowed Logout URLs:
  - `https://lifeline.a2z-us.com`
- Allowed Web Origins:
  - `https://lifeline.a2z-us.com`

If Auth0 expects trailing-slash variants or stricter formatting in the tenant UI, those should be confirmed during Phase 5 planning.

### Backend token-validation compatibility
The backend is compatible with production Auth0 flow if the VPS env explicitly sets:
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`

But there is one important risk:
- [backend/src/middleware/auth0.js](backend/src/middleware/auth0.js) contains fallback defaults to the current dev tenant/domain and audience if env is absent
- so production env must be explicit, not left blank

### Likely production-only risks
- production subdomain not yet in DNS
- production subdomain not yet covered by TLS cert
- Auth0 production app/client ID may still need explicit confirmation
- if wrong `VITE_AUTH0_*` values are used at build time, the frontend image will be built against incorrect Auth0 settings and will require rebuild
- if wrong `AUTH0_*` runtime values are used in the backend, token validation will fail even if frontend login succeeds

## 8. Deployment Strategy Readiness

Given that downtime is acceptable, the simplest likely deployment/cutover strategy is:

1. Prepare VPS host
- install Docker
- install Docker Compose plugin
- create deployment directory, likely under `/opt/lifeline`
- place compose file, Dockerfile context, and a production-only env file there

2. Prepare production env/build inputs
- set backend runtime env for Postgres + Auth0 + production origin
- set frontend build env for production Auth0 and same-origin API behavior
- ensure auth is enabled (`AUTH_DISABLED=0`, `VITE_AUTH_DISABLED=0`)

3. Bring up VPS stack
- build image on VPS or transfer a prepared image/artifact
- start Postgres + app stack
- let startup run DB wait + migrations automatically

4. Verify internally on VPS first
- confirm app answers locally on internal port (likely `127.0.0.1:3020`)
- confirm health and key API routes
- confirm login path readiness as far as possible

5. Configure reverse proxy and TLS
- add Nginx server block for `lifeline.a2z-us.com`
- obtain/attach certificate for that subdomain
- proxy HTTPS traffic to the Lifeline app

6. Data step
- if existing data from local/Postgres must move, use a simple database dump/restore approach into VPS Postgres
- rerun verification after restore

7. Final switch
- once VPS stack is verified, point real use to the new deployment via DNS / public route activation

### Readiness assessment of this strategy
This strategy is feasible with the current repo.

What is still missing is mostly operational setup, not application redesign.

## 9. Risks and Watchouts

Primary risks identified:
- Docker is not installed on the VPS
- Docker Compose is not installed on the VPS
- `lifeline.a2z-us.com` does not currently resolve in DNS
- current TLS certificate does not include `lifeline.a2z-us.com`
- Nginx `80/443` are already serving the main site, so new routing must be added carefully without breaking `a2z-us.com`
- current Compose file publishes the app on all interfaces; production should likely avoid that and bind loopback-only
- current example env defaults are auth-disabled for local verification and must not be reused directly in production
- frontend Auth0 config is build-time; wrong values require image rebuild
- backend Auth0 middleware has dev fallback defaults if env is omitted
- firewall is inactive, so accidentally exposing app/admin ports directly is easier than intended
- existing VPS app management appears lightweight/ad hoc rather than standardized container ops

Secondary watchouts:
- no swap configured (not a blocker, but worth noting)
- any DB restore/import plan should be explicit before Phase 5 execution
- if host Nginx remains the reverse proxy, Docker networking and host port bindings should be planned carefully

## 10. Recommended Inputs for Phase 5 Planning

Phase 5 planning should explicitly collect/lock these inputs:

1. VPS deployment directory
- recommended candidate: `/opt/lifeline`

2. Production host binding decision
- recommended: bind Lifeline app as `127.0.0.1:3020 -> container:3000`
- do not expose app publicly on `0.0.0.0:3020`

3. DNS decision
- create `A` record for `lifeline.a2z-us.com` pointing to `187.124.7.88`

4. TLS decision
- issue a certificate for `lifeline.a2z-us.com`
- decide whether it is separate from or combined with the apex cert

5. Final production env values
- Auth0 production domain
- Auth0 production audience
- Auth0 production client ID
- production Postgres credentials
- exact production origin values (`APP_ORIGIN`, `CORS_ORIGIN`, `FRONTEND_ORIGIN`)

6. Data move input
- whether a real database restore is required
- if yes, preferred mechanism (`pg_dump` / `pg_restore` is the simplest likely path)

7. Reverse-proxy shape
- confirm host Nginx remains the reverse proxy
- confirm Lifeline should be proxied from `lifeline.a2z-us.com` to `127.0.0.1:3020`

8. Operational policy
- who will own ongoing updates/rebuilds on the VPS
- whether Docker should be installed from Ubuntu packages or Docker CE packages

## 11. Appendix

### Repository files inspected
- [compose.yaml](compose.yaml)
- [Dockerfile](Dockerfile)
- [compose.env.example](compose.env.example)
- [backend/.env.example](backend/.env.example)
- [backend/package.json](backend/package.json)
- [backend/scripts/start-container.js](backend/scripts/start-container.js)
- [backend/scripts/wait-for-postgres.js](backend/scripts/wait-for-postgres.js)
- [backend/src/middleware/auth0.js](backend/src/middleware/auth0.js)
- [client/src/providers/AuthAdapterProvider.jsx](client/src/providers/AuthAdapterProvider.jsx)
- [client/src/utils/apiBase.js](client/src/utils/apiBase.js)
- [.dockerignore](.dockerignore)
- [.gitignore](.gitignore)
- [client/.gitignore](client/.gitignore)

### VPS facts gathered via SSH
- host: `srv1425978`
- OS: Ubuntu 24.04.4 LTS
- Docker absent
- Compose absent
- Nginx installed and active
- Certbot installed
- active public listeners: `80`, `443`, `22`
- existing app listener: `3010`
- no observed listener on `3020`, `3000`, or `5432`
- existing web root/app path: `/var/www/a2z-us.com`
- current TLS cert only covers apex + `www`

### DNS fact gathered locally
- `lifeline.a2z-us.com` currently returns NXDOMAIN

### Safe inspection commands used
- SSH inspection of OS/tooling/listeners/disk/memory/directories
- SSH inspection of Nginx site config and Certbot certificates
- local DNS lookup for `lifeline.a2z-us.com`
