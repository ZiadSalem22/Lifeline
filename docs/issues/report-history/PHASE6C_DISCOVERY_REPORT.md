# Phase 6C Discovery Report

## 1. Executive Summary

Phase 6C is ready to move from documentation-system scaffolding into canonical project documentation work. The repository now has a strong documentation governance layer, but the actual canonical docs are still thin across most long-term domains.

Discovery shows four major realities:

1. **The real source of truth is the codebase, not the current long-term docs.** Most active docs folders contain placeholders or scaffolding only, while the actual implementation lives in the frontend, backend, migrations, deploy files, and runtime configuration.
2. **There is useful retained material, but much of it is stale.** Older archive/reference docs still describe now-disabled notifications, older recurrence behavior, SQLite/MSSQL-era persistence assumptions, and Azure-era deployment remnants.
3. **The app has enough real implementation complexity to justify multiple canonical documentation workstreams.** Product behavior, frontend flows, backend/API contracts, persistence, and operations all have meaningful scope.
4. **Phase 6C should be executed as multiple subphases, not one monolithic writing pass.** Product/features/frontend can move first, but backend/API/data-model/architecture/operations need their own focused passes because they depend on code-accurate extraction and stale-doc cleanup.

In short: the repo is documentation-governed, but not yet documentation-complete.

## 2. Locked Inputs

This discovery pass treated the following as locked inputs:

- The Phase 6A/6B documentation system and governance stack already implemented in the repo.
- The current production deployment model documented in [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md) and implemented in [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml) plus [deploy/scripts/apply-release.sh](deploy/scripts/apply-release.sh).
- The current codebase as the primary source of truth, especially:
  - frontend behavior in [client/src/app/App.jsx](client/src/app/App.jsx), [client/src/pages](client/src/pages), [client/src/components](client/src/components), and [client/src/providers](client/src/providers)
  - backend behavior in [backend/src/index.js](backend/src/index.js), [backend/src/application](backend/src/application), [backend/src/infrastructure](backend/src/infrastructure), [backend/src/infra/db](backend/src/infra/db), and [backend/src/middleware](backend/src/middleware)
  - persistence shape in [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js) and related entity schemas
- The user instruction for this pass: **discovery only**; do not start canonical doc writing yet.

## 3. Existing Documentation and Source-of-Truth Findings

### 3.1 Current long-term docs state

The long-term docs tree is correctly scaffolded in [docs/README.md](docs/README.md), but most domain folders are still placeholders:

- [docs/product/README.md](docs/product/README.md)
- [docs/backend/README.md](docs/backend/README.md)
- [docs/api/README.md](docs/api/README.md)
- [docs/data-model/README.md](docs/data-model/README.md)
- [docs/architecture/README.md](docs/architecture/README.md)

These establish intended destinations, but not canonical content yet.

### 3.2 Existing useful retained docs

Useful seed material exists, but needs curation before reuse:

- [docs/features/FEATURES.md](docs/features/FEATURES.md)
  - useful as a rough inventory of implemented vs aspirational features
  - not canonical yet because it mixes shipped items with backlog ideas
- [docs/frontend/ui-wireframe.md](docs/frontend/ui-wireframe.md)
  - useful for layout/navigation/responsive behavior
  - especially relevant to `TopBar`, `Sidebar`, and mobile drawer behavior
- [docs/operations/QUICK_START.md](docs/operations/QUICK_START.md)
  - useful concise operator/dev setup starting point
- [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md)
  - current and important for production operations
- [docs/reference/TESTING_CHECKLIST.md](docs/reference/TESTING_CHECKLIST.md)
  - useful historically, but partially stale
- archive docs such as:
  - [docs/archive/INTEGRATION_COMPLETE.md](docs/archive/INTEGRATION_COMPLETE.md)
  - [docs/archive/IMPLEMENTATION_SUMMARY.md](docs/archive/IMPLEMENTATION_SUMMARY.md)
  - [docs/archive/README_INTEGRATION.md](docs/archive/README_INTEGRATION.md)

### 3.3 Major stale or misleading documentation surfaces

The repo contains several documents/configs that should be treated as historical or stale inputs, not direct truth:

- [README.md](README.md)
  - still describes SQLite as a default development database and older architecture assumptions
  - still advertises browser notifications as active
  - includes subpath/basename guidance that does not match [client/src/app/main.jsx](client/src/app/main.jsx)
