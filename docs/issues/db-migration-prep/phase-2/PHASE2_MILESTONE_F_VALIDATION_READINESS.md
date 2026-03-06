# Phase 2 Milestone F — Validation, Evidence, and Readiness Design

## 1. Executive Summary
Milestone F is complete.

This document defines the verification, evidence, and readiness model for the later execution of the approved MSSQL-to-PostgreSQL migration.

It establishes:
- what must be measured before migration
- what must be checked after schema creation and data load
- what business-critical behavior must be validated
- what evidence must be captured for acceptance
- what criteria determine go/no-go readiness for the next phase

This milestone does not execute validation. It defines the acceptance system that later migration implementation must satisfy.

## 2. Validation Principles
1. Validate against the approved target schema in [PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md](PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md), not against legacy MSSQL drift.
2. Compare retained in-scope data only.
3. Treat intentional design changes as expected differences, not failures.
4. Require both structural correctness and business-flow correctness.
5. Capture evidence before and after migration so outcomes are auditable.
6. Reject silent data coercion unless an approved transform rule explicitly allows it.
7. A migration is not ready merely because it loads; it is ready only when integrity and business-use validation both pass.

## 3. Validation Model Overview
Validation is organized into six layers:

1. **Baseline evidence capture**
   - source schema, counts, uniqueness, and critical distributions

2. **Schema conformance validation**
   - target tables, columns, types, defaults, constraints, and indexes

3. **Data parity validation**
   - row counts, preserved IDs, required field preservation, and transform-result checks

4. **Integrity validation**
   - PK, FK, uniqueness, contradiction, and backfill correctness

5. **Business-flow validation**
   - representative application behaviors on migrated data

6. **Readiness gating**
   - final pass/fail criteria for advancing to production-style execution planning

## 4. Baseline Evidence to Capture Before Later Execution
Before any later implementation run, collect and store baseline evidence from the source MSSQL environment.

### 4.1 Source schema evidence
Capture:
- table existence for all in-scope tables
- source column lists/types for all exported columns
- source indexes and unique constraints relevant to retained business behavior
- source row counts

### 4.2 Source data-shape evidence
Capture at minimum:
- `users`
  - total rows
  - `auth0_sub` null count
  - `auth0_sub` duplicate count
  - `email` null count
  - `email` duplicate non-null count
  - `role` distribution
  - `subscription_status` distribution
- `user_profiles`
  - total rows
  - per-user duplicates if any
  - `start_day_of_week` distribution
  - invalid/null `start_day_of_week` counts
- `user_settings`
  - total rows
  - per-user duplicates if any
  - `theme` null/blank counts
  - `locale` null/blank counts
  - `layout` null/blank counts
  - invalid JSON count for `layout`
- `todos`
  - total rows
  - null/duplicate counts for (`user_id`, `task_number`)
  - null `user_id` count
  - invalid boolean-domain flag counts
  - invalid JSON counts for `subtasks` and `recurrence`
  - `archived` distribution
  - `priority` distribution
- `tags`
  - total rows
  - contradiction counts against the approved default/custom rule
  - duplicate default tag names
  - duplicate custom tag names within user scope
- `todo_tags`
  - total rows
  - duplicate pair count
  - orphaned todo refs count
  - orphaned tag refs count

### 4.3 Artifact retention
Baseline evidence artifacts should be stored per run and include:
- source schema snapshot
- source aggregate validation results
- transform reject/quarantine report format definition
- source extract manifest

## 5. Schema Conformance Validation
After the target PostgreSQL schema is created later, validate exact conformance against [PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md](PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md).

### 5.1 Required schema checks
For each in-scope table verify:
- table exists
- excluded tables do not exist in the approved schema scope
- expected columns exist
- excluded columns do not exist
- column types match approved target types
- nullability matches spec
- defaults match spec
- primary key matches spec
- foreign keys match spec
- unique rules match spec
- required indexes exist
- required check constraints exist

### 5.2 Critical schema checks by table
- `users`
  - partial unique index exists for non-null `email`
  - unique enforcement exists for `auth0_sub`
