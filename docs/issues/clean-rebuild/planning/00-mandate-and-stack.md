# Lifeline Clean-Room Rebuild — Mandate & Stack (confirmed)

> Continuation of the GitHub agent session "ziadsalem22-full-project-refactor" (2026-07-03),
> whose ~20k-line working tree was never pushed. This local rebuild re-executes the same
> user-confirmed plan on branch `rebuild/clean-room`. If the original session's branch ever
> lands, compare and adopt whichever is further along.

## Mandate (user-confirmed)

Rebuild the entire app from scratch in a new `codebase/` monorepo, TypeScript everywhere,
with freedom to redesign endpoints, APIs, and the MCP server. Target: production-ready
quality. At the end, the new codebase replaces `backend/`, `client/`, and
`services/lifeline-mcp/`.

Only true invariants:

1. **User data survives** — new server runs against the existing PostgreSQL data. Baseline
   schema comes from introspecting the current schema; evolution via forward migrations,
   never destructive resets.
2. **Auth0 stays** — same tenant/env vars; guest mode preserved as a product feature.
3. **Feature parity** — every user-facing capability of the old app exists in the new one.
4. **Same deployment target** — VPS via Docker Compose + deploy-branch workflow, updated to
   build the new codebase.

## Stack decisions

| Concern    | Choice                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------ |
| Runtime    | Node 22 LTS, npm workspaces                                                                 |
| Server     | Express 5 + TypeScript                                                                      |
| Validation | Zod at all boundaries, schemas in `packages/shared`                                         |
| ORM        | Drizzle ORM + drizzle-kit migrations; baseline from introspecting current schema            |
| API style  | `/api/v1`, consistent REST, RFC 7807 problem+json errors, pagination on all list endpoints  |
| OpenAPI    | generated from zod route registry                                                           |
| Logging    | pino + pino-http, request IDs                                                               |
| Web        | React 19 + Vite + TS, react-router v7, TanStack Query v5, react-hook-form + zod, CSS Modules + ported design tokens |
| MCP        | Embedded MCP module in the server (`@modelcontextprotocol/sdk`, streamable HTTP) + per-user API keys — replaces the 2-hop `services/lifeline-mcp` design |
| Tests      | vitest everywhere (server unit + supertest integration; web component/flow tests)           |
| CI         | GitHub Actions: lint + format + typecheck + test + build (`.github/workflows/ci-codebase.yml`) |
| Security   | helmet, strict CORS allowlist, rate limits on write/auth endpoints, env validation at boot  |
| Ops        | `/health/live` + `/health/ready`, graceful shutdown, multi-stage Dockerfile, compose dev + prod |

Deviations from the original session's table (deliberate, minor):

- JWT verification via `jose` (JWKS) instead of an Auth0-specific Express middleware — one
  verifier serves the three-way auth (Auth0 JWT / guest / MCP API key).
- Zod v4 (current major) — native `z.toJSONSchema()` feeds both the OpenAPI generator and
  MCP tool input schemas, so contracts can't drift.

## Execution phases

Same 13-phase breakdown as the session plan (contract-design → … → deploy-swap), tracked in
the session task list. Artifacts for phase 1 live in this directory:

- `00-mandate-and-stack.md` (this file)
- `01-feature-inventory.md`
- `02-api-contract-v1.md`
- `03-db-baseline.md`
- `04-mcp-tool-surface.md`
- `05-decisions.md` (incl. /api/ai, /api/admin, notifications verdicts)
