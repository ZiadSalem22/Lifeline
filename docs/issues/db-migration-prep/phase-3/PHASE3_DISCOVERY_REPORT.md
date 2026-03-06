# Phase 3 Discovery Report

## 1. Executive Summary
Phase 3 implementation is not yet ready to execute with low change risk.

Discovery confirms that the current backend still operates as a mixed MSSQL-plus-SQLite system, while the approved Phase 2 direction requires a PostgreSQL-only runtime and a controlled local logical migration path from MSSQL to PostgreSQL. The main implementation burden is not limited to datasource replacement. It spans provider configuration, startup flow, entity definitions, repository behavior, migration tooling, ETL scripting, validation tooling, operational scripts, and large parts of the automated test suite.

The most material findings are:
- runtime datasource configuration is still MSSQL-only
- backend startup still contains SQLite fallback bootstrapping and repository wiring
- TypeORM entities still encode MSSQL-oriented types and surrogate-key shapes that conflict with the approved target schema
- repository code still contains MSSQL- and SQLite-specific behavior, including raw SQL branches and text-JSON/int-boolean assumptions
- `birthday` is still written in runtime profile flows even though it is excluded from the target schema
- notifications remain exposed in frontend and backend surfaces even though `notifications` are out of scope
- local migration tooling for deterministic extract/transform/import is not implemented yet
- backend package scripts and dependencies still reflect MSSQL and SQLite, not PostgreSQL-first execution
- the test suite still depends heavily on SQLite in-memory behavior and current dual-provider assumptions

Conclusion: Phase 3 implementation should be treated as a coordinated backend platform conversion plus migration-tooling delivery effort. Current implementation risk is high.

## 2. Locked Inputs
The following Phase 2 artifacts should be treated as fixed inputs for later Phase 3 planning and implementation:

- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_B_DECISIONS.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_C_LIVE_DB_REPORT.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_E_MIGRATION_BLUEPRINT.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_F_VALIDATION_READINESS.md`

Locked decisions already approved and observed during discovery:
- PostgreSQL is the only approved target runtime database
- `notifications` are excluded from migration scope
- `user_profiles.birthday` is excluded from the target schema
- `users.auth0_sub` must be mandatory and unique
- `users.email` must be nullable and unique when present
- `todos.task_number` must be preserved and unique per user
- `user_profiles` must be one row per user keyed by `user_id`
- `user_settings` must be one row per user keyed by `user_id`
- `layout`, `subtasks`, and `recurrence` move to `jsonb`
- missing `user_profiles` and `user_settings` rows must be backfilled during migration
- default/global tags and user-owned tags remain part of the approved model

## 3. Backend Runtime Conversion Surface
The current backend runtime conversion surface is broad.

### 3.1 Datasource configuration
Primary files discovered:
- `backend/src/infra/db/data-source.js`
- `backend/data-source-migrations.js`
- `backend/.env.example`
- `backend/package.json`

Current state:
- application datasource is hardcoded to MSSQL
- migration datasource is hardcoded to MSSQL
- environment guidance is MSSQL-oriented
- backend dependencies include `mssql` and `sqlite3`, but not `pg` in `package.json`
- migration scripts still point at the current MSSQL datasource file

Implication for Phase 3:
- datasource setup must be redesigned around PostgreSQL
- env contract must be replaced or expanded for PostgreSQL runtime and local migration execution
- package dependencies and scripts must be updated to support PostgreSQL-first execution
- current migration CLI wiring cannot remain unchanged

### 3.2 Application startup and fallback behavior
Primary file discovered:
- `backend/src/index.js`

Current state:
- server startup initializes the current TypeORM datasource first
- when that path fails, runtime falls back to SQLite
- fallback mode creates local SQLite tables and wires SQLite repositories
- backend startup behavior still treats mixed-provider operation as acceptable

Implication for Phase 3:
- SQLite fallback removal is not a single flag change; startup behavior, repository selection, service wiring, and error handling all need rework
- runtime bootstrap must become deterministic around PostgreSQL success/failure only
- any local developer mode assumptions based on silent fallback will need replacement with explicit configuration and failure messaging

### 3.3 Repository implementation surface
Primary files discovered:
- `backend/src/infrastructure/TypeORMTodoRepository.js`
- `backend/src/infrastructure/TypeORMUserRepository.js`
- `backend/src/infrastructure/TypeORMUserProfileRepository.js`
- `backend/src/infrastructure/TypeORMUserSettingsRepository.js`
- `backend/src/infrastructure/SQLiteTodoRepository.js`
- `backend/src/infrastructure/SQLiteUserRepository.js`
- `backend/src/infrastructure/SQLiteTagRepository.js`

Current state:
- `TypeORMTodoRepository` still contains dialect branching, MSSQL-specific raw SQL, integer-boolean handling, and JSON-as-string handling
- `TypeORMUserSettingsRepository` still assumes surrogate `id` creation and string `layout` serialization
- `TypeORMUserProfileRepository` still operates within the current surrogate-key entity model
- SQLite repositories remain part of real runtime fallback behavior

Implication for Phase 3:
- repository logic must be normalized for PostgreSQL-backed entities and approved schema shapes
- JSON handling should move from text parsing/stringification toward native object/array persistence expectations
- integer flag assumptions must be removed in favor of native booleans
- MSSQL raw SQL branches need replacement or elimination
- SQLite repositories likely become removable or test-only legacy artifacts after runtime conversion

### 3.4 Entity and schema mapping surface
Primary files discovered:
- `backend/src/infra/db/entities/UserEntity.js`
- `backend/src/infra/db/entities/UserProfileEntity.js`
- `backend/src/infra/db/entities/UserSettingsEntity.js`
- `backend/src/infra/db/entities/TodoEntity.js`
- `backend/src/infra/db/entities/TagEntity.js`
- `backend/src/infra/db/entities/TodoTagEntity.js`
- `backend/src/migrations/1764826105992-initial_migration.js`

Current state:
- current entities still reflect MSSQL-oriented column types such as `uniqueidentifier`, `nvarchar`, `datetime`, and `bit`
- `UserProfileEntity` and `UserSettingsEntity` still retain surrogate `id` assumptions that are not part of the approved target schema
- current migration file is MSSQL-shaped and not a target PostgreSQL authority

Implication for Phase 3:
- entity definitions must be rebuilt around the approved PostgreSQL schema rather than incrementally patched around current MSSQL types
- `user_profiles` and `user_settings` need to move to `user_id`-keyed one-row-per-user models
- current migration history should not be treated as a reliable target-schema source

### 3.5 Runtime feature surfaces with database drift
Primary files discovered:
- `backend/src/index.js`
- `backend/src/application/NotificationService.js`
- `backend/src/middleware/attachCurrentUser.js`

Current state:
- profile write flows still handle `birthday`
- notification service persists only when a SQLite handle is available
- notification routes remain exposed in the API surface
- middleware and surrounding comments still reflect current MSSQL-plus-TypeORM assumptions

Implication for Phase 3:
- runtime writes must stop persisting excluded fields
- notification behavior must be either removed, hard-disabled, or explicitly isolated from the approved migration/runtime scope
- backend request handling should be reviewed for schema-contract drift against the approved target

## 4. PostgreSQL Implementation Readiness Gaps
The main readiness gaps identified during discovery are below.

### 4.1 Platform and dependency gaps
- no PostgreSQL driver dependency is declared in `backend/package.json`
- no PostgreSQL-first datasource file is present
- no PostgreSQL migration datasource is present
- no clear local PostgreSQL environment contract exists in `.env.example`

### 4.2 Schema authority gaps
- current entities are not aligned to the approved target schema
- current migration artifacts are MSSQL-shaped and partially historical
- runtime and entity assumptions still compete with the approved target schema document

### 4.3 Runtime contract gaps
- startup still accepts provider fallback instead of enforcing one supported provider
- repositories still assume stringified JSON, integer booleans, and mixed SQL dialect logic
- profile/settings persistence still assumes old shapes
- excluded fields and excluded tables still leak into runtime behavior

### 4.4 Operational tooling gaps
- no implemented extract tooling for MSSQL export
- no implemented transform staging pipeline for approved normalization rules
- no implemented PostgreSQL import pipeline
- no implemented validation harness that compares source and target evidence as described in Phase 2

### 4.5 Test readiness gaps
- tests heavily depend on SQLite in-memory behavior
- some tests encode MSSQL environment assumptions
- there is no visible PostgreSQL-backed integration harness for backend runtime validation

## 5. ETL Implementation Surface
Discovery found that the approved logical migration path exists as design only. The implementation surface still needs to be built.

### 5.1 Existing script landscape
Files discovered with relevance to migration and data operations:
- `backend/scripts/init-db.js`
- `backend/scripts/mark-migrations-applied.js`
- `backend/scripts/verify-connection-v2.js`
- `backend/scripts/test-mssql-connection.js`
- `backend/src/scripts/reset-db.js`
- `backend/src/scripts/soft-reset-db.js`
- `backend/scripts/inspect_attachments_schema.js`
- `backend/scripts/test-db.js`

Observed reality:
- these scripts are current-state operational helpers, not an end-to-end ETL implementation
- several are explicitly MSSQL-oriented
- migration-history management is still tied to current TypeORM patterns rather than approved offline logical migration stages

### 5.2 Missing ETL phases
The following implementation layers are still absent:
- deterministic source extraction with explicit approved column lists
- transform layer for booleans, timestamps, text normalization, JSON parsing, and quarantine handling
- backfill generation for missing `user_profiles` and `user_settings`
- tag contradiction enforcement and default-tag seeding logic in staging
- ordered PostgreSQL import runner
- post-import validation evidence collection

### 5.3 Data-shape transformations that will require code
The following transformations appear mandatory:
- convert SQL Server bit/int flags to PostgreSQL booleans
- parse `user_settings.layout` into object-shaped `jsonb`
- parse `todos.subtasks` into array-shaped `jsonb`
- parse `todos.recurrence` into nullable object-shaped `jsonb`
- drop `user_profiles.id`, `user_settings.id`, and `user_profiles.birthday`
- preserve stable business identifiers including `users.id`, `todos.id`, `tags.id`, `task_number`, and `original_id`
- normalize weekday values for `start_day_of_week`
- handle blank/invalid `email`, `role`, `subscription_status`, `theme`, and `locale`
- de-duplicate or quarantine orphaned `todo_tags`

### 5.4 Evidence and replay gaps
No implemented local workflow was found for:
- generating baseline row-count evidence before migration
- generating transform summaries and reject counts
- re-running transform/import deterministically from captured extract artifacts
- comparing import results against baseline expectations

## 6. Runtime-vs-Target Mismatch Inventory
This section summarizes the most important mismatches between current runtime behavior and the approved target state.

### 6.1 Provider model mismatch
Current:
- MSSQL-first with SQLite fallback

Target:
- PostgreSQL-only runtime

### 6.2 Entity shape mismatch
Current:
- MSSQL column types in entities
- surrogate `id` still present for `user_profiles` and `user_settings`

Target:
- PostgreSQL-native types
- `user_profiles` primary key = `user_id`
- `user_settings` primary key = `user_id`

### 6.3 Field contract mismatch
Current:
- runtime still writes `birthday`
- notifications still exist in live API and client integration points

Target:
- `birthday` excluded
- `notifications` excluded from approved migration/runtime direction

### 6.4 Data representation mismatch
Current:
- `layout`, `subtasks`, and `recurrence` are handled as strings in important backend paths
- boolean-like fields still use integer/bit assumptions in repository behavior

Target:
- JSON payloads stored and treated as `jsonb`
- booleans stored and treated as native booleans

### 6.5 Uniqueness and nullability mismatch
Current:
- schema and runtime history still reflect mixed legacy assumptions

Target:
- `users.auth0_sub` mandatory + unique
- `users.email` nullable + unique when present
- `todos.task_number` unique per user

### 6.6 Frontend/API contract drift worth noting
Discovery also found client-side surfaces that still reflect excluded or legacy behavior:
- `client/src/components/ProfilePanel.jsx` still handles `birthday`
- `client/src/utils/api.js` still exposes notification API calls
- `client/src/providers/NotificationPoller.jsx` still contains notification-related behavior, even if polling is currently disabled

These are not the core Phase 3 backend migration mechanics, but they are part of the broader runtime mismatch inventory and should be considered during planning.

## 7. Local Execution Prerequisites
To execute a local PostgreSQL runtime and local MSSQL-to-PostgreSQL migration path later, the following prerequisites appear necessary.

### 7.1 Environment prerequisites
- a locally reachable PostgreSQL instance for application runtime and import validation
- a reachable MSSQL source environment or stable source extract artifacts for migration rehearsals
- clearly defined environment variables for both source and target systems
- explicit documentation for local setup, credentials, and required schemas/databases

### 7.2 Backend package prerequisites
- add and validate PostgreSQL driver dependencies
- remove ambiguity about whether `mssql` and `sqlite3` remain required after conversion
- ensure TypeORM configuration supports the approved PostgreSQL target schema and local execution mode

### 7.3 Workflow prerequisites
- reproducible commands for starting backend against PostgreSQL only
- reproducible commands for extract, transform, import, and validation
- safe reset/reseed workflows for local PostgreSQL rehearsal environments
- clear handling for migration artifacts, staging files, and re-run cleanup

### 7.4 Documentation prerequisites
- update backend environment documentation
- document local migration rehearsal steps
- document expected evidence outputs and acceptance checks
- document failure handling and rerun behavior for local ETL execution

## 8. Validation Implementation Surface
Phase 2 defined validation expectations, but the implementation surface still needs to be built.

### 8.1 Source and target evidence collection
Implementation is still needed for:
- source row counts by in-scope table
- target row counts by imported table
- uniqueness checks for `auth0_sub`, nullable `email`, per-user `task_number`, and composite `todo_tags`
- foreign key integrity checks
- backfill verification for missing profile/settings rows
- transform reject/quarantine summaries

### 8.2 Runtime validation
Implementation is still needed for:
- backend startup validation against PostgreSQL-only configuration
- smoke checks for authenticated user upsert flows
- profile/settings read/write validation against the approved schema contract
- todo create/list/update/export/statistics flows under PostgreSQL
- tag creation and association flows under the approved ownership rules

### 8.3 Test-suite conversion surface
Relevant discovery signals:
- many backend tests still use SQLite directly
- some tests assume MSSQL env variables or current datasource behavior
- current integration and repository tests are not yet aligned to PostgreSQL-only execution

Expected validation work:
- replace or isolate SQLite-backed tests that currently encode legacy runtime behavior
- introduce PostgreSQL-backed integration coverage for critical repositories and routes
- update fixtures and factories to match approved schema shapes and JSON/boolean behavior
- review client integration tests that assume old profile or notification contracts

### 8.4 Operational validation tooling
Implementation is still needed for:
- migration dry-run summaries
- post-import diff reports
- local acceptance checklist automation where practical
- failure classification for transform, import, and integrity errors

## 9. Recommended Inputs for Phase 3 Planning
The next planning phase should enter with the following explicit inputs and decisions.

### 9.1 Required planning inputs
- final accepted list of in-scope backend files to convert first
- decision on whether current TypeORM entities will be rewritten in place or replaced through a staged compatibility path
- decision on whether old SQLite repositories are deleted immediately or retained temporarily behind tests only
- decision on whether notification routes are removed now or isolated behind a disabled feature contract
- decision on whether frontend `birthday` and notification surfaces are included in the same workstream or tracked separately

### 9.2 Recommended workstream slicing
A practical Phase 3 planning split appears to be:
1. PostgreSQL runtime foundation
2. target-schema entity/repository conversion
3. startup and API contract cleanup
4. local ETL implementation
5. validation harness and automated tests
6. docs and developer workflow updates

### 9.3 Recommended acceptance gates
Planning should define explicit gates for:
- backend boots only against PostgreSQL
- approved schema is the sole runtime authority
- no runtime writes depend on excluded fields/tables
- ETL can run locally end to end on rehearsal data
- validation outputs are reproducible and reviewable
- core route and repository tests pass under the new provider model

## 10. Risks and Watchouts
Key risks identified during discovery:

### 10.1 Broad coupling risk
Database-provider assumptions are embedded across startup, repositories, entities, scripts, and tests. This increases regression risk during conversion.

### 10.2 Hidden fallback behavior risk
Current SQLite fallback may be masking failures or assumptions in local development. Removing it may expose previously hidden startup and repository issues.

### 10.3 Schema drift risk
If implementation uses current entities or legacy migrations as truth instead of the locked Phase 2 schema documents, drift will reappear quickly.

### 10.4 ETL data-quality risk
JSON parsing, boolean normalization, orphaned associations, duplicate one-to-one rows, and contradictory tag ownership rules can all create transform failures that need explicit handling.

### 10.5 Test churn risk
A meaningful portion of backend test coverage appears tied to SQLite or current provider assumptions. Test conversion could be large enough to affect schedule and confidence if left late.

### 10.6 Contract drift risk outside backend core
Frontend surfaces still reference `birthday` and notifications. If backend cleanup happens without coordinated contract review, user-facing regressions or dead API flows may remain.

## 11. Appendix

### 11.1 Files most relevant to later implementation planning
Backend runtime and config:
- `backend/src/index.js`
- `backend/src/infra/db/data-source.js`
- `backend/data-source-migrations.js`
- `backend/.env.example`
- `backend/package.json`

Entities and repositories:
- `backend/src/infra/db/entities/UserEntity.js`
- `backend/src/infra/db/entities/UserProfileEntity.js`
- `backend/src/infra/db/entities/UserSettingsEntity.js`
- `backend/src/infra/db/entities/TodoEntity.js`
- `backend/src/infra/db/entities/TagEntity.js`
- `backend/src/infra/db/entities/TodoTagEntity.js`
- `backend/src/infrastructure/TypeORMTodoRepository.js`
- `backend/src/infrastructure/TypeORMUserRepository.js`
- `backend/src/infrastructure/TypeORMUserProfileRepository.js`
- `backend/src/infrastructure/TypeORMUserSettingsRepository.js`
- `backend/src/infrastructure/SQLiteTodoRepository.js`
- `backend/src/infrastructure/SQLiteUserRepository.js`
- `backend/src/infrastructure/SQLiteTagRepository.js`

Scripts and migrations:
- `backend/src/migrations/1764826105992-initial_migration.js`
- `backend/scripts/init-db.js`
- `backend/scripts/mark-migrations-applied.js`
- `backend/scripts/verify-connection-v2.js`
- `backend/scripts/test-mssql-connection.js`
- `backend/src/scripts/reset-db.js`
- `backend/src/scripts/soft-reset-db.js`

Validation/test surfaces:
- `backend/test/**`
- `client/src/components/ProfilePanel.jsx`
- `client/src/utils/api.js`
- `client/src/providers/NotificationPoller.jsx`

### 11.2 Discovery conclusion
Phase 3 implementation is feasible, but it should be planned as a high-risk, multi-surface conversion effort rather than a narrow migration-script task.
