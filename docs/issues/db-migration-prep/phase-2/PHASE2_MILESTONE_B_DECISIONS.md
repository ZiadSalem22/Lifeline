# Phase 2 Milestone B — Product and Architecture Decision Record Pack

## 1. Executive Summary
Milestone B is complete.

This decision pack establishes the approved policy basis for the future PostgreSQL design.

Major decisions made:
- future schema truth will come from an explicit approved Phase 2 schema specification derived from live production truth, current runtime needs, and Milestone B decisions; entities and migrations will become downstream artifacts, not the source of truth
- SQLite fallback will be removed from the supported runtime architecture and replaced by a single-database PostgreSQL-first model across production and local development
- `notifications` will be deferred out of migration scope and dropped from supported backend persistence unless later re-approved as a real product capability
- `users.auth0_sub` is mandatory, unique, and part of the canonical identity model
- `users.email` will remain nullable but must be unique when present
- `todos.task_number` is retained, must stay unique per user, and existing values must be preserved
- `user_profiles.start_day_of_week` is retained with explicit allowed values, non-null future shape, a default, and a database-level constraint
- `user_profiles.birthday` is treated as accidental runtime drift and should be removed from runtime behavior rather than added to the target schema
- `user_settings` will be normalized to one row per user, keyed by `user_id`, with `layout` stored as `jsonb`
- all user-linked references will normalize to one canonical PostgreSQL user key type referencing `users.id`
- the permanent tag model will support global default tags plus user-owned custom tags, with defaults treated as seeded data
- migration should backfill missing `user_profiles` and `user_settings` so the target schema starts in a coherent state

## 2. Decision Framework
These decisions were made using the following rule order:

1. Live production truth wins over stale repo artifacts when determining whether a field/table is real.
2. Current runtime/product needs win over historical migration drift when they represent active supported behavior.
3. Broken or partial legacy behavior is not preserved unless it is clearly required product behavior.
4. PostgreSQL target design should reduce ambiguity, normalize relationships, and remove split-brain schema authority.
5. The approved future truth is not any one current artifact. It is the explicit future-state specification produced after Milestones A, B, and C.

Decision inputs used:
- Milestone A reconciliation findings in [PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md](PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md)
- Milestone C live evidence in [PHASE2_MILESTONE_C_LIVE_DB_REPORT.md](PHASE2_MILESTONE_C_LIVE_DB_REPORT.md)
- current runtime expectations referenced in Milestone A, especially around `auth0_sub`, `task_number`, tag semantics, and the runtime-only `birthday` write

## 3. Decision Records

### 3.1 Future schema source of truth
- Decision: The approved future source of truth will be a single explicit PostgreSQL schema specification produced in Phase 2, based on Milestone B decisions and validated against live production truth. TypeORM entities, repository implementations, and migrations must conform to that specification instead of competing with it.
- Status: Final
- Evidence:
  - Milestone A proved there is no single current authority across entities, active migration, archived migrations, manual SQL, fallback bootstrap, and runtime expectations.
  - Milestone C proved live production truth differs materially from the active migration and parts of the repo.
- Rationale:
  - using the active migration alone would preserve known errors
  - using the live DB alone would preserve historical drift and environment-specific residue
  - using entities alone would ignore production truth
  - an explicit approved specification is the only way to make the PostgreSQL design coherent
- Migration Implications:
  - Milestone D should define the canonical PostgreSQL schema from this decision pack
  - later entities and migrations should be generated or rewritten to match that schema
  - repo/runtime drift should be measured against the approved schema, not against older artifacts
- Tradeoffs:
  - requires disciplined documentation and later refactoring
  - adds up-front design work, but removes recurring ambiguity

### 3.2 SQLite fallback
- Decision: Remove SQLite fallback from the supported backend architecture and replace it with a PostgreSQL-only development/test approach. SQLite should not remain as a runtime fallback path.
- Status: Final
- Evidence:
  - Milestone A showed SQLite fallback is partial and does not faithfully represent `users`, `user_profiles`, `user_settings`, `tags.user_id`, `tags.is_default`, `todos.archived`, or `notifications` relative to the primary model.
  - Milestone C confirmed live truth is materially richer than the fallback schema.
- Rationale:
  - fallback SQLite currently hides drift instead of reducing it
  - a second persistence model multiplies schema divergence and testing ambiguity
  - the future architecture should optimize for one coherent relational model
