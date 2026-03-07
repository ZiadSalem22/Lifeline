# Documentation Governance Instructions

Use this instruction file when creating, updating, reviewing, or routing documentation work.

## Purpose

Ensure documentation changes are routed to the correct domain and kept current when code, behavior, or runtime assumptions change.

## Required behavior

- Identify impacted docs domains before writing or editing docs.
- Prefer updating existing docs over creating duplicates.
- Keep business/product docs separate from API and backend docs.
- Keep operations docs separate from architecture docs.
- Keep historical reports and execution artifacts out of the repo root.
- Treat discovery notes, implementation plans, workstream reports, checkpoint outputs, and progress summaries as temporary artifacts unless they are explicitly designated as a final retained report.
- Default temporary and historical reporting artifacts to `docs/issues/report-history/` unless a more specific issue-history folder under `docs/issues/...` is clearly better.
- Use `docs/archive/...` for superseded long-term docs, not as the default destination for execution reporting.
- Allow a root-level report only when a single final report is explicitly required and clearly justified.
- When a phase completes, compact or relocate temporary reports instead of leaving a multi-report trail in root.

## Routing rules

- frontend UI or flow changes → `docs/frontend/`
- backend logic changes → `docs/backend/`
- endpoint contract changes → `docs/api/`
- business rule changes → `docs/product/` and possibly `docs/features/`
- data model changes → `docs/data-model/`
- deployment/runtime changes → `docs/operations/`
- cross-cutting or structural changes → `docs/architecture/` and possibly `docs/adr/`

## Output expectations

- Name the impacted docs domains.
- Name the files that should be updated.
- Name the correct storage target for any reports or execution artifacts produced by the work.
- If docs are intentionally deferred, state that explicitly.
