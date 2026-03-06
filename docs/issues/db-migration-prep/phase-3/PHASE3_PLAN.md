# Phase 3 Plan

## 1. Objective
Phase 3 is meant to deliver a working local Lifeline stack that runs against PostgreSQL only, implements the approved target schema and runtime behavior, supports a deterministic one-snapshot MSSQL-to-PostgreSQL local migration flow, and proves correctness through validation and local app verification.

This phase is implementation-oriented, but it is still local-only. Its purpose is to replace the current mixed MSSQL-plus-SQLite runtime with a PostgreSQL-first local development and migration path that is simple, deterministic, and aligned with the approved Phase 2 direction.

In practical terms, Phase 3 should accomplish all of the following:
- establish PostgreSQL as the single supported local database runtime
- remove SQLite fallback from the supported backend runtime path
- align entities, repositories, and runtime behavior to the approved target schema
- implement deterministic ETL tooling using one MSSQL source snapshot
- implement validation tooling and acceptance checks
- rehearse the migration locally and verify core application flows against PostgreSQL
- clean up only the contract drift that is necessary to align runtime behavior with the approved target model

## 2. Locked Inputs
This plan is based on the following approved and fixed inputs.

### Approved architectural direction
- PostgreSQL becomes the single future supported database
- SQLite fallback is removed from the supported architecture
- `notifications` are excluded from migration scope
- `user_profiles.birthday` is excluded from target schema and should be removed from runtime behavior

### Approved schema direction
- `users.auth0_sub` is mandatory and unique
- `users.email` is nullable and unique when present
- `todos.task_number` is retained and unique per user
- `user_profiles.start_day_of_week` is retained with explicit rules
- `user_profiles` is keyed by `user_id`
- `user_settings` is keyed by `user_id`
- `layout`, `subtasks`, and `recurrence` move to `jsonb`
- missing `user_profiles` and `user_settings` rows must be backfilled
- global default tags and user-owned custom tags remain the approved tag model

