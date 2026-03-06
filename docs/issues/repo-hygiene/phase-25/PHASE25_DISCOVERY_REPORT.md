# Phase 2.5 Discovery Report

## 1. Executive Summary
The repository is functionally organized for source code, but its documentation and root-level artifact placement are messy.

The main hygiene issues are:
- the repo root is overloaded with onboarding docs, historical integration writeups, phase reports, and status/checklist files
- active project docs and archival/generated phase artifacts are mixed together with no clear hierarchy
- several root docs appear stale or partially stale relative to the current architecture and approved Phase 2 direction
- at least one clearly temporary folder exists: `backend-deploy-temp`
- issue/history notes are present in a dedicated folder, but their placement and naming suggest they are project history rather than active product docs
- AI/process artifacts are now numerous enough that they should likely move under a dedicated docs/history structure later

Overall assessment:
- source directories are reasonably clear: `backend/`, `client/`, `db/`
- documentation governance is weak
- root cleanliness is below a professional enterprise standard
- cleanup opportunity is strong, but some items need caution because they are historically useful even if no longer front-door docs

## 2. Root-Level Inventory Assessment
Current repo root includes a mix of:
- core source folders: `backend/`, `client/`, `db/`
- repo support/config folders: `.git/`, `.github/`, `.vscode/`, `.agent/`
- temporary/suspect folder: `backend-deploy-temp/`
- issue/history folder: `ISSUES/`
- many root Markdown artifacts, including:
  - primary repo docs
  - implementation summaries
  - testing/status docs
  - Phase 1 artifacts
  - Phase 2 artifacts

Root-level clutter observations:
- there are too many Markdown files at repo root for a reader to quickly identify the current authoritative entrypoints
- Phase 1 and Phase 2 outputs are mixed directly into the root alongside `README.md`, `QUICK_START.md`, `START_HERE.md`, and historical integration docs
- the root currently reads more like a working folder or deliverables drop-zone than a polished product repository
- root onboarding/discovery documents overlap heavily:
  - `README.md`
  - `START_HERE.md`
  - `QUICK_START.md`
  - `DOCUMENTATION_INDEX.md`
  - `README_INTEGRATION.md`
  - `STATUS_REPORT.md`

Misplaced or likely misplaced root items:
- Phase artifacts at root:
  - `PHASE1_*`
  - `PHASE2_*`
- historical integration docs at root:
  - `INTEGRATION_COMPLETE.md`
  - `IMPLEMENTATION_SUMMARY.md`
  - `FILES_MODIFIED_CREATED.md`
  - `STATUS_REPORT.md`
  - `README_INTEGRATION.md`
  - `START_HERE.md`
- feature backlog/history doc at root:
  - `FEATURES.md`
- standalone HTML artifact:
  - `cosmic-background.html`

Likely professional root keepers later:
- `README.md`
- `LICENSE`
- `backend/`
- `client/`
- `db/`
- possibly one small set of current user/developer entry docs only

## 3. Documentation Inventory and Classification

### 3.1 Active/core docs
Likely active or intended as front-door/current docs:
- `README.md`
- `QUICK_START.md`
- `client/README.md`
- `client/docs/ui-wireframe.md`
- `.github/copilot-instructions.md` (developer/AI workflow guidance, not user-facing)

Notes:
- `README.md` is still the obvious primary root doc, but it appears mixed: some sections are current while others are long, duplicated, or contain older assumptions
- `QUICK_START.md` is useful in concept, but content shows historical/stale references such as SQLite emphasis and old project path examples

### 3.2 Phase artifacts
Phase-specific generated or planning artifacts:
- `PHASE1_DISCOVERY_REPORT.md`
- `PHASE1_FRONTEND_ROOT_VERIFICATION.md`
- `PHASE1_IMPLEMENTATION_REPORT.md`
- `PHASE1_PLAN.md`
- `PHASE2_DB_MIGRATION_DISCOVERY_REPORT.md`
- `PHASE2_MASTER_PLAN.md`
- `PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md`
- `PHASE2_MILESTONE_B_DECISIONS.md`
- `PHASE2_MILESTONE_C_LIVE_DB_REPORT.md`
- `PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md`
- `PHASE2_MILESTONE_E_MIGRATION_BLUEPRINT.md`
- `PHASE2_MILESTONE_F_VALIDATION_READINESS.md`
- `PHASE2_FINAL_REPORT.md`

Assessment:
- these are valuable project-history and planning records
- they should likely remain in the repo
- they are high-noise at repo root
- they look like AI/planning deliverables, not root-facing product docs

