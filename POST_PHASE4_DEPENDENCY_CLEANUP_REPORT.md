# Post-Phase-4 Dependency Cleanup Report

## 1. Executive Summary

The focused post-Phase-4 cleanup completed successfully.

The backend runtime and local Compose path remain PostgreSQL-only. Unsupported MSSQL and SQLite runtime baggage was removed from active package manifests, executable scripts, repository implementations, and provider-specific tests that depended on the old fallback paths.

## 2. Dependencies and Scripts Removed

Removed direct backend dependencies:
- `mssql`
- `sqlite3`

Removed obsolete backend package scripts:
- `migration:export-snapshot`
- `migration:transform-snapshot`
- `migration:import-snapshot`
- `migration:validate-snapshot`
- `migration:rehearse`

Removed dead backend scripts and helpers:
- `backend/scripts/create-smoke.js`
- `backend/scripts/export-mssql-snapshot.js`
- `backend/scripts/import-postgres-snapshot.js`
- `backend/scripts/mark-migrations-applied.js`
- `backend/scripts/rehearse-migration.js`
- `backend/scripts/test-db.js`
- `backend/scripts/test-mssql-connection.js`
- `backend/scripts/transform-mssql-snapshot.js`
- `backend/scripts/validate-postgres-migration.js`
- `backend/scripts/verify-connection-v2.js`
- `backend/scripts/lib/phase3Migration.js`

## 3. Dead Repository and Test Cleanup

Removed unsupported legacy repository implementations:
- `backend/src/infrastructure/SQLiteTodoRepository.js`
- `backend/src/infrastructure/SQLiteTagRepository.js`
- `backend/src/infrastructure/SQLiteUserRepository.js`

Removed provider-specific tests that depended on SQLite runtime wiring or SQLite-backed fake datasources:
- `backend/test/application/CompleteDateRangeBehavior.test.js`
- `backend/test/application/CreateTodoRecurrence.test.js`
- `backend/test/concurrency/createTodoConcurrency.test.js`
- `backend/test/infrastructure/SQLiteTodoRepository.test.js`
- `backend/test/integration/getExportStats.db.test.js`
- `backend/test/integration/http.todos.test.js`
- `backend/test/integration/taskNumber.smoke.test.js`
- `backend/test/migrations/taskNumber.backfill.test.js`

Kept PostgreSQL/TypeORM-backed tag tests, but updated their env gate to use the PostgreSQL runtime contract instead of the old MSSQL variable.

## 4. Runtime and Documentation Adjustments

Updated runtime/config references:
- `backend/.env.example` now documents only the supported PostgreSQL runtime contract.
- `backend/src/index.js` no longer mentions SQLite in the statistics aggregation fallback comment.
- `README.md` no longer points readers at the removed MSSQL connection script.

Updated PostgreSQL-backed test gating:
- `backend/test/tags/defaultTags.test.js`
- `backend/test/tags/perUserTags.test.js`
- `backend/test/tags/security.test.js`

## 5. Verification Executed

Executed successfully:
- `npm install` in `backend/`
- `docker compose --env-file compose.env.example config`
- `docker compose --env-file compose.env.example build`
- `docker compose --env-file compose.env.example up -d`
- `npm run verify:compose` in `backend/`
- `docker compose --env-file compose.env.example restart lifeline-postgres lifeline-app`
- `npm run verify:compose` in `backend/` after restart
- `docker compose --env-file compose.env.example down`

Observed results:
- backend install completed cleanly with the new manifest
- the Docker image still built successfully
- the local Compose stack still reached healthy state
- the core Phase 4 verification flow still passed before and after restart
- persisted Compose data remained intact across restart (`todoCount` increased from 5 to 6 during the second verification)

## 6. Remaining Provider-Specific Leftovers

The following provider-specific leftovers remain intentionally outside the active runtime path:
- historical SQL artifacts in `backend/db/mssql-init.sql` and `backend/migrations/*.sql`
- archived migration evidence in `backend/migration-artifacts/**`
- legacy migration log content in `backend/migration_log.txt`
- ignored local env files containing old MSSQL settings (`backend/.env`, `backend/.env.local`, `backend/.env.local.bak`)
- one archived migration comment in `backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js`
- lockfile peer metadata from TypeORM optional database-driver support in `backend/package-lock.json`

These leftovers are historical or tool metadata only. They are not used by the supported PostgreSQL runtime, container startup path, or Phase 4 Compose verification flow.

## 7. Completion Status

Cleanup completed successfully.

Delivered outcomes:
- unsupported MSSQL and SQLite direct dependencies removed from the active backend manifest
- dead provider-specific scripts removed
- dead SQLite repository implementations removed
- dead provider-specific tests removed
- supported PostgreSQL runtime and Compose verification preserved
