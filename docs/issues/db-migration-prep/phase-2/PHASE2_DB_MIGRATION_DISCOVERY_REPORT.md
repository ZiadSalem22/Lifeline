# Phase 2 DB Migration Discovery Report

## 1. Executive Summary
The current backend database story is mixed and has no single clean source of truth.

Runtime is centered on MSSQL through TypeORM in [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js), but startup in [backend/src/index.js](backend/src/index.js) explicitly falls back to local SQLite when MSSQL initialization fails. The fallback only bootstraps a partial schema (`todos`, `tags`, `todo_tags`) and then enables a SQLite-only `notifications` table through [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js).

Schema definition is split across at least four live sources:
- TypeORM `EntitySchema` files in [backend/src/infra/db/entities](backend/src/infra/db/entities)
- an active TypeORM JS migration in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- legacy archived JS migrations in [backend/src/migrations/archived](backend/src/migrations/archived)
- manual MSSQL SQL files in [backend/migrations](backend/migrations) and [backend/db/mssql-init.sql](backend/db/mssql-init.sql)

Those sources drift materially. Important examples:
- `users.auth0_sub` exists in the entity and manual SQL, but is missing from the active JS migration.
- `users.email` is nullable and non-unique in current entity expectations, but `NOT NULL UNIQUE` in the active JS migration and initially `NULL UNIQUE` in manual SQL.
- `todos.task_number` exists in current entities and repositories, but is absent from the active JS migration and the manual SQL migration set.
- `user_profiles.start_day_of_week` exists in the entity and manual SQL patch files, but is absent from the active JS migration.
- default tag seeding exists only in archived migration logic, not in the active JS migration or manual SQL folder.
- `notifications` exists only in SQLite service code and is not represented in TypeORM or MSSQL migrations.

Bottom line: PostgreSQL migration is feasible, but discovery evidence points to a high-difficulty planning phase because schema reconstruction, provider-specific SQL removal, and SQLite-only behavior cleanup all need explicit design before implementation.

## 2. Current Database Architecture
- Providers present
  - MSSQL is the primary configured provider in [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js).
  - SQLite is a real secondary runtime path in [backend/src/index.js](backend/src/index.js) and a large test path throughout [backend/test](backend/test).
  - PostgreSQL is not configured anywhere in backend runtime code or package scripts; there is no first-class `pg` dependency in [backend/package.json](backend/package.json).
- Runtime selection and fallback
  - On startup, [backend/src/index.js](backend/src/index.js) first tries `AppDataSource.initialize()` for MSSQL.
  - If that fails, the app opens [db/dev.sqlite](db/dev.sqlite) through `sqlite3` and creates only `todos`, `tags`, and `todo_tags` directly in code.
  - In SQLite fallback, repositories switch to [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js) and [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js).
  - `NotificationService` is instantiated with the SQLite handle and creates `notifications` only when SQLite exists.
  - Auth/profile/settings paths remain TypeORM-centered even though fallback bootstraps no `users`, `user_profiles`, or `user_settings` tables.
- Schema sources in play
  - Current entities: [backend/src/infra/db/entities](backend/src/infra/db/entities)
  - Active TypeORM migrations source: [backend/data-source-migrations.js](backend/data-source-migrations.js) pointing only to [backend/src/migrations](backend/src/migrations)
  - Archived migrations still semantically important: [backend/src/migrations/archived](backend/src/migrations/archived)
  - Manual SQL migration folder: [backend/migrations](backend/migrations)
  - Manual bootstrap SQL: [backend/db/mssql-init.sql](backend/db/mssql-init.sql)
  - SQLite bootstrap logic: [backend/src/index.js](backend/src/index.js)
  - SQLite-only schema creation for notifications: [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)
- Key architectural observations
  - `synchronize: false` is set in both TypeORM data sources, so entities do not automatically enforce schema.
  - Schema management is split between a manual SQL era and a later TypeORM migration era.
  - A helper script, [backend/scripts/mark-migrations-applied.js](backend/scripts/mark-migrations-applied.js), manually inserts legacy migration names into the TypeORM `migrations` table, which is strong evidence that migration history was rewritten rather than cleanly converged.
  - Tests exercise both MSSQL-style TypeORM code and SQLite compatibility shims, especially for stats and task numbering.

## 3. Canonical Schema Source Assessment
There is no fully reliable single canonical schema source.

