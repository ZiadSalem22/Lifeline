# Phase 2 Milestone E — Migration Design and Data Movement Blueprint

## 1. Executive Summary
Milestone E is complete.

This blueprint defines the approved non-executed migration path from the current live MSSQL database to the approved PostgreSQL target schema defined in [PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md](PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md).

This document does not execute the migration. It defines:
- what to extract from MSSQL
- how to transform each dataset into target-compatible shape
- import sequencing and dependency order
- backfill and seed behavior
- retry and rollback thinking
- readiness assumptions for later implementation

Approved migration posture:
- perform a controlled offline-style logical migration, not an in-place engine conversion
- treat MSSQL as the authoritative source for in-scope persisted data
- exclude `notifications` and `user_profiles.birthday` from exported migration scope
- preserve stable identifiers and business-critical fields exactly unless a target-approved transform is required
- convert legacy representation drift during transform, not after import

## 2. Scope, Inputs, and Non-Goals

### 2.1 In-scope source tables
- `users`
- `user_profiles`
- `user_settings`
- `todos`
- `tags`
- `todo_tags`

### 2.2 Excluded source elements
- `notifications`
- runtime-only `user_profiles.birthday`
- SQLite fallback-only schema behavior
- non-approved surrogate keys being removed from target model:
  - `user_profiles.id`
  - `user_settings.id`

### 2.3 Locked inputs
This blueprint assumes the approved direction in:
- [PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md](PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md)
- [PHASE2_MILESTONE_B_DECISIONS.md](PHASE2_MILESTONE_B_DECISIONS.md)
- [PHASE2_MILESTONE_C_LIVE_DB_REPORT.md](PHASE2_MILESTONE_C_LIVE_DB_REPORT.md)
- [PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md](PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md)

### 2.4 Non-goals
This blueprint does not:
- execute export/import
- define deployment cutover steps
- define Docker or Compose setup
- implement migrations or scripts
- modify the live MSSQL database

## 3. Migration Strategy Overview
The approved migration path is a five-stage logical movement process:

1. **Baseline capture**
   - record pre-migration evidence from MSSQL
   - capture schema metadata and dataset counts
   - capture critical integrity/quality evidence

2. **Deterministic extract**
   - export only approved in-scope tables and columns
   - export in stable, repeatable ordering
   - preserve original identifiers and source keys required for joins

3. **Transform and normalize**
   - convert SQL Server-specific representations into PostgreSQL target shapes
   - apply boolean normalization
   - parse JSON-like text payloads
   - generate backfill rows
   - seed/validate global default tags
   - exclude intentionally dropped fields

4. **Ordered import into PostgreSQL target**
   - load parent tables first
   - load one-to-one tables after user base is present
   - load dependent many-to-many associations last
   - apply constraints/indexes in a way that supports deterministic validation

5. **Post-import verification**
   - run schema, count, uniqueness, FK, and business-flow checks
   - compare evidence against baseline
   - declare pass/fail readiness for later cutover planning

## 4. Source-to-Target Movement Matrix

| Source table / element | Target status | Movement action | Notes |
|---|---|---|---|
| `users` | retained | direct extract + normalize timestamps/text + preserve IDs | `auth0_sub` and `email` require integrity validation |
| `user_profiles` | retained | direct extract + collapse to `user_id` PK + exclude `id` | backfill missing users |
| `user_profiles.id` | excluded | do not import | not part of target schema |
| `user_profiles.birthday` | excluded | do not export/import into target | approved as runtime drift |
| `user_settings` | retained | direct extract + drop surrogate `id` + convert `layout` to `jsonb` | backfill missing users |
| `user_settings.id` | excluded | do not import | not part of target schema |
| `todos` | retained | direct extract + normalize booleans + convert JSON-like fields + preserve `task_number` | preserve lineage fields |
| `tags` | retained | direct extract + normalize `is_default` + enforce contradiction rules + seed defaults if needed | preserve global/default vs user/custom semantics |
| `todo_tags` | retained | direct extract after todo/tag identity validation | association load happens last |
| `notifications` | excluded | no export/import | out of migration scope |

## 5. Export Strategy

