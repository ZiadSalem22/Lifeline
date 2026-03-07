# Documentation Governance Workflow

## Purpose

Define the repeatable execution path for documentation governance in Lifeline.

This workflow sits above the documentation-governance skill, agent, and team and turns those governance layers into a practical sequence for reviewing code, config, schema, UX, and runtime changes.

## Built on

- `.github/skills/documentation-governance.md`
- `.github/agents/documentation-governance-agent.md`
- `.github/teams/documentation-governance-team.md`

## Inputs

- proposed change description
- changed files or affected surfaces
- relevant product, frontend, backend, API, data-model, architecture, or operations context
- PR context when available

## Workflow sequence

1. Inspect the proposed change.
2. Decide whether documentation is impacted.
3. Map impacted documentation domains.
4. Determine primary and secondary docs targets.
5. Decide whether an ADR is required.
6. Generate or refresh the documentation update checklist.
7. Decide whether any produced report or artifact is canonical documentation, temporary issue-history output, or retained final history.
8. Decide the exact non-root destination path before writing any non-canonical output.
9. Reject repo-root placement unless a singular permanent top-level artifact is explicitly approved.
10. Flag missing docs, stale docs, unresolved documentation debt, or root-clutter risk.
11. Route outputs to the correct docs areas under `docs/` using the scoped issue-history pattern when non-canonical output is needed.

## Rules it enforces

- active documentation belongs under `docs/`, not at repo root
- frontend, backend, API, product, data-model, architecture, and operations docs are distinct domains
- business rules must not be collapsed into API-only documentation
- frontend docs must not be treated as secondary to backend or API docs
- historical reports belong in `docs/issues/...` or `docs/archive/...`
- temporary execution artifacts should use `docs/issues/<initiative>/<step>/<artifact-class>/` whenever the initiative and step can be identified
- `docs/issues/report-history/unscoped/` is a secondary fallback only when a valid scoped path cannot be derived confidently
- root-level reporting is limited to a singular explicitly approved permanent top-level artifact, not a rolling stack of phase/workstream artifacts

## Outputs it produces

- documentation impact map
- required docs target list
- primary versus secondary docs targets
- report/output placement decision
- exact artifact path when non-canonical output is required
- ADR-needed signal when applicable
- docs-update checklist
- stale-source or stale-doc-debt warnings
- missing-docs or unresolved-doc-debt warnings

## Failure modes and warnings

Emit warnings when:
- a change affects multiple docs domains but only one target is proposed
- business-rule changes are being routed only to backend or API docs
- frontend UX changes are not routed to `docs/frontend/`
- a non-canonical artifact is being written before its exact destination path is decided
- historical implementation artifacts are being routed back to the repo root
- `docs/issues/report-history/unscoped/` is being used even though a valid initiative/step path is available
- multiple temporary phase/workstream reports are being left in root instead of compacted or relocated
- archived or historical artifacts are being treated as current authoritative docs without revalidation
- documentation debt is being deferred without making the debt explicit
- an ADR-worthy structural change has no ADR evaluation

## Anti-patterns this workflow prevents

- dumping all documentation into one generic document
- treating docs as optional for non-trivial changes
- sending reports back to the root
- treating every phase checkpoint as a permanent root-level deliverable
- confusing product behavior docs with API contract docs
- leaving documentation debt implicit instead of naming it