Most likely current runtime intent is closest to this combination:
1. current TypeORM entities in [backend/src/infra/db/entities](backend/src/infra/db/entities)
2. repository expectations in [backend/src/infrastructure](backend/src/infrastructure)
3. some behavior preserved by archived migrations in [backend/src/migrations/archived](backend/src/migrations/archived)

Why the active JS migration alone is not canonical:
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) omits `users.auth0_sub`, which current auth upsert code in [backend/src/infrastructure/TypeORMUserRepository.js](backend/src/infrastructure/TypeORMUserRepository.js) writes.
- It omits `todos.task_number`, which both TypeORM and SQLite todo repositories use heavily.
- It omits `user_profiles.start_day_of_week`, which profile endpoints in [backend/src/index.js](backend/src/index.js) read and write.
- It does not seed default tags, while current tag logic expects `is_default` rows to exist.
- It keeps `users.email` as `NOT NULL UNIQUE`, which conflicts with current entity settings and manual SQL follow-up scripts.

Why the manual SQL folder is not canonical either:
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql) includes `auth0_sub`, but it also lacks `user_settings` and `todos.task_number`.
- Follow-up SQL files patch only some drift (`email`, `start_day_of_week`, start-day check constraint) and do not cover all current repository expectations.
- [backend/db/mssql-init.sql](backend/db/mssql-init.sql) is even older and only provisions `todos`, `tags`, and `todo_tags` with outdated column shapes.

Likely drift points:
- `users`: nullable vs non-null email, unique vs non-unique email, missing `auth0_sub` in active JS migration
- `user_profiles`: missing `start_day_of_week` in active JS migration
- `user_settings`: different column types between entity/current migration and archived migration
- `todos`: missing `task_number` in active JS migration/manual SQL folder; type/length differences in older bootstrap SQL
- `tags`: default-tag seeding and indexing only exist in archived migration logic
- `notifications`: exists only in SQLite code, nowhere else

Practical assessment: current schema truth appears to live mainly in code expectations, not in a single migration chain.

## 4. Entity and Table Inventory

| Table / Entity | Business importance | TypeORM entity | Active JS migration | Archived JS migration | Manual SQL migration | SQLite bootstrap / repo | Notes |
|---|---|---|---|---|---|---|---|
| `users` | Critical auth/account identity | [backend/src/infra/db/entities/UserEntity.js](backend/src/infra/db/entities/UserEntity.js) | Partial in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) | Extended by [backend/src/migrations/archived/1660000000000-ExtendUsersWithRoleAndSubscriptionStatus.js](backend/src/migrations/archived/1660000000000-ExtendUsersWithRoleAndSubscriptionStatus.js) | Created in [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql); altered in [backend/migrations/002_make_email_nullable.sql](backend/migrations/002_make_email_nullable.sql) and [backend/migrations/004_drop_unique_email_on_users.sql](backend/migrations/004_drop_unique_email_on_users.sql) | Used by [backend/src/infrastructure/SQLiteUserRepository.js](backend/src/infrastructure/SQLiteUserRepository.js) but not created by fallback bootstrap | Entity expects `auth0_sub`; active JS migration does not create it |
| `user_profiles` | Critical onboarding/profile settings | [backend/src/infra/db/entities/UserProfileEntity.js](backend/src/infra/db/entities/UserProfileEntity.js) | Partial in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) | Created in [backend/src/migrations/archived/1660000001000-CreateUserProfilesTable.js](backend/src/migrations/archived/1660000001000-CreateUserProfilesTable.js) | Created in [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql); extended in [backend/migrations/005_add_start_day_to_user_profiles.sql](backend/migrations/005_add_start_day_to_user_profiles.sql) and [backend/migrations/006_add_check_constraint_start_day.sql](backend/migrations/006_add_check_constraint_start_day.sql) | No fallback bootstrap | Current runtime writes `start_day_of_week`; active JS migration omits it |
| `user_settings` | Important persisted preferences/layout/theme | [backend/src/infra/db/entities/UserSettingsEntity.js](backend/src/infra/db/entities/UserSettingsEntity.js) | Created in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) | Older incompatible shape in [backend/src/migrations/archived/1690880000000-CreateUserSettingsTable.js](backend/src/migrations/archived/1690880000000-CreateUserSettingsTable.js) | Not present in [backend/migrations](backend/migrations) | No fallback bootstrap | Strong evidence of drift in id/type/default strategy |
| `todos` | Core product table | [backend/src/infra/db/entities/TodoEntity.js](backend/src/infra/db/entities/TodoEntity.js) | Partial in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) | Modified by [backend/src/migrations/archived/1660000020000-UpdateTodoSchemaAndAddArchived.js](backend/src/migrations/archived/1660000020000-UpdateTodoSchemaAndAddArchived.js), [backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js](backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js), [backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js](backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js) | Created in [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql) | Created by fallback in [backend/src/index.js](backend/src/index.js); heavily used in [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js) | `task_number` is business-relevant and not represented in active JS or manual SQL migration chains |
| `tags` | Important for categorization and defaults | [backend/src/infra/db/entities/TagEntity.js](backend/src/infra/db/entities/TagEntity.js) | Created in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) | Modified/seeded in [backend/src/migrations/archived/1660000030000-AddUserIdToTodosAndTags.js](backend/src/migrations/archived/1660000030000-AddUserIdToTodosAndTags.js) and [backend/src/migrations/archived/1660000040000-AddDefaultTagsSupport.js](backend/src/migrations/archived/1660000040000-AddDefaultTagsSupport.js) | Created in [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql) | Created by fallback in [backend/src/index.js](backend/src/index.js); used in [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js) | Default-tag seeding appears only in archived migration logic |
| `todo_tags` | Critical join table for todo/tag relationships | [backend/src/infra/db/entities/TodoTagEntity.js](backend/src/infra/db/entities/TodoTagEntity.js) | Created in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) | Touched indirectly by todo schema changes | Created in [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql) | Created by fallback in [backend/src/index.js](backend/src/index.js); used by SQLite and TypeORM repos | Portable conceptually, but raw SQL around joins/deletes is provider-specific |
| `notifications` | Low-to-medium product importance; feature appears optional | None | None | None | None | Created only in [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js) when SQLite exists | SQLite-only feature table; not part of TypeORM schema |
| `migrations` | Internal migration bookkeeping | None | Implicit TypeORM internal table | Manipulated by [backend/scripts/mark-migrations-applied.js](backend/scripts/mark-migrations-applied.js) | None | None | Important only for deployment/reset/admin workflows |

