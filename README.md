# Lifeline

A production task manager: a TypeScript monorepo with an Express 5 API, a React 19 web app, and an embedded [Model Context Protocol](https://modelcontextprotocol.io) server so AI assistants can manage tasks on your behalf. Auth0 authentication with a first-class guest mode, PostgreSQL via Drizzle ORM, and a single-container Docker deployment.

## Monorepo layout

```
apps/
  server/     Express 5 + TypeScript API (/api/v1), Drizzle ORM, embedded MCP module
  web/        React 19 + Vite web app (feature-sliced)
packages/
  shared/     Zod schemas + API contract types — single source of truth for server & web
```

| Concern    | Choice                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| Runtime    | Node 22 LTS, npm workspaces                                                  |
| API        | Express 5 + TypeScript, `/api/v1`, RFC 7807 problem+json errors, OpenAPI 3.1 |
| Validation | Zod at every boundary, schemas in `packages/shared`                          |
| Database   | PostgreSQL 16 + Drizzle ORM (SQL migrations)                                 |
| Auth       | Auth0 (JWT) + guest mode + per-user MCP API keys                             |
| Web        | React 19, Vite, react-router v7, TanStack Query, CSS Modules                 |
| MCP        | Embedded in the server (`POST /mcp`, streamable HTTP), 28 tools              |
| Tests      | Vitest — unit, supertest integration, and real-Postgres integration          |

## Getting started

```sh
npm ci                                    # install all workspaces
docker compose -f compose.dev.yaml up -d  # dev Postgres on :15432

# apps/server/.env  (local dev — no Auth0 needed)
#   NODE_ENV=development
#   DATABASE_URL=postgres://lifeline:lifeline@localhost:15432/lifeline
#   AUTH_DISABLED=1            # or set AUTH0_DOMAIN + AUTH0_AUDIENCE for real auth
#   MCP_API_KEY_PEPPER=dev

npm run dev:server   # API on :4000 (runs the baseline migration on start)
npm run dev:web      # web on :5173, proxies /api → :4000
```

## Scripts (repo root)

```sh
npm run lint         # eslint (flat config, type-checked)
npm run format       # prettier --check
npm run typecheck    # tsc across workspaces
npm run test         # vitest across workspaces
npm run build        # shared → server → web
```

Integration tests that need a live database run when `TEST_DATABASE_URL` is set.

## Deployment

Single container serving the API, the built web SPA, and the MCP endpoint, plus PostgreSQL — see [`compose.production.yaml`](compose.production.yaml) and [`Dockerfile`](Dockerfile). Production is deployed to a VPS by pushing the `deploy` branch, which builds the image on the host and health-gates the release with automatic rollback (`deploy/scripts/apply-release.sh`). The server runs the idempotent baseline migration on startup, so it adopts an existing database without data loss.

## Documentation

Architecture, API, data-model, and operations docs live under [`docs/`](docs/). The clean-room rebuild's design contracts and the deploy runbook are in [`docs/issues/clean-rebuild/`](docs/issues/clean-rebuild/).