- `user_profiles`
  - PK is `user_id`
  - no surrogate `id`
  - weekday constraint exists
- `user_settings`
  - PK is `user_id`
  - no surrogate `id`
  - `layout` is `jsonb`
  - `jsonb_typeof(layout) = 'object'` rule exists
- `todos`
  - `task_number` is required
  - unique (`user_id`, `task_number`) exists
  - boolean fields use PostgreSQL `boolean`
  - `subtasks` and `recurrence` use `jsonb`
- `tags`
  - contradiction check exists
  - uniqueness rules for default and custom tag namespaces exist
- `todo_tags`
  - composite PK exists
  - both foreign keys exist with approved cascade behavior

## 6. Data Parity Validation

### 6.1 Row-count expectations
Expected post-migration count rules:
- `users` target count must equal source `users` count
- `todos` target count must equal source `todos` count
- `tags` target count must equal source valid-retained tags count plus any approved seeded default tags added by migration
- `todo_tags` target count must equal source valid-retained association count after approved orphan/de-dup handling
- `user_profiles` target count must equal source valid profile count plus approved backfill rows up to one per user
- `user_settings` target count must equal source valid settings count plus approved backfill rows up to one per user

### 6.2 Preserved identifier checks
Verify exact preservation of:
- every `users.id`
- every `users.auth0_sub`
- every `todos.id`
- every `todos.task_number`
- every retained `tags.id`
- every preserved `todo_tags` pair where parents remain valid

### 6.3 Field-level parity checks
Verify exact or approved-equivalent parity for:
- `users.email`, `name`, `picture`, `role`, `subscription_status`
- `user_profiles` non-excluded profile fields
- `user_settings.theme` and `user_settings.locale`
- `todos.title`, `description`, `due_date`, `due_time`, `duration`, `priority`, `next_recurrence_due`, `original_id`
- `tags.name`, `color`, `user_id`, `is_default`

### 6.4 Approved transform-result checks
Validate transform intent succeeded:
- integer flags became correct booleans
- JSON-like text became valid `jsonb`
- excluded fields were not created in the target
- dropped surrogate keys are absent
- backfilled rows were created where required

## 7. Integrity and Constraint Validation

### 7.1 Primary key checks
Verify:
- no duplicate PKs in any target table
- one row per user in `user_profiles`
- one row per user in `user_settings`

### 7.2 Unique constraint checks
Verify:
- no duplicate `auth0_sub`
- no duplicate non-null `email`
- no duplicate (`user_id`, `task_number`)
- no duplicate default-tag names in the global default namespace
- no duplicate custom tag names within the same user namespace

### 7.3 Foreign key checks
Verify:
- every `user_profiles.user_id` references `users.id`
- every `user_settings.user_id` references `users.id`
- every `todos.user_id` references `users.id`
- every non-null `tags.user_id` references `users.id`
- every `todo_tags.todo_id` references `todos.id`
- every `todo_tags.tag_id` references `tags.id`
- every non-null `todos.original_id` references a valid target `todos.id`

### 7.4 Check-constraint semantic checks
Verify:
- all `start_day_of_week` values are approved weekday names
- every `user_settings.layout` row is a JSON object
- every `todos.subtasks` row is a JSON array
- every non-null `todos.recurrence` row is a JSON object
- every `tags` row satisfies:
  - default tag => `user_id IS NULL` and `is_default = true`
  - custom tag => `user_id IS NOT NULL` and `is_default = false`

### 7.5 Backfill correctness checks
Verify:
- every user has exactly one `user_profiles` row
- every user has exactly one `user_settings` row
- backfilled profile rows use approved defaults
- backfilled settings rows use approved defaults

## 8. Business-Flow Validation Matrix
The later implementation phase should run representative business validations against migrated data.

