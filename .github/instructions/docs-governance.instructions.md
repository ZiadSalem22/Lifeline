# Documentation Governance Instructions

Use this instruction file when creating, updating, reviewing, or routing documentation work.

## Purpose

Ensure documentation changes are routed to the correct domain and kept current when code, behavior, or runtime assumptions change.

## Required behavior

- Identify impacted docs domains before writing or editing docs.
- Prefer updating existing docs over creating duplicates.
- Keep business/product docs separate from API and backend docs.
- Keep operations docs separate from architecture docs.
- Keep historical reports out of the repo root.

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
- If docs are intentionally deferred, state that explicitly.