## 5. Provider Usage Map

### 5.1 MSSQL-specific usage
- Data source and env model
  - [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js)
  - [backend/data-source-migrations.js](backend/data-source-migrations.js)
  - [backend/.env.example](backend/.env.example)
- MSSQL-only connection and inspection scripts
  - [backend/scripts/init-db.js](backend/scripts/init-db.js)
  - [backend/scripts/test-db.js](backend/scripts/test-db.js)
  - [backend/scripts/test-mssql-connection.js](backend/scripts/test-mssql-connection.js)
  - [backend/scripts/verify-connection-v2.js](backend/scripts/verify-connection-v2.js)
- MSSQL-only schema/admin routes in [backend/src/index.js](backend/src/index.js)
  - `/api/health/db/schema` uses `mssql` directly and queries `INFORMATION_SCHEMA`
  - `/api/reset-account` and import-replace paths use `@0` placeholders and SQL Server delete syntax
- Entity-level MSSQL assumptions
  - `nvarchar`, `datetime`, `bit`, `uniqueidentifier`
  - defaults like `GETDATE()`
  - generated ids relying on UUID/uniqueidentifier semantics
- Repository-level MSSQL assumptions
  - [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) uses `ISNULL`, `CONVERT(varchar(10), due_date, 23)`, and `OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY`
  - query placeholders are `@0`, `@1`, etc.
- Migration-level MSSQL assumptions
  - all manual SQL in [backend/migrations](backend/migrations)
  - all active and archived JS migrations rely on SQL Server catalog views, `OBJECT_ID`, `sys.indexes`, `sys.foreign_keys`, `NEWID()`, `NEWSEQUENTIALID()`, `GETDATE()`, or SQL Server DDL forms
- App features likely tied to MSSQL today
  - Auth0 user upsert and profile creation
  - user settings persistence
  - default/custom tag visibility rules
  - import replace path for authenticated users
  - stats/export aggregation in the default code path

### 5.2 SQLite-specific usage
- Fallback bootstrapping
  - [backend/src/index.js](backend/src/index.js) creates SQLite DB file and bootstraps `todos`, `tags`, and `todo_tags`
- SQLite repositories
  - [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js)
  - [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js)
  - [backend/src/infrastructure/SQLiteUserRepository.js](backend/src/infrastructure/SQLiteUserRepository.js)