### 3.3 Stale historical docs
Docs that look historically useful but likely stale as primary guidance:
- `START_HERE.md`
- `README_INTEGRATION.md`
- `STATUS_REPORT.md`
- `INTEGRATION_COMPLETE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `FILES_MODIFIED_CREATED.md`
- parts of `QUICK_START.md`
- parts of `README.md`

Evidence of likely staleness or drift:
- heavy emphasis on the older “three features integration” narrative
- explicit notification table/API guidance even though Phase 2 now excludes `notifications` from the future approved target model
- SQLite-first wording in older docs even though Phase 2 explicitly removed SQLite fallback from the future supported architecture
- old path/reference wording like `testground/` in `QUICK_START.md`
- docs framed as delivery-completion artifacts rather than enduring repository documentation

### 3.4 Issue/history/reference notes
- `ISSUES/2025-11-routing.md`
- `ISSUES/2025-11-fix-sidebar-drawer.md`
- potentially `FEATURES.md` as a historical backlog/reference artifact rather than a current product contract

Assessment:
- useful as engineering history/reference
- not primary user/developer docs
- better suited to an archive/history/docs-issues area than root prominence

### 3.5 Setup/deployment notes
These are mixed into other docs rather than separated cleanly:
- `README.md`
- `QUICK_START.md`
- `DOCUMENTATION_INDEX.md`
- `STATUS_REPORT.md`
- `README_INTEGRATION.md`

Assessment:
- deployment/setup guidance is duplicated across multiple docs
- some of it is likely outdated relative to current repo direction
- placement and ownership are unclear

### 3.6 AI-generated planning artifacts
Strongly likely AI-generated or AI-assisted planning/specification artifacts:
- all `PHASE1_*` and `PHASE2_*` docs
- possibly some integration completion/status summary docs depending on authorship history

Assessment:
- valuable for traceability
- should likely be grouped under a deliberate project-history or planning archive structure later
- should not dominate the root

### 3.7 Likely redundant or overlapping docs
High-overlap cluster:
- `README.md`
- `START_HERE.md`
- `QUICK_START.md`
- `DOCUMENTATION_INDEX.md`
- `README_INTEGRATION.md`
- `STATUS_REPORT.md`
- `INTEGRATION_COMPLETE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `FILES_MODIFIED_CREATED.md`

Specific overlap patterns:
- multiple “where to start” docs
- multiple feature-summary docs
- multiple implementation-summary docs
- multiple status or completion docs
- multiple setup/troubleshooting sections

## 4. Folder Hygiene Findings

### 4.1 `backend-deploy-temp`
Current contents:
- `.env.example`
- `node_modules/`

Assessment:
- strongly temporary-looking
- misleading at repo root because it implies an active deployment workspace or parallel backend package
- the presence of `node_modules/` inside a temp-named root folder is a strong hygiene smell
- this is one of the clearest cleanup candidates, though exact treatment should be decided in planning

Likely future role:
- remove entirely, or archive only if it contains unique material beyond what is currently visible

### 4.2 `ISSUES/`
Current contents:
- `2025-11-routing.md`
- `2025-11-fix-sidebar-drawer.md`

Assessment:
- folder is clearer than leaving issue notes at root
- content reads like local engineering history / patch notes / manually captured issue stubs
- useful, but not obviously part of the long-term main documentation hierarchy

Likely future role:
- keep as project-history/reference material, or move under an archival docs/history/issues structure later

### 4.3 `.agent/`
Current visible contents:
- `workflows/`

Assessment:
- clearly workflow/tooling-related rather than product documentation
- acceptable as repo support material if actively used
- should not be confused with human-facing docs

Likely future role:
- keep, but mentally separate from project docs
- likely deserves caution during cleanup because it may support automated workflows

### 4.4 `.github/`
Current visible contents:
- `copilot-instructions.md`
- `workflows/`

Assessment:
- normal repo-support area
- not clutter in itself
- belongs to automation/governance, not to end-user docs

Likely future role:
- keep in place

### 4.5 `db/`
Current visible contents:
- `dev.sqlite`

Assessment:
- small but notable because it puts a concrete database file under repo root support structure
- may be acceptable for local development history, but needs governance clarity
- because current approved future architecture removes SQLite fallback, this file now looks more historical/dev-only than strategically central

Likely future role:
- caution item; verify whether it is still actively needed before any cleanup

### 4.6 Root-level scratch/history/doc-heavy pattern
The root contains a document-heavy historical layer instead of a clean hierarchy.

Symptoms:
- many report-style Markdown files
- completion/status artifacts mixed with active docs
- no clear `docs/` structure at root
- no obvious separation between current docs and archived project history

## 5. Phase Artifact Findings
Phase artifacts are currently valuable but poorly placed.

Current placement pattern:
- all Phase 1 and Phase 2 artifacts live directly at repo root
- they are interleaved with active onboarding and historical integration docs

Assessment:
- this is convenient during active work
- it is not a professional long-term layout
- the artifacts should stay available for traceability
- they should likely move later under a dedicated project-history or docs archive structure

