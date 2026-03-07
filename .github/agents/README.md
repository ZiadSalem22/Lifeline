# Lifeline Agents

This directory stores repo-native agents that build on Lifeline's skills, instructions, prompts, and templates.

## Build order

1. skills
2. agents
3. teams
4. workflows

## Governance agents

### Documentation & CI/CD
- [documentation-governance-agent.md](documentation-governance-agent.md)
- [cicd-governance-agent.md](cicd-governance-agent.md)

### Code quality (builder + reviewer)
- [code-quality-builder-agent.md](code-quality-builder-agent.md)
- [code-quality-review-agent.md](code-quality-review-agent.md)

### Frontend engineering (builder + reviewer)
- [frontend-builder-agent.md](frontend-builder-agent.md)
- [frontend-review-agent.md](frontend-review-agent.md)

### Backend engineering (builder + reviewer)
- [backend-builder-agent.md](backend-builder-agent.md)
- [backend-review-agent.md](backend-review-agent.md)

### Data model (builder + reviewer)
- [data-model-builder-agent.md](data-model-builder-agent.md)
- [data-model-review-agent.md](data-model-review-agent.md)

### Refactor (builder + reviewer)
- [refactor-builder-agent.md](refactor-builder-agent.md)
- [refactor-review-agent.md](refactor-review-agent.md)

## Agent patterns

- **Governance agents** (documentation, CI/CD) make routing, risk, and update decisions.
- **Builder agents** guide implementation approach, decomposition, and structure before and during work.
- **Review agents** assess completed work quality, compliance, and genuine improvement.

All agents depend on repo-native skills and integrate with the instruction/prompt system.

Teams come after agents and coordinate grouped responsibilities above the agent layer.
Workflows come after teams and define repeatable governance sequences above both layers.

## Existing domain agent scaffolding

Other agent files in this directory (api-docs-agent, frontend-docs-agent, etc.) remain as domain documentation scaffolding from the earlier system setup.