- SQLite-only notification storage
  - [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)
  - comments explicitly state notifications are disabled when no SQLite DB is present
- SQLite SQL idioms
  - `INSERT OR REPLACE`
  - `LIMIT`
  - `strftime(...)`
  - `datetime("now")`
  - `?` placeholders
  - `COLLATE NOCASE`
- SQLite-heavy tests and smoke scripts
  - [backend/scripts/create-smoke.js](backend/scripts/create-smoke.js)
  - many suites under [backend/test](backend/test), especially SQLite repository, recurrence, concurrency, and integration smoke tests
- Feature areas still tied to SQLite behavior
  - local fallback todo/tag CRUD
  - local task-number sequencing in SQLite repository
  - notifications table and notification persistence
  - a large share of non-MSSQL test confidence

### 5.3 Provider-agnostic / portable usage
- High-level domain/use-case logic is mostly provider-neutral:
  - [backend/src/application/CreateTodo.js](backend/src/application/CreateTodo.js)
  - [backend/src/application/ListTodos.js](backend/src/application/ListTodos.js)
  - [backend/src/application/UpdateTodo.js](backend/src/application/UpdateTodo.js)
  - [backend/src/application/DeleteTodo.js](backend/src/application/DeleteTodo.js)
  - [backend/src/application/TagUseCases.js](backend/src/application/TagUseCases.js)
- Core table concepts are portable:
  - `users`, `user_profiles`, `user_settings`, `todos`, `tags`, `todo_tags`
- Many repository operations are portable in concept but not in current SQL syntax:
  - counts, aggregates, joins, date bucketing, tag filtering, import replacement

## 6. Raw SQL Inventory

| Location | Provider path | Purpose | Operation type | Portability concerns |
|---|---|---|---|---|
| [backend/src/index.js](backend/src/index.js) `/api/reset-account` | MSSQL | Delete current user’s todos, tags, settings | Write/admin | Uses `@0` placeholders; assumes direct table deletes without PostgreSQL syntax adaptation |
| [backend/src/index.js](backend/src/index.js) `/api/health/db` | Mostly portable | `SELECT 1` health probe | Read-only | Low risk |
| [backend/src/index.js](backend/src/index.js) `/api/health/db/schema` | MSSQL | Schema inspection through `INFORMATION_SCHEMA` and direct `mssql` connection | Schema inspection/admin | SQL Server catalog shape, connection model, and `mssql` driver are not portable |
| [backend/src/index.js](backend/src/index.js) fallback bootstrap | SQLite | Create minimal fallback tables | Schema bootstrap | SQLite DDL types and missing non-core tables make it unsuitable as PostgreSQL truth |
| [backend/src/index.js](backend/src/index.js) import replace section | MSSQL | Delete join rows for one user via joined delete; then delete user todos/custom tags | Write/import | `DELETE tt FROM ... JOIN ...` is SQL Server-specific |
| [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) `getMaxTaskNumber()` | MSSQL/SQLite branch | Next per-user task number | Read-only | MSSQL path uses `@0`; PostgreSQL needs new placeholders |
| [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) `findByFilters()` | MSSQL-leaning query builder | Search, archive filtering, date filtering, sort | Read-only | `ISNULL(...)` and some null-order logic are MSSQL-specific |
| [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) `getExportStatsForUser()` | Dual-path | Totals, completion stats, top tags, last-30-day grouping | Read-only analytics | MSSQL branch uses `ISNULL`, `CONVERT`, `OFFSET/FETCH`; SQLite branch uses `COALESCE`, `strftime`, `LIMIT`; PostgreSQL needs a third branch or query rewrite |
| [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) `getStatisticsForUserInRange()` | Dual-path | Range totals, tag stats, day grouping | Read-only analytics | Same portability issues as export stats |
| [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) `getStatisticsAggregated()` | Dual-path | Windowed stats and grouped trend output | Read-only analytics | Same portability issues as export stats |
| [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js) | SQLite | Full todo CRUD, filtering, aggregates, grouping, cleanup | Read/write | Uses SQLite-only syntax like `INSERT OR REPLACE`, `COLLATE NOCASE`, `strftime`, `LIMIT` |
| [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js) | SQLite | Tag CRUD and case-insensitive duplicate prevention | Read/write | Uses SQLite placeholder and transaction style |
| [backend/src/infrastructure/SQLiteUserRepository.js](backend/src/infrastructure/SQLiteUserRepository.js) | SQLite | User lookup/insert by Auth0 sub | Read/write | Unused in live fallback wiring; assumes a `users` table that fallback bootstrap never creates |
| [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js) | SQLite | Create `notifications`, insert/update/select/delete notifications | Schema + CRUD | Entire feature is SQLite-specific today |
| [backend/src/scripts/reset-db.js](backend/src/scripts/reset-db.js) | TypeORM over MSSQL | Drop DB and rerun migrations | Admin/destructive | Depends on current TypeORM migration chain correctness |
| [backend/src/scripts/soft-reset-db.js](backend/src/scripts/soft-reset-db.js) | MSSQL via TypeORM manager | Purge application data while keeping schema | Admin/destructive | Raw table-delete order and assumptions must be reevaluated for PostgreSQL |
| [backend/src/scripts/promote-admin.js](backend/src/scripts/promote-admin.js) | TypeORM | Update user role | Write/admin | Portable conceptually |
| [backend/scripts/init-db.js](backend/scripts/init-db.js) | MSSQL | Ensure database exists in `master` | Admin/bootstrap | Uses SQL Server `DB_ID`, `EXEC`, instance semantics |
| [backend/scripts/test-db.js](backend/scripts/test-db.js) | MSSQL | Initialize TypeORM datasource for manual connectivity test | Admin/test | MSSQL-only env and driver |
| [backend/scripts/test-mssql-connection.js](backend/scripts/test-mssql-connection.js) | MSSQL | Parse `MSSQL_URL` and open manual connection | Admin/test | MSSQL-only connection string model |
| [backend/scripts/verify-connection-v2.js](backend/scripts/verify-connection-v2.js) | MSSQL | Direct connection verification | Admin/test | MSSQL-only |
| [backend/scripts/mark-migrations-applied.js](backend/scripts/mark-migrations-applied.js) | MSSQL TypeORM metadata | Insert legacy migration names into `migrations` table | Admin/migration bookkeeping | Uses `@0` placeholders and reflects migration-history surgery |
| [backend/migrations](backend/migrations) | MSSQL | Manual DDL migration set | Migration/schema | Entire folder is SQL Server-specific |
| [backend/db/mssql-init.sql](backend/db/mssql-init.sql) | MSSQL | Old local bootstrap schema | Schema bootstrap | SQL Server-specific and stale relative to runtime expectations |