- Migration Implications:
  - future PostgreSQL design should assume one supported persistence engine
  - local/dev workflows should use PostgreSQL-compatible configuration rather than SQLite fallback behavior
  - any code paths that assume automatic fallback must be removed later
- Tradeoffs:
  - local setup may be less lightweight than SQLite
  - short-term developer convenience is reduced
  - long-term correctness and consistency improve substantially

### 3.3 `notifications`
- Decision: Defer `notifications` out of migration scope and drop it from supported backend persistence for the PostgreSQL target unless it is re-approved later as a first-class product capability.
- Status: Final for Phase 2 scope
- Evidence:
  - Milestone A showed `notifications` exists only in SQLite-only runtime/service behavior.
  - Milestone C confirmed the live MSSQL database has no `notifications` table.
- Rationale:
  - it is not part of the live primary data model
  - migrating it now would institutionalize a feature that lacks canonical schema support
  - Phase 2 should not invent new persistence scope without product approval
- Migration Implications:
  - Milestone D should exclude `notifications` from the approved PostgreSQL schema
  - if the product later wants notifications, it should be redesigned explicitly as a separate feature
- Tradeoffs:
  - any current SQLite-only notification persistence behavior will not be carried forward as part of the migration target
  - future redesign effort may be needed if the feature is revived

### 3.4 `users.auth0_sub`
- Decision: `users.auth0_sub` is mandatory, unique, and part of the canonical identity model.
- Status: Final
- Evidence:
  - Milestone A identified it as required by runtime/auth flows and missing from the active migration.
  - Milestone C confirmed it exists live, is populated for all rows, and has no duplicates.
- Rationale:
  - it is the strongest external identity anchor currently used by the application
  - making it mandatory and unique aligns database rules with the real authentication model
- Migration Implications:
  - PostgreSQL target should define `auth0_sub` as non-null with unique enforcement
  - migration must preserve every existing value exactly
  - rows lacking a valid `auth0_sub` would require remediation before cutover
- Tradeoffs:
  - stronger uniqueness enforcement may surface hidden bad data in other environments
  - ties canonical identity to the current auth provider integration, though it matches present reality

### 3.5 `users.email`
- Decision: `users.email` will be nullable and unique when present.
- Status: Final
- Evidence:
  - Milestone A showed active migration, manual SQL, and runtime expectations conflict on `email` rules.
  - Milestone C showed live schema allows nulls but still retains uniqueness, and current data has no duplicates.
- Rationale:
  - nullable supports auth-linked accounts that may not always have email available or may not need email as the primary identifier
  - uniqueness when present prevents ambiguous account matching and preserves reasonable product expectations
  - email should not replace `auth0_sub` as canonical identity
- Migration Implications:
  - PostgreSQL target should allow `NULL`
  - PostgreSQL target should enforce uniqueness for non-null values
  - migration should preserve existing emails and validate for duplicates in other environments
- Tradeoffs:
  - nullable email slightly complicates workflows that assume every user has contactable email
  - unique-when-present requires explicit indexing strategy rather than a simplistic non-null column rule

### 3.6 `todos.task_number`
- Decision: Retain `todos.task_number` as a first-class field, keep uniqueness scoped per user, preserve all existing values during migration, and continue future generation as per-user sequential numbering without requiring gap-free sequences.
- Status: Final
- Evidence:
  - Milestone A showed runtime depends heavily on `task_number` and the active migration wrongly omits it.
  - Milestone C showed live data has 536 populated values with zero nulls and zero duplicate per-user groups, backed by a unique composite index.
- Rationale:
  - the field is active product behavior, not legacy residue
  - per-user numbering is user-facing and operationally meaningful
  - requiring gap-free numbering would overcomplicate behavior and migration
- Migration Implications:
  - PostgreSQL target should keep `task_number`
  - PostgreSQL target should enforce uniqueness on (`user_id`, `task_number`)
  - migration must preserve current numbers, not recompute them
  - future creation logic should continue assigning the next available per-user number
- Tradeoffs:
  - preserving historical numbers means carrying an additional business key beyond the primary key
  - later repair logic may be needed if other environments contain gaps or corruption

