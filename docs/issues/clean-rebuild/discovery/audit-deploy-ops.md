# Deploy/Ops Audit — Lifeline (old codebase)

## 1. Dockerfiles

### `C:\Users\ziyad\Lifeline\Dockerfile` (app image, 3 stages, all `node:20-alpine`)
| Stage | Purpose |
|---|---|
| `client-build` | `npm ci` + `npm run build` of `client/` (Vite). Build ARGs baked into bundle: `BUILD_VITE_API_BASE_URL` (default `/`), `BUILD_LOCAL_MODE` (default `1`, mapped to env `VITE_AUTH_DISABLED`), `BUILD_VITE_AUTH0_DOMAIN`, `BUILD_VITE_AUTH0_CLIENT_ID`, `BUILD_VITE_AUTH0_AUDIENCE`, `BUILD_VITE_AUTH0_SCOPE` (default `openid profile email offline_access`) |
| `backend-deps` | `npm ci --omit=dev` for `backend/` |
| `runtime` | `ENV NODE_ENV=production PORT=3000`. Copies: `backend/node_modules` (from deps stage), `backend/package*.json`, `backend/data-source-migrations.js`, `backend/swagger.json`, `backend/public`, `backend/scripts`, `backend/src`, and client build output to `/app/client/dist`. WORKDIR `/app/backend`. `EXPOSE 3000`. `CMD ["node", "scripts/start-container.js"]` |

Note: `backend/migrations/*.sql` (raw SQL) is **NOT copied** into the image — only TypeORM JS migrations under `backend/src/migrations/` ship (see §4/§7).

### `C:\Users\ziyad\Lifeline\services\lifeline-mcp\Dockerfile` (2 stages, `node:20-alpine`)
- `deps`: `npm ci --omit=dev`. `runtime`: `ENV NODE_ENV=production MCP_PORT=3030 MCP_BIND_HOST=0.0.0.0`; copies `node_modules`, `package*.json`, `scripts/`, `src/` (chown `node:node`); `USER node`; `EXPOSE 3030`; `CMD ["node", "src/index.js"]`.

### `.dockerignore` (root, C:\Users\ziyad\Lifeline\.dockerignore)
Excludes `.git .github .vscode .agent`, `**/node_modules **/coverage`, backend `.env*`, `backend/logs database db migration-artifacts test tests *.db`, `client/dist client/tests`, `db`, `*.log *.tmp *.md` (except README.md, PHASE4_PLAN.md, PHASE4_IMPLEMENTATION_REPORT.md).

## 2. Compose files

### `compose.yaml` (local) — 2 services
| Service | Image/Build | Container name | Ports | Volumes | Healthcheck |
|---|---|---|---|---|---|
| `lifeline-postgres` | `postgres:16-alpine` | `lifeline-postgres` | none published | `lifeline-postgres-data:/var/lib/postgresql/data` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`, 5s/5s/20 retries/start 5s |
| `lifeline-app` | build `.` w/ Dockerfile + BUILD_ args (local default `BUILD_LOCAL_MODE=1`) | `lifeline-app` | `${APP_PORT:-3020}:3000` (**all interfaces**) | none | `node -e fetch('http://127.0.0.1:3000/api/health/db')`, 10s/5s/12 retries/start 20s |

- `lifeline-app` env: `NODE_ENV=production`, `PORT=3000`, `PGHOST=lifeline-postgres`, `PGPORT=5432`, `PGUSER/PGPASSWORD/PGDATABASE` from POSTGRES_*, `PGSSL:-0`, `PGSSL_ALLOW_SELF_SIGNED:-1`, `DB_WAIT_TIMEOUT_MS:-60000`, `DB_WAIT_INTERVAL_MS:-2000`, `TYPEORM_LOGGING:-0`, `LOG_LEVEL:-info`, `AUTH_DISABLED:-1`, `AUTH_LOCAL_USER_ID:-guest-local`, `AUTH0_DOMAIN/AUDIENCE/AUDIENCE_ALT:-''`, `CORS_ORIGIN/FRONTEND_ORIGIN/APP_ORIGIN:-http://localhost:${APP_PORT:-3020}`.
- `depends_on: lifeline-postgres: condition: service_healthy`. Top-level `volumes: lifeline-postgres-data`. **No `networks:` section** (compose default network).

