# Deploy swap & production DB adoption runbook

How the `codebase/` monorepo replaces the old `backend/` + `client/` + `services/lifeline-mcp/`
on the VPS **without data loss**. Nothing here is destructive until the explicit "Execute" section,
which requires owner sign-off (it deploys against live user data).

## What changes

| Old | New |
| --- | --- |
| 3 containers: postgres + lifeline-app (backend+client) + lifeline-mcp | 2 containers: postgres + lifeline-app (API + web SPA + embedded MCP) |
| `Dockerfile` COPY backend/ + client/ | `codebase/Dockerfile` (multi-stage: build shared→server→web, run migrate then serve) |
| `compose.production.yaml` (root) | `codebase/compose.production.yaml` |
| MCP at its own container/port 3030 | MCP embedded at the app's `POST /mcp` |
| TypeORM migrations at boot | Drizzle idempotent baseline migration at boot |

**Preserved exactly** (so data and integrations survive): the `lifeline-postgres` container name,
credentials, and `lifeline-postgres-data` volume; Auth0 tenant + all `AUTH0_*` env; the
`MCP_API_KEY_PEPPER` (existing `lk_…` API keys keep verifying — same HMAC scheme); the nginx TLS
vhosts and the deploy-branch CD workflow shape.

**Retired env vars** (embedded MCP removes the hop): `MCP_INTERNAL_SHARED_SECRET`,
`LIFELINE_BACKEND_BASE_URL`, `MCP_BIND_HOST`, `MCP_PORT`. New required var: `DATABASE_URL`
(the compose builds it from the existing `POSTGRES_*`; override in the shared env file if the DB is
external).

## Why adoption is safe (no data loss)

The new baseline migration (`apps/server/src/infrastructure/db/migrations/0000_baseline.sql`) is
100% `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` and adds only the `pg_trgm` extension + the trigram
index if absent. Run against the live schema it **no-ops on every existing object** and records a
single Drizzle ledger row in `drizzle.__drizzle_migrations`. The old TypeORM `migrations` table is
left untouched (inert). Verified locally against a `postgres:16` instance holding the introspected
production shape: all 7 tables, constraints, indexes, and the 10 seeded default tags match, and a
second run is a clean no-op.

Rollback: the previous images remain deployable; the baseline changes nothing destructive, so a
revert to the old `deploy` commit restores the old stack against the same data.

## Pre-flight (safe, do first)

1. **Back up the database** (always, before any deploy):
   `docker exec lifeline-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > lifeline-$(date +%F).sql`
2. Confirm CI green on the rebuild branch (`.github/workflows/ci-codebase.yml`: lint, format,
   typecheck, test, build).
3. Confirm the shared prod env file has: `DATABASE_URL` (or `POSTGRES_*`), `AUTH0_DOMAIN`,
   `AUTH0_AUDIENCE`, non-empty `MCP_API_KEY_PEPPER`, `CORS_ORIGIN`, the `VITE_AUTH0_*` build args,
   and `AUTH_DISABLED=0`.
4. Point the nginx MCP vhost (`mcp.lifeline.a2z-us.com`) at the app instead of `:3030` — it now
   proxies `POST /mcp` on the app's port. (The main vhost is unchanged; the app serves the SPA.)

## Execute (owner sign-off required — deploys against live data)

1. Promote the new build files to the repo root (replacing the old ones):
   `Dockerfile`, `compose.production.yaml`, `.dockerignore` ← from `codebase/`, and repoint the
   deploy workflow's build context / compose path at `codebase/` (or move `codebase/*` to root).
2. Merge the rebuild branch to `main`, then fast-forward `deploy` → the CD workflow builds the new
   image, runs the baseline migration (adopts the live DB), and health-gates on `/health/ready`.
3. Smoke-check in prod: `/health/ready` 200; log in via Auth0; create/complete a task; an existing
   `lk_…` key still authenticates against `POST /mcp` (tools/list returns 28 tools).
4. Only after green: delete `backend/`, `client/`, `client-next/`, `services/`, `db/`, stale
   `database/` artifacts, and `tmp_*deploy*.log`; rewrite the top-level docs and `.github/`
   instruction path refs (they still point at `backend/src/...`).

## Post-swap cleanup (optional, non-urgent)

- Drop the inert TypeORM `migrations` table once confident.
- Remove the old images from the VPS registry cache.