### 3.7 `user_profiles.start_day_of_week`
- Decision: Retain `user_profiles.start_day_of_week`. Allowed values will be the seven full weekday names: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`. The PostgreSQL target should make the field non-null with default `Monday` and enforce the allowed values at the database level.
- Status: Final
- Evidence:
  - Milestone A showed runtime/entity/manual SQL recognize the field while the active migration omits it.
  - Milestone C confirmed the field exists live and is used.
- Rationale:
  - the field is real product data, not accidental drift
  - explicit allowed values remove ambiguity
  - a non-null default simplifies downstream logic and backfill behavior
  - database-level enforcement prevents silent invalid values
- Migration Implications:
  - existing live values should be preserved
  - any null or invalid values in other environments must be normalized during migration
  - PostgreSQL target should include explicit enum-like or check-constraint enforcement
- Tradeoffs:
  - choosing a default imposes a product assumption where legacy schema was permissive
  - `Monday` may not match every regional expectation, but it provides one clean system default

### 3.8 `user_profiles.birthday`
- Decision: Treat `user_profiles.birthday` as accidental runtime drift and remove it from runtime behavior instead of adding it to the target schema.
- Status: Final
- Evidence:
  - Milestone A found runtime writes `birthday` even though no schema source defines it.
  - Milestone C confirmed the live production database does not contain the column.
- Rationale:
  - there is no evidence it is an approved persisted product field
  - adding it now would promote drift into canonical design without product justification
  - the cleaner choice is to remove the unsupported write path later
- Migration Implications:
  - Milestone D should exclude `birthday`
  - later implementation work should remove the write path and any API contract that implies persistence
- Tradeoffs:
  - if some stakeholder expected birthdays to persist, that expectation will need explicit future product re-approval
  - removing drift may expose silent assumptions in existing client code

### 3.9 `user_settings`
- Decision: Normalize `user_settings` to one row per user, keyed by `user_id` as the primary key, with `user_id` also a foreign key to `users.id`. Do not retain a separate standalone surrogate `id` in the target schema. Store `layout` as `jsonb`.
- Status: Final
- Evidence:
  - Milestone A showed conflicting `user_settings` shapes across entity/active migration vs archived history.
  - Milestone C showed live `user_settings` is sparse, lacks one-row-per-user enforcement, uses string identifiers, and stores `layout` as text.
- Rationale:
  - settings are naturally one-to-one with users
  - using `user_id` as the primary key removes unnecessary duplication and ambiguity
  - `jsonb` matches actual serialized payload usage while fitting PostgreSQL well
  - a true FK enforces relational correctness absent in live drifted schema
- Migration Implications:
  - PostgreSQL target should define exactly one settings row per user
  - migration must map existing settings rows by `user_id`
  - existing standalone `id` values become legacy-only and need not survive as canonical identifiers
  - malformed `layout` payloads, if any, will need validation/normalization
- Tradeoffs:
  - dropping the surrogate `id` may require later code changes where repositories expect one
  - `jsonb` introduces validation questions if layouts are not consistently shaped

### 3.10 User ID normalization
- Decision: The canonical PostgreSQL user key type will be the same type as `users.id`, stored as PostgreSQL `text`, and all user-linked tables must reference it directly through foreign keys instead of carrying inconsistent local length/type variants.
- Status: Final
- Evidence:
  - Milestone C showed inconsistent live shapes across `user_profiles.user_id`, `todos.user_id`, `tags.user_id`, and `user_settings.user_id`.
  - Milestone A showed those inconsistencies are also reflected in repo artifacts.
- Rationale:
  - current user key values are string-based, not UUID-native
  - `text` avoids arbitrary legacy length fragmentation while preserving existing values safely
  - using one canonical referenced type across all tables simplifies the PostgreSQL model
- Migration Implications:
  - PostgreSQL target should define `users.id` and all user FKs using the same type
  - all user-linked tables should carry true foreign keys where relationship semantics require them
  - data movement must normalize width/type mismatches from legacy MSSQL forms
- Tradeoffs:
  - `text` is less narrowly constrained than a fixed-length type
  - later migration to a different identifier strategy would still require a separate project

### 3.11 Default tags
- Decision: Approve the permanent dual tag model: global default tags plus user-owned custom tags. Default tags are seeded reference data, not per-user duplicates. Migration must preserve existing default/custom tags and backfill the canonical default tag set if required.
- Status: Final with one narrow content deferral
- Evidence:
  - Milestone A showed tag semantics exist in primary runtime expectations but not faithfully in SQLite fallback.
  - Milestone C showed live data cleanly separates global defaults (`user_id = NULL`, `is_default = 1`) from user-owned custom tags (`user_id != NULL`, `is_default = 0`).
- Rationale:
  - the live model is coherent and already in use
  - global seeded defaults are simpler than duplicating the same defaults per user
  - preserving custom tags plus shared defaults matches current product reality
- Migration Implications:
  - PostgreSQL target should keep `user_id` nullable for global defaults
  - PostgreSQL target should keep `is_default`
  - migration must preserve existing tag ownership/default semantics
  - Milestone D should define the rule set needed to prevent contradictory states
- Tradeoffs:
  - nullable `user_id` introduces a mixed ownership model
  - future product changes may still require stronger constraints or separate reference tables

### 3.12 Missing profile/settings coverage
- Decision: Migration should backfill both missing `user_profiles` and missing `user_settings` so every migrated user has a baseline row in each table.
- Status: Final
- Evidence:
  - Milestone C showed 7 users, 5 profiles, and 2 settings.
  - current partial coverage creates ambiguity and forces runtime branching.
- Rationale:
  - the PostgreSQL target should start from a coherent baseline rather than preserving avoidable sparsity
  - backfill reduces downstream null-handling complexity and supports one-row-per-user settings
  - profile rows can be safely created with defaults and nullable optional fields
- Migration Implications:
  - migration design must specify default values for backfilled rows
  - backfilled `user_profiles` should use default `start_day_of_week` and safe nulls for optional fields
  - backfilled `user_settings` should create valid default `layout`, `theme`, and `locale` policy values
- Tradeoffs:
  - backfill creates new rows that did not previously exist
  - some defaults may not reflect user intent, but they produce a cleaner consistent baseline

## 4. Consolidated Approved Future-State Rules
- One approved PostgreSQL schema specification becomes the canonical source of truth.
- TypeORM entities and migrations must follow that specification, not define competing truth.
- No supported SQLite runtime fallback remains in the future architecture.
- `notifications` is out of migration scope and excluded from the PostgreSQL target.
- `users.auth0_sub` is required, unique, and canonical for external identity.
- `users.email` is nullable and unique when present.
- `todos.task_number` is retained, preserved, and unique per user.
- `user_profiles.start_day_of_week` is retained, non-null in the target, defaulted to `Monday`, and constrained to the seven weekday names.
- `user_profiles.birthday` is excluded from the target schema and should be removed from runtime behavior later.
- `user_settings` becomes a true one-to-one table keyed by `user_id`, with `layout` stored as `jsonb`.
- `users.id` is the canonical user key, stored as PostgreSQL `text`; all user-linked references use the same type and foreign keys.
- Tags keep the dual model of global defaults and user-owned customs.
- Migration should backfill missing profile and settings rows.

## 5. Open Questions or Intentional Deferrals
- Default tag catalog content is intentionally deferred.
  - Decision already made: defaults are seeded global reference data.
  - Deferred detail: the exact default tag names/colors to seed or preserve as the canonical catalog.
  - Why deferred: it is data-content definition, not schema-policy definition.

- Default values for backfilled `user_settings` payload fields are intentionally deferred.
  - Decision already made: missing rows will be backfilled.
  - Deferred detail: the exact default `theme`, `locale`, and `layout` payload content.
  - Why deferred: Milestone D needs the schema first; concrete seed/default content can be finalized alongside migration design.

No major architecture decision required by Milestone B remains blocked.

## 6. Recommended Inputs for Milestone D
Milestone D should use the following approved inputs:
- canonical truth source = approved PostgreSQL schema specification derived from Milestones A, B, and C
- exclude SQLite fallback from the future supported architecture
- exclude `notifications` from the PostgreSQL target schema
- include `users.auth0_sub` as non-null unique identity field
- include `users.email` as nullable with uniqueness when present
- include `todos.task_number` with unique (`user_id`, `task_number`) enforcement
- include `user_profiles.start_day_of_week` with constrained allowed values and a default
- exclude `user_profiles.birthday`
- normalize `user_settings` to a one-row-per-user table keyed by `user_id`
- store `user_settings.layout` as `jsonb`
- normalize all user-linked references to the same type as `users.id`
- preserve the dual tag model and encode rules needed to prevent contradictory tag ownership/default states
- design migration/backfill paths so every migrated user ends with profile and settings rows

## 7. Appendix

### 7.1 Decision philosophy summary
Where repo truth, live truth, and product/runtime behavior conflicted, this milestone preferred:
- live truth to determine what is real today
- runtime/product needs to determine what behavior matters
- explicit redesign where drifted historical artifacts would make PostgreSQL ambiguous or messy

### 7.2 Non-goals of this milestone
This milestone did not:
- implement code changes
- modify the live database
- define final PostgreSQL DDL syntax
- write migrations
- export or transform data
- continue into Milestone D or later
