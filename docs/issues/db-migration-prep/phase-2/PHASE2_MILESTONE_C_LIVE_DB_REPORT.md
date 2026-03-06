# Phase 2 Milestone C — Live MSSQL Inspection and Truth Capture

## 1. Executive Summary
Milestone C is complete.

A read-only live inspection of the current MSSQL database confirms that production truth does not match any single repository source exactly. The live database contains the six core tables used by the main application flow:
- `users`
- `user_profiles`
- `user_settings`
- `todos`
- `tags`
- `todo_tags`

The live database does not contain `notifications`.

The most important live findings are:
- live schema includes `users.auth0_sub`, `todos.task_number`, and `user_profiles.start_day_of_week`, which confirms the active TypeORM migration is not the live-schema authority
- live schema does **not** include `user_profiles.birthday`, confirming that current runtime writes target a column that is absent in production
- `users.email` is nullable in the live database, but a unique constraint still exists on it
- `user_settings` live shape aligns more closely with the older archived migration style than with the current entity/active migration story
- several user-linked tables use inconsistent `user_id` storage types/lengths and frequently lack foreign keys
- `notifications` remains SQLite-only behavior and is not part of the live MSSQL schema

Live data shape also shows partial adoption/backfill across user-adjacent tables:
- `users`: 7 rows
- `user_profiles`: 5 rows
- `user_settings`: 2 rows
- `todos`: 536 rows
- `tags`: 17 rows
- `todo_tags`: 564 rows

This means the migration design cannot assume all users already have corresponding profile/settings rows.

## 2. Inspection Method
Inspection was performed with a single read-only MSSQL session using the existing backend environment configuration.

Method characteristics:
- no schema changes
- no data changes
- no inserts, updates, deletes, or migrations
- metadata gathered from `INFORMATION_SCHEMA` and SQL Server catalog views
- data-shape checks limited to safe aggregates and distributions

Captured evidence included:
- table existence
- column names, types, nullability, defaults, and order
- primary keys, unique constraints, foreign keys, and indexes
- row counts
- selected aggregate quality/distribution checks for drift-sensitive fields

Scope covered:
- `users`
- `user_profiles`
- `user_settings`
- `todos`
- `tags`
- `todo_tags`
- `notifications`

## 3. Live Schema Inventory

### 3.1 `users`
Live status:
- exists: yes
- row count: 7

Live columns:
- `id` — `nvarchar(64)`, not null
- `email` — `nvarchar(255)`, null allowed
- `name` — `nvarchar(255)`, null allowed
- `picture` — `nvarchar(512)`, null allowed
- `created_at` — `datetime`, not null, default `getdate()`
- `updated_at` — `datetime`, not null, default `getdate()`
- `role` — `nvarchar(32)`, null allowed, default `NULL`
- `subscription_status` — `nvarchar(32)`, not null, default `'none'`
- `auth0_sub` — `nvarchar(128)`, not null

Live constraints/indexes:
- primary key on `id`
- unique constraint/index on `email`
- no unique constraint found on `auth0_sub`

### 3.2 `user_profiles`
Live status:
- exists: yes
- row count: 5

Live columns:
- `id` — `uniqueidentifier`, not null, default `newid()`
- `user_id` — `nvarchar(64)`, not null
- `first_name` — `nvarchar(100)`, null allowed
- `last_name` — `nvarchar(100)`, null allowed
- `phone` — `nvarchar(32)`, null allowed
- `country` — `nvarchar(64)`, null allowed
- `city` — `nvarchar(64)`, null allowed
- `timezone` — `nvarchar(64)`, null allowed
- `avatar_url` — `nvarchar(255)`, null allowed
- `onboarding_completed` — `bit`, not null, default `0`
- `created_at` — `datetime`, not null, default `getdate()`
- `updated_at` — `datetime`, not null, default `getdate()`
- `start_day_of_week` — `nvarchar(16)`, null allowed

Live constraints/indexes:
- primary key on `id`
- foreign key `user_id -> users.id`
- no unique constraint found on `user_id`
- no live `birthday` column
- no check constraint observed for `start_day_of_week`

### 3.3 `user_settings`
Live status:
- exists: yes
- row count: 2

