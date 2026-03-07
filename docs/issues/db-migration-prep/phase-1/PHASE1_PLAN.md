# Phase 1 Plan

## 1. Objective
Phase 1 will restore the accidentally broken local frontend root file at `client/src/app/App.jsx` to the last committed `HEAD` state, establish a minimal pre-clean baseline, remove only clearly safe non-runtime artifacts, and confirm that this cleanup did not change current runtime behavior.

Phase 1 will not perform database migration, Docker or Compose setup, deployment redesign, architecture refactoring, SQL Server cleanup, SQLite removal, or behavior changes beyond restoring the accidental local `App.jsx` breakage.

## 2. Assumptions and Locked Inputs
This plan is based on the following locked inputs from discovery and targeted verification:

- The repository is one product with a frontend in `client` and a backend in `backend`.
- The frontend is React + Vite.
- The active runtime root is `client/src/app/App.jsx`, imported by `client/src/app/main.jsx`.
- The current working tree version of `client/src/app/App.jsx` is locally modified and broken.
- The committed `HEAD` version of `client/src/app/App.jsx` parses successfully.
- The checked-in `client/dist` appears older than the broken local `App.jsx` and likely reflects an older successful build.
- The backend is Express + TypeORM, intended to be MSSQL-first, with local SQLite fallback behavior still present.
- Current deployment evidence reflects a split frontend/backend model with Azure/SWA artifacts, and no Docker artifacts exist yet.
- Safe cleanup candidates already identified include `client/dist`, `client/dist.zip`, `frontend_old`, top-level `*.diff` and scratch artifacts, and `client/scripts/ui-smoke-debug.*`.
- Risky items that must not be removed casually include env files, SQLite files, migrations, deployment configs, backend legacy controller/route structures, and context-preserving docs.

These inputs should remain fixed unless implementation uncovers direct contradictory repository evidence.

## 3. Ordered Execution Plan
1. **Capture pre-change working tree baseline**
   - Record current branch and `git status --short` output.
   - Record whether any files besides `client/src/app/App.jsx` are modified or untracked.
   - Save a concise pre-clean inventory of the specific files targeted for deletion so the implementation step has an explicit audit trail.
   - Purpose: avoid accidental cleanup while the tree contains unrelated work.

2. **Restore the frontend root to committed state first**
   - Restore `client/src/app/App.jsx` exactly from `HEAD` before any cleanup or validation that depends on frontend health.
   - Do not hand-edit, reformat, or partially patch the file.
   - Purpose: remove the known local corruption and return the frontend root to the last committed source of truth.

3. **Verify the restoration took effect**
   - Confirm `client/src/app/App.jsx` no longer differs from `HEAD`.
   - Re-run a lightweight syntax/build verification for the frontend root path.
   - Confirm that the previous parser/build failure tied to `App.jsx` is gone.
   - Purpose: ensure the implementation is not masking a different issue.

4. **Capture minimal runtime baseline after restoration and before cleanup**
   - Frontend: run a production build check from `client`.
   - Backend: run a minimal non-destructive verification such as backend test/lint-free startup check only if it does not require DB mutation; prefer an existing safe command already supported by the repo.
   - Record results as the pre-clean committed-state baseline.
   - Purpose: distinguish cleanup effects from pre-existing runtime conditions.

5. **Execute Batch A safe cleanup only**
   - Remove only the explicitly approved safe artifacts listed in Batch A below.
   - Do not widen scope during implementation.
   - If any candidate has unexpected references/usages during execution, stop and move it to review rather than deleting it.

6. **Do not delete stale docs in Phase 1**
   - Leave the documentation set in place.
   - If implementation is asked to handle docs, it should only classify or optionally prepare an archive manifest/report, not remove them.
   - Purpose: preserve migration, deployment, and history context until later phases decide what to retain.

7. **Run post-clean validation**
   - Re-run the same minimal frontend validation used in Step 4.
   - Re-run the same minimal backend/repo integrity checks used in Step 4.
   - Confirm no new modified runtime files were introduced by cleanup.
   - Purpose: prove that cleanup did not alter behavior.

8. **Produce a cleanup/report artifact**
   - Create a concise Phase 1 cleanup report summarizing:
     - what was restored
     - what was deleted
     - what was intentionally left untouched
     - validation outcomes
     - any candidates deferred for later review
   - If archival is recommended but not executed, include an archive manifest proposal rather than moving files.

## 4. Cleanup Batches
### 4.1 Batch A — Safe immediate cleanup
These are the only items Phase 1 should delete immediately, assuming they still exist and show no unexpected active references during execution:

- `client/dist`
- `client/dist.zip`
- `frontend_old`
- top-level `*.diff` artifacts
  - `AdvancedSearch.diff`
  - `App.diff`
  - `App_main.diff`
  - `ExportImport.diff`
  - `Settings.diff`
  - `Statistics.diff`
- top-level scratch/non-source artifacts that appear non-runtime and non-authoritative
  - `app_base.jsx`
  - `oldApp.txt`
  - `todo_list_draft.txt`
  - `empty.md`
  - `patch_app.py`
  - `repro_crash.js`
  - `COMPLETION_CERTIFICATE.txt`
- smoke/debug artifacts under `client/scripts`
  - `client/scripts/ui-smoke-debug.html`
  - `client/scripts/ui-smoke-debug.png`

Constraints for Batch A:
- Do not delete anything outside this explicit list unless later implementation evidence clearly proves it is equivalent in risk.
- Do not delete generated artifacts that are still currently being used as inputs by scripts or workflows.

### 4.2 Batch B — Review/archive candidates
These should remain in place in Phase 1 unless a later explicit prompt authorizes archival or relocation. Phase 1 may document them, but should not delete them.

