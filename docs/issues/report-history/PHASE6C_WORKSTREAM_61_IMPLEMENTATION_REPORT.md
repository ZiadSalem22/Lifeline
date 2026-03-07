# Phase 6C Workstream 6C.1 Implementation Report

## 1. Executive Summary

Workstream 6C.1 — Source-of-Truth Normalization and Stale-Surface Triage — is complete in this pass.

This implementation used the existing Lifeline governance system as the operating model, including the documentation-governance instruction, skill, agent, team, workflow, and the CI/CD governance layer for deployment/runtime-related stale surfaces.

The workstream produced a concrete normalization artifact for later Phase 6C execution, explicitly classified stale and historical materials, stabilized canonical terminology, and verified that the ownership matrix and backlog references still support the intended docs-domain separation.

No later Phase 6C workstream was started.

## 2. Workstream Scope

This pass executed only Workstream 6C.1 from [PHASE6C_PLAN.md](PHASE6C_PLAN.md):

- normalize what is authoritative vs historical
- classify stale docs/configs/materials
- stabilize canonical terminology and source hierarchy
- prepare the repo cleanly for later Workstreams 6C.2+
- close Workstream 6C.1 fully before stopping

Governance system components actively applied during this pass:

- [.github/instructions/docs-governance.instructions.md](.github/instructions/docs-governance.instructions.md)
- [.github/skills/documentation-governance.md](.github/skills/documentation-governance.md)
- [.github/agents/documentation-governance-agent.md](.github/agents/documentation-governance-agent.md)
- [.github/teams/documentation-governance-team.md](.github/teams/documentation-governance-team.md)
- [.github/workflows-governance/documentation-governance-workflow.md](.github/workflows-governance/documentation-governance-workflow.md)
- [.github/skills/cicd-governance.md](.github/skills/cicd-governance.md)
- [.github/agents/cicd-governance-agent.md](.github/agents/cicd-governance-agent.md)
- [.github/teams/cicd-governance-team.md](.github/teams/cicd-governance-team.md)
- [.github/workflows-governance/cicd-governance-workflow.md](.github/workflows-governance/cicd-governance-workflow.md)
- [docs/templates/docs-update-checklist.md](docs/templates/docs-update-checklist.md)
- [docs/templates/change-impact-matrix.md](docs/templates/change-impact-matrix.md)
- [.github/prompts/map-doc-impact.prompt.md](.github/prompts/map-doc-impact.prompt.md)
- [docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md](docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md)
- [docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md](docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md)

## 3. Todo Tracking and Completion Status

| Todo | Status | Notes |
| --- | --- | --- |
| Review [PHASE6C_DISCOVERY_REPORT.md](PHASE6C_DISCOVERY_REPORT.md) and extract stale-surface findings into an execution checklist | Completed | Discovery and plan findings were rechecked and mapped into the normalization artifact |
| Classify each identified stale item by handling path | Completed | Classified as supersede later, refresh later, archive/leave historical, or ignore as non-authoritative legacy context |
| Confirm authoritative source hierarchy by docs domain | Completed | Domain-by-domain source hierarchy recorded in [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md) |
| Verify ownership matrix and backlog references against intended domain separation | Completed | Verified still aligned; no ownership-routing changes required |
| Define canonical terminology for guest mode, authenticated mode, onboarding, recurrence modes, and deploy-branch production model | Completed | Terminology decisions recorded in [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md) |
| Record which existing docs are seed material only and require verification | Completed | Seed-only list recorded in [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md) |
| Perform final stale-surface review and close workstream | Completed | Final review completed; no unresolved Workstream 6C.1 blockers remain |

## 4. Source-of-Truth and Stale-Surface Findings

### 4.1 Source-of-truth normalization outcome

The primary output of this workstream is [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md).

It establishes that later canonical documentation must prioritize:

1. current implementation and runtime files
2. current operations/runtime docs
3. retained reference/archive materials only as seed/context
4. Azure-era, SQLite-era, MSSQL-era, and older raw SQL artifacts only as non-authoritative legacy context

### 4.2 Domain source hierarchy stabilized

The normalization pass explicitly stabilized source hierarchy for:

- product
- features
- frontend
- backend
- api
- data-model
- architecture
- operations
- adr

This prevents later workstreams from pulling truth from older archive/reference/config surfaces without verification.

### 4.3 Stale-surface classification completed

The following major stale/material classes were explicitly classified:

- partially stale active docs to supersede later
  - [README.md](README.md)
  - [docs/features/FEATURES.md](docs/features/FEATURES.md)
