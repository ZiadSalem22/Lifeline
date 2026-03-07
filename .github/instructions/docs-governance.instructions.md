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
- Decide the artifact class and destination path before writing any non-canonical output.
- Treat discovery notes, implementation plans, workstream reports, checkpoint outputs, and progress summaries as temporary artifacts unless they are explicitly designated as a final retained report.
- Route issue-history artifacts using `docs/issues/<initiative>/<step>/<artifact-class>/` whenever the initiative and step can be identified.
- Use `discovery/`, `planning/`, `implementation/`, and `final/` as the default artifact-class folders.
- If a prompt asks for a report but does not provide a valid non-root path, derive the initiative and step from the work and use the scoped pattern.
- Use `docs/issues/report-history/unscoped/` only as a secondary fallback when a valid scoped path cannot be derived confidently.
- Use `docs/archive/...` for superseded long-term docs, not as the default destination for execution reporting.
- Allow a root-level artifact only when it is explicitly approved as a singular permanent top-level deliverable.
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
- Name the exact non-root storage target for any reports or execution artifacts produced by the work.
- If docs are intentionally deferred, state that explicitly.
