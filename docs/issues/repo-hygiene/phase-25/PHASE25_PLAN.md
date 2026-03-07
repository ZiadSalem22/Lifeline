# Phase 2.5 Plan

## 1. Objective
Phase 2.5 will clean the repository surface and establish a professional documentation/layout standard before Phase 3 begins.

This phase will:
- reduce root-level clutter
- separate active documentation from archival/history material
- relocate Phase 1 / Phase 2 artifacts into a deliberate structure
- classify stale-but-useful docs for archive rather than accidental loss
- remove clearly temporary or low-value leftovers where risk is low
- leave the repo with a small, intentional root and a clear docs hierarchy

This phase will not:
- change database design or migration planning
- do Docker or deployment redesign work
- refactor application source architecture
- broadly rewrite all documentation content
- perform large product/content re-authoring beyond minimal structure/entrypoint cleanup

## 2. Locked Inputs
This plan is based on the following locked discovery findings:
- the main hygiene problem is root/documentation clutter, not source-code layout
- source layout is already reasonably clear:
  - `backend/`
  - `client/`
  - `db/`
- root currently mixes:
  - active docs
  - stale integration docs
  - Phase 1 / Phase 2 artifacts
  - issue/history notes
  - temporary-looking leftovers
- `backend-deploy-temp/` is the clearest temporary-looking hygiene issue
- Phase artifacts are valuable and should be preserved, but not at repo root
- several docs are stale-yet-useful rather than obviously disposable
- cleanup risk is medium because some items may still carry historical or operational value

## 3. Target Repository Documentation Structure
The target structure should be simple, explicit, and low-noise.

### 3.1 Root-level target intent
Root should contain only:
- core source/product directories
- essential repo metadata
- one primary entrypoint doc
- at most one or two secondary current-use docs if truly justified

Recommended future root set:
- `README.md`
- `LICENSE`
- `backend/`
- `client/`
- `db/`
- `.github/`
- `.agent/` if actively used
- optionally one root `docs/` directory
- optionally one root quick-start pointer only if it remains genuinely current and non-duplicative

### 3.2 Proposed docs structure
Recommended future documentation hierarchy:
- `docs/`
  - `README.md` or `index.md` as the docs entrypoint
  - `guides/`
    - active user/developer guides
  - `reference/`
    - design/reference materials that are still current
  - `history/`
    - issue/history/reference notes
  - `phases/`
    - preserved phase artifacts grouped by phase
  - `archive/`
    - stale or superseded but historically useful docs

### 3.3 Placement rules
Docs that should live at repo root:
- only the main `README.md`
- possibly one short current quick-start doc if it remains truly active after cleanup

Docs that should live under `docs/`:
- active non-root docs
- guides
- references
- indexes
- testing/checklist docs if still current

Docs that should live under `docs/phases/`:
- all Phase 1 and Phase 2 planning/discovery/report artifacts
- grouped by phase
- milestone docs kept together

Docs that should live under `docs/history/` or similar:
- issue notes
- local engineering history notes
- historic troubleshooting records

Docs that should live under `docs/archive/`:
- stale integration-era completion/status docs
- superseded planning or summary docs retained only for historical context

Design/reference material that is still useful but not root-worthy should live under `docs/reference/`.

## 4. Root-Level Item Policy

### 4.1 Keep at root
- `README.md`
- `LICENSE`
- `backend/`
- `client/`
- `db/` (structure only; contents may need review)
- `.github/`
- `.agent/` if active

### 4.2 Relocate
These should likely move out of root into a structured docs tree:
- `QUICK_START.md`
- `DOCUMENTATION_INDEX.md`
- `FEATURES.md`
- `ISSUES/`
- `cosmic-background.html`

Likely destinations:
- `QUICK_START.md` -> `docs/guides/`
- `DOCUMENTATION_INDEX.md` -> `docs/` as docs entrypoint or navigation doc
- `FEATURES.md` -> `docs/reference/` or `docs/archive/` depending on current value
- `ISSUES/` -> `docs/history/issues/`
- `cosmic-background.html` -> `docs/reference/` or a design/archive area if still relevant

