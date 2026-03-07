# Phase 6C Plan

## 1. Objective

Phase 6C will turn the discovery findings in [PHASE6C_DISCOVERY_REPORT.md](PHASE6C_DISCOVERY_REPORT.md) into a controlled, multi-workstream implementation program for Lifeline canonical documentation.

This plan is for execution discipline only. It does not start documentation implementation.

The objective is to ensure the later Phase 6C documentation pass is:

- implementation-accurate
- domain-separated
- fact-checked as it goes
- staged in small, reviewable batches
- governed by the existing Phase 6B documentation system
- explicit about stale-material handling
- closed workstream-by-workstream instead of performed as a single uncontrolled rewrite

## 2. Locked Inputs

The later implementation must treat the following as locked planning inputs:

- [PHASE6C_DISCOVERY_REPORT.md](PHASE6C_DISCOVERY_REPORT.md) as the primary discovery baseline
- the Phase 6B governance/documentation system already present in the repo, including:
  - [.github/copilot-instructions.md](.github/copilot-instructions.md)
  - [.github/instructions](.github/instructions)
  - [.github/prompts](.github/prompts)
  - [.github/skills](.github/skills)
  - [.github/agents](.github/agents)
  - [.github/teams](.github/teams)
  - [.github/workflows-governance](.github/workflows-governance)
  - [docs/templates](docs/templates)
  - [docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md](docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md)
  - [docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md](docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md)
- current production/runtime truth from:
  - [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md)
  - [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)
  - [deploy/scripts/apply-release.sh](deploy/scripts/apply-release.sh)
  - [compose.production.yaml](compose.production.yaml)
  - [Dockerfile](Dockerfile)
- current implementation truth from the codebase, especially:
  - [client/src/app/App.jsx](client/src/app/App.jsx)
  - [client/src/pages](client/src/pages)
  - [client/src/components](client/src/components)
  - [client/src/providers](client/src/providers)
  - [backend/src/index.js](backend/src/index.js)
  - [backend/src/application](backend/src/application)
  - [backend/src/infrastructure](backend/src/infrastructure)
  - [backend/src/infra/db](backend/src/infra/db)
  - [backend/src/middleware](backend/src/middleware)
  - [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)

The later implementation must also preserve the documentation-domain separation already established in the repo:

- [docs/product](docs/product)
- [docs/features](docs/features)
- [docs/frontend](docs/frontend)
- [docs/backend](docs/backend)
- [docs/api](docs/api)
- [docs/data-model](docs/data-model)
- [docs/architecture](docs/architecture)
- [docs/operations](docs/operations)
- [docs/adr](docs/adr)

## 3. Planning Principles

1. **Planning is workstream-based, not repo-wide in one pass.**
2. **Implementation truth wins over stale documentation.**
3. **A workstream must be fully closed before the next workstream begins.**
4. **Todos must be updated as each target document or document section is completed.**
5. **Every workstream must end with verification, coherence review, and explicit closeout.**
6. **Docs domains stay separated.** Product, features, frontend, backend, API, data model, architecture, operations, and ADRs are not to be collapsed into one generic documentation stream.
7. **Later implementation must use the existing governance system.** Documentation work should use the existing instructions, prompts, templates, ownership matrix, skills, agents, teams, and workflows rather than ad hoc writing.
8. **Downstream docs should not be written on unstable upstream concepts.** For example, backend/API docs should not finalize business-rule language before product/business behavior is stabilized.
9. **Reviewability beats speed.** Smaller, checkpointed batches are preferred over large speculative drafts.
10. **Historical material must be explicitly classified.** No stale doc should silently remain implied truth after canonical docs are written.

## 4. Documentation Quality and Verification Method

The later Phase 6C implementation should use the following writing method for every workstream and every document.

### 4.1 Unit of work

The implementation should write:

- one document at a time, or
- one clearly bounded document section at a time

It must not produce one giant multi-domain documentation dump.

### 4.2 Required write-check-continue loop

For each target document:

1. identify the exact implementation sources for that document
2. outline the sections before writing
3. write only the first section or first logical chunk
4. cross-check that section against code/runtime truth
5. revise if needed for accuracy and terminology consistency
6. then write the next section
7. repeat until the document is complete
8. do a final full-document coherence pass before marking the document done

### 4.3 Required verification after each section

