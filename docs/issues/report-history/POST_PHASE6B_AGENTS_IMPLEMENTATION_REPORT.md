# Post-Phase-6B Agents Implementation Report

## 1. Executive Summary

This implementation pass added the first two repo-native governance agents for Lifeline:

- `documentation-governance-agent`
- `cicd-governance-agent`

Both agents were implemented as repo-specific governance layers on top of the already-created skills, instruction files, prompts, templates, and operations references.

## 2. Agents Added

Added under `.github/agents/`:

- `.github/agents/documentation-governance-agent.md`
- `.github/agents/cicd-governance-agent.md`
- `.github/agents/README.md`

Also removed the older overlapping stub:

- `.github/agents/docs-governance-agent.md`

This prevents duplication and makes the governance-agent naming consistent with the repo-native skill names.

## 3. Documentation-Governance Agent Design

The `documentation-governance-agent` is built on the `documentation-governance` skill.

It is responsible for:
- deciding whether a change is documentation-relevant
- mapping changes to the correct docs domains
- detecting when multiple docs domains must be updated together
- distinguishing product, feature, frontend, backend, API, data-model, architecture, and operations docs
- deciding when an ADR is warranted
- preventing root report clutter and generic catch-all docs

It produces outputs such as:
- documentation impact maps
- recommended docs targets
- missing-docs warnings
- ADR-needed signals
- update-checklist suggestions

## 4. CI/CD-Governance Agent Design

The `cicd-governance-agent` is built on the `cicd-governance` skill.

It is responsible for:
- protecting the `main` / `deploy` branch production model
- protecting GitHub Actions as the active deployment path
- guarding the `/opt/lifeline/releases` + `/opt/lifeline/current` release model
- guarding the VPS runtime-secret model
- guarding the private app bind on `127.0.0.1:3020`
- guarding the Nginx proxy shape and smoke checks
- identifying when deployment changes also require operations docs, architecture docs, or ADR updates

It produces outputs such as:
- CI/CD change-risk assessments
- deployment-doc update requirements
- smoke-check preservation checklists
- secret-boundary warnings
- deployment-model drift warnings

## 5. Files Added or Updated

Added:
- `.github/agents/documentation-governance-agent.md`
- `.github/agents/cicd-governance-agent.md`
- `.github/agents/README.md`
- `docs/reference/ENGINEERING_AGENTS.md`
- `POST_PHASE6B_AGENTS_IMPLEMENTATION_REPORT.md`

Updated:
- `docs/reference/README.md`
  - now links the engineering agents index

Deleted:
- `.github/agents/docs-governance-agent.md`

## 6. How These Agents Fit the System

These agents are the second deliberate layer in the current system plan:

1. skills
2. agents
3. teams
4. workflows

They build directly on the governance skills rather than introducing a separate rule system.

They are governance agents, not delivery workflows:
- they assess impact
- they route updates
- they flag risks
- they produce structured governance outputs

Teams and workflows should later build on these governance agents rather than bypass them.

## 7. Notes / Risks

- This pass intentionally adds only the two governance agents.
- The wider agent set remains outside this pass.
- The agents depend on the existing skill and instruction system being kept current.
- CI/CD governance still depends on keeping `docs/operations/` aligned when deployment behavior changes.

## 8. Completion Status

Completed.

The first two governance agents are now in place, and the repo is ready for the next step: teams.