What looks professionally preferable later:
- a dedicated docs area with a clear archive/history subtree
- one predictable location for phase artifacts instead of root sprawl
- phase docs grouped by phase and possibly by milestone
- root kept focused on current product/developer entry docs

Professional low-noise handling pattern likely needed later:
- retain all phase outputs
- move them out of root
- preserve names or stable references where useful
- distinguish “approved historical artifact” from “current operating documentation”

Phase artifact quality observations:
- Phase 2 artifacts are structured and enterprise-style
- their problem is placement, not usefulness
- Phase 1 + Phase 2 together now create visible root noise even though they are important records

## 6. Enterprise Repo Structure Assessment
Against a clean professional standard, the repo is mixed.

Strengths:
- source code is separated into `backend/` and `client/`
- issue notes are at least grouped in `ISSUES/`
- project has a primary `README.md`
- Phase 2 artifacts are thorough and structured

Weaknesses:
- root is too noisy
- documentation hierarchy is unclear
- active docs, stale docs, history docs, and AI/planning artifacts are mixed together
- older integration deliverables still appear to be first-class docs
- multiple overlapping “entrypoint” docs reduce discoverability
- temp/deploy leftovers weaken professionalism

Current professionalism score, qualitatively:
- source layout: moderate to good
- documentation governance: weak
- root cleanliness: weak
- historical traceability: strong but noisy
- enterprise polish: moderate at best until docs/root cleanup happens

Major improvement areas:
- establish one clear docs hierarchy
- separate current docs from archive/history
- reduce root-level Markdown count sharply
- isolate temporary or abandoned workspaces
- identify one authoritative onboarding path

## 7. Cleanup Candidate Classification

### 7.1 Likely safe cleanup candidates
These look most likely to be removable later, subject to normal confirmation:
- `backend-deploy-temp/node_modules/`
- temporary/deploy leftover contents under `backend-deploy-temp/` if no unique source material depends on them
- duplicated or superseded generated status/checklist docs once archival policy is defined

Notes:
- “safe” here means likely low functional risk, not approved for deletion yet
- actual cleanup should still confirm whether any referenced process depends on them