After each new section is written, later implementation must verify:

- the claims match the current implementation
- the terminology matches earlier canonical docs already approved in previous workstreams
- the section does not contradict other sections in the same document
- the section does not drift into another docs domain
- stale archive/reference docs were used only as seed/context, not as automatic truth

### 4.4 Required stop-and-verify points

The later implementation must stop and verify before continuing when:

- a section introduces a major product/business rule
- a section defines API behavior, auth behavior, validation rules, or persistence rules
- a document starts depending on another document that is not yet stabilized
- implementation sources disagree with older docs or comments
- a document becomes large enough that internal coherence may drift

### 4.5 Full-document closeout checks

Before any target document is marked complete, later implementation must verify:

- the document is internally coherent
- the document reflects current implementation truth
- the document is extended enough to be practically useful
- the document follows the relevant template or governance conventions where applicable
- file placement is correct for its domain
- the document does not duplicate another canonical doc unnecessarily
- references to stale/historical sources are explicit when included

### 4.6 Workstream closeout checks

Before a workstream is closed, later implementation must verify:

- every target document in that workstream exists and is complete
- workstream todos are updated and marked closed
- cross-document terminology is consistent
- downstream docs are unblocked by stable upstream docs
- any stale docs/configs targeted by that workstream have an explicit handling decision

### 4.7 Quality expectations

Later implementation should optimize for documentation that is:

- extended enough to be useful
- clearly structured
- specific
- implementation-accurate
- coherent as a set
- consistent across domains
- written in staged, fact-checked increments

## 5. Recommended Workstreams / Subphases

### Workstream 6C.1 — Source-of-Truth Normalization and Stale-Surface Triage

**Purpose**

Stabilize what is authoritative, what is seed material, and what is historical before canonical writing begins.

**Outputs**

- a normalized source-of-truth reference note for implementation use
- explicit stale-material handling decisions
- clear classification of retained current vs historical materials

**Exact target document paths**

- [docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md](docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md) — refresh/normalize if needed during implementation
- [docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md](docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md) — validate against actual workstream ownership if needed
- [README.md](README.md) — planned later for refresh/supersession decisions, not yet in this planning pass
- [docs/reference/TESTING_CHECKLIST.md](docs/reference/TESTING_CHECKLIST.md) — classify as historical or refresh target
- [client/staticwebapp.config.json](client/staticwebapp.config.json) — classify as legacy/non-authoritative
- [client/swa-cli.config.json](client/swa-cli.config.json) — classify as legacy/non-authoritative
- [docs/archive/INTEGRATION_COMPLETE.md](docs/archive/INTEGRATION_COMPLETE.md)
- [docs/archive/IMPLEMENTATION_SUMMARY.md](docs/archive/IMPLEMENTATION_SUMMARY.md)
- [docs/archive/README_INTEGRATION.md](docs/archive/README_INTEGRATION.md)

**Dependencies**

- none; this is the required first workstream

**Risk level**

- low

**Exit criteria**

- authoritative source hierarchy is explicit
- all major stale docs/configs from discovery have a handling decision
- later workstreams can use stable terminology and source rules
- no ambiguous current-vs-historical surface remains in the execution plan

### Workstream 6C.2 — Product Concepts, Business Rules, and Feature Canon

**Purpose**

Establish canonical product-level understanding before frontend/backend/API documents depend on it.

**Outputs**

- product concepts overview
- task lifecycle behavior doc
- recurrence behavior doc
- guest vs authenticated mode doc
- onboarding/profile/settings product-behavior doc
- maintained feature inventory or feature summary set

**Exact target document paths**

- [docs/product/core-product-concepts.md](docs/product/core-product-concepts.md)
- [docs/product/task-lifecycle.md](docs/product/task-lifecycle.md)
- [docs/product/recurrence-behavior.md](docs/product/recurrence-behavior.md)
- [docs/product/identity-and-access-modes.md](docs/product/identity-and-access-modes.md)
- [docs/product/onboarding-profile-and-preferences.md](docs/product/onboarding-profile-and-preferences.md)
- [docs/features/README.md](docs/features/README.md) — refresh if needed to reflect canonical feature structure
- [docs/features/FEATURES.md](docs/features/FEATURES.md) — either refresh into a maintained canonical inventory or supersede with a planned feature-summary set

**Dependencies**

