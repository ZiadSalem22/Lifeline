# Phase 2 Milestone A — Canonical Schema Reconciliation Baseline

## 1. Purpose
This artifact is the Milestone A schema reconciliation baseline for Phase 2.

It converts the backend schema story into one explicit matrix covering:
- one row per business-relevant table
- one row per business-relevant column
- source presence across:
  - TypeORM entity
  - active migration
  - archived migrations
  - manual SQL
  - SQLite fallback/bootstrap
  - runtime/repository expectation
- one status per item:
  - aligned
  - drifted
  - missing
  - legacy-only
  - decision-needed

This milestone does not finalize the PostgreSQL target schema. It identifies what is known, what conflicts, and what must be decided later.

## 2. Scope and source interpretation
Business-relevant tables covered:
- `users`
- `user_profiles`
- `user_settings`
- `todos`
- `tags`
- `todo_tags`
- `notifications`

Source columns in this artifact mean:
- Entity = current TypeORM `EntitySchema` definitions under [backend/src/infra/db/entities](backend/src/infra/db/entities)
- Active migration = the currently active TypeORM migration in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- Archived migrations = the older JS migration set under [backend/src/migrations/archived](backend/src/migrations/archived)
- Manual SQL = the manual SQL migration set under [backend/migrations](backend/migrations)
- SQLite fallback/bootstrap = startup fallback schema creation in [backend/src/index.js](backend/src/index.js), SQLite repositories under [backend/src/infrastructure](backend/src/infrastructure), and SQLite-only notification schema logic in [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)
- Runtime/repository expectation = explicit reads/writes/queries in runtime routes, services, and repositories

Important note on the old bootstrap SQL:
- The older MSSQL bootstrap script in [backend/db/mssql-init.sql](backend/db/mssql-init.sql) is not given its own presence column because the revised milestone requirements specified only the six source columns above.
- It still matters and is called out in notes where it materially increases drift.

## 3. Status legend
Presence values:
- Y = explicit presence
- P = partial or indirect presence
- N = not found in that source family

Status values:
- aligned = sources materially agree for current planning purposes
- drifted = item exists in multiple places but shape/rules/coverage differ
- missing = item is expected by current runtime or core schema intent but absent from a key source
- legacy-only = item exists only in legacy/fallback paths and is not part of the primary current schema story
- decision-needed = current evidence is insufficient to safely assume the future-state behavior/schema rule

## 4. Table-level reconciliation matrix

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `users` | Y | Y | P | Y | P | Y | drifted | `auth0_sub` is required by runtime but absent from active migration; SQLite path is partial only |
| table | `user_profiles` | Y | Y | Y | Y | N | Y | drifted | `start_day_of_week` exists in runtime/entity/manual SQL but not active migration; runtime also writes `birthday` |
| table | `user_settings` | Y | Y | Y | N | N | Y | drifted | Table exists in entity and active/archived migrations, but shape is inconsistent and no manual SQL baseline exists |
| table | `todos` | Y | Y | Y | Y | Y | Y | drifted | `task_number` is runtime-significant but missing from active migration and manual SQL baseline |
| table | `tags` | Y | Y | Y | Y | Y | Y | drifted | Default-tag behavior depends on archived migration logic; SQLite fallback omits user/default columns |
| table | `todo_tags` | Y | Y | P | Y | Y | Y | aligned | Join-table purpose is stable, though some historical DDL details differ |
| table | `notifications` | N | N | N | N | Y | Y | decision-needed | Exists only in SQLite-only notification flow; not represented in MSSQL/TypeORM schema sources |

## 5. Column-level reconciliation matrix

