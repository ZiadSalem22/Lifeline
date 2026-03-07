# Lifeline Documentation

This directory is the long-term documentation home for the repository.

Phase 6A removes ongoing root-level report clutter and normalizes documentation into stable sections that future work can build on.

## Active sections

- [product/](product)
  - product-facing documentation, positioning, roadmap summaries, and user-facing narratives
- [features/](features)
  - feature inventory and feature-specific documentation
- [frontend/](frontend)
  - client-side implementation notes and UI artifacts
- [backend/](backend)
  - backend implementation and service documentation
- [api/](api)
  - API contracts and endpoint-oriented documentation
- [data-model/](data-model)
  - schema, entities, migrations, and model documentation
- [architecture/](architecture)
  - system architecture and topology notes
- [operations/](operations)
  - runbooks, quick starts, deployment procedures, and operational guides
- [adr/](adr)
  - architecture decision records
- [templates/](templates)
  - reusable documentation templates and scaffolds
- [reference/](reference)
  - retained reference material
- [issues/](issues)
  - issue-centered history and phase artifacts
- [archive/](archive)
  - stale or superseded documentation retained for history

## Report and output hygiene

- The repository root is not a report drop-zone.
- Non-canonical artifacts should use `docs/issues/<initiative>/<step>/<artifact-class>/`, with `discovery/`, `planning/`, `implementation/`, and `final/` as the default artifact-class folders.
- Temporary discovery notes, plans, workstream reports, checkpoint outputs, validation outputs, and progress summaries belong under `docs/issues/...`, not at root.
- Use `docs/issues/report-history/unscoped/` only when a prompt does not provide a valid non-root path and the initiative/step cannot be derived confidently.
- Superseded long-term docs belong under `docs/archive/...`, not mixed with execution reporting.
- A root-level artifact is acceptable only when it is explicitly approved as a singular permanent top-level deliverable.

## Current starting points

- Project overview: [../README.md](../README.md)
- Quick start: [operations/QUICK_START.md](operations/QUICK_START.md)
- Deploy-branch CD: [operations/DEPLOY_BRANCH_CD.md](operations/DEPLOY_BRANCH_CD.md)
- Testing reference: [reference/TESTING_CHECKLIST.md](reference/TESTING_CHECKLIST.md)
- Feature inventory: [features/FEATURES.md](features/FEATURES.md)
- Deployment and phase history: [issues/deployment-prep](issues/deployment-prep)
- Governance history: [issues/governance](issues/governance)
- Report/output policy: [reference/REPORT_OUTPUT_POLICY.md](reference/REPORT_OUTPUT_POLICY.md)
- Secondary fallback report storage: [issues/report-history/unscoped](issues/report-history/unscoped)

## Historical issue groupings

- [DB migration prep](issues/db-migration-prep)
- [Deployment prep](issues/deployment-prep)
- [Governance](issues/governance)
- [Report history](issues/report-history)
- [Repo hygiene](issues/repo-hygiene)
- [Repo history notes](issues/repo-history)