- requires Workstream 6C.1 closed

**Risk level**

- medium

**Exit criteria**

- product terminology is stable
- task lifecycle and recurrence semantics are canonically defined
- identity mode and onboarding behavior are documented from implementation truth
- feature inventory no longer mixes canonical truth with undefined backlog items without clear labeling
- frontend/backend/API workstreams can reference stable product language

### Workstream 6C.3 — Frontend Surface Canon

**Purpose**

Document the real user-visible frontend surface: routes, pages, layout, navigation, and major flows.

**Outputs**

- route/page inventory
- dashboard/home behavior doc
- date-routing behavior doc
- layout/navigation/responsive behavior doc
- search UX doc
- profile/settings/statistics/export-import frontend docs

**Exact target document paths**

- [docs/frontend/routes-and-pages.md](docs/frontend/routes-and-pages.md)
- [docs/frontend/dashboard-and-day-routing.md](docs/frontend/dashboard-and-day-routing.md)
- [docs/frontend/layout-navigation-and-responsive-behavior.md](docs/frontend/layout-navigation-and-responsive-behavior.md)
- [docs/frontend/advanced-search-flow.md](docs/frontend/advanced-search-flow.md)
- [docs/frontend/profile-and-onboarding-screens.md](docs/frontend/profile-and-onboarding-screens.md)
- [docs/frontend/settings-statistics-and-data-management.md](docs/frontend/settings-statistics-and-data-management.md)
- [docs/frontend/recurrence-ui.md](docs/frontend/recurrence-ui.md)
- [docs/frontend/ui-wireframe.md](docs/frontend/ui-wireframe.md) — refresh or explicitly leave as wireframe-only companion material

**Dependencies**

- requires Workstream 6C.1 closed
- should start only after Workstream 6C.2 is closed so product language is stable

**Risk level**

- medium

**Exit criteria**

- all primary routes and route aliases are documented
- dashboard/day-routing/search behaviors are clearly described
- responsive layout/navigation behavior is canonically described
- settings/profile/statistics/export-import surfaces are documented without leaking backend/API detail into frontend docs

### Workstream 6C.4 — Backend Runtime and API Contract Canon

**Purpose**

Document backend runtime composition, middleware/auth flow, and the real API contract by endpoint group.

**Outputs**

- backend runtime overview
- auth and current-user attachment flow docs
- endpoint-group docs for public/auth/todos/tags/stats/export/import/notifications-disabled behavior
- validation and error behavior docs

**Exact target document paths**

- [docs/backend/runtime-composition.md](docs/backend/runtime-composition.md)
- [docs/backend/auth-user-attachment-and-rbac.md](docs/backend/auth-user-attachment-and-rbac.md)
- [docs/backend/todo-services-and-use-cases.md](docs/backend/todo-services-and-use-cases.md)
- [docs/backend/tag-search-stats-and-data-transfer-services.md](docs/backend/tag-search-stats-and-data-transfer-services.md)
- [docs/api/public-and-health-endpoints.md](docs/api/public-and-health-endpoints.md)
- [docs/api/auth-profile-and-settings-endpoints.md](docs/api/auth-profile-and-settings-endpoints.md)
- [docs/api/todo-endpoints.md](docs/api/todo-endpoints.md)
- [docs/api/tag-endpoints.md](docs/api/tag-endpoints.md)
- [docs/api/stats-endpoints.md](docs/api/stats-endpoints.md)
- [docs/api/export-import-endpoints.md](docs/api/export-import-endpoints.md)
- [docs/api/validation-auth-and-error-behavior.md](docs/api/validation-auth-and-error-behavior.md)

**Dependencies**

- requires Workstream 6C.1 closed
- should start only after Workstream 6C.2 is closed
- should ideally follow Workstream 6C.3 so frontend naming can inform public-facing endpoint wording where needed

**Risk level**

- high

**Exit criteria**

- backend runtime/service boundaries are documented
- endpoint groups are documented from implementation truth, not just swagger base spec
- auth, validation, and error behavior are explicit
- disabled notifications behavior is clearly documented as disabled/current-state
- backend and API docs are coherent with product docs and do not contradict frontend docs

### Workstream 6C.5 — Data Model and Persistence Canon

**Purpose**

Document entities, tables, ownership rules, persistence constraints, and current-vs-historical schema truth.

