# Rebuild decisions — deltas from the old implementation

Ground truth: `../discovery/audit-*.md`. Everything not listed here is ported 1:1.

## Investigated verdicts (mandated by plan)

| Question | Verdict |
| --- | --- |
| `/api/ai` | Dead namespace — only a rate limiter + `requirePaid()` gate, zero routes, no AI feature anywhere. **Dropped.** |
| `/api/admin` | Dead namespace — `requireRole('admin')` with zero routes behind it. **Dropped as HTTP surface**; role model + `promote-admin` script are kept. |
| Notifications | All endpoints are 410 stubs; client poller returns `[]`. **Dropped** (no endpoints, no poller). Documented as removed feature. |
| `client-next/` | Abandoned experiment (build output only, no src). Deleted at swap. |

## Old bugs deliberately fixed (not parity)

1. **`AppError` import bug** (old `index.js:9`): intended 403 free-tier / 404 not-found responses actually threw
   `TypeError` → 500. v1 returns the intended status codes via typed domain errors.
2. **`archived` never mapped to domain** (old repo `_mapRowToDomain`): archive guards never fired; any update to
   an archived task silently unarchived it; MCP `restore` never actually restored. v1 maps `archived` properly:
   archived tasks reject mutations with 409 `conflict`, restore works, updates never flip archive state implicitly.
3. **Task-number race**: old computed `MAX+1` app-side without a transaction. v1 assigns inside the INSERT
   (`SELECT COALESCE(MAX(task_number),0)+1 … FOR UPDATE` pattern with retry on unique-violation).
4. **DELETE cleared tag links but archive kept them** — inconsistent. v1: DELETE = archive; tags always preserved.
5. **Role clobber**: old overwrote `users.role` from JWT claims on every request (default `free`), so
   `promote-admin` was undone at next login. v1 only syncs role from claims **when the token carries role claims**;
   otherwise the DB value stands. Claims still win when present (Auth0 remains authoritative if configured).
6. **`MCP_API_KEY_PEPPER` silently defaulted to `''`** — env validation now requires it in production.
7. **Public `GET /api/health/db/schema`** (information_schema dump, no auth) — removed.
8. **MCP week windows hardcoded Sunday start** while instructions promised user preference — v1 uses the user's
   `startDayOfWeek` profile setting.
9. **In-memory rate limiter maps never pruned** — replaced with `express-rate-limit` (same budgets: todos 60/min,
   key writes 10/min; ai limiter dropped with the namespace).
10. **Import not transactional** (partial imports possible; taskNumber collisions → 500) — v1 wraps import in one
    transaction and reassigns conflicting task numbers instead of failing.

## Deliberate parity keeps (even where surprising)

- **Recurrence = pre-generate at creation** (daily/specificDays/legacy expand to N rows; dateRange = one
  spanning task). Spawn-on-complete existed only as dead code and never shipped — not ported. `nextRecurrenceDue`
  column kept (always null) for data compat; not written.
- Recurrence immutable after create through MCP; mutable via nothing (PATCH rejects it too in v1 — the old REST
  Joi allowed it but the web UI never edited recurrence post-create; keeping it immutable is the safer contract).
- Subtask identity contract: whole-array replace on PATCH, `subtaskId` stable, max 50, titles ≤500, positions
  re-sequenced 1-based.
- Free tier caps: 200 active todos, 50 custom tags. Roles: free/paid/admin from Auth0 claim namespaces
  (`https://lifeline-api/roles` + legacy `https://lifeline.app/roles`).
- Guest mode: hardened server (401 `"Please log in to use this feature. Guest mode works only locally."`),
  all guest data client-side in localStorage, wiped at login (no upgrade path — documented product behavior).
- Default tags: 10 global rows seeded by baseline migration, `user_id NULL`, immutable/undeletable.
- Export JSON/CSV shapes and import merge/replace semantics (incl. tag remap by lowercase name).
- All date math UTC; `dueDate` date-only strings; `dueTime` HH:mm string.
- MCP tool names/inputs/outputs: all 28 tools identical (existing configured clients keep working).

## API shape changes (breaking is fine — old clients are replaced in the same swap)

- Everything under `/api/v1`; **camelCase everywhere** including profile (`firstName`, `startDayOfWeek`,
  `onboardingCompleted`) and me payload (`subscriptionStatus`).
- RFC 7807 `application/problem+json` errors with stable `code`; zod field errors under `errors`.
- One list endpoint `GET /api/v1/todos` with all search filters (merges old `/api/todos` + `/api/todos/search`),
  paginated `{items, page, pageSize, totalItems, totalPages}`.
- Explicit `POST …/complete` + `POST …/uncomplete` replace PATCH toggle; flag via `PATCH {isFlagged}`.
- `order` updates via PATCH (dedicated reorder endpoint folded in).
- Batch: `{action: complete|uncomplete|archive|restore, ids}` with per-item results (adopts the MCP shape;
  `restore` newly exposed to REST).
- `GET /api/v1/todos/similar` — pg_trgm similarity, now public REST (was MCP-only).
- `PUT /me/profile`, `PUT /me/settings` (idempotent replaces of POST variants).
- `POST /api/v1/account/reset` (was `/api/reset-account`).
- MCP keys at `/api/v1/mcp-keys` (same presets/metadata/`lk_…` format so existing keys keep working —
  **hash, prefix, pepper scheme unchanged**).
- Health at `/health/live` + `/health/ready` (root, out of /api). `GET /api/v1/info` stays public.

## MCP redesign (embedded module)

- Mounted in the server at `POST /mcp` (streamable HTTP, stateless, JSON responses), plus OAuth
  protected-resource metadata when Auth0 configured. Same dual auth: `x-api-key` / non-JWT Bearer → API-key path;
  JWT Bearer → Auth0 verify (jose JWKS). Tools call use-cases directly — the internal HTTP hop, shared secret,
  and principal headers are deleted (`MCP_INTERNAL_SHARED_SECRET`, `LIFELINE_BACKEND_BASE_URL` gone).
- Scope enforcement stays in the tool layer (`tasks:read` / `tasks:write`, wildcards honored).
- Per-principal rate limit (fixes the all-anonymous bucket bug).
- Supersedes ADR-0001 (separate runtime) — new ADR written at swap. ADR-0002 (dual auth), 0003 (subtask
  contract), 0004 (archive-first) carry forward.

## Env compatibility (VPS drop-in)

Same names honored: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE(_ALT)`, `AUTH_DISABLED`, `AUTH_LOCAL_USER_ID`,
`AUTH_TIMEOUT_MS`, `MCP_API_KEY_PEPPER`, `MCP_AUTH0_*`, `MCP_PUBLIC_BASE_URL`, `PORT`, `DATABASE_URL`
(new; compose maps old PG pieces), CORS origin vars (consolidated to `CORS_ORIGIN` CSV, others still read).
No hardcoded Auth0 tenant fallbacks — required in production, validated at boot.
