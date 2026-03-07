# Phase 2 Milestone D — Approved Target PostgreSQL Schema Specification

## 1. Executive Summary
Milestone D is complete.

This document defines the approved target PostgreSQL schema for the in-scope Lifeline tables:
- `users`
- `user_profiles`
- `user_settings`
- `todos`
- `tags`
- `todo_tags`

The target schema intentionally excludes:
- `notifications`
- `user_profiles.birthday`

Major design choices:
- one explicit PostgreSQL schema becomes the canonical authority
- string-based legacy identifiers are normalized around PostgreSQL `text` rather than mixed SQL Server width-limited string variants
- `users.id` is the canonical user key type and every `user_id` reference uses the same PostgreSQL type with explicit foreign keys
- `user_profiles` and `user_settings` are modeled as one-row-per-user tables keyed directly by `user_id`
- `users.email` is nullable with uniqueness when present through a PostgreSQL partial unique index
- `users.auth0_sub` is mandatory, unique, and canonical for identity
- `todos.task_number` is retained with per-user uniqueness
- JSON-like application payloads move to `jsonb`
- tag ownership rules are encoded explicitly so default/global tags and user-owned custom tags cannot contradict each other
- migration must backfill missing profile and settings rows

## 2. Design Principles
1. Use one canonical schema authority, not competing migrations/entities/runtime drift.
2. Preserve required product behavior, not accidental historical residue.
3. Prefer PostgreSQL-native types and constraints where they materially improve clarity.
4. Normalize relationships and foreign keys explicitly.
5. Reduce nullable ambiguity unless product behavior requires it.
6. Preserve stable business identifiers already used by the application.
7. Treat content catalogs and default payload content separately from structural schema rules.

## 3. Canonical Type and Key Strategy

### 3.1 Canonical identifier strategy
- `users.id`: `text`
- all `user_id` foreign keys: `text`, referencing `users(id)`
- `todos.id`: `text`
- `tags.id`: `text`
- `todo_tags`: composite key of `todo_id text` + `tag_id text`
- `user_profiles`: keyed by `user_id text`, no surrogate `id`
- `user_settings`: keyed by `user_id text`, no surrogate `id`

### 3.2 UUID normalization decision
UUID-native keys are not retained as a target-schema requirement.

Approved rule:
- the target schema does **not** preserve the live MSSQL `user_profiles.id uniqueidentifier` pattern
- instead, profile identity is normalized to the owning user through `user_id`
- no in-scope target table requires a PostgreSQL `uuid` primary key

Rationale:
- existing application identity is already centered on string identifiers
- current IDs across important tables are not consistently UUID-based
- one-row-per-user tables do not need independent surrogate IDs

### 3.3 Shared type conventions
- business identifiers: `text`
- display/content strings with no firm bounded vocabulary: `text`
- booleans: `boolean`
- timestamps: `timestamptz`
- structured payloads: `jsonb`
- counters/order values: `integer`

### 3.4 Timestamp rule
Every table that currently carries lifecycle timestamps retains:
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Tables that do not currently need lifecycle timestamps in the product model remain without them.

## 4. Table Specifications

### 4.1 `users`
- Purpose:
  - canonical account and external-auth identity table

- Columns:

| Column | Type | Nullability | Default | Notes |
|---|---|---:|---|---|
| `id` | `text` | not null | none | canonical user key |
| `auth0_sub` | `text` | not null | none | canonical external identity |
| `email` | `text` | null | none | unique when present |
| `name` | `text` | null | none | display name |
| `picture` | `text` | null | none | avatar/profile image URL |
| `role` | `text` | not null | `'free'` | product role/status label |
| `subscription_status` | `text` | not null | `'none'` | billing/subscription state |
| `created_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |
| `updated_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |

- Primary Key:
  - `PRIMARY KEY (id)`

- Foreign Keys:
  - none

- Unique Constraints:
  - unique constraint on `auth0_sub`
  - partial unique index on `email` where `email IS NOT NULL`

- Indexes:
  - unique index on `auth0_sub`
  - partial unique index on `email`
  - non-unique index on `role`
  - non-unique index on `subscription_status`

- Check Constraints:
  - `char_length(trim(id)) > 0`
  - `char_length(trim(auth0_sub)) > 0`
  - if `email` is present, `char_length(trim(email)) > 0`

- Defaults:
  - `role default 'free'`
  - `subscription_status default 'none'`
  - `created_at default now()`
  - `updated_at default now()`

- Backfill / Seed Notes:
  - no schema-created backfill rows for `users`
  - migration must preserve every existing `id`, `auth0_sub`, and `email` value
  - other environments must be checked for duplicate or blank `auth0_sub`

