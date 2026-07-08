# DB baseline

Normative column-level truth: `../discovery/audit-db-schema.md` (reconstructed from the two live TypeORM
migrations + manual SQL 007/008). Code source of truth after rebuild:
`codebase/apps/server/src/infrastructure/db/schema.ts` (Drizzle) + `migrations/0000_baseline.sql`.

## Baseline migration contents (one SQL file, everything `IF NOT EXISTS`)

1. `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
2. Tables exactly as audited: `users`, `user_profiles`, `user_settings`, `todos`, `tags`, `todo_tags`,
   `mcp_api_keys` — every column/default/CHECK/FK/index verbatim, including partial + GIN indexes and
   `idx_todos_title_trgm` GiST (fixes the old gap where pg_trgm setup lived outside the migration chain).
3. Idempotent seed of the 10 default tags (fixed ids `default-work` … `default-misc`).

No data transforms: prod data already satisfies the shape (007 subtask backfill ran in prod; new code always
writes `subtaskId`/`position`).

## Adoption on the existing VPS database (no data loss)

Drizzle ledger lives in `drizzle.__drizzle_migrations`. Because every statement is `IF NOT EXISTS`, the
baseline is **safe to run as-is against the live DB** — it no-ops on existing objects and only records the
ledger row (+ creates the trgm index if missing). Old TypeORM `migrations` table stays behind as an inert
artifact (documented; optional manual drop later). Rollback: previous images remain deployable — baseline
changes nothing destructive.

Fresh dev DBs get the identical schema from the same file via `npm run db:migrate` (also run at container
start, mirroring old behavior).

## Compatibility notes

- ids are `text` (uuid strings app-side) — keep text, do not convert to `uuid` type.
- `todos."order"` is a reserved word — Drizzle column `order` mapped with quoted name.
- `next_recurrence_due` kept (always null in practice) for data compat.
- text + CHECK instead of PG enums (as-is).
- `timestamptz` for all timestamps; `created_at`/`updated_at` default `now()`, `updated_at` maintained
  app-side on update (old behavior via TypeORM; new repos set it explicitly).
