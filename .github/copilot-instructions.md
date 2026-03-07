# Copilot Instructions for Lifeline

Use this file as the stable, always-on repo guidance layer.

## Repo shape

Lifeline is a full-stack application with:
- backend code in `backend/`
- frontend code in `client/`
- long-term documentation in `docs/`
- deployment automation in `.github/workflows/` and `deploy/`

Production currently deploys by pushing to `deploy`, which triggers the VPS deployment workflow.

## Documentation system rules

- Do not use the repository root as a drop-zone for reports or scratch docs.
- Active long-term documentation belongs under `docs/`.
- Historical phase and issue artifacts belong under `docs/issues/...`.
- Stale or superseded material belongs under `docs/archive/...`.
- Route non-canonical artifacts using `docs/issues/<initiative>/<step>/<artifact-class>/` whenever the initiative and step can be identified.
- Use `discovery/`, `planning/`, `implementation/`, `results/`, and `final/` as the default artifact-class folders for issue-history work.
- If a prompt asks for a report but does not provide a valid non-root path, derive the initiative and step from the work and use the scoped `docs/issues/<initiative>/<step>/...` pattern.
- Use `docs/issues/report-history/unscoped/` only as a secondary fallback when the work cannot be scoped confidently.
- Default all temporary execution artifacts, progress reports, discovery notes, plans, workstream reports, implementation reports, validation reports, and phase summaries away from the repo root.
- Treat repo root as a home for intentional top-level project files only.
- Only create a root-level artifact when it is explicitly approved as a singular permanent top-level deliverable.
- When a phase or implementation pass completes, compact temporary reporting into a scoped non-root history location instead of leaving reporting in root.
- Before making a non-trivial code or runtime change, evaluate documentation impact.

## Documentation domains

Keep these domains separate:
- `docs/product/` for business rules, user concepts, and product behavior
- `docs/features/` for feature inventory and feature-level summaries
- `docs/frontend/` for screens, flows, routes, UI state, and responsive behavior
- `docs/backend/` for use cases, services, middleware, persistence behavior, and backend internals
- `docs/api/` for request/response contracts, auth requirements, and error behavior
- `docs/data-model/` for entities, tables, relationships, and migrations
- `docs/architecture/` for system structure, boundaries, runtime topology, and integration points
- `docs/operations/` for setup, deployment, CI/CD, runtime checks, and rollback
- `docs/adr/` for durable architecture decision records

## How to use the instruction system

- Use this file for stable repo-wide rules only.
- Use `.github/skills/...` for repo-native governance and engineering skill guidance.
- Use `.github/instructions/...` for domain-specific documentation guidance.
- Use `.github/agents/...` for domain-specific documentation workflows.
- Use `.github/teams/...` for grouped governance responsibilities.
- Use `.github/workflows-governance/...` for repeatable governance workflow sequences.
- Use `.github/prompts/...` for reusable AI documentation tasks, including artifact-routing conventions.
- Use `docs/templates/...` when creating or refreshing documentation.

## Documentation update expectations

- Frontend behavior changes should update `docs/frontend/` and often `docs/features/`.
- Backend behavior changes should update `docs/backend/` and may also affect `docs/product/` or `docs/api/`.
- Endpoint changes should update `docs/api/`.
- Data-model changes should update `docs/data-model/`.
- Deployment or environment changes should update `docs/operations/` and possibly `docs/architecture/`.
- Major durable design changes should add or update an ADR in `docs/adr/`.

## Practical rule

Keep this file short. Put specialized writing rules in the path-specific instruction files instead of expanding this file indefinitely.