Summary of raw SQL rewrite pressure:
- Low rewrite pressure: simple counts and deletes
- Medium rewrite pressure: query-builder filters with MSSQL null/date functions
- High rewrite pressure: analytics/statistics queries, migration scripts, schema inspection, and notification storage if retained

## 7. SQLite Dependency Findings
SQLite is not just a dead library. It is still a live fallback path, but only for part of the product.

What definitely still depends on SQLite:
- startup fallback in [backend/src/index.js](backend/src/index.js)
- local todo/tag repositories in [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js) and [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js)
- notification persistence in [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)
- many tests and smoke scripts in [backend/test](backend/test) and [backend/scripts/create-smoke.js](backend/scripts/create-smoke.js)

Is SQLite only a local fallback?
- In production-intent code, yes: comments and control flow present SQLite as a fallback when MSSQL initialization fails.
- In practice, it is more than dead legacy because the app can start and serve todo/tag traffic on SQLite when MSSQL is unavailable.

Which features still depend on SQLite code paths?
- Todo CRUD and search in fallback mode
- Tag CRUD in fallback mode
- Task-number sequencing in fallback mode
- Notifications, including the only implementation of a `notifications` table
- A large share of regression tests

Which repositories/services are SQLite-only?
- [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js)
- [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js)
- [backend/src/infrastructure/SQLiteUserRepository.js](backend/src/infrastructure/SQLiteUserRepository.js)
- [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js) storage path

Do notifications truly depend on SQLite?
- Yes, based on current code.
- The service creates and uses `notifications` only when passed a SQLite `db` handle.
- Comments in [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js) and [backend/src/index.js](backend/src/index.js) explicitly state MSSQL/TypeORM mode disables notifications.

Does SQLite still look like intended product behavior or leftover compatibility code?
- Todo/tag fallback looks intentionally retained for local/dev survival.
- `SQLiteUserRepository` looks closer to leftover or incomplete compatibility code because fallback bootstrap never creates `users`, and fallback wiring does not switch auth/profile/settings repositories to SQLite.
- Notifications are legacy-compatible but still user-visible because endpoints remain exposed.