| Flow | What to validate | Pass condition |
|---|---|---|
| User identity lookup | lookup by `auth0_sub` and nullable `email` semantics | one correct user returned; uniqueness preserved |
| User bootstrap data | user has profile and settings row | every user resolves one profile and one settings row |
| Todo listing | list user todos with archive/completion filters | counts and ordering are consistent with source intent |
| Todo numbering | fetch or display `task_number` values | preserved values match source exactly |
| Recurrence payload use | read recurrence-enabled todos | valid recurrence JSON exists where expected |
| Subtask payload use | read todos with subtasks | valid JSON array payloads deserialize correctly |
| Tag lookup | list global defaults and user custom tags | dual tag model returns correct partition |
| Tag assignment | resolve todo-tag relationships | join rows are intact and no orphan associations exist |
| Archived filtering | archived vs active todo views | boolean conversion preserves expected counts |
| Onboarding/profile settings | read `start_day_of_week`, onboarding state, theme, locale, layout | fields exist, conform to target rules, and deserialize correctly |

## 9. Before / During / After Evidence Collection

### 9.1 Before migration evidence
Collect:
- source schema snapshot
- source row counts and aggregates
- source integrity reports
- approved target schema version identifier
- approved transform rules version identifier

### 9.2 During migration evidence
Collect:
- extract manifest with row counts by table
- transform summary with input/output/reject counts by table
- backfill counts by table
- seed insert counts for global tags
- import counts by table
- any quarantine records and reasons

### 9.3 After migration evidence
Collect:
- target schema validation results
- target row counts by table
- target uniqueness/integrity results
- business-flow validation results
- diff summary between source baseline and target outcome
- final pass/fail readiness statement

## 10. Readiness Gates and Acceptance Criteria

### 10.1 Gate A — Schema readiness before execution
Pass only if:
- approved target schema is implementation-defined with no major ambiguity
- transform rules exist for every retained field needing conversion
- excluded elements list is explicit
- default-tag and default-settings content inputs are sufficiently finalized for execution

### 10.2 Gate B — Source readiness before extraction
Pass only if:
- source connectivity is stable
- source baseline evidence is captured
- no unresolved critical data anomalies remain untriaged
- export scope is fixed and approved

### 10.3 Gate C — Transform readiness before import
Pass only if:
- every invalid row category has a defined quarantine or repair rule
- JSON conversion behavior is deterministic
- boolean conversion behavior is deterministic
- backfill generation rules are finalized
- seed insertion rules are finalized

### 10.4 Gate D — Load acceptance
Pass only if:
- all schema checks pass
- all required row-count checks pass within approved expectations
- all uniqueness and FK checks pass
- all critical business-flow validations pass
- no unapproved data loss or silent coercion occurred

## 11. Intentionally Changed Behaviors That Should Not Be Flagged as Regression
The following differences are expected by design:
- `notifications` is absent from the target schema
- `user_profiles.birthday` is absent from the target schema
- `user_profiles` no longer has a surrogate `id`
- `user_settings` no longer has a surrogate `id`
- integer flag fields become booleans
- JSON-like text fields become `jsonb`
- every user will have a profile and settings row after migration because of approved backfill rules
- tags must obey the stricter contradiction rule even if historical data was looser

## 12. Readiness Assessment for Next Phase
Phase 2 defines a complete readiness model for Phase 3 implementation.

Implementation should not begin until the following narrow remaining inputs are finalized:
- exact canonical global default tag catalog content
- exact default seeded settings payload content where later code needs stronger-than-empty-object defaults

No major structural or architectural validation blocker remains.

## 13. Appendix

### 13.1 Minimum validation checklist by table
| Table | Minimum must-pass checks |
|---|---|
| `users` | count parity, PK uniqueness, `auth0_sub` uniqueness, partial unique email behavior |
| `user_profiles` | one row per user, FK validity, weekday constraint, backfill completeness |
| `user_settings` | one row per user, FK validity, `layout` object validity, backfill completeness |
| `todos` | count parity, PK uniqueness, per-user `task_number` uniqueness, boolean and `jsonb` conversion validity |
| `tags` | contradiction rule, namespace uniqueness, preserved/seeded defaults |
| `todo_tags` | count parity after approved cleanup, FK validity, no duplicates |

### 13.2 Evidence artifacts later implementation should emit
- source schema snapshot file
- source aggregate report file
- extract manifest file
- transform summary file
- reject/quarantine report file
- import summary file
- target schema validation file
- target data validation file
- business-flow validation file
- final migration acceptance report