**Outputs**

- entity/table overview
- ownership/relationship docs
- persistence rules for recurrence, subtasks, task numbering, default/custom tags
- migration-history/current-truth clarification

**Exact target document paths**

- [docs/data-model/overview-and-current-source-of-truth.md](docs/data-model/overview-and-current-source-of-truth.md)
- [docs/data-model/users-profiles-and-settings.md](docs/data-model/users-profiles-and-settings.md)
- [docs/data-model/todos-tags-and-relationships.md](docs/data-model/todos-tags-and-relationships.md)
- [docs/data-model/recurrence-subtasks-and-task-numbering.md](docs/data-model/recurrence-subtasks-and-task-numbering.md)
- [docs/data-model/migrations-and-historical-schema-context.md](docs/data-model/migrations-and-historical-schema-context.md)

**Dependencies**

- requires Workstream 6C.1 closed
- should start after Workstream 6C.4 so API/backend language and persistence terminology are aligned

**Risk level**

- medium

**Exit criteria**

- current Postgres/TypeORM truth is explicit
- entity relationships and ownership rules are clearly documented
- historical SQL/MSSQL artifacts are correctly framed as legacy context
- recurrence/task numbering/tag ownership persistence rules are documented consistently with backend/product docs

### Workstream 6C.6 — Architecture and Operations Canon

**Purpose**

Document system boundaries, runtime topology, deployment flow, and operations/runbook truth.

**Outputs**

- architecture overview
- runtime topology doc
- production deployment model doc
- runbook/setup refreshes
- ADR decisions list if durable design clarifications are needed

**Exact target document paths**

- [docs/architecture/system-overview.md](docs/architecture/system-overview.md)
- [docs/architecture/runtime-topology.md](docs/architecture/runtime-topology.md)
- [docs/architecture/frontend-backend-data-boundaries.md](docs/architecture/frontend-backend-data-boundaries.md)
- [docs/operations/QUICK_START.md](docs/operations/QUICK_START.md) — refresh if needed
- [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md) — refresh if needed
- [docs/operations/local-development-and-runtime-setup.md](docs/operations/local-development-and-runtime-setup.md)
- [docs/operations/production-runtime-and-rollback.md](docs/operations/production-runtime-and-rollback.md)
- [docs/operations/deployment-verification-and-smoke-checks.md](docs/operations/deployment-verification-and-smoke-checks.md)
- [docs/adr](docs/adr) — add ADRs only if the implementation uncovers durable architectural decisions that need explicit records

**Dependencies**

- requires Workstream 6C.1 closed
- should start after Workstreams 6C.4 and 6C.5 are closed so runtime and data boundaries are already stable

**Risk level**

- medium

**Exit criteria**

- architecture boundaries and runtime topology are explicit
- operations docs reflect the current VPS/deploy-branch reality
- local-dev and production runbooks are coherent with actual runtime files
- any necessary ADRs are identified and either added or explicitly deferred with reason

## 6. Ordered Todo Backlog by Workstream

### Workstream 6C.1 — Source-of-Truth Normalization and Stale-Surface Triage

1. review [PHASE6C_DISCOVERY_REPORT.md](PHASE6C_DISCOVERY_REPORT.md) and extract all stale-surface findings into an execution checklist
2. classify each identified stale item as one of:
   - supersede later
   - refresh later
   - archive/leave historical
   - ignore as non-authoritative legacy context
3. confirm the authoritative source hierarchy by domain using current implementation files
4. verify that the ownership matrix and backlog references still match intended domain separation
5. define canonical terminology for:
   - guest mode
   - authenticated mode
   - onboarding
   - recurrence modes
   - deploy-branch production model
6. record which existing docs are seed material only and must not be reused without verification
7. perform a final stale-surface review before closing the workstream

### Workstream 6C.2 — Product Concepts, Business Rules, and Feature Canon

