# Phase 3 Implementation Report

## 1. Executive Summary

Phase 3 implementation is complete.

The backend has been converted to a PostgreSQL-only supported runtime, the approved target schema has been implemented as the new TypeORM migration authority, repository and entity behavior has been aligned to PostgreSQL semantics, deterministic MSSQL-to-PostgreSQL ETL tooling has been added, and minimal contract cleanup for `birthday` and `notifications` has been completed.

The backend has been validated locally against a Dockerized PostgreSQL target, and the full MSSQL-to-PostgreSQL rehearsal now succeeds end to end.

The remaining blocker reported in the earlier draft was cleared once the Azure-hosted MSSQL VM became reachable again. During the retry pass, the export query set was aligned to the live source schema, the PostgreSQL rehearsal reset logic was corrected to preserve the migrated schema, the full rehearsal completed successfully, and expanded behavior-level API verification also passed.

## 2. Scope Executed

This implementation pass completed work across the planned Phase 3 workstreams:

1. PostgreSQL runtime foundation
2. target schema, entity, and repository conversion
3. startup/provider/runtime cleanup
4. narrow contract cleanup for `birthday` and `notifications`
5. deterministic ETL tooling implementation
6. validation/runtime smoke verification support
7. final rehearsal retry, deeper verification, and DB-local asset cleanup

## 3. Major Changes Implemented

### 3.1 PostgreSQL runtime foundation

Implemented:
- PostgreSQL datasource option builder in `backend/src/infra/db/data-source-options.js`
- PostgreSQL default datasource wiring in `backend/src/infra/db/data-source.js`
- PostgreSQL migration datasource wiring in `backend/data-source-migrations.js`
- PostgreSQL env contract updates in `backend/.env.example`
- backend package/runtime scripts and `pg` dependency updates in `backend/package.json`
- PostgreSQL database init script in `backend/scripts/init-db.js`

### 3.2 Approved target schema as runtime authority

Implemented:
- canonical default tag seed catalog in `backend/src/infra/db/defaultTags.js`
- PostgreSQL target-schema migration in `backend/src/migrations/1764826105992-initial_migration.js`
- PostgreSQL-aligned entity conversion for:
	- `UserEntity`
	- `UserProfileEntity`
	- `UserSettingsEntity`
	- `TodoEntity`
	- `TagEntity`
	- `TodoTagEntity`

Target-shape changes include:
- `user_profiles.user_id` as PK
- `user_settings.user_id` as PK
- `users.auth0_sub` mandatory + unique
- nullable unique email when present
- per-user unique `task_number`
- `layout`, `subtasks`, `recurrence` moved to `jsonb`
- timestamps normalized to `timestamptz`

### 3.3 Repository conversion

Implemented:
- complete PostgreSQL-only rewrite of `backend/src/infrastructure/TypeORMTodoRepository.js`
- PostgreSQL-aligned updates for:
	- `backend/src/infrastructure/TypeORMUserRepository.js`
	- `backend/src/infrastructure/TypeORMUserProfileRepository.js`
	- `backend/src/infrastructure/TypeORMUserSettingsRepository.js`
	- `backend/src/infrastructure/TypeORMTagRepository.js`

Key behavior changes:
- removed supported-runtime MSSQL/SQLite branching from repository behavior
- native boolean handling instead of integer/bit assumptions
- native JSON handling instead of text-JSON persistence assumptions
- case-insensitive tag behavior and namespace-safe uniqueness handling
- in-memory statistics aggregation replacing provider-specific raw SQL paths

### 3.4 Startup/provider/runtime cleanup

Implemented in `backend/src/index.js` and adjacent runtime surfaces:
- removed supported SQLite fallback from datasource initialization path
- startup now wires PostgreSQL-backed repositories only
- notification service now uses the disabled PostgreSQL-runtime implementation
- DB health/schema routes now inspect PostgreSQL correctly
- import replace path converted to PostgreSQL-safe delete behavior
- server startup now guards `app.listen()` with `require.main === module`

Related runtime cleanup:
- `backend/src/application/NotificationService.js` rewritten as a disabled service
- `backend/src/middleware/attachCurrentUser.js` enhanced for PostgreSQL-backed local auth bypass using `AUTH_LOCAL_USER_ID`
- `backend/src/scripts/soft-reset-db.js` converted to PostgreSQL cleanup semantics
- `backend/scripts/mark-migrations-applied.js` retired as legacy-obsolete for the supported runtime

### 3.5 Contract cleanup

Completed:
- backend no longer writes `birthday` in `/api/profile`
- `start_day_of_week` validation widened to all weekdays
- notification endpoints now return disabled behavior instead of trying to operate on unsupported storage
- `client/src/components/ProfilePanel.jsx` no longer reads/saves/renders `birthday`
- `client/src/utils/api.js` no longer exposes notification helper APIs
- `client/src/providers/NotificationPoller.jsx` reduced to a true no-op component without notification API usage

### 3.6 Deterministic ETL tooling

Implemented:
- shared ETL library in `backend/scripts/lib/phase3Migration.js`
- wrapper scripts:
	- `backend/scripts/export-mssql-snapshot.js`
	- `backend/scripts/transform-mssql-snapshot.js`
	- `backend/scripts/import-postgres-snapshot.js`
	- `backend/scripts/validate-postgres-migration.js`
	- `backend/scripts/rehearse-migration.js`