- current-but-needing-later refreshes
  - [docs/frontend/ui-wireframe.md](docs/frontend/ui-wireframe.md)
  - [docs/operations/QUICK_START.md](docs/operations/QUICK_START.md)
  - [docs/operations/DEPLOY_BRANCH_CD.md](docs/operations/DEPLOY_BRANCH_CD.md)
- historical references to retain with warning or historical framing
  - [docs/reference/TESTING_CHECKLIST.md](docs/reference/TESTING_CHECKLIST.md)
  - [docs/archive/INTEGRATION_COMPLETE.md](docs/archive/INTEGRATION_COMPLETE.md)
  - [docs/archive/IMPLEMENTATION_SUMMARY.md](docs/archive/IMPLEMENTATION_SUMMARY.md)
  - [docs/archive/README_INTEGRATION.md](docs/archive/README_INTEGRATION.md)
- legacy/non-authoritative config and schema surfaces
  - [client/staticwebapp.config.json](client/staticwebapp.config.json)
  - [client/swa-cli.config.json](client/swa-cli.config.json)
  - [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql)
  - [backend/migrations/005_add_start_day_to_user_profiles.sql](backend/migrations/005_add_start_day_to_user_profiles.sql)
  - [backend/migrations/006_add_check_constraint_start_day.sql](backend/migrations/006_add_check_constraint_start_day.sql)
  - [backend/db/mssql-init.sql](backend/db/mssql-init.sql)

### 4.4 Governance verification outcome

Using the documentation-governance operating model, this pass confirmed:

- the docs-domain routing model remains correct
- the ownership matrix still matches intended separation
- the backlog still matches the domain-separated execution model
- the deploy/runtime stale-surface decisions remain consistent with the CI/CD governance model

## 5. Files Created or Updated

### Created

- [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md)
- [PHASE6C_WORKSTREAM_61_IMPLEMENTATION_REPORT.md](PHASE6C_WORKSTREAM_61_IMPLEMENTATION_REPORT.md)

### Updated

- [docs/reference/README.md](docs/reference/README.md)
  - added the new normalization reference file
- [docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md](docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md)
  - added a Workstream 6C.1 normalization-input note so later workstreams consult the source-of-truth map first
- [docs/reference/TESTING_CHECKLIST.md](docs/reference/TESTING_CHECKLIST.md)
  - added an explicit historical-reference warning to prevent it from being misused as a canonical current-state test spec

## 6. Canonical Terminology and Source-Hierarchy Decisions

### Canonical terminology locked for later workstreams

The following terms are now normalized for later Phase 6C execution:

- `guest mode`
- `authenticated mode`
- `onboarding`
- `recurrence modes`
- `deploy-branch production model`

These definitions are recorded in [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md) and should be reused consistently in later workstreams.

### Source-hierarchy decisions locked for later workstreams

Later workstreams must follow these normalized rules:

- product truth comes from live frontend/backend behavior, not from archive summaries
- frontend truth comes from current routes/pages/components/providers, with the wireframe treated only as companion seed material
- backend truth comes from current runtime composition, middleware, use cases, repositories, and data-source layers
- api truth comes from route code, validators, middleware, and runtime behavior before any static swagger base file
- data-model truth comes from the Postgres TypeORM migration/entity stack before older SQL or MSSQL artifacts
- operations truth comes from the deploy-branch/VPS release model and current runtime/deploy files, not Azure-era config remnants

## 7. Workstream Verification and Closeout

Workstream 6C.1 closeout checks were completed against the plan:

- every required Workstream 6C.1 task was completed
- stale surfaces were explicitly classified
- canonical terminology was stabilized
- authoritative source hierarchy was recorded
- ownership matrix and backlog references were verified against intended domain separation
- later workstreams now have a concrete normalization artifact to use before writing canonical docs
- no Workstream 6C.2 or later implementation was started

Coherence check result:

- the created/updated reference outputs are internally consistent
- the stale-surface handling decisions match the discovery and planning baselines
- the outputs remain within the proper documentation/reference domain and do not bleed into later workstream implementation

## 8. Notes / Risks

- [README.md](README.md) remains partially stale until a later canonical refresh pass supersedes its outdated runtime and feature claims.
- [docs/features/FEATURES.md](docs/features/FEATURES.md) remains a mixed inventory until Workstream 6C.2 resolves its canonical replacement strategy.
- Azure-era config remnants and older schema artifacts still exist in the repo, but this workstream now explicitly classifies them as non-authoritative legacy context.
- Later workstreams must follow [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md) or drift risk will return.

## 9. Completion Status

**Workstream 6C.1 status:** Complete

**Closed in this pass:** Yes

**Ready for Workstream 6C.2:** Yes

**Blocked by unresolved Workstream 6C.1 issues:** No