1. outline the canonical product document set before writing any content
2. write [docs/product/core-product-concepts.md](docs/product/core-product-concepts.md)
3. cross-check it against current implementation before marking complete
4. write [docs/product/identity-and-access-modes.md](docs/product/identity-and-access-modes.md)
5. cross-check guest/auth/onboarding claims against frontend and backend identity flow
6. write [docs/product/task-lifecycle.md](docs/product/task-lifecycle.md)
7. verify task lifecycle against todo creation, update, archive, unarchive, delete, and task-number behavior
8. write [docs/product/recurrence-behavior.md](docs/product/recurrence-behavior.md)
9. explicitly verify modern recurrence UX modes vs legacy accepted recurrence shapes
10. write [docs/product/onboarding-profile-and-preferences.md](docs/product/onboarding-profile-and-preferences.md)
11. verify week-start/profile/preferences claims against frontend and persistence behavior
12. refresh or supersede [docs/features/FEATURES.md](docs/features/FEATURES.md) into a maintained feature inventory approach
13. do a cross-document coherence review across all product/features outputs
14. mark all product/features todos closed only after coherence review passes

### Workstream 6C.3 — Frontend Surface Canon

1. build a route/page inventory from [client/src/app/App.jsx](client/src/app/App.jsx) and related page files
2. write [docs/frontend/routes-and-pages.md](docs/frontend/routes-and-pages.md)
3. verify all routes, aliases, and protected-route behavior against implementation
4. write [docs/frontend/dashboard-and-day-routing.md](docs/frontend/dashboard-and-day-routing.md)
5. verify selected-day syncing, deep linking, guest banners, and dashboard behavior against implementation
6. write [docs/frontend/layout-navigation-and-responsive-behavior.md](docs/frontend/layout-navigation-and-responsive-behavior.md)
7. cross-check with [docs/frontend/ui-wireframe.md](docs/frontend/ui-wireframe.md) and actual layout components
8. write [docs/frontend/advanced-search-flow.md](docs/frontend/advanced-search-flow.md)
9. verify server/client fallback, batch operations, and jump-to-day behavior against implementation
10. write [docs/frontend/profile-and-onboarding-screens.md](docs/frontend/profile-and-onboarding-screens.md)
11. write [docs/frontend/settings-statistics-and-data-management.md](docs/frontend/settings-statistics-and-data-management.md)
12. write [docs/frontend/recurrence-ui.md](docs/frontend/recurrence-ui.md)
13. decide whether [docs/frontend/ui-wireframe.md](docs/frontend/ui-wireframe.md) is refreshed as companion material or left as design support with explicit scope
14. perform a frontend-wide consistency review before closing the workstream

### Workstream 6C.4 — Backend Runtime and API Contract Canon

1. map backend runtime composition from [backend/src/index.js](backend/src/index.js) and supporting modules
2. write [docs/backend/runtime-composition.md](docs/backend/runtime-composition.md)
3. write [docs/backend/auth-user-attachment-and-rbac.md](docs/backend/auth-user-attachment-and-rbac.md)
4. verify auth, `AUTH_DISABLED`, current-user attachment, roles, and error normalization against middleware implementation
5. write [docs/backend/todo-services-and-use-cases.md](docs/backend/todo-services-and-use-cases.md)
6. write [docs/backend/tag-search-stats-and-data-transfer-services.md](docs/backend/tag-search-stats-and-data-transfer-services.md)
7. create the API endpoint-group docs in this order:
   - [docs/api/public-and-health-endpoints.md](docs/api/public-and-health-endpoints.md)
   - [docs/api/auth-profile-and-settings-endpoints.md](docs/api/auth-profile-and-settings-endpoints.md)
   - [docs/api/todo-endpoints.md](docs/api/todo-endpoints.md)
   - [docs/api/tag-endpoints.md](docs/api/tag-endpoints.md)
   - [docs/api/stats-endpoints.md](docs/api/stats-endpoints.md)
   - [docs/api/export-import-endpoints.md](docs/api/export-import-endpoints.md)
   - [docs/api/validation-auth-and-error-behavior.md](docs/api/validation-auth-and-error-behavior.md)
8. after each API doc, verify request/response/error/auth behavior against route code, middleware, and validators
9. explicitly document notification endpoints as disabled/current-state where relevant
10. perform a backend/API coherence pass across all backend and API outputs
11. close the workstream only after the endpoint-group set is complete and consistent

### Workstream 6C.5 — Data Model and Persistence Canon