- stale-looking documentation set
  - `START_HERE.md`
  - `QUICK_START.md`
  - `README_INTEGRATION.md`
  - `IMPLEMENTATION_SUMMARY.md`
  - `INTEGRATION_COMPLETE.md`
  - `STATUS_REPORT.md`
  - `FILES_MODIFIED_CREATED.md`
  - `DOCUMENTATION_INDEX.md`
  - `TESTING_CHECKLIST.md`
- top-level note/history files whose value is uncertain
  - `FEATURES.md`
  - issue notes under `ISSUES/`
- temporary-looking deployment support area
  - `backend-deploy-temp`

Recommended handling in Phase 1:
- Leave these items untouched.
- Optionally create an archive/review manifest in the cleanup report that flags them for a later documentation/archive phase.
- Do not move them unless implementation is explicitly instructed to create a quarantine/archive folder.

### 4.3 Batch C — Deferred items
These are explicitly out of cleanup scope for Phase 1 and must be deferred:

- env files and backups
  - `client/.env*`
  - `backend/.env*`
- SQLite files
  - `db/dev.sqlite`
  - `backend/todos_v4.db`
- migrations and DB bootstrap assets
  - `backend/migrations/`
  - `backend/src/migrations/`
  - `backend/db/mssql-init.sql`
- deployment/config artifacts
  - `.github/workflows/`
  - `client/staticwebapp.config.json`
  - `client/swa-cli.config.json`
  - `backend/.deployment`
- backend legacy structures
  - `backend/src/controllers/`
  - `backend/src/routes/`
  - `backend/src/config/index.js`
- dependency or build configuration changes
  - `.gitignore` broad rewrites
  - package changes
  - script changes
- any database/provider behavior changes
  - MSSQL/SQLite fallback changes
  - TypeORM/raw SQL cleanup

## 5. Validation Plan
Implementation should verify Phase 1 success with the smallest reliable validation set:

1. **Frontend validation**
   - Confirm `client/src/app/App.jsx` matches `HEAD` after restoration.
   - Run a frontend production build from `client`.
   - If build fails after restoration, capture the failure and stop treating the issue as only local corruption.

2. **Backend validation**
   - Run a minimal safe backend validation that does not mutate DB state.
   - Preferred options are existing tests or a startup/import check already supported by the repo.
   - Avoid reset scripts, migration execution, or any operation that changes DB contents.

3. **Repo integrity checks**
   - Re-run `git status --short` after cleanup.
   - Confirm the only intentional changes are:
     - restored `client/src/app/App.jsx`
     - deleted Batch A artifacts
     - newly added cleanup/report files, if required by the implementation prompt
   - Confirm no unexpected runtime/config files changed.

4. **Behavior preservation check**
   - Compare pre-clean and post-clean validation outcomes.
   - Confirm cleanup did not introduce new frontend build failures or new backend verification failures.

## 6. Risks and Safeguards
- **Risk: deleting still-useful docs too early**
  - Safeguard: do not delete stale docs in Phase 1; only classify them and optionally list them for later archival review.

- **Risk: deleting DB or migration artifacts before migration planning**
  - Safeguard: all DB files, migrations, and provider-specific assets are Batch C deferred items.

- **Risk: confusing deployment artifacts with junk**
  - Safeguard: leave all Azure/SWA/deployment config untouched in Phase 1.

- **Risk: masking real frontend issues by only reverting `App.jsx`**
  - Safeguard: restoration must be followed by a real frontend build validation, not just `git diff` confirmation.

- **Risk: deleting items outside approved cleanup scope**
  - Safeguard: restrict deletions to the explicit Batch A list.

- **Risk: unintentionally changing runtime behavior while “cleaning”**
  - Safeguard: no refactors, no import rewrites, no config rewrites, no dependency changes, no DB behavior changes.

- **Risk: mixing Phase 1 cleanup with later Docker/database work**
  - Safeguard: keep Dockerization, provider migration, and deployment redesign explicitly out of scope.

## 7. Expected Deliverables
The Phase 1 implementation step should leave behind:

- `client/src/app/App.jsx` restored exactly to committed `HEAD`
- Batch A artifacts removed
- a concise Phase 1 cleanup report in the repo root describing:
  - what was restored
  - what was removed
  - what was deferred
  - validation results
- optionally, an archive/review manifest section inside that report for Batch B documentation candidates
- optionally, a very small `.gitignore` suggestion only if implementation finds recurring safe generated artifacts that clearly should not be committed again

It should not leave behind broader config rewrites, archival folder reshuffles, or behavior changes.

## 8. Out of Scope
The following must wait for later phases:

- PostgreSQL migration
- SQL Server export/import or provider conversion
- Dockerfiles
- `docker-compose`
- deployment consolidation or Azure artifact cleanup
- architecture refactors
- backend route/controller modernization
- SQLite fallback redesign
- stale documentation deletion or mass archival
- environment variable redesign
- behavior changes unrelated to restoring the accidental `App.jsx` breakage

## 9. Recommendation for Phase 1 Implementation Prompt
The next implementation prompt should instruct the agent to:

1. capture a pre-change git/status baseline
2. restore `client/src/app/App.jsx` exactly from `HEAD`
3. verify the frontend build from committed source state
4. remove only the approved Batch A cleanup items
5. run minimal post-clean frontend/backend/repo validation
6. produce a Phase 1 cleanup report documenting actions, validation, and deferred items
7. avoid touching Batch B and Batch C items

The implementation prompt should explicitly forbid any database migration, Docker work, deployment edits, or refactoring.