### Authoritative Phase 2 artifacts
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_B_DECISIONS.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_C_LIVE_DB_REPORT.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_E_MIGRATION_BLUEPRINT.md`
- `docs/issues/db-migration-prep/phase-2/PHASE2_MILESTONE_F_VALIDATION_READINESS.md`

### Locked Phase 3 discovery findings
- the runtime conversion surface is broad
- datasource and environment configuration are still MSSQL-only
- startup still contains SQLite fallback bootstrapping
- repositories still contain provider-specific logic
- entities still reflect MSSQL-oriented types and old one-to-one table shapes
- ETL tooling is not implemented
- validation tooling is not implemented
- the test suite still depends heavily on SQLite and provider-specific assumptions
- the current implementation risk is high

### Operational simplification used by this plan
This plan intentionally assumes:
- no zero-downtime requirement
- no dual-write period
- no incremental sync
- no continuity requirement for the old environment
- one source MSSQL snapshot is sufficient for local migration work
- correctness, simplicity, and deterministic local validation are more important than deployment continuity complexity

## 3. Recommended Phase 3 Strategy
The recommended Phase 3 strategy is to execute a local-first platform conversion in a fixed order:
1. stabilize PostgreSQL runtime foundations
2. make the approved PostgreSQL schema the sole backend authority
3. convert runtime persistence and startup behavior to that authority
4. implement simple deterministic ETL from one MSSQL snapshot
5. implement validation and test coverage around the new runtime and migration flow
6. run a full local migration rehearsal and verify core app behavior
7. clean up only the contract drift that directly conflicts with the approved target behavior

This is the recommended strategy because the project does not need continuity engineering. That allows Phase 3 to avoid unnecessary complexity such as sync layers, live cutover coordination, dual-write, and repeated reconciliation passes. The plan should instead optimize for:
- one stable target schema
- one supported runtime provider
- one deterministic extract/transform/import path
- one local validation model
- one clear readiness standard

This strategy also reduces risk by refusing to build ETL or validation against unstable runtime assumptions. Runtime and schema authority must be fixed first, then ETL can target the real local contract, and validation can measure the correct result.

## 4. Phase 3 Workstreams

### Workstream 1: PostgreSQL Runtime Foundation
- **Purpose**
  - Establish PostgreSQL as the only supported local backend provider and create the configuration baseline required for all later work.

- **Main surfaces/files**
  - `backend/package.json`
  - `backend/.env.example`
  - `backend/src/infra/db/data-source.js`
  - `backend/data-source-migrations.js`
  - backend runtime configuration and startup wiring surfaces

- **Deliverables**
  - PostgreSQL-capable backend dependency set
  - PostgreSQL-first datasource configuration for app runtime
  - PostgreSQL-first migration datasource configuration
  - clear local environment variable contract for PostgreSQL runtime and local migration execution
  - updated backend commands/scripts needed to support PostgreSQL local execution

- **Dependencies**
  - locked Phase 2 schema and migration direction
  - none of the later workstreams should begin implementation before this foundation is defined

- **Exit criteria**
  - backend configuration no longer depends on MSSQL-only datasource assumptions for the supported path
  - PostgreSQL runtime configuration exists and is documented
  - backend startup can be pointed at PostgreSQL as the intended local runtime target
  - package and script surfaces are ready for later schema/runtime conversion work

- **Risk level**
  - Medium
  - Reason: this work is bounded, but mistakes here affect every later workstream

### Workstream 2: Target Schema, Entity, and Repository Conversion
- **Purpose**
  - Make the approved PostgreSQL schema the only backend persistence authority and convert entity/repository behavior to match it.

- **Main surfaces/files**
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
  - any related validators and use-case surfaces that assume current persistence shapes

- **Deliverables**
  - entity model aligned to the approved target PostgreSQL schema
  - `user_profiles` converted to one-row-per-user keyed by `user_id`
  - `user_settings` converted to one-row-per-user keyed by `user_id`
  - repository logic aligned to native booleans and `jsonb`-style payload handling
  - removal of MSSQL-specific raw SQL and provider branches from supported repository behavior
  - repository behavior aligned to approved uniqueness and backfill expectations

- **Dependencies**
  - Workstream 1
  - authoritative schema decisions from Phase 2

- **Exit criteria**
  - entity definitions match the approved target schema rather than legacy MSSQL shapes
  - supported repositories no longer depend on MSSQL or SQLite semantics
  - JSON-like payloads are handled according to the target schema contract
  - repository behavior supports PostgreSQL-only runtime expectations

- **Risk level**
  - High
  - Reason: this is the largest source of persistence drift and touches core data behavior

### Workstream 3: Startup, Provider, and Runtime Path Cleanup
- **Purpose**
  - Remove unsupported provider behavior from supported runtime paths and make backend startup deterministic around PostgreSQL only.

- **Main surfaces/files**
  - `backend/src/index.js`
  - `backend/src/application/NotificationService.js`
  - `backend/src/middleware/attachCurrentUser.js`
  - SQLite repository wiring surfaces
  - startup/bootstrap error handling paths

- **Deliverables**
  - removal of SQLite fallback from the supported startup path
  - backend bootstrap behavior that fails clearly when PostgreSQL is unavailable instead of silently switching providers
  - provider selection and service wiring aligned to the PostgreSQL-only architecture
  - cleanup of unsupported runtime branches that only exist for MSSQL/SQLite coexistence

- **Dependencies**
  - Workstream 1
  - Workstream 2 should be substantially complete before this workstream is finalized

- **Exit criteria**
  - backend startup is deterministic around PostgreSQL only
  - SQLite fallback is no longer part of the supported runtime path
  - supported service wiring no longer assumes mixed-provider runtime behavior
  - local developers see explicit failure instead of hidden provider fallback

- **Risk level**
  - High
  - Reason: hidden fallback behavior may currently mask real defects that only appear once the fallback is removed

### Workstream 4: Target-Contract Cleanup for Excluded or Legacy Behavior
- **Purpose**
  - Remove only the runtime and API contract drift that directly conflicts with the approved target model.

- **Main surfaces/files**
  - `backend/src/index.js`
  - `backend/src/application/NotificationService.js`
  - `client/src/components/ProfilePanel.jsx`
  - `client/src/utils/api.js`
  - `client/src/providers/NotificationPoller.jsx`
  - any validators, route handlers, or request/response shapes that still persist excluded fields or expose excluded features

- **Deliverables**
  - runtime no longer persists or expects `birthday`
  - unsupported `notifications` flows removed, hard-disabled, or isolated from the approved local runtime path
  - frontend/backend contract surfaces aligned with the approved target behavior where necessary for local verification
  - a small, explicit list of any deferred legacy contract cleanup that is not needed for Phase 3 success

- **Dependencies**
  - Workstream 2
  - Workstream 3
  - coordination with Workstream 6 local verification needs

- **Exit criteria**
  - excluded fields and excluded feature paths no longer distort the supported local runtime behavior
  - core local verification does not depend on dead notification or `birthday` contracts
  - remaining contract surfaces are intentionally aligned or explicitly deferred

- **Risk level**
  - Medium
  - Reason: the technical scope is smaller than repository conversion, but contract drift can cause confusing regressions if left unresolved

### Workstream 5: Deterministic ETL Tooling Implementation
- **Purpose**
  - Build the simple one-snapshot local extract/transform/import flow approved in Phase 2.

- **Main surfaces/files**
  - `backend/scripts/init-db.js`
  - `backend/scripts/mark-migrations-applied.js`
  - `backend/scripts/verify-connection-v2.js`
  - `backend/scripts/test-mssql-connection.js`
  - `backend/src/scripts/reset-db.js`
  - `backend/src/scripts/soft-reset-db.js`
  - new ETL/export/import/transform/validation helper surfaces to be created during implementation
  - any staging artifact locations chosen for local rehearsal outputs

- **Deliverables**
  - source extraction flow using one approved MSSQL snapshot and explicit column selection
  - transform stage implementing approved normalization rules
  - backfill generation for missing `user_profiles` and `user_settings`
  - tag contradiction handling and staging cleanup rules
  - ordered PostgreSQL import flow
  - deterministic artifact and rerun handling for local rehearsal

- **Dependencies**
  - Workstream 1
  - Workstream 2
  - Workstream 3
  - authoritative blueprint from `PHASE2_MILESTONE_E_MIGRATION_BLUEPRINT.md`

- **Exit criteria**
  - extract/transform/import can run locally from one source snapshot to one local PostgreSQL target
  - transform rules align with the approved Phase 2 blueprint
  - rerun behavior is deterministic and documented
  - ETL output is ready for validation harness execution

- **Risk level**
  - High
  - Reason: data-quality edge cases, JSON normalization, and one-to-one backfill rules can all produce nontrivial transform failures

### Workstream 6: Validation Harness and Test Conversion
- **Purpose**
  - Prove that the new PostgreSQL runtime and ETL flow are correct, measurable, and repeatable.

- **Main surfaces/files**
  - `backend/test/**`
  - backend integration and repository tests
  - validation tooling surfaces implied by `PHASE2_MILESTONE_F_VALIDATION_READINESS.md`
  - any local evidence output/reporting locations chosen for migration validation
  - client tests only where required by contract cleanup or local verification support

- **Deliverables**
  - validation checks for schema, counts, uniqueness, foreign keys, backfills, and transform rejects
  - PostgreSQL-backed integration coverage for core backend flows
  - reduced dependence on SQLite-only test assumptions in supported validation paths
  - repeatable local validation outputs suitable for rehearsal sign-off

- **Dependencies**
  - Workstream 2
  - Workstream 3
  - Workstream 5

- **Exit criteria**
  - local validation can prove that migrated data and runtime behavior match the approved contract
  - core backend tests relevant to the supported runtime pass under PostgreSQL-backed execution
  - acceptance evidence can be generated repeatedly from the same rehearsal process

- **Risk level**
  - High
  - Reason: current tests encode legacy provider assumptions and may require significant adjustment

### Workstream 7: Local Migration Rehearsal and PostgreSQL App Verification
- **Purpose**
  - Run the full local end-to-end proof: migrate once from a source snapshot into PostgreSQL, then verify that the app works on the migrated local target.

- **Main surfaces/files**
  - local ETL artifacts and commands produced by Workstream 5
  - validation outputs produced by Workstream 6
  - backend runtime startup paths
  - core frontend/backend verification surfaces used during smoke testing

- **Deliverables**
  - one successful local rehearsal from source snapshot to local PostgreSQL target
  - validation evidence showing the rehearsal passed
  - local app smoke verification against PostgreSQL for core flows
  - written record of rehearsal outcome, issues found, and any remaining pre-deployment gaps

- **Dependencies**
  - Workstream 3
  - Workstream 4
  - Workstream 5
  - Workstream 6

- **Exit criteria**
  - a full local migration rehearsal completes successfully
  - validation outputs show acceptable results
  - backend runs locally against PostgreSQL only
  - core app behavior is verified on the migrated PostgreSQL data set

- **Risk level**
  - Medium-High
  - Reason: this work depends on all earlier workstreams and tends to expose integration defects late

## 5. Recommended Execution Order
The recommended full-phase execution order is:

1. **Workstream 1: PostgreSQL Runtime Foundation**
2. **Workstream 2: Target Schema, Entity, and Repository Conversion**
3. **Workstream 3: Startup, Provider, and Runtime Path Cleanup**
4. **Workstream 4: Target-Contract Cleanup for Excluded or Legacy Behavior**
5. **Workstream 5: Deterministic ETL Tooling Implementation**
6. **Workstream 6: Validation Harness and Test Conversion**
7. **Workstream 7: Local Migration Rehearsal and PostgreSQL App Verification**

### Why this order is recommended
- Workstream 1 comes first because all later implementation needs a real PostgreSQL runtime foundation.
- Workstream 2 comes second because ETL and validation should target the real approved schema, not the legacy persistence model.
- Workstream 3 follows once the target persistence layer is substantially defined, so startup and supported runtime behavior can be simplified around the new model.
- Workstream 4 comes before rehearsal because local verification should not continue to depend on excluded fields or excluded feature paths.
- Workstream 5 comes only after runtime/schema/provider assumptions are stable enough to receive migrated data.
- Workstream 6 follows ETL because validation needs real migration outputs and real PostgreSQL runtime behavior to test against.
- Workstream 7 is last because rehearsal should be the proof step, not the discovery step.

### Execution policy
The workstreams should be implemented in overlapping but controlled fashion where helpful, but the order above should remain the primary dependency order. The plan should avoid:
- building ETL against unstable schema/runtime assumptions
- trying to validate the end-to-end migration before startup/provider cleanup exists
- leaving contract drift unresolved until after local smoke verification

## 6. Contract Cleanup Recommendation
The recommendation is to handle **limited contract cleanup inside Phase 3**, not defer it entirely.

### Recommended policy
Phase 3 should clean up only the contract surfaces that directly block or distort the approved local PostgreSQL runtime and migration behavior.

### Specifically
- `birthday` cleanup should be included in Phase 3
  - Reason: it directly conflicts with the approved target schema and should not remain in supported runtime behavior.

- `notifications` cleanup should be included in Phase 3 in a narrow form
  - Reason: `notifications` are excluded from migration scope and currently depend on unsupported runtime assumptions. They should not remain part of the supported local PostgreSQL verification path.

- other mismatches should be included only when they are required to:
  - stop writing unsupported data
  - stop exposing dead or misleading runtime paths
  - allow local verification against the approved target behavior

### Not recommended
Phase 3 should not turn contract cleanup into a broad frontend redesign or a sweeping UX cleanup effort. The contract policy should remain narrow and target-aligned.

## 7. Readiness Gates
Phase 3 should be considered complete only when all of the following are true.

### Runtime and configuration gates
- backend runs locally against PostgreSQL only
- supported backend runtime no longer depends on SQLite fallback
- supported datasource and migration configuration are PostgreSQL-first and documented

### Schema and persistence gates
- approved target schema is implemented locally as the sole persistence authority
- `user_profiles` and `user_settings` follow the approved `user_id`-keyed one-row-per-user model
- supported repositories no longer rely on MSSQL/SQLite branches, stringified JSON contracts, or integer-boolean persistence assumptions

### Contract-alignment gates
- supported runtime no longer persists or depends on `user_profiles.birthday`
- `notifications` are removed, disabled, or isolated so they are not part of the supported local PostgreSQL path
- core local verification no longer depends on excluded legacy contracts

### ETL gates
- one-snapshot extract/transform/import runs locally and deterministically
- approved transform rules, backfills, and tag-handling rules are implemented
- ETL reruns are controlled and documented

### Validation gates
- validation checks can prove counts, uniqueness, foreign keys, backfills, and transform outcomes
- validation evidence is reproducible from rehearsal runs
- core backend tests for the supported runtime pass under PostgreSQL-backed execution

### End-to-end verification gates
- a full local migration rehearsal succeeds from the chosen MSSQL source snapshot into local PostgreSQL
- the app is verified locally against PostgreSQL for core flows such as user bootstrap, profile/settings access, todo CRUD, tag association, and statistics/export paths as applicable
- remaining known issues, if any, are documented and judged non-blocking for later deployment planning

## 8. Risks and Safeguards

### Risk 1: schema drift reappears during implementation
- **Safeguard**
  - Treat Phase 2 schema and blueprint documents as the sole planning authority.
  - Do not use current entities or legacy migrations as the design source of truth.

### Risk 2: SQLite fallback removal exposes hidden defects
- **Safeguard**
  - Sequence startup/provider cleanup after schema/entity conversion.
  - Require explicit PostgreSQL startup failure behavior and smoke validation.

### Risk 3: ETL complexity grows beyond the simplified migration goal
- **Safeguard**
  - Enforce the one-snapshot, offline-style local rehearsal model.
  - Reject dual-write, sync, and zero-downtime add-ons from Phase 3 scope.

### Risk 4: test churn becomes schedule-critical late in the phase
- **Safeguard**
  - Treat validation and test conversion as a first-class workstream, not a final cleanup step.
  - Focus first on tests that prove the supported PostgreSQL runtime and migration path.

### Risk 5: contract drift causes confusing verification failures
- **Safeguard**
  - Include narrow `birthday` and `notifications` cleanup inside Phase 3.
  - Align verification only to the approved supported runtime behavior.

### Risk 6: integration failures are discovered only at full rehearsal time
- **Safeguard**
  - Keep rehearsal last, but require workstream exit criteria before entering it.
  - Generate validation outputs before declaring rehearsal success.

### Risk 7: scope creep expands the phase into deployment work
- **Safeguard**
  - Keep Docker, Compose, VPS, production rollout, and broad frontend redesign explicitly out of scope.
  - Limit the phase to local runtime, local migration, and local correctness proof.

## 9. Out of Scope
Phase 3 will not do the following:
- Dockerization
- Docker Compose setup
- VPS preparation or server hardening
- production deployment or cutover execution
- zero-downtime or live continuity engineering
- dual-write or sync-layer implementation
- repeated production migration coordination
- broad frontend redesign
- broad repo hygiene work beyond what is strictly needed for target-runtime alignment
- future optimization work that is not required for correct local PostgreSQL runtime and deterministic migration rehearsal

## 10. Recommendation for the Phase 3 Implementation Prompt
The next implementation prompt should instruct the agent to execute the **full Phase 3 implementation** as one coordinated phase using the workstreams and dependency order in this plan.

That implementation prompt should explicitly require the agent to:
- use the Phase 2 artifacts as the authoritative schema, migration, and validation sources
- implement PostgreSQL runtime foundations first
- convert entities, repositories, and startup behavior to the approved PostgreSQL-only model
- remove SQLite fallback from the supported runtime path
- perform narrow contract cleanup for `birthday` and `notifications`
- implement deterministic one-snapshot ETL tooling for local MSSQL-to-PostgreSQL migration rehearsal
- implement validation tooling and convert the necessary tests to prove the supported runtime
- run a full local rehearsal and verify core app flows against PostgreSQL
- stay out of Docker, Compose, VPS, and production deployment work

The implementation prompt should also instruct the agent to work in a controlled order, validate after each major workstream, and produce a final implementation report summarizing what was changed, what passed, what remains risky, and what is deferred.