Implemented ETL capabilities:
- MSSQL source extraction with explicit in-scope table selection
- transform normalization for booleans, timestamps, text, JSON payloads, weekdays
- backfill generation for missing `user_profiles` and `user_settings`
- orphan/duplicate filtering and reject reporting
- PostgreSQL import ordering
- post-import validation reporting

### 3.7 Local runtime verification tooling

Implemented:
- `backend/scripts/verify-local-postgres-runtime.js`

This script verifies core supported flows against PostgreSQL:
- `/api/me`
- `/api/profile`
- `/api/settings`
- `/api/tags`
- `/api/todos`
- `/api/stats`
- `/api/export`

## 4. Execution Performed

### 4.1 Dependency installation

Executed successfully:
- `npm install` in `backend/`

### 4.2 Dockerized PostgreSQL target

Per updated instruction, a dedicated Docker PostgreSQL target was created and used for local validation.

Container details used during execution:
- image: `postgres:16-alpine`
- container name: `lifeline-phase3-postgres`
- mapped host port: `54329`
- database: `lifeline_phase3`

### 4.3 PostgreSQL schema migration

Executed successfully:
- `npm run migration:run`

Outcome:
- the new PostgreSQL target schema migration applied successfully
- default tags were seeded successfully

### 4.4 Local PostgreSQL runtime verification

Executed successfully:
- `npm run verify:local`

Observed successful outcomes:
- authenticated/local user bootstrap returned 200
- profile save returned 200
- settings save returned 200
- tag creation returned 201
- todo creation and toggle succeeded
- todo list returned non-empty results
- tags returned expected results
- stats returned 200
- export returned 200

### 4.5 Local MSSQL-to-PostgreSQL rehearsal

Executed successfully:
- `npm run migration:rehearse`

Successful run:
- run id: `2026-03-06T11-29-47-387Z`
- artifact root: `database/phase3/runs/2026-03-06T11-29-47-387Z`

Outcome summary:
- export snapshot succeeded from MSSQL
- transform completed with zero rejects
- import into Dockerized PostgreSQL succeeded
- validation succeeded with all checks at zero failures

Validation highlights from the successful rehearsal:
- source counts: 7 users, 5 profiles, 2 settings, 536 todos, 17 tags, 564 todo-tag links
- transformed/imported counts: 7 users, 7 profiles, 7 settings, 536 todos, 17 tags, 564 todo-tag links
- backfills performed: 2 profiles, 5 settings
- duplicate/orphan/integrity checks: all zero

### 4.6 Additional retry fixes required to finish the rehearsal

During the successful retry pass, two targeted fixes were required:
- the MSSQL export query was aligned with the live source schema by aliasing missing timestamp columns for `todos` and `tags`
- the PostgreSQL rehearsal reset logic was changed to truncate data while preserving the migrated schema instead of dropping the database without reapplying migrations

### 4.7 Deep local PostgreSQL-backed app verification

Executed successfully:
- `npm run verify:local`

Verified routes:
- `/api/me`
- `/api/profile`
- `/api/settings`
- `/api/tags`
- `/api/todos`
- `/api/stats`
- `/api/export`
- `/api/notifications/pending`
- `/api/notifications/schedule`
- `/api/notifications/:id/sent`

Verified behaviors:
- profile save and reload worked correctly through `/api/profile` and `/api/me`
- saved profile payloads no longer exposed or depended on `birthday`
- settings save and reload worked correctly through `/api/settings` and `/api/me`
- tags could be created and listed correctly
- todos could be created, updated, toggled, listed, and kept associated with tags
- stats returned sensible `periodTotals` and grouping payloads
- export returned the saved profile/settings data plus created todo/tag content
- notification pending returned an empty list
- notification mutation routes returned the intended disabled `410` behavior

## 5. Validation Status

### 5.1 Completed validation

Completed successfully:
- changed-file error scan for the directly edited backend/frontend files
- PostgreSQL migration execution against the Docker target
- successful end-to-end MSSQL → PostgreSQL rehearsal against the Docker target
- expanded local PostgreSQL runtime and behavior verification against the Docker target

### 5.2 Partially completed validation

No remaining partial validation items for Phase 3 acceptance.

## 6. Remaining Blocker

There is no remaining material blocker for Phase 3.

The earlier source-accessibility blocker was cleared during the retry pass.

Minor follow-up work, if desired later, would be documentation or future deployment planning rather than unfinished Phase 3 acceptance work.

## 7. Outcome Assessment

### Completed
- PostgreSQL-only supported backend runtime
- approved PostgreSQL target schema implementation
- repository/entity/runtime conversion
- SQLite fallback removal from supported runtime path
- contract cleanup for `birthday` and `notifications`
- ETL tooling implementation
- Dockerized PostgreSQL target setup for local execution
- full end-to-end MSSQL → PostgreSQL rehearsal success
- local PostgreSQL app verification success
- DB-local asset organization under a dedicated `database/` directory

### Issues remaining
- no blocking Phase 3 issues remain

## 8. Finalized DB-Local Directory Structure

Finalized local DB-related structure:
- `backend/` — application runtime, migration, and ETL code
- `client/` — frontend application code
- `database/` — local database support assets
	- `database/README.md`
	- `database/phase3/runs/<run-id>/`

The prior scattered artifact location under `backend/migration-artifacts/` was removed. Phase 3 rehearsal artifacts now live under the dedicated repo-level `database/` directory.

## 9. Final Status

Phase 3 is fully complete.