- [docs/reference/TESTING_CHECKLIST.md](docs/reference/TESTING_CHECKLIST.md)
  - still assumes live notifications and SQLite-era behavior
- [docs/archive/README_INTEGRATION.md](docs/archive/README_INTEGRATION.md) and [docs/archive/IMPLEMENTATION_SUMMARY.md](docs/archive/IMPLEMENTATION_SUMMARY.md)
  - useful history, but now inaccurate in multiple places
- [client/staticwebapp.config.json](client/staticwebapp.config.json)
  - still points to an Azure Static Web Apps / Azure App Service backend URL
- [client/swa-cli.config.json](client/swa-cli.config.json)
  - Azure SWA local tooling artifact; likely no longer part of the active production story
- [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql), [backend/migrations/005_add_start_day_to_user_profiles.sql](backend/migrations/005_add_start_day_to_user_profiles.sql), and [backend/migrations/006_add_check_constraint_start_day.sql](backend/migrations/006_add_check_constraint_start_day.sql)
  - useful historical migration intent, but no longer the authoritative live schema compared to the TypeORM/Postgres migration chain
- [backend/db/mssql-init.sql](backend/db/mssql-init.sql)
  - historical MSSQL setup artifact, not the current live runtime model

### 3.4 Source-of-truth conclusion

For canonical Phase 6C docs, the real documentation source hierarchy should be:

1. **Current code and runtime files**
2. **Current deploy/runtime docs**
3. **Retained reference/archive docs as historical seed material only**
4. **Older Azure/SQLite/MSSQL artifacts as non-authoritative context**

## 4. Product and Business-Logic Documentation Surfaces

### 4.1 Core product concepts discovered

The current product is not just a generic todo list. Canonical product docs will need to explain:

- authenticated vs guest usage modes
- task lifecycle and per-user task numbering
- recurrence modes and their behavioral differences
- tagging, including default vs custom tags
- onboarding/profile completion as part of first-use flow
- settings and preference persistence
- statistics and time-based aggregation behavior
- import/export and account reset behavior
- role-sensitive limits (free-tier limits are implemented server-side)

### 4.2 Main product/business-rule files

Primary business-rule sources discovered:

- [backend/src/domain/Todo.js](backend/src/domain/Todo.js)
  - task entity fields and lifecycle toggles
- [backend/src/application/CreateTodo.js](backend/src/application/CreateTodo.js)
  - creation rules, recurrence expansion, per-user task numbering
- [backend/src/application/RecurrenceService.js](backend/src/application/RecurrenceService.js)
  - recurrence semantics and next-occurrence generation
- [backend/src/application/CompleteRecurringTodo.js](backend/src/application/CompleteRecurringTodo.js)
  - recurrence completion behavior
- [backend/src/application/TagUseCases.js](backend/src/application/TagUseCases.js)
  - custom tag creation/update/delete rules
- [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js)
  - archived vs active behavior, search semantics, statistics aggregation
- [backend/src/infrastructure/TypeORMTagRepository.js](backend/src/infrastructure/TypeORMTagRepository.js)
  - default/custom tag separation and ownership enforcement
- [backend/src/index.js](backend/src/index.js)
  - free-tier limits, export/import behavior, settings/profile flows, stats fallback behavior
- [client/src/providers/TodoProvider.jsx](client/src/providers/TodoProvider.jsx)
  - date filtering, guest fallback, search/filter behavior, date-range recurrence rendering
- [client/src/utils/guestApi.js](client/src/utils/guestApi.js)
  - local-only guest behavior mirroring many backend task flows

### 4.3 Product behaviors that clearly need canonical docs

#### Task lifecycle

Canonical product docs should explain:

- create/edit/delete behavior
- completion vs archive vs unarchive
- flagged state
- due date and due time
- subtasks and duration
- immutable per-user `taskNumber`
- guest-mode local persistence vs authenticated persistence

#### Recurrence behavior

This is one of the highest-priority product documentation gaps.

The live implementation supports modern recurrence modes in [client/src/components/calendar/RecurrenceSelector.jsx](client/src/components/calendar/RecurrenceSelector.jsx) and [backend/src/application/CreateTodo.js](backend/src/application/CreateTodo.js):

- `daily`
- `dateRange`
- `specificDays`

There is also legacy recurrence support still present in backend logic:

- `daily`
- `weekly`
- `monthly`
- `custom`

