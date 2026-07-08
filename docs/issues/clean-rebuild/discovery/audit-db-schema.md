# Lifeline production PostgreSQL schema audit

## Migration mechanism & apply order

| # | Source | Mechanism | Applied |
|---|--------|-----------|---------|
| 1 | `backend/src/migrations/1764826105992-initial_migration.js` (`InitialPostgresSchema1764826105992`) | TypeORM `migration:run` at every container boot — `backend/scripts/start-container.js:29` via `backend/data-source-migrations.js` (glob `src/migrations/*.js`, non-recursive) | auto |
| 2 | `backend/src/migrations/1772862400000-add-mcp-api-keys.js` (`AddMcpApiKeys1772862400000`) | same | auto |
| 3 | `backend/migrations/008_enable_pg_trgm_similarity.sql` | **manual** `docker exec … psql` (documented runbook `docs/issues/mcp-server/step-09-everyday-task-fluency/implementation/release-preparation.md:31-40` — 008 run before 007) | manual, outside TypeORM ledger |
| 4 | `backend/migrations/007_backfill_subtask_identity.sql` | manual psql; **data-only** PL/pgSQL DO block (adds `subtaskId` uuid + 1-based `position` to each element of `todos.subtasks` jsonb); uses `gen_random_uuid()` (built-in, prod = `postgres:16-alpine` per `compose.production.yaml:3`) | manual, no DDL |

- `synchronize: false` (`backend/src/infra/db/data-source-options.js:36`) — no schema sync at runtime.
- TypeORM auto-creates its ledger table **`migrations`** (default name; `id serial PK, timestamp bigint NOT NULL, name varchar NOT NULL`) — runtime DDL, not in any migration file.
- Database itself created by postgres image `POSTGRES_DB` (compose) or `backend/scripts/init-db.js` (`CREATE DATABASE`, local only).
- All DDL uses `IF NOT EXISTS`; seed of 10 default tags happens inside migration 1 (idempotent per-name insert).

## Extensions
- **pg_trgm** — required (manual 008); consumed by `similarity()` in `backend/src/infrastructure/TypeORMTodoRepository.js:361-362` (`findSimilarByTitle`). ILIKE fallback exists only in docs/plans, NOT in code — if extension missing, query errors.
- No pgcrypto/uuid-ossp needed (`gen_random_uuid()` native on PG≥13).

## Tables (7 live + `migrations` ledger)

### users
| column | type | null | default |
|---|---|---|---|
| id | text | NO | — (PK) |
| auth0_sub | text | NO | — |
| email | text | YES | — |
| name | text | YES | — |
| picture | text | YES | — |
| role | text | NO | `'free'` |
| subscription_status | text | NO | `'none'` |
| created_at | timestamptz | NO | `now()` |
| updated_at | timestamptz | NO | `now()` |

Checks: `chk_users_id_not_blank` `char_length(trim(id))>0`; `chk_users_auth0_sub_not_blank`; `chk_users_email_not_blank` (`email IS NULL OR char_length(trim(email))>0`).
Indexes: `ux_users_auth0_sub` UNIQUE(auth0_sub); `ux_users_email_not_null` UNIQUE(lower(email)) WHERE email IS NOT NULL; `ix_users_role`(role); `ix_users_subscription_status`(subscription_status).

### user_profiles
| column | type | null | default |
|---|---|---|---|
| user_id | text | NO | — (PK) |
| first_name / last_name / phone / country / city / timezone / avatar_url | text | YES | — |
| onboarding_completed | boolean | NO | `false` |
| start_day_of_week | text | NO | `'Monday'` |
| created_at / updated_at | timestamptz | NO | `now()` |

FK: `fk_user_profiles_user` (user_id)→users(id) ON DELETE CASCADE ON UPDATE CASCADE.
Check: `chk_user_profiles_start_day_of_week` IN ('Monday'…'Sunday') — all 7 days (the 3-day MSSQL check in `006_*.sql` is dead).
Indexes: `ix_user_profiles_onboarding_completed`(onboarding_completed); `ix_user_profiles_start_day`(start_day_of_week).

