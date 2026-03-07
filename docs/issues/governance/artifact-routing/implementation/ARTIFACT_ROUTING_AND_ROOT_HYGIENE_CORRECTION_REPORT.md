# Artifact Routing and Root Hygiene Correction Report

## 1. Executive Summary

This pass implemented a focused correction for Lifeline's artifact-routing behavior.

It did five things:

- replaced generic non-root guidance with a scoped canonical routing pattern based on `docs/issues/<initiative>/<step>/<artifact-class>/`
- updated the documentation-governance stack so artifact destination is decided before non-canonical output is written
- added a repo-native prompt convention for future discovery, planning, implementation, validation, and cleanup prompts
- relocated the remaining root-level report artifacts into scoped non-root governance history paths
- verified that repo root now contains only intentional top-level project files

The result is that repo root is no longer treated as a normal report destination, scoped issue-history routing is now the default, and the generic fallback bucket is explicitly secondary only.

## 2. Canonical Artifact-Routing Standard

The canonical routing standard is now encoded in [docs/reference/REPORT_OUTPUT_POLICY.md](../../../../reference/REPORT_OUTPUT_POLICY.md).

Standard rules now enforced:

- discovery artifacts -> `docs/issues/<initiative>/<step>/discovery/`
- planning artifacts -> `docs/issues/<initiative>/<step>/planning/`
- workstream and implementation artifacts -> `docs/issues/<initiative>/<step>/implementation/`
- full-phase/final historical reports -> `docs/issues/<initiative>/<step>/final/`
- canonical docs -> final `docs/<domain>/...` locations
- repo root -> intentional top-level project files only
- root exception -> only a singular explicitly approved permanent top-level artifact
- fallback when a prompt asks for a report but does not provide a valid non-root path -> derive `initiative` and `step`; if that still cannot be done confidently, use `docs/issues/report-history/unscoped/`

Additional repo-native structure added in this pass:

- [docs/issues/governance/README.md](../../README.md)
- [docs/issues/report-history/unscoped/README.md](../../../report-history/unscoped/README.md)

## 3. Governance-Layer Changes Applied

Updated governance files:

- [.github/copilot-instructions.md](../../../../../.github/copilot-instructions.md)
- [.github/instructions/docs-governance.instructions.md](../../../../../.github/instructions/docs-governance.instructions.md)
- [.github/skills/documentation-governance.md](../../../../../.github/skills/documentation-governance.md)
- [.github/agents/documentation-governance-agent.md](../../../../../.github/agents/documentation-governance-agent.md)
- [.github/teams/documentation-governance-team.md](../../../../../.github/teams/documentation-governance-team.md)
- [.github/workflows-governance/documentation-governance-workflow.md](../../../../../.github/workflows-governance/documentation-governance-workflow.md)

Applied by layer:

### Instructions

- made scoped `docs/issues/<initiative>/<step>/<artifact-class>/` routing the always-on default rule
- required artifact class and destination to be decided before writing non-canonical output
- reduced `docs/issues/report-history/unscoped/` to a secondary fallback only
- restricted root to intentional project files and rare explicitly approved permanent top-level artifacts

### Skill

- encoded the new scoped routing pattern as policy knowledge
- clarified default artifact-class folders: `discovery/`, `planning/`, `implementation/`, and `final/`
- added exact-path decision-making to the practical checklist
- marked treating root as a normal report destination as an explicit anti-pattern

### Agent

- made exact artifact-path selection part of the agent responsibility
- required path-level placement decisions for non-canonical output
- clarified root placement as a separate explicit exception decision, not a default outcome

### Team

- assigned coordination responsibility for exact artifact-path decisions
- made the team responsible for preventing root placement drift across multi-surface work

### Workflow

- added an explicit step to decide the exact non-root destination before writing output
- added an explicit root-rejection step unless a singular permanent top-level artifact is approved
- added warnings when unscoped fallback is used despite an available scoped path

Supporting policy/template/index updates were also applied in:

- [docs/README.md](../../../../README.md)
- [docs/issues/README.md](../../../README.md)
- [docs/issues/report-history/README.md](../../../report-history/README.md)
- [docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md](../../../../reference/DOCUMENTATION_OWNERSHIP_MATRIX.md)
- [docs/reference/REPORT_OUTPUT_POLICY.md](../../../../reference/REPORT_OUTPUT_POLICY.md)
- [docs/templates/docs-update-checklist.md](../../../../templates/docs-update-checklist.md)
- [docs/templates/change-impact-matrix.md](../../../../templates/change-impact-matrix.md)