## 8. MSSQL Dependency Findings
MSSQL remains the dominant intended backend database path.

What startup/runtime paths depend on MSSQL:
- primary datasource initialization in [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js)
- authenticated user attach/upsert in [backend/src/middleware/attachCurrentUser.js](backend/src/middleware/attachCurrentUser.js)
- user/profile/settings repositories under [backend/src/infrastructure](backend/src/infrastructure)
- tag default/custom visibility logic
- import/replace authenticated data flow
- schema inspection and DB health endpoints in [backend/src/index.js](backend/src/index.js)

What scripts/tools assume MSSQL:
- [backend/scripts/init-db.js](backend/scripts/init-db.js)
- [backend/scripts/test-db.js](backend/scripts/test-db.js)
- [backend/scripts/test-mssql-connection.js](backend/scripts/test-mssql-connection.js)
- [backend/scripts/verify-connection-v2.js](backend/scripts/verify-connection-v2.js)
- [backend/src/scripts/reset-db.js](backend/src/scripts/reset-db.js)
- [backend/src/scripts/soft-reset-db.js](backend/src/scripts/soft-reset-db.js)
- [backend/scripts/mark-migrations-applied.js](backend/scripts/mark-migrations-applied.js)
- [backend/db/mssql-init.sql](backend/db/mssql-init.sql)
- [backend/migrations](backend/migrations)

What migrations/schema management assume MSSQL:
- all manual SQL migrations
- current active TypeORM migration
- archived migrations that inspect `sys.*` catalogs or rely on SQL Server DDL
- env templates centered on `MSSQL_*` variables in [backend/.env.example](backend/.env.example)

What app features likely rely on MSSQL-specific SQL or types:
- auth/user creation because `users` shape is tied to current TypeORM entity/migration mismatch
- profile onboarding because `start_day_of_week` and profile row creation depend on current schema state
- user settings persistence because current code assumes `user_settings` exists in the main DB
- analytics/export stats because TypeORM todo repo contains multiple MSSQL-specific aggregate queries
- default tag behavior because archived seeding/indexing logic was MSSQL-oriented
- task numbering because historical fixes were written with SQL Server assumptions

Is MSSQL essential or replaceable?
- Replaceable in principle.
- Not easily swappable in current code because provider-specific assumptions exist in startup, migrations, admin scripts, analytics queries, and entity types.

## 9. PostgreSQL Migration Complexity Assessment
- Schema: High
  - No clean schema source of truth.
  - Active migrations, archived migrations, manual SQL, bootstrap SQL, and entities disagree.
  - Before PostgreSQL DDL can be written, the team must choose the real target schema.
- Data: Medium to High
  - Table count is manageable.
  - Core data volume is likely modest relative to enterprise systems.
  - But migration logic must reconcile missing/extra columns such as `auth0_sub`, `task_number`, `start_day_of_week`, `user_settings`, default tags, and archived/nullable email rules.
  - `subtasks`, `recurrence`, and `layout` are JSON-as-string fields today; moving them safely may still be straightforward, but representation decisions are needed.
- Repositories: High
  - [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js) contains the heaviest query rewrite surface.
  - Current repository code branches between MSSQL and SQLite. PostgreSQL either becomes a third branch or triggers a repository simplification phase.
  - Auth/profile/settings repositories are less complex but still tied to current entity drift.
- Raw SQL: High
  - MSSQL-specific DDL and admin scripts are extensive.
  - Joined delete syntax, `ISNULL`, `CONVERT`, `OFFSET/FETCH`, `OBJECT_ID`, `sys.indexes`, and `NEWSEQUENTIALID` all need removal or replacement.
  - Notification SQL is SQLite-only and would need redesign if that feature is kept server-side.
- Startup/config: Medium
  - Replacing datasource env and driver usage is conceptually straightforward.
  - The hard part is deciding whether SQLite fallback survives, disappears, or becomes a different dev strategy.
  - Current startup mixes provider choice with application wiring.
- Feature behavior: High
  - Auth/user onboarding depends on schema fields that are currently inconsistent across migration sources.
  - Default tags depend on seed history that is not represented in the active migration chain.
  - Notification behavior is currently effectively disabled in MSSQL mode and SQLite-only when active.
  - Import/replace behavior uses provider-specific joined delete SQL.
  - Task numbering has historical repair migrations and per-user sequencing rules.