Live columns:
- `id` — `varchar(50)`, not null
- `user_id` — `varchar(50)`, not null
- `theme` — `varchar(50)`, null allowed
- `locale` — `varchar(20)`, null allowed
- `layout` — `text`, null allowed
- `created_at` — `datetime`, not null, default `getdate()`
- `updated_at` — `datetime`, not null, default `getdate()`

Live constraints/indexes:
- primary key on `id`
- non-unique index on `user_id`
- no foreign key found on `user_id`
- no unique constraint found on `user_id`

### 3.4 `todos`
Live status:
- exists: yes
- row count: 536

Live columns:
- `id` — `nvarchar(64)`, not null
- `title` — `nvarchar(200)`, not null
- `description` — `nvarchar(2000)`, null allowed
- `due_date` — `datetime`, null allowed
- `is_completed` — `int`, not null, default `0`
- `is_flagged` — `int`, not null, default `0`
- `duration` — `int`, not null, default `0`
- `priority` — `nvarchar(16)`, null allowed, default `'medium'`
- `due_time` — `nvarchar(16)`, null allowed
- `subtasks` — `nvarchar(max)`, null allowed, default `'[]'`
- `order` — `int`, not null, default `0`
- `recurrence` — `nvarchar(max)`, null allowed
- `next_recurrence_due` — `datetime`, null allowed
- `original_id` — `nvarchar(64)`, null allowed
- `archived` — `int`, not null, default `0`
- `user_id` — `nvarchar(128)`, not null
- `task_number` — `int`, null allowed

Live constraints/indexes:
- primary key on `id`
- unique composite index on (`user_id`, `task_number`)
- no foreign key found on `user_id`

### 3.5 `tags`
Live status:
- exists: yes
- row count: 17

Live columns:
- `id` — `varchar(255)`, not null
- `name` — `nvarchar(255)`, not null
- `color` — `nvarchar(255)`, not null
- `user_id` — `nvarchar(128)`, null allowed
- `is_default` — `int`, not null, default `0`

Live constraints/indexes:
- primary key on `id`
- non-unique index on (`user_id`, `is_default`)
- no foreign key found on `user_id`

### 3.6 `todo_tags`
Live status:
- exists: yes
- row count: 564

Live columns:
- `todo_id` — `nvarchar(64)`, not null
- `tag_id` — `varchar(255)`, not null

Live constraints/indexes:
- composite primary key on (`todo_id`, `tag_id`)
- foreign key `todo_id -> todos.id`
- foreign key `tag_id -> tags.id`

### 3.7 `notifications`
Live status:
- exists: no

Implication:
- the live MSSQL database does not include the notification table used by the SQLite-only notification path

## 4. Drift-Field Findings

### 4.1 `users.auth0_sub`
Live result:
- present
- not nullable
- all 7 rows populated
- 7 distinct non-null values
- no duplicate groups found
- no unique constraint found

Meaning:
- live production truth confirms `auth0_sub` is a real required field
- Milestone A concern is validated: the active migration is missing a critical live column
- future target schema should decide whether uniqueness must be enforced at the database level

### 4.2 `users.email`
Live result:
- present
- nullable
- all current rows populated
- 7 distinct non-null values
- no duplicate groups found
- live database still has a unique constraint on `email`

Meaning:
- live state reflects a mixed outcome:
  - nullability appears relaxed
  - uniqueness was not dropped in this database
- this directly confirms drift between manual migration intent and live reality

### 4.3 `todos.task_number`
Live result:
- present
- currently no nulls across 536 rows
- composite uniqueness by (`user_id`, `task_number`) is enforced and currently clean

Meaning:
- `task_number` is not legacy residue; it is live operational data with enforced uniqueness semantics
- Milestone A concern is validated: active migration omission is materially wrong for current production truth

### 4.4 `user_profiles.start_day_of_week`
Live result:
- present
- values observed: `Sunday` and `Monday`
- no nullability enforcement issue visible from aggregates
- no check constraint was observed in live metadata

Meaning:
- the field is real live schema, not just repo intent
- the constraint story is still drifted: the manual SQL history implies stronger rule intent than what is visible live

### 4.5 `user_profiles.birthday`
Live result:
- absent from live schema

Meaning:
- current runtime writes are targeting a field that does not exist in production MSSQL
- this is a confirmed repo-vs-live defect/risk, not just a documentation gap