### 7.2 Likely archive candidates
These look valuable historically but noisy in the main repo surface:
- all `PHASE1_*` docs
- all `PHASE2_*` docs
- `START_HERE.md`
- `README_INTEGRATION.md`
- `STATUS_REPORT.md`
- `INTEGRATION_COMPLETE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `FILES_MODIFIED_CREATED.md`
- `ISSUES/*.md`
- possibly `FEATURES.md` if it is treated as a historical backlog artifact rather than current roadmap source

### 7.3 Likely keep-in-root candidates
These are the strongest current root keepers:
- `README.md`
- `LICENSE`
- `backend/`
- `client/`
- `db/` (with caution; keep for now)
- `.github/`
- `.agent/` (if actively used)

Potentially also keep one of the following at root, but likely not all:
- `QUICK_START.md`
- a future root-level `docs/` entrypoint

### 7.4 Likely keep-but-relocate candidates
These appear worth preserving but poorly placed:
- all `PHASE1_*` artifacts
- all `PHASE2_*` artifacts
- `DOCUMENTATION_INDEX.md`
- `QUICK_START.md`
- `README_INTEGRATION.md`
- `STATUS_REPORT.md`
- `INTEGRATION_COMPLETE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `FILES_MODIFIED_CREATED.md`
- `ISSUES/`
- `client/docs/ui-wireframe.md`
- `cosmic-background.html`

Reasoning:
- these are more appropriate in a formal docs tree, archive tree, history tree, or design/reference area than at root

### 7.5 Risky / caution items
These need caution before later cleanup because they may still be operationally referenced or historically important:
- `README.md`
  - currently mixed-quality but still the primary repo entrypoint
- `QUICK_START.md`
  - likely stale in parts, but may still be actively used
- `DOCUMENTATION_INDEX.md`
  - may currently serve as a doc map despite being part of the clutter problem
- `FEATURES.md`
  - may function as backlog/reference rather than pure stale content
- `db/dev.sqlite`
  - unclear whether still needed for local development/testing history
- `.agent/`
  - tool/workflow dependent
- `.github/`
  - workflow/instructions dependent
- `ISSUES/`
  - historical troubleshooting context may still matter

## 8. Recommended Inputs for Phase 2.5 Planning
The planning step should decide:
- the future top-level documentation hierarchy
- what the single authoritative root entrypoint should be besides `README.md`
- whether root should keep any secondary docs such as `QUICK_START.md`, or whether those belong under a structured docs area
- where project-history and phase artifacts should live
- whether Phase 1 / Phase 2 outputs should live under:
  - docs archive
  - project history
  - planning records
  - milestone subfolders
- how to separate active docs from archival docs
- what to do with stale integration-era docs
- how to treat issue/history notes (`ISSUES/`)
- whether `backend-deploy-temp/` contains anything worth preserving before later cleanup
- whether `db/dev.sqlite` is still a supported repo artifact or a legacy/dev leftover
- how to govern future AI-generated artifacts so root clutter does not recur
- whether to create a dedicated root `docs/` structure and what substructure it should use

## 9. Appendix

### 9.1 Current root files/folders observed
- `.agent/`
- `.git/`
- `.github/`
- `.gitignore`
- `.vscode/`
- `backend/`
- `backend-deploy-temp/`
- `client/`
- `cosmic-background.html`
- `db/`
- `DOCUMENTATION_INDEX.md`
- `FEATURES.md`
- `FILES_MODIFIED_CREATED.md`
- `IMPLEMENTATION_SUMMARY.md`
- `INTEGRATION_COMPLETE.md`
- `ISSUES/`
- `LICENSE`
- `PHASE1_DISCOVERY_REPORT.md`
- `PHASE1_FRONTEND_ROOT_VERIFICATION.md`
- `PHASE1_IMPLEMENTATION_REPORT.md`
- `PHASE1_PLAN.md`
- `PHASE2_DB_MIGRATION_DISCOVERY_REPORT.md`
- `PHASE2_FINAL_REPORT.md`
- `PHASE2_MASTER_PLAN.md`
- `PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md`
- `PHASE2_MILESTONE_B_DECISIONS.md`
- `PHASE2_MILESTONE_C_LIVE_DB_REPORT.md`
- `PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md`
- `PHASE2_MILESTONE_E_MIGRATION_BLUEPRINT.md`
- `PHASE2_MILESTONE_F_VALIDATION_READINESS.md`
- `QUICK_START.md`
- `README.md`
- `README_INTEGRATION.md`
- `START_HERE.md`
- `STATUS_REPORT.md`
- `TESTING_CHECKLIST.md`

### 9.2 Documentation-like files observed
Root-level docs:
- `DOCUMENTATION_INDEX.md`
- `FEATURES.md`
- `FILES_MODIFIED_CREATED.md`
- `IMPLEMENTATION_SUMMARY.md`
- `INTEGRATION_COMPLETE.md`
- `PHASE1_DISCOVERY_REPORT.md`
- `PHASE1_FRONTEND_ROOT_VERIFICATION.md`
- `PHASE1_IMPLEMENTATION_REPORT.md`
- `PHASE1_PLAN.md`
- `PHASE2_DB_MIGRATION_DISCOVERY_REPORT.md`
- `PHASE2_FINAL_REPORT.md`
- `PHASE2_MASTER_PLAN.md`
- `PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md`
- `PHASE2_MILESTONE_B_DECISIONS.md`
- `PHASE2_MILESTONE_C_LIVE_DB_REPORT.md`
- `PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md`
- `PHASE2_MILESTONE_E_MIGRATION_BLUEPRINT.md`
- `PHASE2_MILESTONE_F_VALIDATION_READINESS.md`
- `QUICK_START.md`
- `README.md`
- `README_INTEGRATION.md`
- `START_HERE.md`
- `STATUS_REPORT.md`
- `TESTING_CHECKLIST.md`

Other doc-like files:
- `ISSUES/2025-11-routing.md`
- `ISSUES/2025-11-fix-sidebar-drawer.md`
- `client/README.md`
- `client/docs/ui-wireframe.md`
- `.agent/workflows/create_todo_app.md`
- `.github/copilot-instructions.md`
- `backend/migration_log.txt`

### 9.3 Temp/history folders observed
- `backend-deploy-temp/`
- `ISSUES/`
- `.agent/`
- `.vscode/`

### 9.4 Phase artifacts observed
Phase 1:
- `PHASE1_DISCOVERY_REPORT.md`
- `PHASE1_FRONTEND_ROOT_VERIFICATION.md`
- `PHASE1_IMPLEMENTATION_REPORT.md`
- `PHASE1_PLAN.md`

Phase 2:
- `PHASE2_DB_MIGRATION_DISCOVERY_REPORT.md`
- `PHASE2_MASTER_PLAN.md`
- `PHASE2_MILESTONE_A_SCHEMA_RECONCILIATION.md`
- `PHASE2_MILESTONE_B_DECISIONS.md`
- `PHASE2_MILESTONE_C_LIVE_DB_REPORT.md`
- `PHASE2_MILESTONE_D_TARGET_POSTGRES_SCHEMA.md`
- `PHASE2_MILESTONE_E_MIGRATION_BLUEPRINT.md`
- `PHASE2_MILESTONE_F_VALIDATION_READINESS.md`
- `PHASE2_FINAL_REPORT.md`
