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
- do not leave discovery notes, plans, implementation summaries, validation reports, or progress summaries in root by default
- do not treat repo root as the fallback destination when a prompt asks for a report

## Canonical routing pattern

Use this preferred issue-history pattern for non-canonical artifacts:

- `docs/issues/<initiative>/<step>/discovery/`
- `docs/issues/<initiative>/<step>/planning/`
- `docs/issues/<initiative>/<step>/implementation/`
- `docs/issues/<initiative>/<step>/results/`
- `docs/issues/<initiative>/<step>/final/`

Canonical long-term docs do not use the issue-history pattern. They should go directly to their final `docs/<domain>/...` location.

## Root allowlist rule

Repo root should contain intentional top-level project files such as:

- project readmes and licensing files
- top-level configuration files
- root runtime and deployment manifests
- other durable project entrypoint files that belong at top level

Reports, phase notes, plans, workstream summaries, validation outputs, and similar execution artifacts do not belong there by default.

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

- it is explicitly approved as a permanent top-level artifact
- it is singular for that pass or deliverable
- it is intentionally retained as a current top-level handoff artifact
- leaving it at root is more useful than routing it into `docs/issues/...`

If those conditions are not met, the final report should also live under `docs/issues/...`.

## Preferred storage pattern

### Primary scoped location

When the initiative and step can be identified, route non-canonical artifacts to:

- `docs/issues/<initiative>/<step>/discovery/`
- `docs/issues/<initiative>/<step>/planning/`
- `docs/issues/<initiative>/<step>/implementation/`
- `docs/issues/<initiative>/<step>/results/`
- `docs/issues/<initiative>/<step>/final/`

Examples:

- `docs/issues/governance/artifact-routing/implementation/`
- `docs/issues/governance/validation/discovery/`
- `docs/issues/deployment-prep/phase-35/planning/`

### Secondary fallback location

Use [docs/issues/report-history/unscoped](../issues/report-history/unscoped) only when a prompt requests a report or execution artifact but does not provide a valid non-root path and the initiative/step cannot be derived confidently.

This includes:

- unscoped discovery reports
- unscoped implementation plans
- unscoped workstream implementation reports
- unscoped temporary checkpoint outputs
- unscoped older final reports that no longer need to remain at root

### More specific issue-history location

When a narrower issue or initiative folder already exists or can be derived confidently, use that scoped path instead of the fallback folder.

Examples:

- `docs/issues/deployment-prep/...`
- `docs/issues/repo-hygiene/...`
- another clearly scoped issue-history folder

### Archive boundary

Use `docs/archive/...` for superseded long-term documentation, not as the default home for execution reporting.

Execution artifacts should normally move to `docs/issues/...` rather than `docs/archive/...`.

## Phase-close behavior

When a phase or implementation pass completes, do one of these:

1. compact temporary reporting into one final summary under a scoped `docs/issues/<initiative>/<step>/final/` path when that is actually useful, or
2. move the temporary reporting set into a scoped `docs/issues/<initiative>/<step>/...` path

Do not leave a stack of phase/workstream reports at root after the pass closes.

## Root-level exception rule

Root-level reports are an exception, not a default.

Allowed root-level reporting is limited to:

- one explicitly approved permanent top-level artifact
- one intentionally retained current top-level deliverable

Even then, the report should be reevaluated later and moved into `docs/issues/...` once it is no longer the active handoff artifact.

## Practical routing guide

| Artifact type | Default location |
| --- | --- |
| discovery report | `docs/issues/<initiative>/<step>/discovery/` |
| implementation plan | `docs/issues/<initiative>/<step>/planning/` |
| workstream report | `docs/issues/<initiative>/<step>/implementation/` |
| checkpoint/progress summary | `docs/issues/<initiative>/<step>/implementation/` |
| validation/test result set | `docs/issues/<initiative>/<step>/results/` |
| final historical phase report | `docs/issues/<initiative>/<step>/final/` |
| canonical long-term doc | `docs/<domain>/...` |
| superseded long-term doc | `docs/archive/` |
| unscoped fallback artifact | `docs/issues/report-history/unscoped/` |
| singular permanent top-level artifact | repo root only when explicitly approved; otherwise scoped `docs/issues/<initiative>/<step>/final/` |

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
- [../issues/governance/README.md](../issues/governance/README.md)
- [DOCUMENTATION_OWNERSHIP_MATRIX.md](DOCUMENTATION_OWNERSHIP_MATRIX.md)
- [../templates/docs-update-checklist.md](../templates/docs-update-checklist.md)