### user_settings
| column | type | null | default |
|---|---|---|---|
| user_id | text | NO | — (PK) |
| theme | text | NO | `'system'` |
| locale | text | NO | `'en'` |
| layout | jsonb | NO | `'{}'::jsonb` |
| created_at / updated_at | timestamptz | NO | `now()` |

FK: `fk_user_settings_user` →users(id) CASCADE/CASCADE. Checks: `chk_user_settings_theme_not_blank`, `chk_user_settings_locale_not_blank`, `chk_user_settings_layout_object` (`jsonb_typeof(layout)='object'`). No extra indexes. Live table (used by `attachCurrentUser.js`, `TypeORMUserSettingsRepository.js`).

### todos
| column | type | null | default |
|---|---|---|---|
| id | text | NO | — (PK) |
| user_id | text | NO | — |
| task_number | integer | NO | — (app-computed MAX+1 per user, `TypeORMTodoRepository.js:68`; **no sequence**) |
| title | text | NO | — |
| description | text | YES | — |
| due_date | timestamptz | YES | — |
| due_time | text | YES | — |
| is_completed | boolean | NO | `false` |
| is_flagged | boolean | NO | `false` |
| duration | integer | NO | `0` |
| priority | text | NO | `'medium'` |
| subtasks | jsonb | NO | `'[]'::jsonb` |
| "order" | integer | NO | `0` (reserved word, quoted) |
| recurrence | jsonb | YES | — |
| next_recurrence_due | timestamptz | YES | — |
| original_id | text | YES | — |
| archived | boolean | NO | `false` |
| created_at / updated_at | timestamptz | NO | `now()` |

FKs: `fk_todos_user` (user_id)→users(id) CASCADE/CASCADE; `fk_todos_original` (original_id)→todos(id) **ON DELETE SET NULL** ON UPDATE CASCADE.
Checks: `chk_todos_id_not_blank`; `chk_todos_title_not_blank`; `chk_todos_task_number_positive` (>0); `chk_todos_duration_non_negative` (>=0); `chk_todos_priority` IN ('low','medium','high'); `chk_todos_subtasks_array` (jsonb_typeof='array'); `chk_todos_recurrence_object` (NULL or jsonb_typeof='object').
Indexes: `ux_todos_user_task_number` UNIQUE(user_id,task_number); `ix_todos_user_archived_completed`(user_id,archived,is_completed); `ix_todos_user_due_date`(user_id,due_date); `ix_todos_user_flagged`(user_id,is_flagged); `ix_todos_next_recurrence_due`(user_id,next_recurrence_due) WHERE next_recurrence_due IS NOT NULL; `ix_todos_original_id`(original_id); `ix_todos_subtasks_gin` GIN(subtasks); `ix_todos_recurrence_gin` GIN(recurrence); `idx_todos_title_trgm` **GiST(title gist_trgm_ops)** (manual 008).
Subtasks jsonb element shape (post-007): `{subtaskId: uuid-string, position: int 1-based, …title/completed fields}`.

### tags
| column | type | null | default |
|---|---|---|---|
| id | text | NO | — (PK) |
| name | text | NO | — |
| color | text | NO | — |
| user_id | text | YES | — |
| is_default | boolean | NO | `false` |
| created_at / updated_at | timestamptz | NO | `now()` |

FK: `fk_tags_user` (user_id)→users(id) CASCADE/CASCADE.
Checks: `chk_tags_name_not_blank`; `chk_tags_color_not_blank`; `chk_tags_default_ownership` `((is_default=true AND user_id IS NULL) OR (is_default=false AND user_id IS NOT NULL))`.
Indexes: `ux_tags_default_name` UNIQUE((lower(name))) WHERE is_default=true AND user_id IS NULL; `ux_tags_custom_name_per_user` UNIQUE(user_id, lower(name)) WHERE is_default=false AND user_id IS NOT NULL; `ix_tags_default_user`(is_default,user_id); `ix_tags_user_id`(user_id) WHERE user_id IS NOT NULL; `ix_tags_defaults_only`(is_default) WHERE is_default=true.
Seed rows (migration 1, `backend/src/infra/db/defaultTags.js`): `default-work`/Work/#3B82F6, `default-personal`/Personal/#10B981, `default-health`/Health/#EF4444, `default-finance`/Finance/#F59E0B, `default-study`/Study/#6366F1, `default-family`/Family/#EC4899, `default-errands`/Errands/#6B7280, `default-ideas`/Ideas/#8B5CF6, `default-important`/Important/#DC2626, `default-misc`/Misc/#9CA3AF — all `user_id=NULL, is_default=true`.