- Notes / Rationale:
  - `auth0_sub` is the canonical identity anchor
  - `email` remains secondary and optional
  - partial unique indexing is the approved PostgreSQL implementation of “nullable but unique when present”

### 4.2 `user_profiles`
- Purpose:
  - one-to-one per-user profile and onboarding/preferences table for non-settings profile data

- Columns:

| Column | Type | Nullability | Default | Notes |
|---|---|---:|---|---|
| `user_id` | `text` | not null | none | also primary key |
| `first_name` | `text` | null | none | profile field |
| `last_name` | `text` | null | none | profile field |
| `phone` | `text` | null | none | profile field |
| `country` | `text` | null | none | profile field |
| `city` | `text` | null | none | profile field |
| `timezone` | `text` | null | none | profile field |
| `avatar_url` | `text` | null | none | profile field |
| `onboarding_completed` | `boolean` | not null | `false` | onboarding state |
| `start_day_of_week` | `text` | not null | `'Monday'` | constrained weekday value |
| `created_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |
| `updated_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |

- Primary Key:
  - `PRIMARY KEY (user_id)`

- Foreign Keys:
  - `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE`

- Unique Constraints:
  - none beyond the primary key

- Indexes:
  - primary key index on `user_id`
  - non-unique index on `onboarding_completed`
  - non-unique index on `start_day_of_week`

- Check Constraints:
  - `start_day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`

- Defaults:
  - `onboarding_completed default false`
  - `start_day_of_week default 'Monday'`
  - `created_at default now()`
  - `updated_at default now()`

- Backfill / Seed Notes:
  - migration must backfill one row for every user missing a profile row
  - backfilled rows should use:
    - `onboarding_completed = false`
    - `start_day_of_week = 'Monday'`
    - nullable profile fields left `NULL`

- Notes / Rationale:
  - `birthday` is intentionally excluded
  - one profile per user is the cleanest target model
  - no surrogate `id` is retained because no in-scope table needs to reference profile rows independently

### 4.3 `user_settings`
- Purpose:
  - one-to-one per-user settings table for application settings and layout/preferences payloads

- Columns:

| Column | Type | Nullability | Default | Notes |
|---|---|---:|---|---|
| `user_id` | `text` | not null | none | also primary key |
| `theme` | `text` | not null | `'system'` | theme preference |
| `locale` | `text` | not null | `'en'` | locale preference |
| `layout` | `jsonb` | not null | `'{}'::jsonb` | structured settings payload |
| `created_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |
| `updated_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |

- Primary Key:
  - `PRIMARY KEY (user_id)`

- Foreign Keys:
  - `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE`

- Unique Constraints:
  - none beyond the primary key

- Indexes:
  - primary key index on `user_id`
  - optional GIN index on `layout` for future structured lookups if the application begins querying inside layout payloads

- Check Constraints:
  - `jsonb_typeof(layout) = 'object'`
  - `char_length(trim(theme)) > 0`
  - `char_length(trim(locale)) > 0`

- Defaults:
  - `theme default 'system'`
  - `locale default 'en'`
  - `layout default '{}'::jsonb`
  - `created_at default now()`
  - `updated_at default now()`

- Backfill / Seed Notes:
  - migration must backfill one row for every user missing a settings row
  - exact default `layout` content remains content-deferred, but the schema default is empty object
  - existing live text payloads must be converted to valid JSON objects during migration

- Notes / Rationale:
  - no surrogate `id` is retained
  - `layout` moves from text to `jsonb`
  - one-row-per-user enforcement is part of the target integrity model

### 4.4 `todos`
- Purpose:
  - core task table supporting personal tasks, ordering, recurrence, and archival behavior

- Columns:

| Column | Type | Nullability | Default | Notes |
|---|---|---:|---|---|
| `id` | `text` | not null | none | todo primary key |
| `user_id` | `text` | not null | none | owning user |
| `task_number` | `integer` | not null | none | per-user business sequence |
| `title` | `text` | not null | none | main task title |
| `description` | `text` | null | none | optional description |
| `due_date` | `timestamptz` | null | none | optional due datetime |
| `due_time` | `text` | null | none | preserved user-entered time representation |
| `is_completed` | `boolean` | not null | `false` | completion flag |
| `is_flagged` | `boolean` | not null | `false` | pinned/important flag |
| `duration` | `integer` | not null | `0` | estimated duration |
| `priority` | `text` | not null | `'medium'` | priority label |
| `subtasks` | `jsonb` | not null | `'[]'::jsonb` | structured checklist payload |
| `order` | `integer` | not null | `0` | ordering field |
| `recurrence` | `jsonb` | null | none | structured recurrence rule payload |
| `next_recurrence_due` | `timestamptz` | null | none | next generated occurrence point |
| `original_id` | `text` | null | none | recurrence lineage/reference |
| `archived` | `boolean` | not null | `false` | archive state |
| `created_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |
| `updated_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |

- Primary Key:
  - `PRIMARY KEY (id)`

- Foreign Keys:
  - `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE`
  - `FOREIGN KEY (original_id) REFERENCES todos(id) ON DELETE SET NULL ON UPDATE CASCADE`

- Unique Constraints:
  - unique constraint on (`user_id`, `task_number`)

- Indexes:
  - unique index on (`user_id`, `task_number`)
  - non-unique index on (`user_id`, `archived`, `is_completed`)
  - non-unique index on (`user_id`, `due_date`)
  - non-unique index on (`user_id`, `is_flagged`)
  - non-unique index on (`user_id`, `next_recurrence_due`) where `next_recurrence_due IS NOT NULL`
  - non-unique index on `original_id`
  - optional GIN index on `subtasks`
  - optional GIN index on `recurrence`

- Check Constraints:
  - `char_length(trim(id)) > 0`
  - `char_length(trim(title)) > 0`
  - `task_number > 0`
  - `duration >= 0`
  - `priority IN ('low', 'medium', 'high')`
  - `jsonb_typeof(subtasks) = 'array'`
  - `recurrence IS NULL OR jsonb_typeof(recurrence) = 'object'`

- Defaults:
  - `is_completed default false`
  - `is_flagged default false`
  - `duration default 0`
  - `priority default 'medium'`
  - `subtasks default '[]'::jsonb`
  - `order default 0`
  - `archived default false`
  - `created_at default now()`
  - `updated_at default now()`

- Backfill / Seed Notes:
  - no synthetic todo backfill rows should be created
  - migration must preserve existing `task_number` values exactly
  - live integer flags must be normalized to booleans during migration
  - live serialized JSON-like fields must be converted to valid `jsonb`

- Notes / Rationale:
  - `task_number` remains a real business key per user
  - `archived` is modeled as `boolean`, not integer
  - `due_time` remains text to avoid overfitting an uncertain legacy string format

### 4.5 `tags`
- Purpose:
  - tag catalog supporting both global default tags and user-owned custom tags

- Columns:

