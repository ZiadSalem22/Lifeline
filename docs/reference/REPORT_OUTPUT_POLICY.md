# Report and Output Policy

## Purpose

This policy defines where Lifeline execution reports, checkpoint outputs, plans, and final handoff summaries belong.

It exists to keep the repository root clean, prevent report sprawl, and ensure temporary execution artifacts are treated as historical working material rather than permanent top-level deliverables.

## Core rule

The repository root is not a report drop-zone.

Default behavior:

- do not create root-level phase reports
- do not create root-level workstream reports
- do not create root-level checkpoint outputs
- do not leave discovery notes, plans, or progress summaries in root by default

## Artifact classes

### Temporary reports and execution artifacts

Treat these as temporary or historical by default:

- discovery reports
- implementation plans
- workstream reports
- checkpoint summaries
- progress updates
- execution logs captured as markdown
- intermediate implementation summaries created to support a pass rather than act as a durable top-level deliverable

These artifacts belong under `docs/issues/...`, not at root.

### Final reports

A final report is a compacted end-of-pass or end-of-phase summary intended to communicate final outcome rather than preserve every intermediate checkpoint.

A final report may be retained at root only when all of the following are true:

- it is explicitly required
- it is singular for that pass or deliverable
- it is intentionally retained as a current top-level handoff artifact
- leaving it at root is more useful than routing it into `docs/issues/...`

If those conditions are not met, the final report should also live under `docs/issues/...`.

## Preferred storage pattern

### Default fallback location

Use [docs/issues/report-history](../issues/report-history) as the default fallback home for historical execution reporting.

This includes:

- phase discovery reports
- implementation plans
- workstream implementation reports
- temporary checkpoint outputs
- older final reports that no longer need to remain at root

### More specific issue-history location

When a narrower issue or initiative folder already exists and clearly owns the material, use that path instead of the fallback folder.

Examples:

- `docs/issues/deployment-prep/...`
- `docs/issues/repo-hygiene/...`
- another clearly scoped issue-history folder

### Archive boundary

Use `docs/archive/...` for superseded long-term documentation, not as the default home for execution reporting.

Execution artifacts should normally move to `docs/issues/...` rather than `docs/archive/...`.

## Phase-close behavior

When a phase or implementation pass completes, do one of these:

1. compact temporary reporting into one final summary when that is actually useful, or
2. move the temporary reporting set into `docs/issues/...`

Do not leave a stack of phase/workstream reports at root after the pass closes.

## Root-level exception rule

Root-level reports are an exception, not a default.

Allowed root-level reporting is limited to:

- one explicitly requested final handoff report
- one intentionally retained current top-level deliverable

Even then, the report should be reevaluated later and moved into `docs/issues/...` once it is no longer the active handoff artifact.

## Practical routing guide

| Artifact type | Default location |
| --- | --- |
| discovery report | `docs/issues/report-history/` |
| implementation plan | `docs/issues/report-history/` |
| workstream report | `docs/issues/report-history/` |
| checkpoint/progress summary | `docs/issues/report-history/` |
| superseded long-term doc | `docs/archive/` |
| singular explicitly required final handoff report | repo root only when justified; otherwise `docs/issues/report-history/` |

## Enforcement expectations

The governance stack should enforce this policy through:

- repo-wide instructions
- docs-governance instructions
- documentation-governance skill
- documentation-governance agent
- documentation-governance team
- documentation-governance workflow
- supporting templates and reference docs

## Related documents

- [../README.md](../README.md)
- [../issues/README.md](../issues/README.md)
- [DOCUMENTATION_OWNERSHIP_MATRIX.md](DOCUMENTATION_OWNERSHIP_MATRIX.md)
- [../templates/docs-update-checklist.md](../templates/docs-update-checklist.md)
