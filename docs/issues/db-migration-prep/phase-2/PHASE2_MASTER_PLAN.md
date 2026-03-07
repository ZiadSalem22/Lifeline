# Phase 2 Master Plan

## 1. Objective
Phase 2 is the full database migration preparation phase for Lifeline.

Its objective is to reduce the current MSSQL/SQLite/schema-drift uncertainty into an approved, evidence-backed PostgreSQL migration basis before any implementation begins.

By the end of Phase 2, the project should have:
- one approved canonical target PostgreSQL schema
- explicit decisions on all drifted/ambiguous product behaviors that affect schema and migration
- verified evidence about the live MSSQL database shape and contents relevant to migration planning
- a designed but not yet executed export/transform/import approach
- a defined validation strategy for later migration execution

Phase 2 is not meant to perform the migration. It is meant to make later migration implementation safe and deliberate.

## 2. Locked Inputs
This plan is based on the following locked inputs:

- Repo architecture
  - frontend in [client](client)
  - backend in [backend](backend)
  - frontend is React + Vite
  - backend is Express + TypeORM
- Current DB/runtime facts
  - MSSQL-first runtime
  - explicit SQLite fallback in [backend/src/index.js](backend/src/index.js)
  - SQLite fallback is real but partial
  - PostgreSQL is not currently configured
- Locked DB discovery findings
  - schema truth is fractured across entities, active TypeORM migration, archived migrations, manual MSSQL SQL, old MSSQL bootstrap SQL, SQLite bootstrap code, and SQLite-only notification schema logic
  - no single trustworthy schema source exists
  - active migration history is not safe to treat as canonical executable truth
  - bottom-line PostgreSQL migration difficulty is high
- Locked drift findings
  - `users.auth0_sub` required by runtime, missing from active JS migration
  - `users.email` rules differ across sources
  - `todos.task_number` required by runtime, absent from active JS migration/manual baseline
  - `user_profiles.start_day_of_week` required by runtime, absent from active JS migration
  - default tag seeding exists only in archived migration logic
  - `notifications` exists only in SQLite code
  - SQLite fallback bootstraps only partial schema
- Locked live-DB capability findings
  - live MSSQL credentials are available from current environment files
  - this environment can connect to the live SQL Server host
  - safe read/connectivity checks succeeded
  - later live schema inspection and read/export work appears feasible
  - no write, migration, reset, or export action has been taken
- Phase boundary constraints
  - no Dockerization in Phase 2
  - no deployment consolidation in Phase 2
  - no production cutover in Phase 2
  - no data migration execution in Phase 2

## 3. Recommended Phase 2 Strategy
The recommended Phase 2 strategy is:

1. reconcile repository truth first, but do not pretend the repo is authoritative by itself
2. force explicit product and schema decisions on all known drift points
3. inspect the live MSSQL database before finalizing the target schema
4. approve one canonical PostgreSQL target model
5. design the later migration flow around that approved target
6. define validation/evidence requirements before any migration implementation starts

Why this is the right strategy:
- the current migration chain is not trustworthy enough to port directly
- the current entities are not sufficient as the sole source of truth
- SQLite fallback and notification behavior create semantic ambiguity that must be decided, not inherited blindly
- live DB access is available, so planning should use real production-shape evidence rather than only repo archaeology
- migration design before schema and behavior decisions would create false certainty and high rework risk

Recommended planning posture:
- Phase 2 should converge on an approved target schema rather than try to preserve historical provider ambiguity
- PostgreSQL implementation should later be based on approved target truth, not on the current MSSQL migration history verbatim
- every major ambiguity should become an explicit decision record before implementation advances

## 4. Phase 2 Milestones / Workstreams

### Milestone A — Canonical Schema Reconciliation Baseline
- name
  - Canonical Schema Reconciliation Baseline
- purpose
  - Turn the repo’s fractured schema story into a single structured reconciliation matrix without yet finalizing the PostgreSQL target.
- key questions
  - Which tables/columns/indexes/defaults/constraints are expected by current runtime code?
  - Which schema elements exist only in entities, only in migrations, only in manual SQL, or only in SQLite code?
  - Which drift items are definitely product-significant versus possibly stale?
  - Which schema gaps block safe target-schema approval later?
