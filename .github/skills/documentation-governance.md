# Skill: documentation-governance

## Purpose

Apply Lifeline's documentation-system rules consistently when code, behavior, schema, architecture, or operations change.

This skill exists to prevent documentation drift, prevent root-level report clutter from returning, and preserve the separation between product, feature, frontend, backend, API, data-model, architecture, operations, ADR, reference, archive, and issue-history documentation.

## Scope

Use this skill to decide:
- whether a change requires documentation updates
- which docs domains must be updated
- whether multiple docs domains are affected
- whether the change should produce or refresh an ADR
- whether a change is a product/business-rule change versus only a backend or API change

## When to use it

Use this skill when a change touches any of the following:
- frontend UX, routes, layout, or interactions
- backend business logic or persistence behavior
- API contracts or auth requirements
- schema, entities, migrations, or identity mapping
- deployment, CI/CD, runtime verification, or operational behavior
- cross-cutting system design or durable design decisions

Use this skill especially before:
- writing docs
- reviewing docs impact in a PR
- deciding where a new doc belongs
- creating or relocating phase/history artifacts
- deciding whether a final report is actually needed versus compacting or relocating temporary outputs

## Sources of truth

Consult these sources first:
- `.github/copilot-instructions.md`
- `.github/instructions/docs-governance.instructions.md`
- domain-specific instructions under `.github/instructions/`
- `docs/README.md`
- `docs/reference/REPORT_OUTPUT_POLICY.md`
- `docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md`
- `docs/templates/docs-update-checklist.md`
- `docs/templates/change-impact-matrix.md`

Then consult the relevant code or config source of truth:
- frontend source under `client/`
- backend source under `backend/`
- deployment and CI/CD under `.github/workflows/`, `deploy/`, `compose.production.yaml`, and `Dockerfile`

## What this skill must know

- Active long-term docs live under `docs/`, not at repo root.
- Historical reports belong in `docs/issues/...` or `docs/archive/...`.
- Temporary execution artifacts are not root deliverables by default.
- The preferred fallback storage path for historical execution reporting is `docs/issues/report-history/`.
- A root-level report is acceptable only as a singular, explicitly required final handoff artifact.
- Frontend docs are first-class and must not be treated as secondary to backend or API docs.
- Product/business behavior docs are separate from backend and API docs.
- Operations/deployment docs are separate from architecture docs.

## Domain map

- `docs/product/` → business rules, user concepts, workflow behavior
- `docs/features/` → feature inventory and feature-level summaries
- `docs/frontend/` → routes, screens, flows, UI state, responsive behavior
- `docs/backend/` → use cases, services, middleware, repositories, persistence behavior
- `docs/api/` → endpoint contracts, auth requirements, request/response shapes, error behavior
- `docs/data-model/` → entities, tables, relationships, migrations, identity mapping
- `docs/architecture/` → system boundaries, runtime topology, cross-cutting design
- `docs/operations/` → setup, deployment, CI/CD, verification, rollback
- `docs/adr/` → durable architecture decisions
- `docs/reference/` → retained supporting reference material
- `docs/archive/` → stale or superseded retained docs
- `docs/issues/` → issue-centered phase and history artifacts
- `docs/issues/report-history/` → fallback home for discovery reports, plans, workstream reports, checkpoint outputs, and other historical execution artifacts

## Routing heuristics

### If the change is primarily frontend UX
Update:
- `docs/frontend/`
- maybe `docs/features/`
- maybe `docs/product/` if user-facing business flow changed

### If the change is primarily an API contract change
Update:
- `docs/api/`
- maybe `docs/backend/`

### If the change is a business-rule change
Update:
- `docs/product/`
- maybe `docs/features/`
- maybe `docs/backend/`
- only update `docs/api/` if the transport contract also changed

### If the change is a schema or entity change
Update:
- `docs/data-model/`
- maybe `docs/backend/`
- maybe `docs/architecture/`

### If the change is a deploy or runtime change
Update:
- `docs/operations/`
- maybe `docs/architecture/`

## ADR heuristics

Create or refresh an ADR when the change materially affects:
- deployment model
- auth model
- persistence model
- domain boundaries
- frontend/backend responsibilities
- documentation governance itself

## Practical checklist

- Identify the primary docs domain.
- Identify any secondary docs domains.
- Update existing docs before creating new duplicates.
- Keep product, frontend, backend, API, and operations docs separate.
- Decide whether any report is temporary or final.
- Route temporary or historical reports into `docs/issues/...`, preferring `docs/issues/report-history/` unless a narrower issue folder exists.
- Keep superseded long-term docs in `docs/archive/...` instead of mixing them with execution artifacts.
- If the change is durable and structural, evaluate ADR impact.

## What this skill must not do

- treat all docs as one bucket
- put reports back in the repo root
- create multiple root-level phase/workstream reports by default
- collapse frontend, backend, API, and product docs into a single generic document
- describe business rules only in API docs
- route operations material into architecture docs by default

## Examples

- sidebar UX change → `docs/frontend/`, maybe `docs/features/`
- recurrence business-rule change → `docs/product/`, maybe `docs/features/`, maybe `docs/backend/`
- `/api/me` contract change → `docs/api/`, maybe `docs/backend/`
- identity-mapping schema change → `docs/data-model/`, maybe `docs/backend/`, maybe `docs/architecture/`
- deploy workflow verification change → `docs/operations/`, maybe `docs/architecture/`
- discovery/workstream checkpoint output → `docs/issues/report-history/` unless a more specific issue-history folder already owns that program
- explicitly requested final handoff report → root only if singular and clearly justified; otherwise keep it under `docs/issues/...`