### todo_tags
| column | type | null | default |
|---|---|---|---|
| todo_id | text | NO | — |
| tag_id | text | NO | — |
| created_at | timestamptz | NO | `now()` |

PK: (todo_id, tag_id). FKs: `fk_todo_tags_todo` →todos(id) CASCADE/CASCADE; `fk_todo_tags_tag` →tags(id) CASCADE/CASCADE. Index: `ix_todo_tags_tag_id`(tag_id).

### mcp_api_keys
| column | type | null | default |
|---|---|---|---|
| id | text | NO | — (PK) |
| user_id | text | NO | — |
| name | text | NO | — |
| key_prefix | text | NO | — |
| key_hash | text | NO | — |
| scopes | jsonb | NO | `'[]'::jsonb` |
| status | text | NO | `'active'` |
| expires_at / last_used_at | timestamptz | YES | — |
| last_used_ip / last_used_user_agent / revocation_reason | text | YES | — |
| revoked_at | timestamptz | YES | — |
| created_at / updated_at | timestamptz | NO | `now()` |

FK: `fk_mcp_api_keys_user` →users(id) CASCADE/CASCADE.
Checks: `chk_mcp_api_keys_id_not_blank`, `chk_mcp_api_keys_name_not_blank`, `chk_mcp_api_keys_prefix_not_blank`, `chk_mcp_api_keys_hash_not_blank`, `chk_mcp_api_keys_scopes_array` (jsonb_typeof='array'), `chk_mcp_api_keys_status` IN ('active','revoked','expired').
Indexes: `ux_mcp_api_keys_prefix` UNIQUE(key_prefix); `ix_mcp_api_keys_user_status`(user_id,status); `ix_mcp_api_keys_expires_at`(expires_at) WHERE NOT NULL; `ix_mcp_api_keys_last_used_at`(last_used_at) WHERE NOT NULL.

## Enums / sequences
- **No PostgreSQL ENUM types** — all constrained via text + CHECK (`priority`, `status`, `start_day_of_week`).
- **No user sequences**; only implicit serial on TypeORM `migrations.id`. `todos.task_number` is app-side MAX+1 guarded by `ux_todos_user_task_number`.

## Dead / non-authoritative artifacts (do NOT port)
- `backend/migrations/000_drop_all_tables.sql`, `001_initial_migration.sql`, `002_make_email_nullable.sql`, `004_drop_unique_email_on_users.sql`, `005_add_start_day_to_user_profiles.sql`, `006_add_check_constraint_start_day.sql` — **MSSQL-era** (NVARCHAR/dbo/GETDATE); docs explicitly mark as historical (`docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md:170-172`). No `003_*` exists.
- `backend/src/migrations/archived/*.js` (8 files, timestamps 1660000000000–1690880000000) — old MSSQL-era TypeORM migrations; **not matched** by the non-recursive glob, never run.
- `backend/db/mssql-init.sql` — MSSQL provisioning script, dead.
- `db/dev.sqlite` — sqlite relic, dead.
- Entity metadata (`backend/src/infra/db/entities/*.js`) matches the DDL (informational only since synchronize=false); minor drift: entities omit CHECKs/partial indexes and `todo_tags` relations lack onDelete — migration SQL is authoritative.

## Drizzle baseline = migrations 1 + 2 + `CREATE EXTENSION pg_trgm` + `idx_todos_title_trgm` GiST index, verbatim as tabled above.