### `compose.production.yaml` — 3 services (deltas vs local + MCP)
| Service | Deltas from local |
|---|---|
| `lifeline-postgres` | + `mem_limit: 2g`, `memswap_limit: 2g`. Same image `postgres:16-alpine`, same volume + healthcheck |
| `lifeline-app` | + `mem_limit/memswap_limit: 2g`; + `dns: [1.1.1.1, 8.8.4.4]`; defaults flip to prod: `BUILD_LOCAL_MODE:-0`, `AUTH_DISABLED:-0`, origins default `https://lifeline.a2z-us.com`; + env `MCP_INTERNAL_SHARED_SECRET`, `MCP_API_KEY_PEPPER`; port binding **loopback-only** `127.0.0.1:${APP_PORT:-3020}:3000` |
| `lifeline-mcp` (prod-only) | build `./services/lifeline-mcp`; container `lifeline-mcp`; `mem_limit/memswap_limit: 512m`; `dns: [1.1.1.1, 8.8.4.4]`; `depends_on: lifeline-app: service_healthy`; ports `127.0.0.1:${MCP_PORT:-3030}:${MCP_PORT:-3030}`; healthcheck `fetch('http://127.0.0.1:${MCP_PORT:-3030}/health')` 10s/5s/12/start 15s |

- `lifeline-mcp` env: `NODE_ENV=production`, `MCP_PORT:-3030`, `MCP_BIND_HOST:-0.0.0.0`, `MCP_PUBLIC_BASE_URL:-https://mcp.lifeline.a2z-us.com`, `MCP_ALLOWED_HOSTS:-mcp.lifeline.a2z-us.com,127.0.0.1,localhost`, `LIFELINE_BACKEND_BASE_URL:-http://lifeline-app:3000`, `MCP_INTERNAL_SHARED_SECRET`, `MCP_REQUEST_TIMEOUT_MS:-5000`, `MCP_LOG_LEVEL:-info`, `AUTH0_DOMAIN/AUDIENCE/AUDIENCE_ALT/ISSUER`, `MCP_AUTH0_DOMAIN/AUDIENCE/AUDIENCE_ALT/ISSUER`, `MCP_AUTH0_SUPPORTED_SCOPES:-tasks:read,tasks:write`, `MCP_AUTH0_REGISTRATION_ENDPOINT`, `MCP_AUTH0_REVOCATION_ENDPOINT`, `MCP_AUTH0_RESOURCE_NAME:-Lifeline MCP`, `MCP_AUTH0_SERVICE_DOCUMENTATION_URL`.

### Postgres
- Version: **`postgres:16-alpine`** (both files).
- Extension: **`pg_trgm`** required by title-similarity feature. Applied via raw SQL `backend/migrations/008_enable_pg_trgm_similarity.sql` (`CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE INDEX IF NOT EXISTS idx_todos_title_trgm ON todos USING gist (title gist_trgm_ops);`). **This SQL is NOT in the container's TypeORM migration chain** (`backend/src/migrations/` has only `1764826105992-initial_migration.js`, `1772862400000-add-mcp-api-keys.js`, + `archived/`) and the `.sql` files aren't even copied into the image → 008 was applied out-of-band/manually on the VPS. The rebuild must own this as a real migration.

## 3. Deploy pipeline

### `.github/workflows/deploy-production.yml` (only workflow; no CI workflow exists)
- Name: `Deploy Lifeline Production`. Triggers: `push` to branch **`deploy`**, plus `workflow_dispatch`. Concurrency group `lifeline-production-deploy` (`cancel-in-progress: false`). `permissions: contents: read`. Job `deploy-to-vps` on `ubuntu-latest`, GitHub **environment `production`**.
- Secrets referenced: `VPS_SSH_HOST`, `VPS_SSH_PORT` (default 22), `VPS_SSH_USER` (default `root`), `VPS_SSH_KNOWN_HOSTS`, `VPS_SSH_PRIVATE_KEY` (written as `~/.ssh/id_ed25519`).
- Constants: `RELEASES_ROOT=/opt/lifeline/releases`, `SHARED_ENV_FILE=/opt/lifeline/shared/.env.production`.
- **Images reach the VPS as source, not registry images**: `git archive` tarball `lifeline-<UTCts>-<sha7>.tar.gz` → `scp` to `${RELEASES_ROOT}` → extracted to `${RELEASES_ROOT}/<release_id>` → images built **on the VPS** by `docker compose ... up -d --build`.
- Steps: validate secrets → derive release id → `git archive` → configure SSH → scp upload → "Reserve MCP loopback port" (over SSH: `ss -ltn` on `${MCP_PORT:-3030}`; kills non-`lifeline-mcp` Docker containers bound to `127.0.0.1:<port>`, kills stale host PIDs, stops supervising systemd unit; aborts if still occupied) → run `deploy/scripts/apply-release.sh <release_dir> <shared_env_file>` → install `deploy/nginx/mcp.lifeline.a2z-us.com.conf` into `/etc/nginx/conf.d/` (or sites-available+enabled), `nginx -t`, `systemctl reload nginx` → verify `curl https://mcp.lifeline.a2z-us.com/health` → on failure: dump `readlink -f /opt/lifeline/current`, `docker ps -a`, last-200 logs of `lifeline-app`/`lifeline-postgres`/`lifeline-mcp`.
- Note: nginx config for the main app domain (`deploy/nginx/lifeline.a2z-us.com.conf`) is **NOT synced by the workflow** — only the MCP one is; app nginx conf was evidently installed manually.