| Column | Type | Nullability | Default | Notes |
|---|---|---:|---|---|
| `id` | `text` | not null | none | tag primary key |
| `name` | `text` | not null | none | display name |
| `color` | `text` | not null | none | display color |
| `user_id` | `text` | null | none | null for global defaults, set for custom tags |
| `is_default` | `boolean` | not null | `false` | distinguishes global defaults from custom tags |
| `created_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |
| `updated_at` | `timestamptz` | not null | `now()` | lifecycle timestamp |

- Primary Key:
  - `PRIMARY KEY (id)`

- Foreign Keys:
  - `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE`

- Unique Constraints:
  - partial unique index on `lower(name)` where `is_default = true AND user_id IS NULL`
  - unique index on (`user_id`, `lower(name)`) where `is_default = false AND user_id IS NOT NULL`

- Indexes:
  - primary key index on `id`
  - non-unique index on (`is_default`, `user_id`)
  - non-unique index on `user_id` where `user_id IS NOT NULL`
  - non-unique index on `is_default` where `is_default = true`

- Check Constraints:
  - anti-contradiction rule:
    - `(is_default = true AND user_id IS NULL) OR (is_default = false AND user_id IS NOT NULL)`
  - `char_length(trim(name)) > 0`
  - `char_length(trim(color)) > 0`

- Defaults:
  - `is_default default false`
  - `created_at default now()`
  - `updated_at default now()`

- Backfill / Seed Notes:
  - migration must preserve existing default/global and user-owned custom tags
  - migration must seed the approved canonical global default tag catalog if missing
  - exact default tag catalog content remains content-deferred

- Notes / Rationale:
  - the anti-contradiction rule is mandatory
  - global defaults are shared seeded data, not cloned per user
  - per-user custom tag names are unique within a user namespace

### 4.6 `todo_tags`
- Purpose:
  - many-to-many association between todos and tags

- Columns:

| Column | Type | Nullability | Default | Notes |
|---|---|---:|---|---|
| `todo_id` | `text` | not null | none | referenced todo |
| `tag_id` | `text` | not null | none | referenced tag |
| `created_at` | `timestamptz` | not null | `now()` | association timestamp |

- Primary Key:
  - `PRIMARY KEY (todo_id, tag_id)`

- Foreign Keys:
  - `FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE ON UPDATE CASCADE`
  - `FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE`

- Unique Constraints:
  - none beyond the composite primary key

- Indexes:
  - primary key index on (`todo_id`, `tag_id`)
  - supporting non-unique index on `tag_id`

- Check Constraints:
  - none required beyond FK and PK integrity

- Defaults:
  - `created_at default now()`

- Backfill / Seed Notes:
  - no synthetic backfill rows
  - migration must preserve existing associations

- Notes / Rationale:
  - `ON DELETE CASCADE` keeps join rows consistent when a todo or tag is removed
  - separate `tag_id` index supports reverse tag-to-todo lookups efficiently

## 5. Excluded or Deferred Schema Elements
Excluded from target schema:
- `notifications`
  - excluded because it is not part of the live primary relational model and was explicitly removed from migration scope in Milestone B
- `user_profiles.birthday`
  - excluded because it was approved as accidental runtime drift rather than a product-backed persisted field
- legacy surrogate keys for one-to-one tables:
  - `user_profiles.id`
  - `user_settings.id`
  - excluded because one-row-per-user ownership is the approved target model

Deferred from schema policy into later content definition:
- exact canonical default tag catalog content
- exact default seeded `layout` payload content
- exact default seeded `theme`/`locale` business values beyond the schema defaults approved here

## 6. Cross-Table Integrity Rules
1. `user_profiles.user_id` must always reference a real user.
2. `user_settings.user_id` must always reference a real user.
3. `todos.user_id` must always reference a real user.
4. `tags.user_id`, when non-null, must reference a real user.
5. `todo_tags.todo_id` must always reference a real todo.
6. `todo_tags.tag_id` must always reference a real tag.
7. deleting a user cascades to:
   - `user_profiles`
   - `user_settings`
   - `todos`
   - user-owned custom `tags`
   - related `todo_tags` indirectly through cascaded todo/tag deletion
8. deleting a global default tag removes only its `todo_tags` associations, not user data outside the join rows.
9. deleting a todo removes its `todo_tags` associations.
10. `tags` must obey the ownership/default contradiction rule at all times.
11. `todos.task_number` must be unique only within a user namespace, never globally.
12. `user_profiles` and `user_settings` must each have at most one row per user because `user_id` is their primary key.

## 7. Migration-Relevant Notes
Milestone E should treat the following as locked schema assumptions:
- target database is PostgreSQL-only; no SQLite fallback parity design is required
- `users.id` and every `user_id` FK use PostgreSQL `text`
- `user_profiles` and `user_settings` are one-to-one tables keyed by `user_id`
- `user_profiles.id` and `user_settings.id` are not carried into the target schema
- `users.email` uniqueness must be implemented with a partial unique index for non-null rows
- `users.auth0_sub` must be preserved and uniquely enforced
- `todos.task_number` must be preserved and remain unique per user
- integer flag fields in live MSSQL (`archived`, `is_completed`, `is_flagged`, `is_default`) map to booleans
- JSON-like text payloads map to `jsonb`
- missing profile/settings rows must be created during migration
- global default tag rows must be preserved and canonical seed content must be ensured
- `notifications` and `birthday` are not part of target migration scope

## 8. Open Content Deferrals
- exact default global tag catalog content
- exact color palette rules for seeded default tags
- exact seeded default `layout` object content
- exact final seed values for `theme` and `locale` beyond the schema defaults chosen here
- any future richer enum vocabularies for `role` or `subscription_status`

These are content-policy or application-policy details, not blockers to schema specification.

## 9. Appendix

### 9.1 In-scope target table summary
| Table | PK | Key design choice |
|---|---|---|
| `users` | `id` | canonical account identity + unique `auth0_sub` |
| `user_profiles` | `user_id` | one row per user, no surrogate `id` |
| `user_settings` | `user_id` | one row per user, `layout` as `jsonb` |
| `todos` | `id` | per-user unique `task_number`, boolean flags, `jsonb` payloads |
| `tags` | `id` | mixed global-default and user-custom model with contradiction check |
| `todo_tags` | (`todo_id`, `tag_id`) | pure join table with cascade cleanup |

### 9.2 PostgreSQL-native features intentionally used
- partial unique indexing for nullable email uniqueness
- `jsonb` for structured settings and todo payloads
- `timestamptz` for lifecycle and due/recurrence timestamps
- boolean types instead of integer flags
- explicit check constraints for weekday and tag consistency rules

### 9.3 Excluded tables/fields summary
| Element | Status | Reason |
|---|---|---|
| `notifications` | excluded | not part of approved primary model |
| `user_profiles.birthday` | excluded | approved as runtime drift |
| `user_profiles.id` | excluded | normalized to one-row-per-user key |
| `user_settings.id` | excluded | normalized to one-row-per-user key |