### 5.1 `users`
Primary evidence:
- [backend/src/infra/db/entities/UserEntity.js](backend/src/infra/db/entities/UserEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
- [backend/migrations/002_make_email_nullable.sql](backend/migrations/002_make_email_nullable.sql)
- [backend/migrations/004_drop_unique_email_on_users.sql](backend/migrations/004_drop_unique_email_on_users.sql)
- [backend/src/infrastructure/TypeORMUserRepository.js](backend/src/infrastructure/TypeORMUserRepository.js)
- [backend/src/middleware/attachCurrentUser.js](backend/src/middleware/attachCurrentUser.js)
- [backend/src/infrastructure/SQLiteUserRepository.js](backend/src/infrastructure/SQLiteUserRepository.js)

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `users` | Y | Y | P | Y | P | Y | drifted | Table exists broadly, but column rules do not reconcile cleanly |
| column | `id` | Y | Y | N | Y | P | Y | aligned | Stable user key in runtime and main schema sources |
| column | `auth0_sub` | Y | N | N | Y | P | Y | missing | Critical runtime/auth field is missing from active migration |
| column | `email` | Y | Y | N | Y | P | Y | drifted | Entity/runtime allow nullable behavior; active migration makes it `NOT NULL UNIQUE`; manual SQL later relaxes that |
| column | `name` | Y | Y | N | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `picture` | Y | Y | N | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `created_at` | Y | Y | N | Y | P | Y | aligned | Present across core sources; SQLite user repo also expects it |
| column | `updated_at` | Y | Y | N | Y | P | Y | aligned | Present across core sources; SQLite user repo also expects it |
| column | `role` | Y | Y | Y | Y | N | Y | aligned | Archived migration extends this and runtime uses it |
| column | `subscription_status` | Y | Y | Y | Y | N | Y | aligned | Runtime expects it and main sources agree materially |

### 5.2 `user_profiles`
Primary evidence:
- [backend/src/infra/db/entities/UserProfileEntity.js](backend/src/infra/db/entities/UserProfileEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/migrations/archived/1660000001000-CreateUserProfilesTable.js](backend/src/migrations/archived/1660000001000-CreateUserProfilesTable.js)
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
- [backend/migrations/005_add_start_day_to_user_profiles.sql](backend/migrations/005_add_start_day_to_user_profiles.sql)
- [backend/migrations/006_add_check_constraint_start_day.sql](backend/migrations/006_add_check_constraint_start_day.sql)
- [backend/src/index.js](backend/src/index.js)
- [backend/src/infrastructure/TypeORMUserProfileRepository.js](backend/src/infrastructure/TypeORMUserProfileRepository.js)

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `user_profiles` | Y | Y | Y | Y | N | Y | drifted | Core table exists, but runtime-relevant columns are not fully represented in active migration |
| column | `id` | Y | Y | Y | Y | N | Y | aligned | Main profile key is consistent enough across core sources |
| column | `user_id` | Y | Y | Y | Y | N | Y | aligned | Stable FK identity column |
| column | `first_name` | Y | Y | Y | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `last_name` | Y | Y | Y | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `phone` | Y | Y | Y | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `country` | Y | Y | Y | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `city` | Y | Y | Y | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `timezone` | Y | Y | Y | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `avatar_url` | Y | Y | Y | Y | N | Y | aligned | Runtime reads/writes this consistently |
| column | `onboarding_completed` | Y | Y | Y | Y | N | Y | aligned | Present across all primary sources |
| column | `created_at` | Y | Y | Y | Y | N | Y | aligned | Present across all primary sources |
| column | `updated_at` | Y | Y | Y | Y | N | Y | aligned | Present across all primary sources |
| column | `start_day_of_week` | Y | N | N | Y | N | Y | missing | Runtime and entity expect it; active migration does not create it |
| column | `birthday` | N | N | N | N | N | Y | decision-needed | Runtime writes this field in [backend/src/index.js](backend/src/index.js), but no schema source defines it |

### 5.3 `user_settings`
Primary evidence:
- [backend/src/infra/db/entities/UserSettingsEntity.js](backend/src/infra/db/entities/UserSettingsEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/migrations/archived/1690880000000-CreateUserSettingsTable.js](backend/src/migrations/archived/1690880000000-CreateUserSettingsTable.js)
- [backend/src/infrastructure/TypeORMUserSettingsRepository.js](backend/src/infrastructure/TypeORMUserSettingsRepository.js)
- [backend/src/middleware/attachCurrentUser.js](backend/src/middleware/attachCurrentUser.js)
- [backend/src/index.js](backend/src/index.js)

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `user_settings` | Y | Y | Y | N | N | Y | drifted | Table is live in runtime, but the repo contains two materially different schema stories |
| column | `id` | Y | Y | Y | N | N | Y | decision-needed | Entity/active migration use UUID-like shape; archived migration uses `varchar(50)` |
| column | `user_id` | Y | Y | Y | N | N | Y | drifted | Same semantic column, but archived migration uses different size/type assumptions |
| column | `theme` | Y | Y | Y | N | N | Y | drifted | Same semantics, different length rules across entity vs archived migration |
| column | `locale` | Y | Y | Y | N | N | Y | drifted | Same semantics, different length rules across entity vs archived migration |
| column | `layout` | Y | Y | Y | N | N | Y | decision-needed | Runtime treats this as JSON-in-string; entity/active use `nvarchar(max)`, archived uses `text` |
| column | `created_at` | Y | Y | Y | N | N | P | aligned | Present across entity/active/archived definitions |
| column | `updated_at` | Y | Y | Y | N | N | P | aligned | Present across entity/active/archived definitions |

### 5.4 `todos`
Primary evidence:
- [backend/src/infra/db/entities/TodoEntity.js](backend/src/infra/db/entities/TodoEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/migrations/archived/1660000020000-UpdateTodoSchemaAndAddArchived.js](backend/src/migrations/archived/1660000020000-UpdateTodoSchemaAndAddArchived.js)
- [backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js](backend/src/migrations/archived/1669999999000-AddTaskNumberToTodos.js)
- [backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js](backend/src/migrations/archived/1670000000000-FixNullTaskNumber.js)
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
- [backend/src/index.js](backend/src/index.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js)

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `todos` | Y | Y | Y | Y | Y | Y | drifted | Table exists everywhere important, but `task_number` and fallback coverage do not align |
| column | `id` | Y | Y | Y | Y | Y | Y | aligned | Stable core key across major sources |
| column | `title` | Y | Y | Y | Y | Y | Y | aligned | Stable core column across major sources |
| column | `description` | Y | Y | Y | Y | Y | Y | aligned | Stable core column across major sources |
| column | `due_date` | Y | Y | Y | Y | Y | Y | aligned | Stable enough semantically across core sources |
| column | `is_completed` | Y | Y | N | Y | Y | Y | aligned | Core status flag is stable |
| column | `is_flagged` | Y | Y | N | Y | Y | Y | aligned | Core status flag is stable |
| column | `duration` | Y | Y | N | Y | Y | Y | aligned | Core numeric field is stable |
| column | `priority` | Y | Y | Y | Y | Y | Y | aligned | Present across all relevant source families |
| column | `due_time` | Y | Y | Y | Y | Y | Y | aligned | Present across all relevant source families |
| column | `subtasks` | Y | Y | Y | Y | Y | Y | aligned | JSON-as-string behavior is consistent enough for current reconciliation |
| column | `order` | Y | Y | N | Y | Y | Y | aligned | Core ordering column is present throughout current stack |
| column | `recurrence` | Y | Y | Y | Y | Y | Y | aligned | Present across all relevant source families |
| column | `next_recurrence_due` | Y | Y | Y | Y | Y | Y | aligned | Present across all relevant source families |
| column | `original_id` | Y | Y | Y | Y | Y | Y | aligned | Present across all relevant source families |
| column | `task_number` | Y | N | Y | N | Y | Y | missing | Runtime uses it heavily, but active migration and manual SQL baseline do not define it |
| column | `archived` | Y | Y | Y | Y | N | Y | drifted | Main runtime expects it, but SQLite fallback bootstrap omits it |
| column | `user_id` | Y | Y | Y | Y | Y | Y | aligned | Core ownership column is stable in current major sources |

### 5.5 `tags`
Primary evidence:
- [backend/src/infra/db/entities/TagEntity.js](backend/src/infra/db/entities/TagEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/migrations/archived/1660000030000-AddUserIdToTodosAndTags.js](backend/src/migrations/archived/1660000030000-AddUserIdToTodosAndTags.js)
- [backend/src/migrations/archived/1660000040000-AddDefaultTagsSupport.js](backend/src/migrations/archived/1660000040000-AddDefaultTagsSupport.js)
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
- [backend/src/index.js](backend/src/index.js)
- [backend/src/infrastructure/TypeORMTagRepository.js](backend/src/infrastructure/TypeORMTagRepository.js)
- [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js)

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `tags` | Y | Y | Y | Y | Y | Y | drifted | Table exists broadly, but default/user-owned tag behavior is not consistently represented in fallback code |
| column | `id` | Y | Y | P | Y | Y | Y | aligned | Stable tag key |
| column | `name` | Y | Y | Y | Y | Y | Y | aligned | Stable tag display field |
| column | `color` | Y | Y | Y | Y | Y | Y | aligned | Stable tag display field |
| column | `user_id` | Y | Y | Y | Y | N | Y | drifted | Primary runtime expects user-owned tags, but SQLite fallback schema does not include this |
| column | `is_default` | Y | Y | Y | Y | N | Y | drifted | Primary runtime expects default-tag semantics, but SQLite fallback schema does not include this |

### 5.6 `todo_tags`
Primary evidence:
- [backend/src/infra/db/entities/TodoTagEntity.js](backend/src/infra/db/entities/TodoTagEntity.js)
- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
- [backend/src/index.js](backend/src/index.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js)
- [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js)

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `todo_tags` | Y | Y | P | Y | Y | Y | aligned | Join-table intent and use are stable |
| column | `todo_id` | Y | Y | P | Y | Y | Y | aligned | Stable join column |
| column | `tag_id` | Y | Y | P | Y | Y | Y | aligned | Stable join column |

### 5.7 `notifications`
Primary evidence:
- [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)
- [backend/src/index.js](backend/src/index.js)

| Level | Item | Entity | Active migration | Archived migrations | Manual SQL | SQLite fallback / bootstrap | Runtime / repository | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| table | `notifications` | N | N | N | N | Y | Y | decision-needed | SQLite-only table with live endpoints, but no primary-schema representation |
| column | `id` | N | N | N | N | Y | Y | decision-needed | Exists only in SQLite notification implementation |
| column | `todo_id` | N | N | N | N | Y | Y | decision-needed | Exists only in SQLite notification implementation |
| column | `message` | N | N | N | N | Y | Y | decision-needed | Exists only in SQLite notification implementation |
| column | `scheduled_time` | N | N | N | N | Y | Y | decision-needed | Exists only in SQLite notification implementation |
| column | `sent_time` | N | N | N | N | Y | Y | decision-needed | Exists only in SQLite notification implementation |
| column | `is_sent` | N | N | N | N | Y | Y | decision-needed | Exists only in SQLite notification implementation |

## 6. Key Milestone A findings
1. There is no single schema authority.
   - Entities, active migration, archived migrations, manual SQL, and fallback code do not tell one consistent story.

2. The active TypeORM migration cannot be treated as canonical current truth.
   - It misses `users.auth0_sub`.
   - It misses `todos.task_number`.
   - It misses `user_profiles.start_day_of_week`.

3. Runtime writes at least one field that has no schema backing in any discovered source.
   - `user_profiles.birthday` is written in [backend/src/index.js](backend/src/index.js) but is not defined in any entity, migration, manual SQL artifact, or SQLite fallback path.

4. SQLite fallback is not just a provider swap.
   - It is a reduced schema mode.
   - `users`, `user_profiles`, and `user_settings` do not have a real fallback schema.
   - `tags.user_id`, `tags.is_default`, and `todos.archived` are also not faithfully represented in fallback bootstrap.

5. `notifications` is not part of the primary database model.
   - It is currently a SQLite-only storage feature exposed through runtime endpoints.
   - Its future cannot be inferred safely; it requires an explicit decision.

6. The most important unresolved schema conflicts for Milestone B are already clear.
   - `users.auth0_sub`
   - `users.email`
   - `todos.task_number`
   - `todos.archived` behavior in fallback contexts
   - `user_profiles.start_day_of_week`
   - `user_profiles.birthday`
   - `user_settings.id` and `user_settings.layout`
   - `tags.user_id`
   - `tags.is_default`
   - default-tag seed behavior
   - `notifications`

## 7. Milestone B decision queue produced by Milestone A
The following items should be carried directly into Milestone B as explicit decision records:
- choose the approved future schema source of truth
- decide the fate of SQLite fallback
- decide the fate of `notifications`
- resolve whether `birthday` is a real product field or accidental runtime drift
- resolve final `users.email` rules
- resolve final `users.auth0_sub` rule set
- resolve final `todos.task_number` behavior
- resolve final `user_profiles.start_day_of_week` rule set
- resolve final `user_settings` identity and payload storage strategy
- resolve whether default tags are seeded data, code-owned data, or legacy behavior

## 8. Milestone A exit assessment
Milestone A exit criteria are met.

Completed:
- every known business-relevant table has a table row
- every business-relevant column identified from current schema/runtime evidence has a column row
- every row includes the required source-presence columns
- every row has a status from the required status set
- the major conflicts that must feed Milestone B are explicit

Recommended next milestone under the revised order:
- Milestone C — Live MSSQL Inspection and Truth Capture
