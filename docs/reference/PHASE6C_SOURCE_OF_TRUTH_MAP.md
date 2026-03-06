# Phase 6C Source of Truth Map

## Purpose

This reference file is the Workstream 6C.1 normalization artifact for Phase 6C canonical documentation.

Use it as the operating guide for later Phase 6C workstreams before writing or refreshing any canonical documentation.

This file defines:

- the governance operating model used for Phase 6C
- the canonical source hierarchy by documentation domain
- the canonical terminology to preserve across later workstreams
- which existing materials are seed-only and require verification
- which stale or historical surfaces are current, stale, historical, or non-authoritative legacy context

## Governance Operating Model Applied

This normalization pass was executed using the existing Phase 6B governance system, specifically:

- repo-wide rules in [.github/copilot-instructions.md](../../.github/copilot-instructions.md)
- governance instructions in [.github/instructions/docs-governance.instructions.md](../../.github/instructions/docs-governance.instructions.md)
- documentation routing rules in [.github/skills/documentation-governance.md](../../.github/skills/documentation-governance.md)
- governance coordination roles in:
  - [.github/agents/documentation-governance-agent.md](../../.github/agents/documentation-governance-agent.md)
  - [.github/teams/documentation-governance-team.md](../../.github/teams/documentation-governance-team.md)
  - [.github/workflows-governance/documentation-governance-workflow.md](../../.github/workflows-governance/documentation-governance-workflow.md)
- deployment/runtime governance for stale operations surfaces in:
  - [.github/skills/cicd-governance.md](../../.github/skills/cicd-governance.md)
  - [.github/agents/cicd-governance-agent.md](../../.github/agents/cicd-governance-agent.md)
  - [.github/teams/cicd-governance-team.md](../../.github/teams/cicd-governance-team.md)
  - [.github/workflows-governance/cicd-governance-workflow.md](../../.github/workflows-governance/cicd-governance-workflow.md)
- reusable governance scaffolds in:
  - [docs/templates/docs-update-checklist.md](../templates/docs-update-checklist.md)
  - [docs/templates/change-impact-matrix.md](../templates/change-impact-matrix.md)
  - [.github/prompts/map-doc-impact.prompt.md](../../.github/prompts/map-doc-impact.prompt.md)
- ownership and backlog references in:
  - [DOCUMENTATION_OWNERSHIP_MATRIX.md](DOCUMENTATION_OWNERSHIP_MATRIX.md)
  - [PHASE6C_DOCUMENTATION_BACKLOG.md](PHASE6C_DOCUMENTATION_BACKLOG.md)

## Canonical Source Hierarchy by Domain

| Domain | Primary authoritative sources | Secondary current sources | Non-authoritative or historical context |
| --- | --- | --- | --- |
| Product | [client/src/app/App.jsx](../../client/src/app/App.jsx), [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx), [backend/src/index.js](../../backend/src/index.js), [backend/src/application](../../backend/src/application) | [docs/features/FEATURES.md](../features/FEATURES.md) as seed inventory only | [docs/archive/README_INTEGRATION.md](../archive/README_INTEGRATION.md), [docs/archive/IMPLEMENTATION_SUMMARY.md](../archive/IMPLEMENTATION_SUMMARY.md), [docs/archive/INTEGRATION_COMPLETE.md](../archive/INTEGRATION_COMPLETE.md) |
| Features | current product/frontend/backend implementation plus later canonical product/frontend docs | [docs/features/FEATURES.md](../features/FEATURES.md) | archive integration documents |
| Frontend | [client/src/app/App.jsx](../../client/src/app/App.jsx), [client/src/app/main.jsx](../../client/src/app/main.jsx), [client/src/pages](../../client/src/pages), [client/src/components](../../client/src/components), [client/src/providers](../../client/src/providers) | [docs/frontend/ui-wireframe.md](../frontend/ui-wireframe.md) for layout intent only | stale README frontend summaries |
| Backend | [backend/src/index.js](../../backend/src/index.js), [backend/src/application](../../backend/src/application), [backend/src/infrastructure](../../backend/src/infrastructure), [backend/src/middleware](../../backend/src/middleware) | [backend/src/routes](../../backend/src/routes), [backend/src/controllers](../../backend/src/controllers) as secondary structure/context | stale SQLite/MSSQL-era summaries in old docs |
| API | [backend/src/index.js](../../backend/src/index.js), [backend/src/middleware](../../backend/src/middleware), [backend/src/validators](../../backend/src/validators) | [backend/src/swagger.js](../../backend/src/swagger.js) and generated JSDoc behavior | [backend/swagger.json](../../backend/swagger.json) alone is not sufficient as canonical truth |
| Data Model | [backend/src/migrations/1764826105992-initial_migration.js](../../backend/src/migrations/1764826105992-initial_migration.js), [backend/src/infra/db/entities](../../backend/src/infra/db/entities), [backend/src/infrastructure](../../backend/src/infrastructure) | [backend/src/infra/db/data-source-options.js](../../backend/src/infra/db/data-source-options.js) | [backend/migrations](../../backend/migrations), [backend/db/mssql-init.sql](../../backend/db/mssql-init.sql) as historical context only |
| Architecture | current frontend/backend/runtime/deploy implementation across [client](../../client), [backend](../../backend), [compose.production.yaml](../../compose.production.yaml), [Dockerfile](../../Dockerfile), [deploy](../../deploy) | [README.md](../../README.md) only after verification | older Azure/SQLite assumptions are non-authoritative |
| Operations | [docs/operations/DEPLOY_BRANCH_CD.md](../operations/DEPLOY_BRANCH_CD.md), [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml), [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh), [compose.production.yaml](../../compose.production.yaml), [Dockerfile](../../Dockerfile), [deploy/nginx/lifeline.a2z-us.com.conf](../../deploy/nginx/lifeline.a2z-us.com.conf) | [docs/operations/QUICK_START.md](../operations/QUICK_START.md) | [client/staticwebapp.config.json](../../client/staticwebapp.config.json), [client/swa-cli.config.json](../../client/swa-cli.config.json) as legacy Azure context |
| ADR | durable decisions only after evaluation against current implementation and docs governance rules | [docs/architecture](../architecture) as architectural context | discovery/planning notes alone do not create ADR truth |