- dependencies
  - none beyond locked discovery inputs
- deliverables
  - canonical schema reconciliation matrix
  - table-by-table drift report
  - list of unresolved schema conflicts requiring decisions
  - provisional current-runtime truth summary
- exit criteria
  - every known business-relevant table is represented in one reconciliation artifact
  - every known drift point is recorded explicitly
  - no major schema ambiguity remains undocumented
- risk level
  - medium

### Milestone B — Product and Architecture Decision Record Pack
- name
  - Product and Architecture Decision Record Pack
- purpose
  - Force explicit decisions on all ambiguous behaviors that affect schema, migration shape, and future architecture.
- key questions
  - Does SQLite fallback survive, get removed, or get replaced by a different dev-only strategy?
  - Are `notifications` dropped, redesigned, or deferred out of the database migration scope?
  - What is the approved meaning and lifecycle of default tags?
  - What are the approved semantics for `todos.task_number`?
  - Is `users.auth0_sub` mandatory and unique in the target schema?
  - What are the final nullability/uniqueness rules for `users.email`?
  - What is the approved target shape for `user_profiles`, including `start_day_of_week`?
  - What is the approved target shape and key strategy for `user_settings`?
  - Which schema source becomes approved future truth once Phase 2 finishes?
- dependencies
  - Milestone A
- deliverables
  - decision record set for all required drifted behaviors
  - approved retention/removal/defer matrix for SQLite-only and MSSQL-only behaviors
  - future-state architectural position for fallback behavior and notification storage
- exit criteria
  - all required decisions listed in Section 6 are explicitly resolved
  - no later migration design step depends on an unmade product/schema decision
- risk level
  - high

### Milestone C — Live MSSQL Inspection and Truth Capture
- name
  - Live MSSQL Inspection and Truth Capture
- purpose
  - Use the now-confirmed live DB access to capture actual schema and data-shape evidence before final target approval.
- key questions
  - What tables, columns, indexes, constraints, and defaults exist in the live MSSQL database?
  - Does live schema match current runtime expectations, manual SQL, or active migrations?
  - Are there live-only columns, missing expected columns, or drift not visible in the repo?
  - What are the real data patterns for critical fields such as `auth0_sub`, `email`, `task_number`, `start_day_of_week`, default tags, archived flags, and settings/layout payloads?
  - Is there evidence of dead tables, partial historical migrations, or inconsistent data that later transform logic must handle?
- dependencies
  - Milestone A should be complete first
  - Milestone B should resolve which live objects are considered in-scope product truth vs legacy leftovers, where possible
- deliverables
  - live schema inventory
  - live data-shape inventory for critical tables/columns
  - repo-vs-live drift comparison report
  - evidence pack of read-only findings suitable for later migration design
- exit criteria
  - live schema has been captured read-only
  - critical live data-shape questions have evidence-backed answers
  - repo/live differences are documented clearly enough to support target approval
- risk level
  - high

### Milestone D — Approved Target PostgreSQL Schema Specification
- name
  - Approved Target PostgreSQL Schema Specification
- purpose
  - Convert reconciled repo truth, explicit decisions, and live DB evidence into one approved future PostgreSQL schema model.
- key questions
  - What exact tables, columns, types, constraints, defaults, keys, relationships, and seed data belong in the target schema?
  - Which current fields are retained, transformed, deprecated, or dropped?
  - Which live or legacy artifacts are intentionally excluded from the target model?
  - How should JSON-like fields, dates/times, booleans, ids, and uniqueness rules be represented in PostgreSQL?
- dependencies
  - Milestone A
  - Milestone B
  - Milestone C
- deliverables
  - approved target PostgreSQL schema spec
  - target seed-data rules for items like default tags
  - field mapping from current state to target state
  - explicit exclusions list for non-retained legacy artifacts
- exit criteria
  - one approved target schema exists and is accepted as the future source of truth
  - all major business tables have final target definitions
  - unresolved schema ambiguity is reduced to zero or explicitly deferred with written approval