### `deploy/scripts/apply-release.sh` (C:\Users\ziyad\Lifeline\deploy\scripts\apply-release.sh)
- Constants: `ROOT_DIR=/opt/lifeline`, `RELEASES_DIR=/opt/lifeline/releases`, `CURRENT_LINK=/opt/lifeline/current`, `PROJECT_NAME=lifeline`, containers `lifeline-app`/`lifeline-mcp`/`lifeline-postgres`, `KEEP_RELEASES=5`.
- Sources shared env file (`set -a`), builds `docker compose -p lifeline --env-file <shared_env> -f <release>/compose.production.yaml`.
- Sequence: `trap rollback ERR` → `ln -sfn <release> /opt/lifeline/current` → `up -d --build --remove-orphans lifeline-postgres lifeline-app` → wait container healthy: db 180s, app 240s → `up -d --build --no-deps --force-recreate lifeline-mcp` → wait mcp healthy 180s → curl-wait (120s each): `http://127.0.0.1:${APP_PORT}/api/health/db`, `http://127.0.0.1:${APP_PORT}/api/health/ready`, `${APP_ORIGIN}/api/health/db`, `${APP_ORIGIN}/api/public/info`, `http://127.0.0.1:${MCP_PORT}/health` → `docker exec lifeline-mcp node -e fetch($LIFELINE_BACKEND_BASE_URL + "/internal/mcp/health", headers {"x-lifeline-internal-service-secret": $MCP_INTERNAL_SHARED_SECRET})` (120s) → asserts `docker port lifeline-app 3000` == exactly `127.0.0.1:${APP_PORT}` and `docker port lifeline-mcp ${MCP_PORT}` == `127.0.0.1:${MCP_PORT}` → prune releases beyond 5.
- `rollback()`: restores `current` symlink to previous release and `docker compose up -d --build --remove-orphans` from previous release's compose file; dumps logs.

### `deploy/nginx/`
| File | Key facts |
|---|---|
| `lifeline.a2z-us.com.conf` | port 80 only (TLS presumably terminated elsewhere/certbot-modified live copy); `client_max_body_size 25m`; `proxy_pass http://127.0.0.1:3020`; websocket upgrade headers; `proxy_read_timeout 60s` |
| `mcp.lifeline.a2z-us.com.conf` | 443 ssl w/ certbot Let's Encrypt paths (`/etc/letsencrypt/live/mcp.lifeline.a2z-us.com/`), 80→301 https; `client_max_body_size 5m`; `proxy_pass http://127.0.0.1:3030`; `proxy_buffering off; proxy_request_buffering off; proxy_read_timeout 300s` (SSE/streamable-HTTP) |

## 4. Health endpoints + start-container.js