### 5.1 Export method
Approved approach:
- use logical table exports, not physical backup restoration
- export each in-scope table with explicit column lists matching approved transform inputs
- export in a reproducible machine-readable format suitable for deterministic transforms
- include ordered extracts keyed by stable identifiers to support retry and diffing

### 5.2 Export ordering
Export in this order:
1. `users`
2. `user_profiles`
3. `user_settings`
4. `todos`
5. `tags`
6. `todo_tags`

Rationale:
- parents and one-to-one tables should be available early for transform validation
- join-table export depends on underlying entity identity integrity

### 5.3 Export column guidance
Use explicit column lists only.

Approved extract columns:
- `users`: `id`, `auth0_sub`, `email`, `name`, `picture`, `role`, `subscription_status`, `created_at`, `updated_at`
- `user_profiles`: `user_id`, `first_name`, `last_name`, `phone`, `country`, `city`, `timezone`, `avatar_url`, `onboarding_completed`, `start_day_of_week`, `created_at`, `updated_at`
- `user_settings`: `user_id`, `theme`, `locale`, `layout`, `created_at`, `updated_at`
- `todos`: `id`, `user_id`, `task_number`, `title`, `description`, `due_date`, `due_time`, `is_completed`, `is_flagged`, `duration`, `priority`, `subtasks`, `order`, `recurrence`, `next_recurrence_due`, `original_id`, `archived`, `created_at`, `updated_at`
- `tags`: `id`, `name`, `color`, `user_id`, `is_default`, `created_at`, `updated_at` if present in the finalized extraction model; if timestamps are absent in the source, transform should supply target defaults during import
- `todo_tags`: `todo_id`, `tag_id`

### 5.4 Export readiness assumptions
Before export begins later:
- source row counts must be captured
- source uniqueness checks must pass or be documented
- source datasets must be extracted from a stable environment snapshot or controlled maintenance window
- source extraction must not include excluded tables/fields

## 6. Transform Strategy

### 6.1 General transform rules
Apply transforms in a staging layer before PostgreSQL import.

General rules:
- preserve source IDs unless the target explicitly removes the field
- normalize empty strings where the target expects meaningful text
- normalize timestamps into PostgreSQL-compatible UTC-aware values where possible
- reject or quarantine records that cannot be transformed deterministically
- produce per-table transform summaries and reject counts

### 6.2 Identifier handling
- preserve `users.id`, `todos.id`, and `tags.id` exactly
- preserve `user_id` references exactly while normalizing them to the target `text` type
- drop `user_profiles.id` and `user_settings.id`
- preserve `original_id` exactly, but set to `NULL` if the referenced source todo is intentionally absent from the approved migration set

### 6.3 Boolean normalization
Normalize SQL Server integer/bit-like flags to PostgreSQL booleans:
- `todos.is_completed`: `0 -> false`, `1 -> true`
- `todos.is_flagged`: `0 -> false`, `1 -> true`
- `todos.archived`: `0 -> false`, `1 -> true`
- `tags.is_default`: `0 -> false`, `1 -> true`
- `user_profiles.onboarding_completed`: SQL Server `bit` to PostgreSQL `boolean`

Handling rule:
- values outside approved boolean domains are transform failures unless an explicit one-time remediation rule is approved

### 6.4 JSON/text payload conversion
#### `user_settings.layout`
- source: text-like payload
- target: `jsonb object`
- transform rule:
  - parse source text as JSON
  - require top-level object
  - if null or blank, substitute approved default object
  - if invalid JSON, quarantine row for remediation or use a documented fallback conversion only if later approved

#### `todos.subtasks`
- source: JSON-like text, expected array semantics
- target: `jsonb array`
- transform rule:
  - parse source string
  - require top-level array
  - if null/blank, use empty array
  - invalid non-array payload is a transform failure unless repaired in staging

#### `todos.recurrence`
- source: JSON-like text or null
- target: `jsonb object` or null
- transform rule:
  - if null/blank, keep null
  - otherwise parse and require top-level object
  - invalid payload is a transform failure unless repaired in staging

### 6.5 `users` transform rules
- preserve `id`, `auth0_sub`, and `email`
- trim significant identity strings
- convert blank `email` to `NULL`
- enforce non-blank `auth0_sub`
- set missing/blank `role` to approved default `'free'`
- set missing/blank `subscription_status` to approved default `'none'`