- Testing/validation: Medium
  - The project already has many focused tests that indicate what should be preserved.
  - But many tests are SQLite-based, so they are not enough to validate PostgreSQL parity by themselves.

Easy areas:
- swapping basic connection env names
- simple CRUD through TypeORM repositories once schema is settled
- moving simple lookup/count queries

Medium-risk areas:
- profile/settings persistence
- soft-reset and admin tooling
- import/export endpoints
- tag ownership/default-tag visibility

High-risk areas:
- deciding the canonical PostgreSQL schema
- replacing stats/export raw SQL
- preserving task-number semantics
- reconciling default-tag seed behavior
- deciding the fate of SQLite fallback and notifications

## 10. Plausible Migration Approach Candidates
1. Entity-led schema recreation + scripted data import
- Description
  - First reconcile entities to the intended PostgreSQL schema, then generate or hand-author a new PostgreSQL-first migration chain, then import data table by table.
- Pros
  - Aligns future runtime with current repository code more closely.
  - Good if the team wants a clean break from manual MSSQL SQL files.
- Cons
  - Dangerous unless schema drift is resolved first.
  - Current entities are not sufficient alone because they omit seed/index/history semantics.

2. Migration-led recreation from a curated new PostgreSQL baseline
- Description
  - Ignore current historical chain as executable truth; instead author one explicit PostgreSQL baseline schema that represents the approved final state, then import data.
- Pros
  - Best fit for the evidence that current migration history is already fractured.
  - Avoids porting old MSSQL-specific migration baggage.
- Cons
  - Requires an upfront canonical-schema decision workshop.
  - Historical down-migration fidelity will be lost.

3. Hybrid approach: canonical-schema spec first, then table-by-table import adapters
- Description
  - Build an approved schema matrix from entities + current runtime expectations + legacy migration facts, then write PostgreSQL schema and targeted import transforms.
- Pros
  - Most realistic given current repo mess.
  - Lets the team handle high-risk tables (`users`, `todos`, `tags`) differently from auxiliary ones (`user_settings`, `notifications`).
- Cons
  - Requires more discovery/planning before implementation.
  - More paperwork up front.

4. Temporary dual-read analysis phase before any migration build
- Description
  - Do one more planning phase that inventories actual live MSSQL schema/data shape, then choose a PostgreSQL target.
- Pros
  - Reduces risk caused by drift between repo and real database.
  - Especially valuable because [backend/scripts/mark-migrations-applied.js](backend/scripts/mark-migrations-applied.js) suggests historical schema may not match repo narratives.
- Cons
  - Slower.
  - Requires safe access to a representative current database later.

Most plausible based on repo evidence:
- Candidate 2 or 3.
- Candidate 1 alone is too optimistic because entities are not the whole truth.

## 11. Recommended Planning Inputs for Phase 2
The next planning step should focus on:
- producing a canonical schema matrix with one row per table/column/index/default/constraint
- deciding whether SQLite fallback is retained, replaced, or removed in the PostgreSQL future
- deciding whether `notifications` remains a server-side persisted feature at all
- resolving default-tag seed rules explicitly
- resolving `users.email` nullability/uniqueness rules explicitly
- resolving `users.auth0_sub` as mandatory schema, since runtime auth code depends on it
- resolving `todos.task_number` uniqueness/backfill semantics explicitly
- resolving whether `user_settings.id` stays UUID-like or becomes a different key strategy
- identifying which current admin/reset scripts matter in the future Compose deployment model
- defining a validation matrix using existing business tests as feature references, not as provider truth

## 12. Risks, Unknowns, and Blockers
- No single trustworthy schema source
- Active TypeORM migration and current entities materially disagree
- Manual SQL migration folder and active TypeORM migration chain also disagree
- Archived migrations still carry semantically important history such as default-tag seeding and task-number repairs
- Real live database shape may differ from repo due to manual fixes and migration-history marking
- SQLite fallback is partial, not full-product parity
- `notifications` is SQLite-only and unrepresented in primary schema management
- Some code paths appear semantically important even if legacy, especially around tags, task numbers, and onboarding profile fields
- Default tag seed behavior is not represented in the active migration chain
- Future Docker Compose target wants a single app + PostgreSQL stack, which increases pressure to remove provider ambiguity rather than preserve it