### Backend (`backend/src/index.js`)
| Route | Line | Auth | Response |
|---|---|---|---|
| `GET /api/health/db` | 185 | public | 200 `{"db":"ok"}` / 500 `{"db":"error","message":...}`; lazily initializes AppDataSource, runs `SELECT 1 AS value` |
| `GET /api/health/ready` | 224 | public | 200/503 `{"ready":bool,"db":"ok"\|"error","auth":<getAuthReadiness() object>}`; DB check only if already initialized |
| `GET /api/health/db/schema` | 309 | public (labeled internal/debug) | `{todos,tags,todo_tags,users}` each an array of `{column_name,data_type}` from information_schema |
| `GET /api/public/info` | 412 | public | `{"name":"Lifeline API","version":<pkg.version>,"guestMode":"local-only","message":"Guest mode data never reaches the server; authenticate to sync.","time":<ISO>}` |
| `GET /internal/mcp/health` | `backend/src/internal/mcp/router.js:51` | header `x-lifeline-internal-service-secret` (const in `backend/src/internal/mcp/constants.js:1`) | `{"status":"ok","service":"internal-mcp","authenticatedService":<string\|null>}` |

### MCP service (`services/lifeline-mcp/src/app.js:118`)
`GET /health` → `{"status":"ok","service":<config.serviceName>,"publicBaseUrl":...,"transport":"streamable-http","auth":["api-key"]\|["api-key","auth0-oauth"],"oauth":{issuer,audiences,resourceMetadataUrl}\|null,"mode":"stateless"}`.

### `backend/scripts/start-container.js` (container entrypoint)
1. `dotenv.config()`; 2. `waitForPostgres()` (`backend/scripts/wait-for-postgres.js`: pg `Client` connect+`SELECT 1` loop, `DB_WAIT_TIMEOUT_MS` default 60000 / `DB_WAIT_INTERVAL_MS` default 2000, throws on timeout); 3. spawns `node typeorm/cli.js migration:run -d ./data-source-migrations.js` (child process; nonzero exit = fatal). `data-source-migrations.js` → `buildAppDataSourceOptions({includeMigrations:true})` → `migrations: [backend/src/migrations/*.js]`; 4. `require('../src/index')` (Express app), `app.listen(PORT||3000)`; 5. post-listen `warmUpAuth()` from `src/middleware/auth0` (JWKS pre-warm, non-fatal on failure); 6. SIGINT/SIGTERM → `server.close()` then `exit(0)`. Any error in main → log + `exit(1)`.

## 5. Env var inventory

### `compose.env.example` (local)
`APP_PORT=3020` · `POSTGRES_DB=lifeline` · `POSTGRES_USER=postgres` · `POSTGRES_PASSWORD=postgres` · `PGSSL=0` · `PGSSL_ALLOW_SELF_SIGNED=1` · `DB_WAIT_TIMEOUT_MS=60000` · `DB_WAIT_INTERVAL_MS=2000` · `TYPEORM_LOGGING=0` · `LOG_LEVEL=info` · `AUTH_DISABLED=1` · `AUTH_LOCAL_USER_ID=guest-local` · `VITE_AUTH_DISABLED=1` · `VITE_API_BASE_URL=/` · `AUTH0_DOMAIN=` · `AUTH0_AUDIENCE=` · `AUTH0_AUDIENCE_ALT=` · `VITE_AUTH0_DOMAIN=` · `VITE_AUTH0_CLIENT_ID=` · `VITE_AUTH0_AUDIENCE=` · `VITE_AUTH0_SCOPE="openid profile email offline_access"` · `CORS_ORIGIN=http://localhost:3020` · `FRONTEND_ORIGIN=http://localhost:3020` · `APP_ORIGIN=http://localhost:3020`

### `compose.production.env.example` (superset; prod values)
Everything above with prod values (`AUTH_DISABLED=0`, `VITE_AUTH_DISABLED=0`, `POSTGRES_USER=lifeline`, `POSTGRES_PASSWORD=change-me`, origins `https://lifeline.a2z-us.com`, `AUTH0_ISSUER=https://your-auth0-domain/`), plus MCP additions:
`MCP_PORT=3030` · `MCP_API_KEY_PEPPER=change-me` · `MCP_INTERNAL_SHARED_SECRET=change-me` · `MCP_LOG_LEVEL=info` · `MCP_REQUEST_TIMEOUT_MS=5000` · `MCP_AUTH0_DOMAIN=` · `MCP_AUTH0_AUDIENCE=` · `MCP_AUTH0_AUDIENCE_ALT=` · `MCP_AUTH0_ISSUER=` (blank = reuse shared AUTH0_*) · `MCP_AUTH0_SUPPORTED_SCOPES=tasks:read,tasks:write` · `MCP_AUTH0_REGISTRATION_ENDPOINT=` · `MCP_AUTH0_REVOCATION_ENDPOINT=` · `MCP_AUTH0_RESOURCE_NAME=Lifeline MCP` · `MCP_AUTH0_SERVICE_DOCUMENTATION_URL=` · `MCP_BIND_HOST=0.0.0.0` · `MCP_PUBLIC_BASE_URL=https://mcp.lifeline.a2z-us.com` · `MCP_ALLOWED_HOSTS=mcp.lifeline.a2z-us.com,127.0.0.1,localhost` · `LIFELINE_BACKEND_BASE_URL=http://lifeline-app:3000`