### 6.6 `user_profiles` transform rules
- map one row per `user_id`
- if multiple profile rows exist per user in any environment, that is a transform conflict requiring deterministic merge or remediation before import
- normalize `start_day_of_week` values to approved weekday names
- if `start_day_of_week` is null or invalid, set to `'Monday'`
- drop excluded fields such as `birthday` and legacy surrogate `id`

### 6.7 `user_settings` transform rules
- map one row per `user_id`
- if multiple settings rows exist per user, choose the deterministic survivor by latest trustworthy timestamp if available; otherwise quarantine for remediation
- normalize `theme` blank/null to `'system'`
- normalize `locale` blank/null to `'en'`
- convert `layout` into valid `jsonb object`
- drop legacy surrogate `id`

### 6.8 `todos` transform rules
- preserve `id`, `user_id`, `task_number`, and `original_id`
- require non-null `user_id`
- require positive integer `task_number`
- preserve existing `task_number` exactly; do not renumber
- normalize `priority` to approved values `low`, `medium`, `high`; invalid values should default to `'medium'` only if approved by migration runbook, otherwise quarantine
- convert JSON-like fields as described above
- normalize integer flags to booleans

### 6.9 `tags` transform rules
- preserve `id`, `name`, `color`, `user_id`, and `is_default`
- normalize `is_default` to boolean
- enforce contradiction rule during transform:
  - if `is_default = true`, then `user_id` must become `NULL`
  - if `is_default = false`, then `user_id` must be non-null
- contradictory rows are transform failures unless repaired in staging according to approved rules
- normalize case/whitespace for name uniqueness comparisons while preserving display content policy chosen by implementation

### 6.10 `todo_tags` transform rules
- preserve associations only where both referenced target rows exist in the approved transformed set
- remove or quarantine orphaned associations before import
- de-duplicate repeated (`todo_id`, `tag_id`) pairs before load

## 7. Backfill and Seed Strategy

### 7.1 `user_profiles` backfill
Backfill rule:
- create one profile row for every `users.id` lacking a transformed profile row

Backfilled values:
- `user_id = users.id`
- nullable profile fields = `NULL`
- `onboarding_completed = false`
- `start_day_of_week = 'Monday'`
- `created_at` / `updated_at` = migration load timestamp unless a better source timestamp rule is later approved

### 7.2 `user_settings` backfill
Backfill rule:
- create one settings row for every `users.id` lacking a transformed settings row

Backfilled values:
- `user_id = users.id`
- `theme = 'system'`
- `locale = 'en'`
- `layout = {}` as target-compatible `jsonb`
- `created_at` / `updated_at` = migration load timestamp unless a better timestamp rule is later approved

### 7.3 Default tag seed behavior
Seed rule:
- preserve all valid existing global default tags found in source
- compare preserved defaults against the approved canonical default tag catalog
- insert any missing approved global defaults during the load process
- do not duplicate global default tags already present and semantically matching the approved catalog

Deferred content dependency:
- the exact canonical default tag catalog remains a content-level input that must be finalized before execution

### 7.4 Excluded elements handling
- `notifications`: no export, no staging, no import
- `user_profiles.birthday`: ignore if encountered in runtime-facing code or non-canonical export definitions; it is not part of the migration dataset
- removed surrogate keys: export may reference them for diagnostics, but import must not create them in the target schema

## 8. Import Order and Load Dependency Map

### 8.1 Import order
Approved load order:
1. `users`
2. `user_profiles`
3. `user_settings`
4. `todos`
5. `tags`
6. `todo_tags`

### 8.2 Import rationale
- `users` must exist before any `user_id` foreign key targets
- one-to-one user-owned tables should load before more complex transactional tables
- `todos` must exist before `todo_tags`
- `tags` must exist before `todo_tags`
- `todo_tags` must be last because it depends on both parents

### 8.3 Constraint/load posture
Recommended implementation posture later:
- create target schema first
- load transformed parent data before child data
- enforce primary and unique constraints during load where feasible
- if load performance later requires temporary relaxation of some non-PK indexes, that must still preserve correctness and be fully revalidated post-load