- risk level
  - high

### Milestone E — Migration Design and Data Movement Blueprint
- name
  - Migration Design and Data Movement Blueprint
- purpose
  - Design how data will later move from the live MSSQL database into the approved PostgreSQL target without implementing it yet.
- key questions
  - What should be exported from live MSSQL?
  - What should be transformed before import?
  - Which tables can move directly and which need normalization or repair?
  - In what order should later import occur to respect FK relationships and seed-data rules?
  - How should rollback/retry thinking work if the later migration fails?
  - What should happen to SQLite-only data/behavior if it is not part of the target?
- dependencies
  - Milestone D
- deliverables
  - later export strategy
  - later transform strategy
  - later import order and dependency map
  - failure/rollback thinking document
  - high-risk table migration notes
- exit criteria
  - there is one realistic later-phase migration path based on the approved target schema
  - high-risk transforms are identified explicitly
  - no critical table lacks a proposed movement strategy
- risk level
  - high

### Milestone F — Validation, Evidence, and Readiness Design
- name
  - Validation, Evidence, and Readiness Design
- purpose
  - Define how later implementation will prove parity and correctness after migration.
- key questions
  - What schema parity checks must pass?
  - What row-count and record-shape checks must pass?
  - Which critical business flows must be validated post-migration?
  - Which behaviors are expected to remain unchanged, and which are intentionally changed by decision?
  - What evidence must be captured before, during, and after later migration execution?
- dependencies
  - Milestone D
  - Milestone E
- deliverables
  - parity validation checklist
  - evidence collection checklist for later implementation
  - critical business-flow validation matrix
  - go/no-go readiness criteria for future migration execution
- exit criteria
  - later migration implementation has clear acceptance criteria
  - every major retained feature has a validation owner/check
  - known intentionally changed behaviors are documented so they do not look like regressions later
- risk level
  - medium

## 5. Recommended Execution Order
Recommended order:
1. Milestone A — Canonical Schema Reconciliation Baseline
2. Milestone B — Product and Architecture Decision Record Pack
3. Milestone C — Live MSSQL Inspection and Truth Capture
4. Milestone D — Approved Target PostgreSQL Schema Specification
5. Milestone E — Migration Design and Data Movement Blueprint
6. Milestone F — Validation, Evidence, and Readiness Design

Why this order reduces risk:
- A first creates a clean inventory of the repo mess before anyone interprets it.
- B comes before deep live-schema finalization because some findings need policy decisions, not just technical discovery.
- C then uses live DB access to test whether repo expectations match reality and to surface hidden drift.
- D only happens after both repo truth and live truth are available and policy decisions exist.
- E depends on a real approved target; otherwise migration design would be speculative.
- F comes last because validation should measure the approved target and the designed migration path, not earlier assumptions.

Important sequencing rule:
- do not design actual export/import transforms before D is complete
- do not finalize the target PostgreSQL schema before C is complete
- do not start any implementation milestone until B and D have closed the required decision set

## 6. Required Decisions Before Implementation Can Advance
The following decisions must be resolved explicitly before Phase 2 implementation can safely advance beyond planning/discovery-style work:

- whether SQLite fallback survives, is removed, or is replaced with a different dev-only approach
- whether `notifications` are:
  - dropped
  - redesigned onto PostgreSQL
  - moved out of DB scope
  - deferred entirely
- whether `users.auth0_sub` is mandatory and unique in the approved target schema
- final `users.email` policy:
  - nullable or non-nullable
  - unique or non-unique
  - synthetic fallback-email behavior retained or changed
- final `todos.task_number` policy:
  - retained or removed
  - uniqueness scope
  - generation/backfill behavior
  - import semantics
- final `user_profiles.start_day_of_week` policy:
  - retained values
  - validation rules
  - nullability/defaults
- final `user_settings` target shape:
  - key strategy
  - storage model for `layout`
  - uniqueness expectations by user
- final default-tag behavior:
  - seed list
  - ownership rules
  - lifecycle and migration handling
- final approved future schema source of truth:
  - schema spec artifact
  - later migration files
  - any seed-data specification
