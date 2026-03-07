# Lifeline Custom Skills

This directory stores repo-native engineering skills that encode stable governance and operational rules for Lifeline.

Current implementation order:
1. skills
2. agents
3. teams
4. workflows

Current skills:
- [documentation-governance.md](documentation-governance.md)
- [cicd-governance.md](cicd-governance.md)
- [code-quality-governance.md](code-quality-governance.md)
- [frontend-engineering-governance.md](frontend-engineering-governance.md)
- [backend-engineering-governance.md](backend-engineering-governance.md)
- [data-model-governance.md](data-model-governance.md)
- [refactor-governance.md](refactor-governance.md)

## Skill families

### Foundation
- **documentation-governance** — docs routing, domain separation, artifact placement
- **cicd-governance** — deploy-branch model, VPS delivery, smoke checks
- **code-quality-governance** — readability, naming, duplication, complexity, maintainability

### Domain
- **frontend-engineering-governance** — React components, state, UI/UX, accessibility, responsive
- **backend-engineering-governance** — layering, services, repositories, validation, error handling, auth
- **data-model-governance** — entities, migrations, relations, ownership, JSONB, schema evolution

### Cross-cutting
- **refactor-governance** — behavior preservation, safe decomposition, scope control, incremental changes

These skills are intentionally narrower than agents.

- Skills encode repo-specific judgment, safeguards, routing rules, and review heuristics.
- Agents execute domain workflows using those skills plus the instruction/prompt system.
- Teams coordinate grouped responsibilities above the agent layer.
- Workflows orchestrate repeatable governance sequences above the team layer.