That means canonical docs will need to distinguish:

- current UX-supported recurrence modes
- legacy recurrence shapes still accepted/handled in code and imports
- the special behavior of `dateRange` tasks, which behave as one logical task across a span rather than generating an endless chain of future tasks

#### Tag model

The tag system has real business rules and needs explicit docs:

- default tags are seeded in [backend/src/infra/db/defaultTags.js](backend/src/infra/db/defaultTags.js)
- default tags are global and immutable for users
- custom tags are user-owned
- free-tier custom tag count is limited server-side

#### Identity and onboarding

Product docs should describe:

- Auth0-based authenticated mode
- local-only guest mode
- onboarding requirement before full use for authenticated users
- profile persistence and week-start preference implications

Primary files:

- [client/src/pages/OnboardingPage.jsx](client/src/pages/OnboardingPage.jsx)
- [client/src/providers/AuthProvider.jsx](client/src/providers/AuthProvider.jsx)
- [backend/src/middleware/attachCurrentUser.js](backend/src/middleware/attachCurrentUser.js)
- [backend/src/index.js](backend/src/index.js)

## 5. Frontend Documentation Surfaces

### 5.1 App shell and navigation

The main frontend orchestration lives in [client/src/app/App.jsx](client/src/app/App.jsx). It is large and currently acts as the functional source of truth for:

- top-level route map
- guest banners
- day-route deep linking
- modal/state orchestration
- search-driven navigation
- task creation/editing orchestration

App shell/layout/navigation sources:

- [client/src/app/main.jsx](client/src/app/main.jsx)
- [client/src/app/App.jsx](client/src/app/App.jsx)
- [client/src/components/layout/AppLayout.jsx](client/src/components/layout/AppLayout.jsx)
- [client/src/components/layout/Sidebar.jsx](client/src/components/layout/Sidebar.jsx)
- [client/src/components/layout/TopBar.jsx](client/src/components/layout/TopBar.jsx)
- [docs/frontend/ui-wireframe.md](docs/frontend/ui-wireframe.md)

### 5.2 Main routes/pages discovered

Current major routes and corresponding page surfaces include:

- `/` and `/day/:day` → dashboard/home behavior in [client/src/app/App.jsx](client/src/app/App.jsx) plus [client/src/pages/DashboardPage.jsx](client/src/pages/DashboardPage.jsx)
- `/profile` → [client/src/pages/ProfilePage.jsx](client/src/pages/ProfilePage.jsx)
- `/onboarding` → [client/src/pages/OnboardingPage.jsx](client/src/pages/OnboardingPage.jsx)
- `/search` and `/advanced-search` → [client/src/pages/AdvancedSearchPage.jsx](client/src/pages/AdvancedSearchPage.jsx)
- `/statistics` and `/stats` → [client/src/pages/StatisticsPage.jsx](client/src/pages/StatisticsPage.jsx)
- `/auth` → [client/src/pages/AuthPage.jsx](client/src/pages/AuthPage.jsx)

### 5.3 Important frontend flow surfaces

#### Auth and identity UX

- [client/src/providers/AuthAdapterProvider.jsx](client/src/providers/AuthAdapterProvider.jsx)
- [client/src/providers/AuthProvider.jsx](client/src/providers/AuthProvider.jsx)
- [client/src/components/auth/ProtectedRoute.jsx](client/src/components/auth/ProtectedRoute.jsx)
- [client/src/hooks/useApi.js](client/src/hooks/useApi.js)

These govern:

- Auth0 vs local-auth-disabled runtime
- token retrieval and refresh behavior
- redirect to `/auth`
- identity load and `currentUser` hydration
- guest fallback when auth fails

#### Dashboard/task management UX

Main dashboard behavior is spread across:

- [client/src/app/App.jsx](client/src/app/App.jsx)
- [client/src/providers/TodoProvider.jsx](client/src/providers/TodoProvider.jsx)

Important documented behaviors to capture later:

- selected-day routing and syncing
- active search hiding parts of the normal home flow
- add-task panel and template-load behavior via task number lookup
- grouping incomplete tasks before completed tasks
- date-range recurrence rendering on day views

#### Search UX

- [client/src/components/search/AdvancedSearch.jsx](client/src/components/search/AdvancedSearch.jsx)

This is a real feature surface, not just a helper view. It includes:

- server-side search filters
- client-side preview/fallback behavior
- month preloading
- batch operations on selected results
- task-number search
- jump-to-day behavior

#### Settings/profile/statistics/export/import UX

- [client/src/components/settings/Settings.jsx](client/src/components/settings/Settings.jsx)
- [client/src/components/settings/ExportImport.jsx](client/src/components/settings/ExportImport.jsx)
- [client/src/components/settings/ExportDataModal.jsx](client/src/components/settings/ExportDataModal.jsx)
- [client/src/components/ProfilePanel.jsx](client/src/components/ProfilePanel.jsx)
- [client/src/components/statistics/Statistics.jsx](client/src/components/statistics/Statistics.jsx)

These need their own canonical frontend docs because they are user-facing feature surfaces with meaningful behavior, not just implementation details.

### 5.4 Frontend-specific documentation gap assessment

Frontend is one of the most documentable surfaces because the route/page/component set is already visible and stable enough. The biggest gaps are:

- no canonical route/page inventory
- no canonical explanation of guest vs authenticated UI behavior
- no canonical dashboard/task flow write-up
- no canonical search flow write-up
- no canonical settings/profile/statistics flow docs
- no canonical recurrence UX doc

## 6. Backend and API Documentation Surfaces

### 6.1 Backend architecture surfaces discovered

The backend is effectively centered around [backend/src/index.js](backend/src/index.js) plus application/repository layers.

Important backend surfaces:

- startup/runtime wiring in [backend/src/index.js](backend/src/index.js)
- use cases in [backend/src/application](backend/src/application)
- middleware in [backend/src/middleware](backend/src/middleware)
- repositories in [backend/src/infrastructure](backend/src/infrastructure)
- entity/data-source definitions in [backend/src/infra/db](backend/src/infra/db)

### 6.2 API surface groups discovered

The real API surface is broader than the minimal static spec in [backend/swagger.json](backend/swagger.json). The most current route truth is the Express implementation and inline OpenAPI annotations in [backend/src/index.js](backend/src/index.js).

Major endpoint groups discovered:

- public info and health
  - `/api/public/info`
  - `/api/health/db`
  - `/api/health/db/schema`
- auth/profile/settings
  - `/api/me`
  - `/api/profile`
  - `/api/settings`
  - `/api/reset-account`
- todos
  - `/api/todos`
  - `/api/todos/by-number/:taskNumber`
  - `/api/todos/batch`
  - `/api/todos/:id/reorder`
  - `/api/todos/:id`
  - `/api/todos/search`
  - `/api/todos/:id/toggle`
  - `/api/todos/:id/flag`
  - `/api/todos/:id/archive`
  - `/api/todos/:id/unarchive`
- tags
  - `/api/tags`
  - `/api/tags/:id`
- stats
  - `/api/stats`
- export/import
  - `/api/export`
  - `/api/import`
- notifications
  - notification endpoints still exist but return `410` because notifications are disabled

### 6.3 Important backend behaviors that need canonical docs

#### Authentication and user attachment

Critical sources:

- [backend/src/middleware/auth0.js](backend/src/middleware/auth0.js)
- [backend/src/middleware/attachCurrentUser.js](backend/src/middleware/attachCurrentUser.js)
- [backend/src/middleware/roles.js](backend/src/middleware/roles.js)
- [backend/src/middleware/errorHandler.js](backend/src/middleware/errorHandler.js)

These govern:

- JWT validation
- `AUTH_DISABLED` local bypass behavior
- mapping Auth0 claims to database user/profile/settings state
- role extraction and RBAC
- guest rejection for protected endpoints
- OAuth-related error normalization

#### Validation and error behavior

- [backend/src/middleware/validateTodo.js](backend/src/middleware/validateTodo.js)
- [backend/src/validators/index.js](backend/src/validators/index.js)
- [backend/src/middleware/errorHandler.js](backend/src/middleware/errorHandler.js)

These define a meaningful part of the API contract and need dedicated API docs later.

#### Search, stats, export/import, and archive semantics

These are not trivial CRUD helpers. They need explicit backend/API documentation because they contain real behavioral rules:

- [backend/src/application/SearchTodos.js](backend/src/application/SearchTodos.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/index.js](backend/src/index.js)

### 6.4 API documentation gap assessment

The repo has API documentation intent, but not a canonical endpoint catalog yet.

Key findings:

- [backend/swagger.json](backend/swagger.json) is too minimal to serve as the full canonical contract
- [backend/src/swagger.js](backend/src/swagger.js) dynamically merges static and JSDoc-generated specs, so the live documentation story depends on code annotations plus the base spec
- canonical API docs should later be organized by endpoint group and should explain auth, request bodies, response shapes, errors, and business-rule constraints

## 7. Data-Model, Architecture, and Operations Documentation Surfaces

### 7.1 Data model surfaces discovered

Primary live data-model truth:

- [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- [backend/src/infra/db/entities/TodoEntity.js](backend/src/infra/db/entities/TodoEntity.js)
- [backend/src/infra/db/entities/TagEntity.js](backend/src/infra/db/entities/TagEntity.js)
- [backend/src/infra/db/entities/TodoTagEntity.js](backend/src/infra/db/entities/TodoTagEntity.js)
- [backend/src/infra/db/entities/UserEntity.js](backend/src/infra/db/entities/UserEntity.js)
- [backend/src/infra/db/entities/UserProfileEntity.js](backend/src/infra/db/entities/UserProfileEntity.js)
- [backend/src/infra/db/entities/UserSettingsEntity.js](backend/src/infra/db/entities/UserSettingsEntity.js)

Core entity/table set:

- `users`
- `user_profiles`
- `user_settings`
- `todos`
- `tags`
- `todo_tags`

Key relationship/constraint themes that later docs must explain:

- users own todos, profiles, settings, and custom tags
- tags are split into global default tags and per-user custom tags
- todos and tags are many-to-many through `todo_tags`
- recurrence and subtasks are stored as JSONB on `todos`
- `task_number` is unique per user
- `original_id` links recurring tasks
- `start_day_of_week` matters both for onboarding/profile data and statistics/week behavior

### 7.2 Data-model drift / historical artifacts

Historical schema artifacts remain in the repo:

- MSSQL-oriented files in [backend/db/mssql-init.sql](backend/db/mssql-init.sql)
- older SQL migrations in [backend/migrations](backend/migrations)

They are useful for migration history, but not authoritative for current runtime behavior, which is clearly Postgres + TypeORM via [backend/src/infra/db/data-source-options.js](backend/src/infra/db/data-source-options.js) and [compose.production.yaml](compose.production.yaml).

### 7.3 Architecture surfaces discovered

The current architecture story can be reconstructed from:

- [README.md](README.md) for broad intent, with some stale areas
- [backend/src/index.js](backend/src/index.js)
- [client/src/app/main.jsx](client/src/app/main.jsx)
- [client/src/app/App.jsx](client/src/app/App.jsx)
- [Dockerfile](Dockerfile)
- [compose.production.yaml](compose.production.yaml)
- [deploy/nginx/lifeline.a2z-us.com.conf](deploy/nginx/lifeline.a2z-us.com.conf)
- [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)

Architecture-level conclusions from discovery:

- single-repo full-stack app
- React/Vite frontend is built into the runtime image and served by the backend container
- Express backend serves API and built frontend assets in production
- Postgres is the active database model
- Auth0 is the live identity provider in normal operation
- production deploys to a VPS using release directories and deploy-branch automation

### 7.4 Operations surfaces discovered

Primary operations truth:

- [docs/operations/QUICK_START.md](docs/operations/QUICK_START.md)
- [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md)
- [.github/workflows/deploy-production.yml](.github/workflows/deploy-production.yml)
- [deploy/scripts/apply-release.sh](deploy/scripts/apply-release.sh)
- [compose.production.yaml](compose.production.yaml)
- [Dockerfile](Dockerfile)
- [deploy/nginx/lifeline.a2z-us.com.conf](deploy/nginx/lifeline.a2z-us.com.conf)

Important operations topics ready for canonical docs:

- local dev startup
- production release packaging and deploy-branch trigger model
- release directory structure under `/opt/lifeline`
- VPS symlink-based release switching and rollback
- internal-only app bind on `127.0.0.1:3020`
- Nginx reverse proxy and health checks
- environment variable responsibilities

### 7.5 Operations/architecture gaps and watchouts

- [client/staticwebapp.config.json](client/staticwebapp.config.json) is a stale Azure-era deployment artifact and can confuse future readers.
- [README.md](README.md) still mixes old and current deployment/runtime assumptions.
- There is no canonical architecture overview yet that clearly explains current boundaries and runtime topology.
- There is no canonical data-model document yet that separates current Postgres truth from historical SQL artifacts.

## 8. Recommended Phase 6C Workstreams / Subphases

### Workstream 6C.1 — Source-of-truth normalization and stale-surface triage

**Purpose**

Normalize what is current vs historical before writing broad canonical docs.

**Likely outputs**

- canonical source-of-truth map
- stale-doc/stale-config watchlist
- explicit treatment of archive/reference/historical artifacts
- possible ADR candidate list if needed

**Likely todo list**

- classify retained docs as current, seed-only, or historical
- flag stale Azure/SQLite/MSSQL references
- identify which existing docs can be refreshed vs superseded
- define the canonical source hierarchy per docs domain

**Dependencies / order**

- should happen first
- unlocks all later workstreams by reducing doc drift risk

**Risk level**

- low

### Workstream 6C.2 — Product concepts and feature inventory

**Purpose**

Produce the canonical product-level understanding of what Lifeline is and how its core behaviors work from a user/business perspective.

**Likely outputs**

- product concepts doc(s)
- task lifecycle doc
- recurrence rules doc
- refreshed feature inventory / feature summary set

**Likely todo list**

- document guest vs authenticated mode
- document onboarding and profile prerequisites
- document task lifecycle and task numbering
- document recurrence semantics from the user perspective
- convert current [docs/features/FEATURES.md](docs/features/FEATURES.md) into a maintained feature set

**Dependencies / order**

- depends on 6C.1
- can run before or in parallel with frontend documentation, but should inform it

**Risk level**

- medium

### Workstream 6C.3 — Frontend routes, pages, and UX flows

**Purpose**

Document the user-visible frontend surface area and major UI flows.

**Likely outputs**

- route/page inventory
- dashboard/home flow doc
- search flow doc
- profile/settings/statistics flow docs
- layout/navigation/responsive behavior docs

**Likely todo list**

- document main routes and aliases
- document dashboard behaviors and date routing
- document search/filter/batch UX
- document mobile sidebar/top bar behavior
- document recurrence selector UX
- document settings/export-import/profile/statistics UI surfaces

**Dependencies / order**

- depends on 6C.1
- strongly benefits from 6C.2

**Risk level**

- medium

### Workstream 6C.4 — Backend services and API contract set

**Purpose**

Turn the live backend implementation into canonical backend and API docs.

**Likely outputs**

- backend module/use-case docs
- middleware/auth flow docs
- endpoint-group docs under `docs/api/`
- error/auth/validation behavior docs

**Likely todo list**

- document backend runtime composition
- document attach-current-user and RBAC flows
- document todo/tag/stats/export/import endpoint groups
- document request validation and error behavior
- document notification endpoint disabled status explicitly

**Dependencies / order**

- depends on 6C.1
- should follow at least some of 6C.2 so business-rule language stays consistent

**Risk level**

- high

### Workstream 6C.5 — Data model and persistence rules

**Purpose**

Document entities, tables, relationships, constraints, and historical migration context.

**Likely outputs**

- entity/table reference docs
- relationship and ownership docs
- migration intent summary
- current-vs-historical schema clarification

**Likely todo list**

- document `users`, `user_profiles`, `user_settings`, `todos`, `tags`, `todo_tags`
- document JSONB fields and recurrence/subtask storage
- document default vs custom tag ownership rules
- document week-start/profile/settings persistence rules
- document Postgres/TypeORM as current truth and historical SQL files as legacy context

**Dependencies / order**

- depends on 6C.1
- should align with backend/API workstream

**Risk level**

- medium

### Workstream 6C.6 — Architecture and operations canon

**Purpose**

Document the real runtime topology, deployment path, and operating model.

**Likely outputs**

- architecture overview
- runtime topology doc
- production deployment/runbook refresh
- environment/responsibility notes
- possible ADR(s) if durable architecture clarifications are needed

**Likely todo list**

- document frontend/backend/database/runtime boundaries
- document image/build/runtime flow
- document deploy-branch/VPS release model
- document Nginx and internal bind strategy
- document rollback and health verification model
- document stale Azure-era config as legacy/non-authoritative

**Dependencies / order**

- depends on 6C.1
- can run in parallel with 6C.4/6C.5 once source normalization is done

**Risk level**

- medium

## 9. Recommended Todo Backlog by Workstream

### 6C.1 — Source-of-truth normalization

- inventory all currently active docs vs placeholders
- inventory stale root/reference/archive docs and configs
- define which docs are authoritative, seed-only, or historical
- identify runtime/config artifacts that contradict current production reality
- lock canonical terminology for guest mode, onboarding, recurrence, and deploy model

### 6C.2 — Product and features

- write product concepts overview
- write task lifecycle behavior doc
- write recurrence behavior doc
- write guest vs authenticated behavior doc
- write onboarding/profile/settings user-concept doc
- replace or split [docs/features/FEATURES.md](docs/features/FEATURES.md) into maintained feature docs

### 6C.3 — Frontend

- write route/page inventory
- write dashboard/home behavior doc
- write date-routing and selected-day behavior doc
- write layout/navigation/responsive behavior doc
- write advanced search UX doc
- write profile/settings/statistics/export-import frontend docs

### 6C.4 — Backend and API

- write backend runtime/composition overview
- write auth and user attachment flow doc
- write todo endpoint-group docs
- write tag endpoint-group docs
- write stats endpoint docs
- write export/import endpoint docs
- write error/auth/validation behavior doc

### 6C.5 — Data model

- write core entity/table overview
- write user/profile/settings ownership docs
- write todo/tag/todo_tags relationship docs
- write recurrence/subtasks/task-number persistence docs
- write migration-history/current-truth clarification doc

### 6C.6 — Architecture and operations

- write architecture overview
- write runtime topology doc
- write current production deployment model doc
- refresh quick-start/setup if needed
- document deploy workflow, rollback, and smoke checks
- document legacy Azure-era configs as non-current

## 10. Risks and Watchouts

### 10.1 Stale documentation contamination

This is the biggest risk. Several existing docs are useful but partially wrong. Canonical Phase 6C writing should not inherit older claims without revalidation.

High-risk stale topics:

- notifications being active
- SQLite being the default/current persistence model
- Azure Static Web App / Azure App Service deployment being current
- old recurrence model descriptions being treated as the only current UX
- old routing/basename assumptions

### 10.2 Over-reliance on placeholder docs

The long-term docs tree is structurally correct, but most domain folders do not yet contain substance. Planning should assume that most canonical docs will be created from code discovery, not lightly refreshed from current placeholders.

### 10.3 App-level frontend complexity concentrated in one file

[client/src/app/App.jsx](client/src/app/App.jsx) is large and behavior-rich. Documentation work will need careful extraction of real route and state behavior so the final docs do not miss edge cases.

### 10.4 Backend contract spread across code and generated docs

The API contract is split between:

- actual route implementations in [backend/src/index.js](backend/src/index.js)
- validation middleware
- repositories/use cases
- minimal static base spec in [backend/swagger.json](backend/swagger.json)
- dynamic merge logic in [backend/src/swagger.js](backend/src/swagger.js)

This means API documentation should be written from the implementation outward, not from the static swagger file alone.

### 10.5 Historical persistence artifacts may confuse future writers

The repo still contains:

- MSSQL setup files
- older raw SQL migrations
- stale README sections

These need explicit classification during planning so future documentation does not accidentally document legacy state as live architecture.

## 11. Recommendation for the Phase 6C Planning Prompt

The next planning prompt should explicitly require:

1. use of this discovery report as the planning baseline
2. no implementation yet unless the user asks for it
3. a concrete multi-subphase plan aligned to the recommended workstreams above
4. explicit sequencing, dependencies, deliverables, and risk management
5. explicit handling of stale/historical docs and configs
6. a definition of which outputs belong in:
   - `docs/product/`
   - `docs/features/`
   - `docs/frontend/`
   - `docs/backend/`
   - `docs/api/`
   - `docs/data-model/`
   - `docs/architecture/`
   - `docs/operations/`
   - `docs/adr/` if needed

Recommended planning-prompt shape:

- reference [PHASE6C_DISCOVERY_REPORT.md](PHASE6C_DISCOVERY_REPORT.md)
- request a **Phase 6C planning pass only**
- ask for:
  - subphase names
  - goals
  - output documents by path
  - ordered todos per subphase
  - dependency graph/order of execution
  - risk level per subphase
  - any stale docs/configs that should be superseded, archived, or explicitly marked historical

Recommended planning constraint:

- planning should prefer **small, reviewable implementation batches** rather than one repo-wide documentation rewrite in a single pass.