## 13. Appendix
### A. Entity files
- [backend/src/infra/db/entities/TodoEntity.js](backend/src/infra/db/entities/TodoEntity.js)
- [backend/src/infra/db/entities/TagEntity.js](backend/src/infra/db/entities/TagEntity.js)
- [backend/src/infra/db/entities/TodoTagEntity.js](backend/src/infra/db/entities/TodoTagEntity.js)
- [backend/src/infra/db/entities/UserEntity.js](backend/src/infra/db/entities/UserEntity.js)
- [backend/src/infra/db/entities/UserProfileEntity.js](backend/src/infra/db/entities/UserProfileEntity.js)
- [backend/src/infra/db/entities/UserSettingsEntity.js](backend/src/infra/db/entities/UserSettingsEntity.js)

### B. Migration files
- Active TypeORM migration
  - [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- Archived TypeORM migrations
  - [backend/src/migrations/archived/1660000000000-ExtendUsersWithRoleAndSubscriptionStatus.js](backend/src/migrations/archived/1660000000000-ExtendUsersWithRoleAndSubscriptionStatus.js)
  - [backend/src/migrations/archived/1660000001000-CreateUserProfilesTable.js](backend/src/migrations/archived/1660000001000-CreateUserProfilesTable.js)
  - [backend/src/migrations/archived/1660000020000-UpdateTodoSchemaAndAddArchived.js](backend/src/migrations/archived/1660000020000-UpdateTodoSchemaAndAddArchived.js)
  - [backend/src/migrations/archived/1660000030000-AddUserIdToTodosAndTags.js](backend/src/migrations/archived/1660000030000-AddUserIdToTodosAndTags.js)
  - [backend/src/migrations/archived/1660000040000-AddDefaultTagsSupport.js](backend/src/migrations/archived/1660000040000-AddDefaultTagsSupport.js)
  - [backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js](backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js)
  - [backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js](backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js)
  - [backend/src/migrations/archived/1690880000000-CreateUserSettingsTable.js](backend/src/migrations/archived/1690880000000-CreateUserSettingsTable.js)
- Manual SQL migration set
  - [backend/migrations/000_drop_all_tables.sql](backend/migrations/000_drop_all_tables.sql)
  - [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
  - [backend/migrations/002_make_email_nullable.sql](backend/migrations/002_make_email_nullable.sql)
  - [backend/migrations/004_drop_unique_email_on_users.sql](backend/migrations/004_drop_unique_email_on_users.sql)
  - [backend/migrations/005_add_start_day_to_user_profiles.sql](backend/migrations/005_add_start_day_to_user_profiles.sql)
  - [backend/migrations/006_add_check_constraint_start_day.sql](backend/migrations/006_add_check_constraint_start_day.sql)

### C. Provider-specific files
- MSSQL / TypeORM
  - [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js)
  - [backend/data-source-migrations.js](backend/data-source-migrations.js)
  - [backend/scripts/init-db.js](backend/scripts/init-db.js)
  - [backend/scripts/test-db.js](backend/scripts/test-db.js)
  - [backend/scripts/test-mssql-connection.js](backend/scripts/test-mssql-connection.js)
  - [backend/scripts/verify-connection-v2.js](backend/scripts/verify-connection-v2.js)
  - [backend/db/mssql-init.sql](backend/db/mssql-init.sql)
- SQLite
  - [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js)
  - [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js)
  - [backend/src/infrastructure/SQLiteUserRepository.js](backend/src/infrastructure/SQLiteUserRepository.js)
  - [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)
  - [backend/scripts/create-smoke.js](backend/scripts/create-smoke.js)

### D. Notification-related files
- [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)
- [backend/src/index.js](backend/src/index.js)

### E. Reset/admin scripts
- [backend/src/scripts/reset-db.js](backend/src/scripts/reset-db.js)
- [backend/src/scripts/soft-reset-db.js](backend/src/scripts/soft-reset-db.js)
- [backend/src/scripts/promote-admin.js](backend/src/scripts/promote-admin.js)
- [backend/scripts/mark-migrations-applied.js](backend/scripts/mark-migrations-applied.js)

### F. Test areas useful for later validation planning
- [backend/test/tags](backend/test/tags)
- [backend/test/profile](backend/test/profile)
- [backend/test/me](backend/test/me)
- [backend/test/export](backend/test/export)
- [backend/test/integration](backend/test/integration)
- [backend/test/migrations](backend/test/migrations)
- [backend/test/infrastructure](backend/test/infrastructure)