- any explicit decision on whether SQLite-only `notifications` or `SQLiteUserRepository` semantics are product-critical or legacy-only

## 7. Validation and Evidence Strategy
Later implementation milestones must gather evidence in a structured way.

Evidence categories required:
- repo evidence
  - entity definitions
  - repository expectations
  - current route/service behaviors
  - tests that imply business rules
- live DB evidence
  - table inventory
  - column/type/nullability/default inventory
  - indexes/constraints inventory
  - sample-safe data-shape findings for critical columns
  - row counts by core tables
- target schema evidence
  - final approved schema artifact
  - mapping from source tables/columns to target tables/columns
- migration design evidence
  - export set definition
  - transform rules
  - import ordering and dependencies
- validation evidence
  - before/after row counts
  - table parity results
  - retained-seed-data checks
  - business-flow checks

Later parity validation should cover at least:
- schema parity against the approved PostgreSQL target
- counts/parity for:
  - `users`
  - `user_profiles`
  - `user_settings`
  - `todos`
  - `tags`
  - `todo_tags`
- critical rule validation for:
  - `auth0_sub`
  - email uniqueness/nullability behavior
  - task-number semantics if retained
  - `start_day_of_week`
  - default tags
  - archived todos
- feature behavior validation for:
  - authenticated user load/profile/settings behavior
  - todo CRUD and search/filtering
  - tag ownership/default-tag behavior
  - export/import behavior if retained
  - guest mode unaffected by DB changes
  - notifications only if the feature is explicitly retained

Specific live-inspection milestone guidance:
- what should be inspected
  - schema metadata
  - table counts
  - critical column distributions/null patterns
  - seed/default-tag state
  - task-number state and duplicates/nulls
  - presence/absence of expected runtime columns
- what should not be modified
  - no migrations
  - no resets
  - no DDL
  - no data repair
  - no exports beyond approved read-only inspection outputs
- outputs that should be produced
  - live schema truth report
  - source-to-target discrepancy list
  - migration-impact notes for critical tables

## 8. Risks and Safeguards
Major risks:
- false assumption that repo schema equals live schema
- false assumption that active migration chain is trustworthy
- carrying SQLite fallback ambiguity into PostgreSQL design
- accidentally preserving broken historical behavior because it exists somewhere in repo history
- underestimating raw SQL/provider-specific query rewrite effort
- designing migration flows before final schema decisions exist
- missing live-only drift that is not represented in code
- conflating retained behavior with legacy leftovers

Safeguards built into this milestone structure:
- Milestone A documents schema fracture explicitly instead of hiding it
- Milestone B forces policy decisions before implementation
- Milestone C validates against live DB truth before target approval
- Milestone D creates one approved future schema source of truth
- Milestone E designs migration only after target truth exists
- Milestone F defines evidence-based acceptance criteria before execution
- Phase 2 scope stays pre-Docker and pre-deployment, preventing unrelated work from masking migration risk

## 9. Out of Scope for Phase 2
Phase 2 will not do the following:
- create Dockerfiles
- create Compose files
- merge frontend/backend hosting or deployment pipelines
- redesign Nginx or VPS deployment
- perform production cutover planning beyond migration-readiness concerns
- execute data export/import
- execute live DB writes, resets, or migrations
- implement PostgreSQL runtime support yet
- implement schema rewrites yet
- perform broad repo cleanup beyond Phase 1
- perform deployment consolidation work

## 10. Recommendation for the Next Prompt
The first milestone to execute should be:
- Milestone A — Canonical Schema Reconciliation Baseline

Why first:
- it has the lowest operational risk
- it does not require touching the live database yet
- it prepares the exact matrix needed to make Milestone B decisions and to compare against live DB truth in Milestone C
- it prevents the next steps from operating on vague schema narratives

Recommended next implementation prompt focus:
- execute Milestone A only
- produce a canonical schema reconciliation artifact at repo root
- compare all schema sources table-by-table and column-by-column
- do not modify code, do not inspect live DB yet, and do not design migration steps yet
- explicitly flag every conflict that must be resolved in Milestone B