### 4.6 `user_settings` identity and payload shape
Live result:
- `id` is `varchar(50)`
- `user_id` is `varchar(50)`
- `layout` is `text`
- only non-unique indexing on `user_id`
- no FK to `users`

Meaning:
- live schema aligns more closely with the archived `user_settings` story than with the current entity/active migration story
- there is still no database-level one-settings-per-user guarantee

### 4.7 `tags.user_id` and `tags.is_default`
Live result:
- both columns are present
- distribution is cleanly split:
  - 10 rows are default tags with `user_id = NULL`
  - 7 rows are custom tags with non-null `user_id`
  - 0 rows violate that observed pattern

Meaning:
- live data strongly suggests an intended dual model:
  - global default tags
  - user-owned custom tags
- fallback SQLite schema is not a faithful representation of this live model

### 4.8 `notifications`
Live result:
- table absent

Meaning:
- live MSSQL confirms `notifications` is not part of the primary database model today

## 5. Live Data-Shape Findings

### 5.1 User identity quality
Observed:
- `auth0_sub` has no nulls and no duplicates
- `email` has no nulls in current data and no duplicates
- `role` is uniformly `free`
- `subscription_status` is uniformly `none`

Interpretation:
- current data is clean, but the database is not enforcing all of the identity assumptions the application may rely on

### 5.2 Partial auxiliary-user-table coverage
Observed:
- 7 `users`
- 5 `user_profiles`
- 2 `user_settings`

Interpretation:
- not all users have profile rows
- not all users have settings rows
- migration and app logic must tolerate missing secondary records and possibly backfill them deliberately

### 5.3 `todos` quality and scale
Observed:
- 536 todos total
- 0 null `task_number`
- 0 duplicate (`user_id`, `task_number`) groups
- 0 null `user_id`
- `archived` distribution:
  - `0`: 395
  - `1`: 141

Interpretation:
- task numbering is actively populated and consistent
- archived state is materially used in live data and cannot be treated as optional legacy residue

### 5.4 `user_profiles.start_day_of_week` usage
Observed:
- `Sunday`: 3
- `Monday`: 2

Interpretation:
- live values appear normalized to known weekday names
- rule enforcement may currently be application-level rather than database-level

### 5.5 `user_settings.layout` usage
Observed:
- 2 rows total
- `layout` nulls: 0
- max length: 34
- min non-null length: 34
- `locale` nulls: 2

Interpretation:
- `layout` is being used as a serialized payload
- `locale` is structurally present but unused in current data sample

### 5.6 Tag model usage
Observed:
- 17 tags total
- 10 defaults with null `user_id`
- 7 custom with non-null `user_id`
- no contradictory combinations seen

Interpretation:
- live data is internally coherent and supports keeping both concepts in the target model if product wants that behavior preserved

## 6. Repo-vs-Live Comparison

### 6.1 Active migration vs live schema
Confirmed mismatches:
- active migration omits `users.auth0_sub`, but live has it as required
- active migration omits `todos.task_number`, but live has it populated and uniquely indexed per user
- active migration omits `user_profiles.start_day_of_week`, but live has it in active use

Conclusion:
- the active migration is not a reliable representation of current production truth

### 6.2 Runtime vs live schema
Confirmed mismatch:
- runtime writes `user_profiles.birthday`, but live schema does not contain that column

Conclusion:
- this is an immediate correctness risk that must become a formal Milestone B decision item

### 6.3 Manual SQL vs live schema
Confirmed mixed alignment:
- manual SQL intent to relax `users.email` nullability appears reflected in live schema
- manual SQL intent to drop unique email is **not** reflected in this live database, which still has a unique constraint
- manual SQL additions around `start_day_of_week` are reflected in the live schema column, but a related check constraint was not observed live

Conclusion:
- manual SQL history cannot be assumed fully applied to the inspected database

### 6.4 Archived migrations vs live schema
Confirmed alignment areas:
- `task_number` presence aligns with archived migration history
- `user_settings` type family aligns more closely with archived definitions
- tag default-support semantics are reflected in live data

Conclusion:
- some older migration history describes production more accurately than the so-called active baseline

