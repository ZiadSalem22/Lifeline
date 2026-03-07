# Lifeline Teams

This directory stores repo-native teams that sit above skills and agents in the Lifeline AI system.

## Build order

1. skills
2. agents
3. teams
4. workflows

## Current governance teams

### Foundation
- [documentation-governance-team.md](documentation-governance-team.md)
- [cicd-governance-team.md](cicd-governance-team.md)
- [code-quality-governance-team.md](code-quality-governance-team.md)

### Domain
- [frontend-engineering-governance-team.md](frontend-engineering-governance-team.md)
- [backend-engineering-governance-team.md](backend-engineering-governance-team.md)
- [data-model-governance-team.md](data-model-governance-team.md)

### Cross-cutting
- [refactor-governance-team.md](refactor-governance-team.md)

## Team intent

- Skills provide rule-level knowledge.
- Agents provide role-level analysis (builder agents guide, review agents assess).
- Teams coordinate grouped governance responsibilities across builder and review agents.
- Workflows define the repeatable execution path and expected outputs above teams.

These teams are governance teams, not execution workflows.

The workflows layer exists under `.github/workflows-governance/` and sits above this team layer.
