# Lifeline (codebase/)

Clean-room rebuild of Lifeline as a TypeScript monorepo. Replaces `backend/`, `client/`,
and `services/lifeline-mcp/` at deploy swap.

## Layout

- `packages/shared` — zod domain schemas, API types, error codes (single source of truth)
- `apps/server` — Express 5 API (`/api/v1`), Drizzle ORM, embedded MCP module
- `apps/web` — React 19 + Vite web app

## Commands (run from `codebase/`)

```sh
npm ci                 # install
npm run dev:server     # API on :4000 (needs Postgres, see compose)
npm run dev:web        # web on :5173, proxies /api → :4000
npm run lint           # eslint
npm run format         # prettier check
npm run typecheck      # tsc across workspaces
npm run test           # vitest across workspaces
npm run build          # shared → server → web
```

Planning contracts: `../docs/issues/clean-rebuild/planning/`.