1. derive the current entity/table truth from TypeORM entities and the Postgres migration chain
2. write [docs/data-model/overview-and-current-source-of-truth.md](docs/data-model/overview-and-current-source-of-truth.md)
3. write [docs/data-model/users-profiles-and-settings.md](docs/data-model/users-profiles-and-settings.md)
4. write [docs/data-model/todos-tags-and-relationships.md](docs/data-model/todos-tags-and-relationships.md)
5. write [docs/data-model/recurrence-subtasks-and-task-numbering.md](docs/data-model/recurrence-subtasks-and-task-numbering.md)
6. write [docs/data-model/migrations-and-historical-schema-context.md](docs/data-model/migrations-and-historical-schema-context.md)
7. verify ownership, constraints, JSONB usage, indexes, and relationship claims against migrations/entities/repositories
8. explicitly classify MSSQL and older SQL artifacts as historical context only
9. run a cross-check against product/backend/API docs for terminology consistency
10. close the workstream only after persistence terminology is stable across domains

### Workstream 6C.6 — Architecture and Operations Canon

1. map the current architecture from runtime, build, deploy, and reverse-proxy files
2. write [docs/architecture/system-overview.md](docs/architecture/system-overview.md)
3. write [docs/architecture/runtime-topology.md](docs/architecture/runtime-topology.md)
4. write [docs/architecture/frontend-backend-data-boundaries.md](docs/architecture/frontend-backend-data-boundaries.md)
5. refresh [docs/operations/QUICK_START.md](docs/operations/QUICK_START.md) only after current runtime/setup truth is confirmed
6. refresh [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md) only if new canonical operations wording is needed
7. write [docs/operations/local-development-and-runtime-setup.md](docs/operations/local-development-and-runtime-setup.md)
8. write [docs/operations/production-runtime-and-rollback.md](docs/operations/production-runtime-and-rollback.md)
9. write [docs/operations/deployment-verification-and-smoke-checks.md](docs/operations/deployment-verification-and-smoke-checks.md)
10. decide whether an ADR is needed for any durable architectural clarification uncovered during writing
11. if needed, add ADRs under [docs/adr](docs/adr) in a final bounded step
12. perform a full architecture/operations coherence review before closeout

## 7. Workstream Dependencies and Sequencing Rules

### 7.1 Required order

The recommended execution order is:

1. Workstream 6C.1 — Source-of-Truth Normalization and Stale-Surface Triage
2. Workstream 6C.2 — Product Concepts, Business Rules, and Feature Canon
3. Workstream 6C.3 — Frontend Surface Canon
4. Workstream 6C.4 — Backend Runtime and API Contract Canon
5. Workstream 6C.5 — Data Model and Persistence Canon
6. Workstream 6C.6 — Architecture and Operations Canon

### 7.2 Strict advancement rule

A workstream must be fully completed, checked, and explicitly closed before the next workstream begins.

That means:

- all target docs for the current workstream are complete
- all current-workstream todos are updated and marked closed
- coherence review is complete
- no major factual uncertainty remains in the current workstream outputs

### 7.3 No downstream writing on unstable upstream concepts

Later implementation must not:

- write frontend docs before product/business rules are stabilized
- finalize backend/API docs before product terminology is stable
- finalize data-model docs before backend/API terminology is stable
- finalize architecture/operations docs before backend/runtime/data truth is stable

### 7.4 Checkpoint rule

At every workstream boundary, the implementation should checkpoint progress by:

- confirming target docs completed
- confirming todos updated
- confirming no unresolved contradictions remain
- confirming the next workstream has stable upstream inputs

### 7.5 Todo discipline rule

Later implementation must maintain an active todo list throughout Phase 6C implementation.

At minimum:

- each workstream should have a bounded active todo set
- todos should be updated as each target document is completed
- a workstream should not be marked complete until all of its todos are closed

## 8. Stale-Documentation and Historical-Material Handling Plan

### 8.1 Supersede later with canonical docs

These should later be superseded by canonical docs or canonical doc sets:

- [README.md](README.md) — refresh after canonical docs exist so the repo overview matches current reality
- [docs/features/FEATURES.md](docs/features/FEATURES.md) — refresh or supersede with a maintained canonical feature inventory structure

### 8.2 Refresh later as part of canonicalization

These are current but may need refreshes during implementation:

- [docs/operations/QUICK_START.md](docs/operations/QUICK_START.md)
- [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md)
- [docs/frontend/ui-wireframe.md](docs/frontend/ui-wireframe.md) — only if retained as active companion material
- [docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md](docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md) — if implementation tracking requires cleanup

### 8.3 Leave as historical with explicit warning/scope