## 9. Table-by-Table Import Blueprint

### 9.1 `users`
Import behavior:
- insert all transformed users first
- validate `auth0_sub` uniqueness before load
- validate partial uniqueness for non-null email before load

### 9.2 `user_profiles`
Import behavior:
- load transformed existing rows
- append backfilled rows for missing users
- enforce one-row-per-user through PK on `user_id`

### 9.3 `user_settings`
Import behavior:
- load transformed existing rows
- append backfilled rows for missing users
- enforce one-row-per-user through PK on `user_id`
- validate `layout` shape before load

### 9.4 `todos`
Import behavior:
- load transformed todos after users exist
- validate every todo has a target user
- validate `task_number` uniqueness per user before load
- defer any todo rows with unresolved `original_id` references for staged repair or nulling according to approved transform rules

### 9.5 `tags`
Import behavior:
- load global defaults and user-owned customs after users exist
- validate contradiction rules before load
- ensure canonical default seed rows are present after preserved rows are loaded

### 9.6 `todo_tags`
Import behavior:
- load only after todos and tags are fully present
- exclude or quarantine orphaned pairs
- de-duplicate repeated pairs before insert

## 10. Failure, Retry, and Rollback Thinking

### 10.1 Retry model
The approved retry model is stage-based, not manual ad hoc reruns.

Required later behavior:
- export artifacts must be immutable for a given run
- transformed outputs must be reproducible from the same inputs
- import should be rerunnable from a clean target database or clean target schema reset state
- each stage must produce success/failure evidence before proceeding

### 10.2 Rollback posture
This phase does not define production cutover, but it does define migration rollback assumptions:
- target PostgreSQL load is disposable until validation passes
- MSSQL source remains untouched during Phase 2-designed migration execution
- rollback for a failed rehearsal or failed load means discarding the target load state and rerunning from preserved source extracts

### 10.3 Failure classes
Key failure classes to plan for later:
- duplicate or blank `auth0_sub`
- duplicate non-null `email`
- duplicate (`user_id`, `task_number`)
- multiple `user_profiles` or `user_settings` rows per user
- invalid JSON payloads in `layout`, `subtasks`, or `recurrence`
- contradictory tag rows
- orphaned `todo_tags`
- broken `original_id` lineage

### 10.4 Quarantine policy
Rows that cannot be safely transformed should not be silently coerced unless an explicit repair rule exists.

Approved posture:
- quarantine invalid records
- record row identifiers and reason codes
- require remediation or formally approved lossless repair rules before final execution

## 11. Environment and Readiness Assumptions
The later implementation phase should assume:
- a PostgreSQL target environment is available and matches the approved schema
- export tooling can read MSSQL safely without write access
- staging storage exists for raw extracts, transformed outputs, and validation artifacts
- enough run-time exists to perform full extraction, transform, and verification without source mutation during the run
- default tag catalog content is finalized before execution
- default settings payload content is finalized before execution

## 12. Recommended Inputs for the Next Phase
The later implementation phase should use this blueprint as the approved movement plan for:
- export scope
- transform logic
- import ordering
- backfill generation
- tag seeding behavior
- failure handling and rerun strategy
- excluded-scope enforcement

## 13. Appendix

### 13.1 High-risk transform hotspots
| Area | Risk | Required later handling |
|---|---|---|
| `users.auth0_sub` | uniqueness/blank values in non-inspected environments | pre-load validation + quarantine |
| `users.email` | duplicates where non-null | pre-load validation + partial unique load strategy |
| `user_settings.layout` | invalid JSON or non-object payloads | parse + object validation |
| `todos.subtasks` | invalid JSON or non-array payloads | parse + array validation |
| `todos.recurrence` | invalid JSON or wrong shape | parse + object-or-null validation |
| `todos.task_number` | duplicate or invalid values | pre-load uniqueness check |
| `tags` contradiction model | default/custom state mismatch | transform enforcement + quarantine |
| `todo_tags` | orphaned associations | dependent-row validation |

### 13.2 Approved no-migrate items
- `notifications`
- `user_profiles.birthday`
- legacy one-to-one surrogate keys not present in target schema
