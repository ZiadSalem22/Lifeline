# Lifeline Governance Workflows

This directory stores repo-native governance workflows that sit above skills, agents, and teams.

## Build order

1. skills
2. agents
3. teams
4. workflows

## Current governance workflows

### Foundation
- [documentation-governance-workflow.md](documentation-governance-workflow.md)
- [cicd-governance-workflow.md](cicd-governance-workflow.md)
- [code-quality-governance-workflow.md](code-quality-governance-workflow.md)

### Domain
- [frontend-engineering-governance-workflow.md](frontend-engineering-governance-workflow.md)
- [backend-engineering-governance-workflow.md](backend-engineering-governance-workflow.md)
- [data-model-governance-workflow.md](data-model-governance-workflow.md)

### Cross-cutting
- [refactor-governance-workflow.md](refactor-governance-workflow.md)

## Workflow intent

- Skills provide rule-level knowledge.
- Agents provide role-level analysis (builder agents guide, review agents assess).
- Teams coordinate grouped governance responsibilities.
- Workflows define the repeatable execution path and expected outputs.

These governance workflows are system workflows, not deployment executables.

## Workflow patterns

Each engineering governance workflow (code-quality, frontend, backend, data-model, refactor) includes:
- **Pre-implementation** phase using the builder agent for guidance
- **Post-implementation** phase using the review agent for assessment
- **Cross-family trigger** detection for documentation, CI/CD, and ADR impacts
