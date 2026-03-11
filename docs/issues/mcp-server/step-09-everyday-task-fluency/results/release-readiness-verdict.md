# Step-09 Release-Readiness Verdict

**Date**: 2025-07-23
**Verdict**: CLEAN — Ready for production deploy

## Review results

### 1. Migration correctness — CLEAN

- **007 (subtask backfill)**: PL/pgSQL DO block runs in implicit PostgreSQL transaction. Idempotency built in (skips elements where `subtaskId` already present, null, or empty). Row-by-row UPDATE within single statement.
- **008 (pg_trgm)**: Both `CREATE EXTENSION IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` are fully idempotent. No data changes.
- **Order**: 008 → 007 (as documented). No dependency between them; order is arbitrary but documented.
- **Edge case noted**: 007 does not guard against non-object JSONB array elements. Application code prevents these from existing. Not a blocker — defensive note only.
- **Rollback SQL**: Reviewed and correct.

### 2. Tool naming consistency — FIXED

- **Finding**: 7 documentation references used `list_tasks/window` as if it were a distinct tool name. The actual MCP tool is `list_tasks` with a required `window` input parameter.
- **Fix applied**: All 7 references corrected across 4 files:
  - `docs/issues/mcp-server/step-09-everyday-task-fluency/implementation/release-preparation.md`
  - `docs/issues/mcp-server/step-09-everyday-task-fluency/final/2026-03-11-closeout.md`
  - `docs/features/FEATURES.md`
  - `docs/operations/deployment-verification-and-smoke-checks.md`

### 3. Similarity-search safety — CLEAN

- `find_similar_tasks` has `readOnlyHint: true`, `destructiveHint: false`.
- Backend path: `GET /internal/mcp/tasks/similar` → `FindSimilarTasks.execute()` → `todoRepository.findSimilarByTitle()` — pure SELECT, no side effects.
- Server instructions provide tiered agent guidance (high/medium/low similarity) — agent asks user before reusing. No auto-create or auto-reuse code.

### 4. Archived-task mutation safety — CLEAN

All mutation paths guarded:

| Path | Guard | Response |
|---|---|---|
| `updateTask` | `existingTask.archived` check | 409 |
| `completeTask` | `existingTask.archived` check | 409 |
| `uncompleteTask` | `existingTask.archived` check | 409 |
| `batchAction` (complete/uncomplete) | `task.archived` check | Skipped with error entry |
| `SubtaskOperations._loadTask` | `task.archived` check | ValidationError |
| `restoreTask` | Already-active graceful handling | Success with note |
| `deleteTask` (archive) | No guard (intentional) | Archives or no-ops |

### 5. Smoke-test completeness — HARDENED

Operations doc now covers all required scenarios:
- Health checks (steps 1-4)
- New tool presence in `list-tools` (step 10)
- `list_tasks` with window `this_week` (step 12)
- `find_similar_tasks` pg_trgm validation (step 13)
- Full subtask CRUD flow (step 14)
- Archive lifecycle guards with 409 rejection (step 15)
- Backward-compat verification for pre-step-09 tools (step 16 — added)

## Test results

- **Backend step-09 tests**: 79/79 passed (8 suites)
- **MCP tests**: 10/10 passed
- **Pre-existing failures**: 2 tests in `test/integration/getExportStats.test.js` and `test/infrastructure/todoRepository.userLimits.test.js` fail due to stale mocks from pre-step-09 commits. Unrelated to this release.

## What was hardened

1. Fixed 7 tool-naming references (`list_tasks/window` → `list_tasks` with `window` parameter)
2. Added backward-compat smoke check (step 16) to operations verification doc

## Deploy sequence

1. Commit doc fixes to `main`
2. Push `main → deploy` to trigger GitHub Actions deployment workflow
3. SSH into VPS and run SQL migrations (008 then 007) against production PostgreSQL
4. GitHub Actions: build → SSH to VPS → `apply-release.sh`
5. Run post-deploy smoke tests per operations doc steps 1-16
