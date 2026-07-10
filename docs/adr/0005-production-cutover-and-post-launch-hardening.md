# ADR 0005: Production cutover to the single-container monorepo and post-launch hardening

## Status

Accepted

## Date

2026-07-09

## Context

The clean-room TypeScript rebuild — an npm-workspaces monorepo (`packages/shared`,
`apps/server`, `apps/web`: Express 5 + Drizzle + an embedded MCP module, and a
React 19 SPA) — was complete, tested (500+ tests), and reviewed, but still lived
under a `codebase/` subdirectory while the pre-rebuild stack (a TypeORM
`backend/`, a separate Vite `client/`, and a standalone `services/lifeline-mcp/`)
continued to serve production.

The week of 2026-07-08 cut the rebuild over to production against **real user
data** (8 users, 626 todos, 23 tags, 16 MCP API keys) and then stabilized the
live app. Several decisions were made under production pressure — most notably a
login outage whose root cause was architectural, not incidental. This ADR
records those decisions as one milestone so the "why" survives.

The single hard invariant throughout was **no data loss**: the new server binds
the *existing* production PostgreSQL (same named volume, container, credentials)
and adopts its schema via an idempotent baseline migration.

## Decision

### 1. Cut over to a single-container, embedded-MCP deployment

Promote `codebase/*` to the repository root and run the whole product as **one
container**: `apps/server` serves the JSON API (`/api/v1`), the embedded MCP
module (`POST /mcp` + `/.well-known/*`), *and* the built web SPA (static assets
with client-route fallback, gated so `/api`, `/mcp`, and `/health` still return
JSON) from `WEB_DIST_DIR`. This retires the previous three-process topology (API
+ separate SPA host + standalone MCP on `:3030`).

Deployment: push the `deploy` branch → GitHub Actions `git archive` → scp to the
VPS → **build the image on the VPS** → flip the `/opt/lifeline/current` symlink →
health-gate → **auto-rollback** on failure. Migrations run inside the app
container at startup. The production Postgres service is never rebuilt.

### 2. CSP must whitelist the Auth0 tenant (the login-outage root cause)

Because the single container now serves the SPA, the server's `helmet` CSP
governs the *browser app*, not just the API. The API-era policy overrode only
`script-src`/`style-src` and left `connect-src` to fall back to `default-src
'self'`. That blocked the browser's `fetch` to
`https://<tenant>.auth0.com/oauth/token`, so after the Auth0 redirect the
returned code was **never exchanged for a token** and the app silently dropped to
guest mode. (`loginWithRedirect` worked because a top-level navigation is not
restricted by `connect-src`; only the token-exchange fetch was.)

Decision: the CSP derives `connect-src` and `frame-src` for the Auth0 tenant from
`env.AUTH0_DOMAIN` (which must equal the web build's `VITE_AUTH0_DOMAIN`), and
also allows Google Fonts (`style-src`/`font-src`) and `https:` avatar images.
**Serving the SPA and the API from one origin means one CSP; it must be kept in
sync with every external origin the browser app talks to.**

### 3. Launch wiring fixes

- **API base URL**: `VITE_API_BASE_URL='/'` must normalize to `/api/v1`, never
  `//api/v1` (a protocol-relative URL the browser resolves to the host `api`).
- **Auth token supplier**: register it once and read the adapter from a live ref,
  rather than in an `[adapter]` effect — otherwise the first `GET /me` after
  login raced ahead of the authenticated closure and went out tokenless (401 →
  guest fallback, "Hello Guest").

### 4. Retire the pre-cutover legacy code after one verified cycle

Once production ran healthy on the new stack, delete the retired source dirs
(`backend/`, `client/`, `services/`, `database/`, `db/`) and stale old-stack
compose/env files. **`deploy/` and `docs/` are load-bearing and are kept** —
`deploy/` ships to the VPS via `git archive` (it is only excluded from the Docker
*image* build context, never deleted).

### 5. Brand mark: the "L-beat" logo

Adopt a two-tone "L-beat" monogram — an "L" whose foot runs out as a heartbeat
pulse (Lifeline = a heartbeat that never flatlines). The stroke uses
`--color-text` so the mark matches the wordmark across themes; the pulse uses
`--color-accent`. The word "Restore" is avoided for any new UI label because it
already means un-archive here (see ADR 0004).

### 6. Composer "reuse a previous task"

- **Suggestion source is client-side, not the server's fuzzy match.** Type-ahead
  suggestions are a synchronous substring filter (prefix-first, deduped by title)
  over the dashboard's already-loaded `useAllTodos` data, passed into the
  composer as an `allTodos` prop. The server `GET /todos/similar` (pg_trgm,
  0.3 threshold) was rejected because it silently drops short prefixes of longer
  titles (typing "Weekly" never matched "Weekly report review"). Client-side
  filtering is instant, identical in guest and server mode, and adds no query the
  dashboard did not already make.
- **Reuse offers "Fresh copy" vs "Keep progress".** Reusing a task used to carry
  its subtasks' completed state into the new copy. Now a single fork point,
  `applyTemplate(todo, keepProgress)`, either resets every subtask to unchecked
  ("Fresh copy", the common case) or keeps them as-is ("Keep progress"). Both
  create a **new** task; the original is never modified.

## Consequences

### Positive

- One build, one image, one process to operate; the embedded MCP removes a whole
  service and its `:3030` port.
- Data survived the cutover intact; rollback stays automatic and the DB is never
  destructively changed.
- Login works end-to-end (`/oauth/token` 200, `/me` 200); the repo is leaner
  after the legacy purge; the reuse UX is faster and matches expectations.

### Tradeoffs

- The SPA and API share a single CSP, which must be widened deliberately for each
  external origin (Auth0, fonts, images) — an easy thing to forget, as the login
  outage showed.
- `env.AUTH0_DOMAIN` (server) and `VITE_AUTH0_DOMAIN` (web build) must stay
  identical, or the CSP whitelists the wrong origin.
- Composer suggestions load the full active todo list client-side. Fine at
  current scale (hundreds of tasks); very large accounts may later warrant a
  dedicated prefix-search endpoint.
- Deletion remains soft-archive with no per-task hard delete in the UI
  (consistent with ADR 0004); "deleted" tasks are recoverable via the
  include-archived view.
