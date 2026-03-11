# Step-09 Release Preparation

## Status

Ready for deployment.

## Pre-release checklist

- [x] All Phase 1–6 implementation complete
- [x] All new backend tests pass (76/76 across 7 test suites)
- [x] All MCP service tests pass (10/10 including new e2e test)
- [x] Two pre-existing DB-dependent test failures confirmed unrelated (todoRepository.userLimits, getExportStats)
- [x] Phase 7 documentation committed
- [x] ADRs 0003 (subtask identity) and 0004 (archive-first lifecycle) committed
- [x] No new lint warnings introduced in modified files
- [x] Server instructions reviewed and rewritten (Phase 4)

## Migration strategy

### Migration files

| Migration | File | Type | Risk |
| --- | --- | --- | --- |
| 007 | `backend/migrations/007_backfill_subtask_identity.sql` | PL/pgSQL DO block — adds subtaskId and position to existing subtask JSONB | Low. Additive only; does not remove fields. |
| 008 | `backend/migrations/008_enable_pg_trgm_similarity.sql` | Extension + GiST index | Low. `CREATE EXTENSION IF NOT EXISTS` is idempotent. Index is additive. |

### Execution order

These are manual SQL migrations (not TypeORM-managed). They must be run against the production database before the new backend code goes live:

1. **Run 008 first** — `pg_trgm` extension + index. No data changes, purely additive.
2. **Run 007 second** — Subtask backfill. Should run before new code because the SubtaskContract normalization handles missing fields gracefully, but pre-backfilling avoids unnecessary normalization on first access.

### How to run

From the VPS, connect to the PostgreSQL container and execute:

```bash
docker exec -i lifeline-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" < migrations/008_enable_pg_trgm_similarity.sql
docker exec -i lifeline-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" < migrations/007_backfill_subtask_identity.sql
```

The migration files are in `backend/migrations/` and will be available inside the release directory.

## Deploy sequence

1. Merge all changes to `main`
2. Verify CI passes (tests, lint)
3. SSH into VPS, copy migration files to accessible path
4. Run SQL migrations 008 then 007 against production PostgreSQL
5. Push to `deploy` branch to trigger the GitHub Actions deployment workflow
6. GitHub Actions: builds release artifact → SSH to VPS → runs `apply-release.sh`
7. `apply-release.sh` handles: postgres health → lifeline-app rebuild + health → lifeline-mcp rebuild + health
8. Run post-deploy smoke tests (see below)
9. Monitor for 24 hours before declaring stable

## Post-deploy smoke tests

After deployment completes:

1. `GET /api/health/db` → 200 (app health)
2. `GET /api/public/info` → 200 (app info)
3. `GET https://mcp.lifeline.a2z-us.com/health` → 200 (MCP health)
4. MCP `list-tools` → should show new tools: `archive_task`, `restore_task`, `list_tasks`, `find_similar_tasks`, `add_subtask`, `complete_subtask`, `uncomplete_subtask`, `update_subtask`, `remove_subtask`
5. MCP `search_tasks` → basic connectivity check
6. MCP `list_tasks` with window `this_week` → confirms window query handler
7. MCP `find_similar_tasks` with a title → confirms pg_trgm is active
8. Create → add_subtask → complete_subtask → remove_subtask → archive_task → restore_task → delete created task (cleanup)

Use short-lived smoke API keys as documented in the operations runbook.

## Rollback plan

### If SQL migrations fail

- **008 (pg_trgm)**: `CREATE EXTENSION IF NOT EXISTS` is idempotent. No rollback needed. If the index creation fails, the extension remains harmless. Drop the index manually if needed: `DROP INDEX IF EXISTS idx_todos_title_trgm;`
- **007 (subtask backfill)**: The DO block runs as a transaction. On failure, no rows are modified. If it succeeds but needs reversal, strip the added keys:

```sql
UPDATE todos
SET subtasks = (
  SELECT jsonb_agg(elem - 'subtaskId' - 'position')
  FROM jsonb_array_elements(subtasks) AS elem
)
WHERE subtasks IS NOT NULL AND jsonb_array_length(subtasks) > 0;
```

### If new backend routes fail

New routes are additive and do not affect existing routes. Rollback: redeploy the previous release via `apply-release.sh` automatic rollback.

### If MCP service fails

New tools are additive and do not affect existing tools. Rollback: redeploy the previous release.

### Rollback trigger criteria

- Health check failures on any service after deploy
- Error rate spike above 5% on existing tools
- Data integrity issues in subtask JSONB (malformed subtasks after backfill)
- `find_similar_tasks` returning errors indicating missing pg_trgm extension

## Code changes summary

### Backend (new files)

- `backend/src/domain/SubtaskContract.js`
- `backend/src/application/SubtaskOperations.js`
- `backend/src/application/FindSimilarTasks.js`
- `backend/src/internal/mcp/subtaskHandlers.js`
- `backend/src/internal/mcp/subtaskRouter.js`
- `backend/migrations/007_backfill_subtask_identity.sql`
- `backend/migrations/008_enable_pg_trgm_similarity.sql`

### Backend (modified files)

- `backend/src/domain/Todo.js` — SubtaskContract integration
- `backend/src/application/UpdateTodo.js` — Subtask normalization on update
- `backend/src/internal/mcp/taskDateFilters.js` — Window token resolution
- `backend/src/internal/mcp/taskReadHandlers.js` — Window + similarity handlers
- `backend/src/internal/mcp/taskReadRouter.js` — New routes
- `backend/src/internal/mcp/taskWriteHandlers.js` — Archive guards, optimistic concurrency, restore
- `backend/src/internal/mcp/taskWriteRouter.js` — Restore route
- `backend/src/internal/mcp/router.js` — Subtask router + new dependencies
- `backend/src/internal/mcp/taskPayloads.js` — createdAt/updatedAt
- `backend/src/infrastructure/TypeORMTodoRepository.js` — Archived visibility fix, findSimilarByTitle
- `backend/src/middleware/validateTodo.js` — Subtask Joi schemas

### MCP service (new files)

- `services/lifeline-mcp/src/middleware/rateLimiter.js`

### MCP service (modified files)

- `services/lifeline-mcp/src/backend/internalBackendClient.js` — 9 new methods
- `services/lifeline-mcp/src/mcp/toolResults.js` — Enhanced subtask preview
- `services/lifeline-mcp/src/mcp/taskTools.js` — 11 new tool registrations
- `services/lifeline-mcp/src/mcp/serverFactory.js` — Comprehensive instructions rewrite
- `services/lifeline-mcp/src/app.js` — Correlation IDs, rate limiter

## Related documents

- [../planning/2026-03-11-master-implementation-plan.md](../planning/2026-03-11-master-implementation-plan.md)
- [../../../../docs/operations/deployment-verification-and-smoke-checks.md](../../../../docs/operations/deployment-verification-and-smoke-checks.md)
- [../../../../docs/operations/production-runtime-and-rollback.md](../../../../docs/operations/production-runtime-and-rollback.md)