These should remain historical/reference material unless later implementation deliberately refreshes them with clear scope:

- [docs/archive/INTEGRATION_COMPLETE.md](docs/archive/INTEGRATION_COMPLETE.md)
- [docs/archive/IMPLEMENTATION_SUMMARY.md](docs/archive/IMPLEMENTATION_SUMMARY.md)
- [docs/archive/README_INTEGRATION.md](docs/archive/README_INTEGRATION.md)
- [docs/reference/TESTING_CHECKLIST.md](docs/reference/TESTING_CHECKLIST.md)

If retained, later implementation should ensure they are not implicitly treated as active canonical truth.

### 8.4 Ignore as non-authoritative legacy context

These should be treated as legacy context only unless a later cleanup phase decides to remove or archive them more aggressively:

- [client/staticwebapp.config.json](client/staticwebapp.config.json)
- [client/swa-cli.config.json](client/swa-cli.config.json)
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
- [backend/migrations/005_add_start_day_to_user_profiles.sql](backend/migrations/005_add_start_day_to_user_profiles.sql)
- [backend/migrations/006_add_check_constraint_start_day.sql](backend/migrations/006_add_check_constraint_start_day.sql)
- [backend/db/mssql-init.sql](backend/db/mssql-init.sql)

### 8.5 Handling rule during implementation

Later implementation must follow this rule:

- stale docs may be consulted for hints, structure, or migration history
- stale docs may not be copied forward as truth without code verification
- if stale docs are kept, their scope must be explicit
- if stale docs are superseded, the canonical replacement must be clear by path and domain

## 9. Risks and Safeguards

### 9.1 Risk: stale-material contamination

**Safeguard**

Use Workstream 6C.1 as a mandatory gate. No canonical writing should begin before stale-surface classification is done.

### 9.2 Risk: one-pass uncontrolled rewrite

**Safeguard**

Use the workstream sequence in this plan. Write one document or one bounded section at a time. Stop at workstream checkpoints.

### 9.3 Risk: cross-domain drift and duplication

**Safeguard**

Use the ownership matrix and keep domain placement strict. Product, frontend, backend, API, data-model, architecture, operations, and ADR docs must remain separated.

### 9.4 Risk: factual drift inside long docs

**Safeguard**

Require section-by-section verification and full-document coherence checks before marking documents done.

### 9.5 Risk: unstable upstream concepts causing rework

**Safeguard**

Do not advance to downstream workstreams until upstream documents and terminology are stable and closed.

### 9.6 Risk: backend/API documentation based only on generated spec

**Safeguard**

Require implementation-first API documentation: route code, middleware, validators, repositories, and runtime behavior must outrank the static swagger base spec.

### 9.7 Risk: architecture/ops docs lagging behind runtime truth

**Safeguard**

Architecture and operations documents should be written after backend and data-model workstreams so runtime and persistence truth are already stabilized.

### 9.8 Risk: governance system bypass

**Safeguard**

Later implementation should explicitly use the existing instructions, prompts, templates, skills, agents, teams, workflows, and ownership matrix. Phase 6C implementation should not proceed as unstructured repo-note writing.

## 10. Recommendation for the Phase 6C Implementation Prompt

The later implementation prompt should:

1. reference [PHASE6C_PLAN.md](PHASE6C_PLAN.md) and [PHASE6C_DISCOVERY_REPORT.md](PHASE6C_DISCOVERY_REPORT.md)
2. request **implementation of exactly one workstream at a time**
3. require todo tracking during execution
4. require section-by-section writing and verification
5. require strict domain separation
6. require a workstream closeout summary before advancing
7. prohibit jumping ahead to downstream workstreams before upstream stabilization

Recommended implementation-prompt shape:

- identify the specific workstream to execute
- list the target document paths for that workstream only
- require:
  - writing one document or one section at a time
  - cross-checking each section against implementation before continuing
  - updating todos as documents are completed
  - running a coherence review before closing the workstream
  - explicitly handling any stale docs/configs touched by that workstream
- require a final response that includes:
  - what was completed
  - which docs were created or updated
  - whether the workstream is fully closed
  - whether the repo is ready for the next workstream

Recommended implementation constraint:

- never execute more than one workstream in a single implementation pass unless the user explicitly asks for multi-workstream execution after reviewing the previous checkpoint.