## Canonical Terminology Decisions

Use these terms consistently in later Phase 6C workstreams.

### Guest mode

**Canonical term:** `guest mode`

**Definition:** Local-only browser mode in which task and tag data are stored client-side and protected server endpoints are not available without authentication.

**Grounding sources:**

- [client/src/providers/AuthProvider.jsx](../../client/src/providers/AuthProvider.jsx)
- [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx)
- [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js)
- [backend/src/middleware/roles.js](../../backend/src/middleware/roles.js)
- [backend/src/index.js](../../backend/src/index.js)

### Authenticated mode

**Canonical term:** `authenticated mode`

**Definition:** Auth0-backed mode in which the user identity is resolved through JWT-based requests and persisted server-side user, profile, settings, todo, and tag data are available.

**Grounding sources:**

- [client/src/providers/AuthAdapterProvider.jsx](../../client/src/providers/AuthAdapterProvider.jsx)
- [client/src/providers/AuthProvider.jsx](../../client/src/providers/AuthProvider.jsx)
- [backend/src/middleware/auth0.js](../../backend/src/middleware/auth0.js)
- [backend/src/middleware/attachCurrentUser.js](../../backend/src/middleware/attachCurrentUser.js)

### Onboarding

**Canonical term:** `onboarding`

**Definition:** The authenticated first-run profile completion flow that gates normal app use until required profile fields are provided and `onboarding_completed` is true.

**Grounding sources:**

- [client/src/pages/OnboardingPage.jsx](../../client/src/pages/OnboardingPage.jsx)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/infra/db/entities/UserProfileEntity.js](../../backend/src/infra/db/entities/UserProfileEntity.js)

### Recurrence modes

**Canonical term:** `recurrence modes`

**Current UX-supported modes:**

- `daily`
- `dateRange`
- `specificDays`

**Legacy accepted recurrence shapes still handled in backend/import logic:**

- `daily`
- `weekly`
- `monthly`
- `custom`

**Documentation rule:** Later canonical docs must distinguish current UX-supported modes from legacy accepted recurrence payloads.

**Grounding sources:**

- [client/src/components/calendar/RecurrenceSelector.jsx](../../client/src/components/calendar/RecurrenceSelector.jsx)
- [backend/src/application/CreateTodo.js](../../backend/src/application/CreateTodo.js)
- [backend/src/application/RecurrenceService.js](../../backend/src/application/RecurrenceService.js)
- [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js)

### Deploy-branch production model

**Canonical term:** `deploy-branch production model`

**Definition:** The current production delivery path where `main` is the development/integration branch, `deploy` is the production deployment branch, GitHub Actions packages a release, uploads it to the VPS, applies it under `/opt/lifeline/releases`, repoints `/opt/lifeline/current`, and verifies the private app bind plus public health/home responses.

**Grounding sources:**

- [docs/operations/DEPLOY_BRANCH_CD.md](../operations/DEPLOY_BRANCH_CD.md)
- [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml)
- [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh)
- [compose.production.yaml](../../compose.production.yaml)
- [deploy/nginx/lifeline.a2z-us.com.conf](../../deploy/nginx/lifeline.a2z-us.com.conf)

## Seed Material Requiring Verification Before Reuse

The following materials may be consulted for hints, scope, migration history, or earlier framing, but they must not be copied into canonical docs without implementation verification.