### 6.5 SQLite fallback vs live schema
Confirmed divergence:
- live has no `notifications` table even though SQLite notification flow depends on one
- live tag ownership/default-tag semantics are richer than fallback schema
- live todo/archive/task-number semantics are richer than fallback assumptions
- live user/profile/settings model is not reproduced faithfully by fallback mode

Conclusion:
- SQLite fallback remains a reduced compatibility path, not a trustworthy schema mirror

## 7. Migration Impact Notes
1. The target PostgreSQL schema must be based on approved live/business truth, not on the active migration alone.

2. `task_number` must be treated as first-class migratable data with uniqueness semantics preserved.

3. `auth0_sub` must be treated as first-class identity data; database-level uniqueness should be explicitly decided.

4. `users.email` requires a formal policy decision because live state currently combines nullable storage with unique enforcement.

5. `user_profiles.birthday` cannot be migrated as an established field because it does not exist live; it requires a product/schema decision first.

6. `user_settings` needs a canonical redesign decision covering:
- identifier type
- `user_id` type and relationship enforcement
- whether one row per user is required
- how `layout` should be stored in PostgreSQL

7. User-linked key types need normalization. Current live widths/types differ across tables:
- `users.id`: `nvarchar(64)`
- `user_profiles.user_id`: `nvarchar(64)`
- `todos.user_id`: `nvarchar(128)`
- `tags.user_id`: `nvarchar(128)`
- `user_settings.user_id`: `varchar(50)`

8. Secondary-record backfill strategy is required because profile/settings coverage is incomplete.

9. `notifications` should not be included in core data migration unless Milestone B explicitly chooses to promote it into the supported primary model.

## 8. Risks, Unknowns, and Cautions
- This report is based on one inspected live database and should not be generalized automatically to every environment.
- Absence of duplicates in current data does not mean the database enforces the desired rule everywhere.
- Lack of an observed constraint in metadata does not prove the product does not depend on the rule at the application layer.
- `user_settings` may contain latent semantic meaning not visible from metadata and short aggregate checks alone.
- The `birthday` runtime/schema mismatch may already cause silent failures or partial-update behavior depending on route execution paths.
- The retained unique constraint on `users.email` suggests migration history may be partially applied or environment-specific.

## 9. Recommended Inputs for Milestone B
Milestone B should create explicit decisions for:
- canonical source of truth for future schema design
- whether live schema or repo intent wins when they conflict
- final rule for `users.auth0_sub` including uniqueness
- final rule for `users.email` including nullability and uniqueness
- whether `user_profiles.birthday` is a real product field or accidental runtime drift
- final allowed values and enforcement strategy for `user_profiles.start_day_of_week`
- final `user_settings` model, including identifier type, `user_id` constraint model, and payload storage shape
- whether global default tags plus user-owned custom tags is the approved permanent model
- whether `notifications` remains SQLite-only, is removed, or is promoted into the primary schema
- whether incomplete `user_profiles` and `user_settings` coverage should be backfilled during migration or lazily created later

## 10. Appendix

### 10.1 Live table existence summary
| Table | Exists | Row count |
|---|---:|---:|
| `users` | yes | 7 |
| `user_profiles` | yes | 5 |
| `user_settings` | yes | 2 |
| `todos` | yes | 536 |
| `tags` | yes | 17 |
| `todo_tags` | yes | 564 |
| `notifications` | no | n/a |

### 10.2 Key aggregate findings summary
| Area | Finding |
|---|---|
| `users.auth0_sub` | 0 nulls, 0 duplicate groups, no unique constraint observed |
| `users.email` | 0 nulls in data, 0 duplicate groups, unique constraint still present |
| `user_profiles.start_day_of_week` | values observed: `Sunday`, `Monday` |
| `user_profiles.birthday` | column absent |
| `user_settings.layout` | 2 non-null rows, serialized payload shape in use |
| `todos.task_number` | 0 nulls, unique per user enforced |
| `todos.archived` | 141 archived rows, 395 non-archived rows |
| `tags` | 10 global defaults, 7 user-owned custom tags |
| `notifications` | table absent |

### 10.3 Milestone C exit assessment
Milestone C exit criteria are met.

Completed:
- live MSSQL schema was inspected read-only
- live drift-sensitive fields were verified
- live data-shape evidence was captured safely
- Milestone A assumptions were validated or corrected against live truth
- the result is ready to feed Milestone B decision work
