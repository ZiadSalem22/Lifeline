# Engineering Agents

Lifeline's engineering agents build on repo-native skills and sit one layer above them in the planned system.

## Phase order

1. skills
2. agents
3. teams
4. workflows

## Current governance agents

### Documentation & CI/CD
- [documentation-governance-agent](../../.github/agents/documentation-governance-agent.md)
- [cicd-governance-agent](../../.github/agents/cicd-governance-agent.md)

### Code quality (builder + reviewer)
- [code-quality-builder-agent](../../.github/agents/code-quality-builder-agent.md)
- [code-quality-review-agent](../../.github/agents/code-quality-review-agent.md)

### Frontend engineering (builder + reviewer)
- [frontend-builder-agent](../../.github/agents/frontend-builder-agent.md)
- [frontend-review-agent](../../.github/agents/frontend-review-agent.md)

### Backend engineering (builder + reviewer)
- [backend-builder-agent](../../.github/agents/backend-builder-agent.md)
- [backend-review-agent](../../.github/agents/backend-review-agent.md)

### Data model (builder + reviewer)
- [data-model-builder-agent](../../.github/agents/data-model-builder-agent.md)
- [data-model-review-agent](../../.github/agents/data-model-review-agent.md)

### Refactor (builder + reviewer)
- [refactor-builder-agent](../../.github/agents/refactor-builder-agent.md)
- [refactor-review-agent](../../.github/agents/refactor-review-agent.md)

## Agent intent

- agents use repo-native skills as core dependencies
- agents produce scoped governance decisions and structured outputs
- governance agents are not the same as delivery workflows
- teams now build on these agent-level rules, and workflows now build on top of both