### 4.3 Archive
These should likely be preserved but removed from root visibility:
- `START_HERE.md`
- `README_INTEGRATION.md`
- `STATUS_REPORT.md`
- `INTEGRATION_COMPLETE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `FILES_MODIFIED_CREATED.md`
- all `PHASE1_*`
- all `PHASE2_*`

### 4.4 Delete
Likely delete candidates later, subject to confirmation during implementation:
- `backend-deploy-temp/node_modules/`
- `backend-deploy-temp/` if it contains no unique artifacts worth preserving beyond visible leftovers
- other clearly generated/temp leftovers found during execution if they are non-source, reproducible, and not referenced

### 4.5 Caution / review first
These require explicit caution before any cleanup action:
- `db/dev.sqlite`
- `QUICK_START.md`
- `DOCUMENTATION_INDEX.md`
- `FEATURES.md`
- `.agent/`
- `.github/`
- `ISSUES/`
- `README.md`

Reason:
- they may still be used operationally, referenced externally, or contain historical context that should be archived instead of removed

## 5. Phase Artifact Policy
Phase artifacts should be preserved as project history, but removed from root.

Approved policy:
- keep all Phase 1 and Phase 2 artifacts
- relocate them under a dedicated phase-history structure
- group by phase
- keep milestone artifacts together within each phase
- preserve filenames where practical for traceability

Recommended layout:
- `docs/phases/phase-1/`
  - `PHASE1_DISCOVERY_REPORT.md`
  - `PHASE1_FRONTEND_ROOT_VERIFICATION.md`
  - `PHASE1_IMPLEMENTATION_REPORT.md`
  - `PHASE1_PLAN.md`
- `docs/phases/phase-2/`
  - all `PHASE2_*` artifacts

Optional enhancement:
- add a short `docs/phases/README.md` or index file listing available phase artifacts

Policy intent:
- keep historical planning accessible
- remove phase-noise from the root
- treat phase docs as preserved records, not current front-door docs

## 6. Stale Documentation Policy
Stale-but-useful docs should default to archive, not deletion, unless they are clearly low-value duplicates.

### 6.1 Archive-first set
Archive rather than delete:
- `START_HERE.md`
- `README_INTEGRATION.md`
- `STATUS_REPORT.md`
- `INTEGRATION_COMPLETE.md`
- `IMPLEMENTATION_SUMMARY.md`
- `FILES_MODIFIED_CREATED.md`

Reason:
- these reflect a meaningful delivery/history trail
- they are likely stale as current guidance
- they still have reference value

### 6.2 Merge/replace later candidates
These may later be consolidated by stronger current docs, but this phase should avoid deep rewriting:
- `QUICK_START.md`
- `DOCUMENTATION_INDEX.md`
- parts of `README.md`
- possibly `FEATURES.md`

Phase 2.5 implementation should focus on structure first, not major content rewrite.

### 6.3 Likely delete only with confidence
Delete only if clearly superseded and historically low-value:
- temp/generated duplicates
- leftover deploy temp materials
- bulky generated directories such as temp `node_modules/`

### 6.4 History preservation rule
If historical value is unclear, prefer:
1. relocate
2. archive
3. only then delete if value is confidently low

## 7. Temporary / Hygiene Cleanup Policy

### 7.1 `backend-deploy-temp/`
Planned policy:
- inspect for unique non-generated source or configuration value
- if it only contains temp/deploy leftovers, remove it during implementation
- do not preserve `node_modules/`

### 7.2 `backend-deploy-temp/node_modules/`
Planned policy:
- delete as generated clutter
- no archive value expected

### 7.3 Other obvious clutter
Implementation should also check for:
- obsolete generated temp files
- scratch/history artifacts misplaced at root
- standalone non-source leftovers with no active role

### 7.4 Hygiene decision rule
A temp item can be deleted later if it is:
- generated
- reproducible
- not part of source/history/reference value
- not referenced by active docs/workflows

Otherwise, relocate or archive it instead.

## 8. Ordered Execution Plan
1. Create the target docs structure.
2. Establish the future docs entrypoint under `docs/`.
3. Relocate Phase 1 artifacts into `docs/phases/phase-1/`.
4. Relocate Phase 2 artifacts into `docs/phases/phase-2/`.
5. Relocate issue/history notes into `docs/history/` or `docs/history/issues/`.
6. Relocate stale-but-useful integration-era docs into `docs/archive/`.
7. Relocate active-but-non-root docs such as quick-start/reference materials into `docs/guides/` or `docs/reference/`.
8. Clean the root so only approved keepers remain.
9. Remove clearly temporary/generated clutter, especially `backend-deploy-temp/node_modules/` and likely the enclosing temp folder if confirmed safe.
10. Update the repo’s documentation entrypoint minimally so users can find active docs and archives cleanly.
11. Produce an implementation report summarizing what was moved, archived, deleted, and intentionally left unchanged.

## 9. Expected Deliverables
The Phase 2.5 implementation step should leave behind:
- a visibly cleaner repo root
- a new `docs/` hierarchy
- Phase 1 artifacts relocated under a phase-history area
- Phase 2 artifacts relocated under a phase-history area
- issue/history notes relocated under a history area
- stale integration-era docs archived instead of left at root
- clearly temporary clutter removed where safe
- a current documentation entrypoint under `docs/`
- minimal root-level doc surface
- a Phase 2.5 implementation report summarizing the cleanup
- optionally a small archive/phases index if it improves discoverability

## 10. Risks and Safeguards
Main risks:
- deleting something historically useful
- breaking references to moved docs
- removing a file still used operationally
- turning a structure cleanup into a broad content rewrite
- accidentally touching source/runtime/deployment scope

Safeguards:
- prefer relocate/archive over delete when value is unclear
- treat `db/dev.sqlite` as caution-only unless explicitly validated
- avoid touching `backend/` and `client/` source layouts except doc/reference placement around them
- preserve filenames where practical for phase/history docs
- keep implementation scoped to repo hygiene and docs governance
- produce a cleanup report so all structural changes remain auditable

## 11. Out of Scope
Phase 2.5 must not touch:
- MSSQL/PostgreSQL migration design or execution
- Docker/Compose
- deployment redesign
- application source-code architecture refactoring
- broad code cleanup unrelated to repo hygiene
- mass rewriting of every document
- product/content redesign beyond minimal doc entrypoint hygiene

## 12. Recommendation for the Phase 2.5 Implementation Prompt
The next implementation prompt should instruct the agent to:
- execute the approved repo hygiene structure cleanup only
- create the target `docs/` hierarchy
- relocate Phase 1 and Phase 2 artifacts out of root into grouped phase folders
- relocate issue/history notes into a history area
- archive stale integration-era docs rather than deleting them by default
- remove clearly temporary/generated clutter such as `backend-deploy-temp/node_modules/`
- evaluate whether `backend-deploy-temp/` itself should be removed after confirming no unique value remains
- keep `README.md` as the root entrypoint
- leave `db/dev.sqlite` untouched unless explicitly approved otherwise
- produce a Phase 2.5 implementation report describing every structural change
- avoid broad doc rewriting or any non-hygiene scope expansion