## 4. Prompt-Convention Changes Applied

Added a reusable repo-native prompt convention:

- [.github/prompts/artifact-routing-non-root.prompt.md](../../../../../.github/prompts/artifact-routing-non-root.prompt.md)

This prompt convention now standardizes the following instruction block for future work:

- do not create root-level report files
- canonical docs go directly to final `docs/<domain>/...` locations
- non-canonical artifacts go under `docs/issues/<initiative>/<step>/<artifact-class>/`
- use `discovery/`, `planning/`, `implementation/`, or `final/` as the default artifact-class folder
- decide the exact artifact path before writing output
- derive initiative/step from the work when a prompt does not provide a valid non-root target
- use `docs/issues/report-history/unscoped/` only when the work cannot be scoped confidently

## 5. Current-State Relocation and Cleanup Actions

Root-level report files found at the start of this pass:

- `GOVERNANCE_VALIDATION_DISCOVERY_AND_DESIGN_REPORT.md`
- `POST_PHASE6C_REPORT_HYGIENE_ENFORCEMENT_REPORT.md`

Relocation actions applied:

- `GOVERNANCE_VALIDATION_DISCOVERY_AND_DESIGN_REPORT.md` -> [docs/issues/governance/validation/discovery/GOVERNANCE_VALIDATION_DISCOVERY_AND_DESIGN_REPORT.md](../../validation/discovery/GOVERNANCE_VALIDATION_DISCOVERY_AND_DESIGN_REPORT.md)
- `POST_PHASE6C_REPORT_HYGIENE_ENFORCEMENT_REPORT.md` -> [docs/issues/governance/report-hygiene/implementation/POST_PHASE6C_REPORT_HYGIENE_ENFORCEMENT_REPORT.md](../../report-hygiene/implementation/POST_PHASE6C_REPORT_HYGIENE_ENFORCEMENT_REPORT.md)

Additional cleanup actions:

- created the scoped governance issue-history index at [docs/issues/governance/README.md](../../README.md)
- created the secondary fallback marker at [docs/issues/report-history/unscoped/README.md](../../../report-history/unscoped/README.md)
- updated the relocated governance-validation discovery/design report to acknowledge its non-root relocation
- added a historical note to the relocated post-Phase-6C enforcement report

Files intentionally left in repo root:

- [README.md](../../../../../README.md)
- [LICENSE](../../../../../LICENSE)
- top-level deployment/runtime/config files such as [compose.production.yaml](../../../../../compose.production.yaml), [compose.yaml](../../../../../compose.yaml), and [Dockerfile](../../../../../Dockerfile)

No root-level report artifacts were intentionally left behind.

## 6. Verification Findings

Verified in this pass:

- repo root no longer contains report artifacts
- governance instructions now explicitly route non-canonical output to scoped non-root issue-history paths
- the documentation-governance skill, agent, team, and workflow now encode exact-path decisions at the correct layer
- the fallback bucket is now explicitly secondary and unscoped only
- future prompts can use a stable repo-native convention without ambiguity
- the current governance-validation discovery/design artifact has been relocated out of root
- the earlier post-Phase-6C hygiene enforcement artifact has been relocated out of root

Current root state is compliant with the corrected policy.

## 7. Notes / Risks

- Historical reports remain preserved as historical snapshots. Some older retained artifacts may still contain then-current wording, but active routing policy now lives in the updated governance stack and [docs/reference/REPORT_OUTPUT_POLICY.md](../../../../reference/REPORT_OUTPUT_POLICY.md).
- Prompt discipline still depends on future execution following the stored prompt convention and updated always-on instructions, but the repo-native defaults are now explicit and aligned.
- The generic fallback bucket still exists by design, but it is now clearly secondary and isolated under `docs/issues/report-history/unscoped/`.

## 8. Completion Status

Complete.

This pass:

- defined the canonical scoped artifact-routing standard
- enforced it across the documentation-governance stack
- added a reusable prompt convention for future work
- relocated the remaining root-level report artifacts into scoped non-root history paths
- verified that root is clean and policy-compliant now