- [README.md](../../README.md)
- [docs/features/FEATURES.md](../features/FEATURES.md)
- [docs/frontend/ui-wireframe.md](../frontend/ui-wireframe.md)
- [docs/reference/TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)
- [docs/archive/INTEGRATION_COMPLETE.md](../archive/INTEGRATION_COMPLETE.md)
- [docs/archive/IMPLEMENTATION_SUMMARY.md](../archive/IMPLEMENTATION_SUMMARY.md)
- [docs/archive/README_INTEGRATION.md](../archive/README_INTEGRATION.md)
- [backend/swagger.json](../../backend/swagger.json)
- [backend/migrations/001_initial_migration.sql](../../backend/migrations/001_initial_migration.sql)
- [backend/migrations/005_add_start_day_to_user_profiles.sql](../../backend/migrations/005_add_start_day_to_user_profiles.sql)
- [backend/migrations/006_add_check_constraint_start_day.sql](../../backend/migrations/006_add_check_constraint_start_day.sql)
- [backend/db/mssql-init.sql](../../backend/db/mssql-init.sql)

## Stale-Surface Classification Register

| Surface | Current status | Classification decision | Rationale | Later handling |
| --- | --- | --- | --- | --- |
| [README.md](../../README.md) | partially stale | supersede later | still mixes current system description with outdated SQLite, notifications, and Azure/subpath assumptions | refresh after canonical docs are in place |
| [docs/features/FEATURES.md](../features/FEATURES.md) | mixed | supersede later | useful inventory seed, but mixes shipped behavior with aspirational backlog | convert into maintained feature canon in later workstream |
| [docs/frontend/ui-wireframe.md](../frontend/ui-wireframe.md) | partially current | refresh later | still useful for layout intent, but must be verified against current components | either refresh as companion material or explicitly narrow scope |
| [docs/reference/TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) | stale | archive/leave historical | references SQLite, active notifications, and earlier runtime assumptions | retain only as historical reference with explicit warning |
| [docs/archive/INTEGRATION_COMPLETE.md](../archive/INTEGRATION_COMPLETE.md) | historical and partially stale | archive/leave historical | useful historical implementation record but not current truth | keep in archive; do not treat as active canonical source |
| [docs/archive/IMPLEMENTATION_SUMMARY.md](../archive/IMPLEMENTATION_SUMMARY.md) | historical and partially stale | archive/leave historical | same reason as above | keep in archive; use only as seed/context |
| [docs/archive/README_INTEGRATION.md](../archive/README_INTEGRATION.md) | historical and partially stale | archive/leave historical | same reason as above | keep in archive; use only as seed/context |
| [client/staticwebapp.config.json](../../client/staticwebapp.config.json) | stale Azure-era config | ignore as non-authoritative legacy context | points to Azure Static Web Apps/App Service deployment path that is no longer current production | do not use for canonical operations or architecture docs |
| [client/swa-cli.config.json](../../client/swa-cli.config.json) | stale Azure-era local tooling context | ignore as non-authoritative legacy context | documents local SWA tooling, not current production model | mention only if legacy context becomes necessary |
| [backend/swagger.json](../../backend/swagger.json) | incomplete current support file | seed material only | useful base spec, but too minimal to serve as canonical contract alone | use route code and validators as primary API truth |
| [backend/migrations/001_initial_migration.sql](../../backend/migrations/001_initial_migration.sql) | historical schema artifact | ignore as non-authoritative legacy context | older raw SQL migration, not the live Postgres TypeORM source of truth | mention only in historical schema context |
| [backend/migrations/005_add_start_day_to_user_profiles.sql](../../backend/migrations/005_add_start_day_to_user_profiles.sql) | historical schema artifact | ignore as non-authoritative legacy context | older migration artifact with narrower historical context | mention only in historical schema context |
| [backend/migrations/006_add_check_constraint_start_day.sql](../../backend/migrations/006_add_check_constraint_start_day.sql) | historical schema artifact | ignore as non-authoritative legacy context | same reason as above | mention only in historical schema context |
| [backend/db/mssql-init.sql](../../backend/db/mssql-init.sql) | historical MSSQL artifact | ignore as non-authoritative legacy context | no longer reflects active runtime model | mention only in migration/history context |

## Ownership Matrix and Backlog Verification

### Ownership matrix verification

[DOCUMENTATION_OWNERSHIP_MATRIX.md](DOCUMENTATION_OWNERSHIP_MATRIX.md) was rechecked against the governance instructions and still matches intended domain separation.

No ownership-routing changes are required for Workstream 6C.1.

### Backlog verification

[PHASE6C_DOCUMENTATION_BACKLOG.md](PHASE6C_DOCUMENTATION_BACKLOG.md) still aligns with the domain-separated execution model.

Its current structure remains valid as a later-workstream backlog, but later workstreams should consult this file together with this source-of-truth map so stale/reference materials are not reused as canonical truth.

## Workstream 6C.1 Closeout Rule for Later Workstreams

Before Workstream 6C.2 or later begins, use this file to confirm:

- the target domain is using the correct primary source hierarchy
- any seed material is being revalidated against implementation
- stale or legacy surfaces are not being treated as current truth
- canonical terminology from this file is being preserved