## 6. Must-preserve for the rebuild's deploy swap

| Item | Value |
|---|---|
| **User-data volume** | compose name `lifeline-postgres-data`; actual Docker volume on VPS is **`lifeline_lifeline-postgres-data`** (project `-p lifeline`). Contains all prod Postgres data. Keep compose project name `lifeline` + volume key `lifeline-postgres-data` (or migrate data explicitly). |
| Compose project name | `lifeline` (hardcoded in apply-release.sh) → default network `lifeline_default` (no explicit `networks:` anywhere) |
| Container names | `lifeline-postgres`, `lifeline-app`, `lifeline-mcp` (referenced by name in workflow diagnostics, apply-release.sh health/port checks, and MCP-port-reservation logic) |
| Host ports (loopback) | app `127.0.0.1:3020→3000`, mcp `127.0.0.1:3030→3030`; nginx proxies to exactly `127.0.0.1:3020` / `127.0.0.1:3030`; apply-release.sh **fails the deploy** if bindings aren't exactly loopback |
| In-container ports | app 3000 (`PORT`), mcp 3030 (`MCP_PORT`) |
| DNS hostname between containers | `lifeline-app` (used in `LIFELINE_BACKEND_BASE_URL=http://lifeline-app:3000` and `PGHOST=lifeline-postgres`) |
| VPS filesystem layout | `/opt/lifeline/releases/`, `/opt/lifeline/current` (symlink), `/opt/lifeline/shared/.env.production` |
| Health URLs the deploy gate curls | `/api/health/db`, `/api/health/ready`, `/api/public/info` (app); `/health` (mcp); `/internal/mcp/health` w/ header `x-lifeline-internal-service-secret` (app internal) — rebuild must expose these exact paths or update apply-release.sh + workflow together |
| Public origins | `https://lifeline.a2z-us.com`, `https://mcp.lifeline.a2z-us.com` (Auth0 callback config + certbot certs keyed to these) |
| Deploy branch | `deploy` (push triggers workflow); GitHub environment `production`; secrets `VPS_SSH_HOST/PORT/USER/KNOWN_HOSTS/PRIVATE_KEY` |
| Compose file name | `compose.production.yaml` at repo root (hardcoded path in apply-release.sh) |
| Postgres | `postgres:16-alpine`; DB `lifeline`, user `lifeline` (prod); **`pg_trgm` extension + `idx_todos_title_trgm` gist index exist in prod but were applied out-of-band** (raw SQL 008 not in the shipped TypeORM chain) — rebuild migrations must be idempotent against their pre-existence |
| TypeORM migrations table | migrations run via `typeorm migration:run` at container start; prod DB already has `migrations` history rows for `1764826105992-initial_migration` and `1772862400000-add-mcp-api-keys` — a new migration framework must not re-run destructive DDL against live data |

## 7. Ambiguities / dead code
- `backend/migrations/*.sql` (000–008) is a raw-SQL chain **disconnected** from the runtime TypeORM chain (`backend/src/migrations/*.js`), not copied into the image; 008 (pg_trgm) applied manually per docs (`docs/issues/mcp-server/step-09-everyday-task-fluency/implementation/release-preparation.md`). Effectively out-of-band ops scripts.
- `database/`, `db/`, `.config/`, `.venv/` root dirs and `tmp_deploy_run_*.log` files — not part of deploy; log files are debris from past workflow runs.
- `.github/workflows-governance/` are markdown docs, not runnable workflows; only real workflow is `deploy-production.yml`. There is **no CI/test workflow**.
- `deploy/nginx/lifeline.a2z-us.com.conf` is port-80-only in repo while MCP conf is certbot-managed 443 — the live app vhost on the VPS likely diverges from the repo copy (repo copy not synced by the workflow).
- `client-next/` exists at root but is absent from Dockerfile/compose — not deployed.
