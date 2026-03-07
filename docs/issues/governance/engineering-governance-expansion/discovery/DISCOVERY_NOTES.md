# Engineering Governance Expansion — Discovery Notes

## Date
2026-03-06

## Existing governance families
- **documentation-governance**: skill, agent, team, workflow, instructions — validated
- **cicd-governance**: skill, agent, team, workflow — validated

## Existing governance system layers (build order)
1. Instructions (`.github/instructions/`)
2. Skills (`.github/skills/`)
3. Agents (`.github/agents/`)
4. Teams (`.github/teams/`)
5. Workflows (`.github/workflows-governance/`)
6. Prompts (`.github/prompts/`)
7. Reference docs (`docs/reference/`)
8. Templates (`docs/templates/`)

## Codebase pain points discovered

### Frontend
- `client/src/components/` has a loose `ProfilePanel.jsx` alongside organized subdirectories
- `context/` has one file (`LoadingContext.jsx`), `providers/` has five — unclear separation
- No TypeScript anywhere on frontend
- Pages are `.jsx` + `.module.css` pairs — needs consistent pattern enforcement
- No clear component boundary rules (when to extract, when to keep inline)

### Backend
- Two infrastructure directories: `infra/` (data-source + entities) and `infrastructure/` (repositories) — confusing split
- Domain layer is thin: only 4 files, missing domain objects for UserProfile, UserSettings, TodoTag
- Controllers exist only for todo and tag — other routes likely have inline logic
- All plain JS — no TypeScript
- Single `validators/index.js` — validation not co-located or domain-aligned

### Data model
- Two parallel migration systems: raw SQL (`backend/migrations/`) and TypeORM JS (`backend/src/migrations/`)
- EntitySchema files use `new EntitySchema({})` pattern, not class-based decorators
- 6 entities: Tag, Todo, TodoTag, User, UserProfile, UserSettings
- Gap in SQL migration numbering (no `003`)

### Code quality
- No TypeScript, no type safety
- Inconsistent file organization patterns
- No clear separation of concerns enforcement
- No documented complexity or duplication thresholds

### Refactor needs
- `infra/` vs `infrastructure/` split needs resolution
- Thin domain layer needs enrichment
- Inline route logic needs extraction to controllers/services
- Migration system duality needs governance
- Frontend context/provider split needs rationalization

## Five new governance families to implement
1. **code-quality-governance** — foundational quality standards
2. **frontend-engineering-governance** — React/UI/UX discipline
3. **backend-engineering-governance** — backend layering/modularity
4. **data-model-governance** — schema/migration/persistence integrity
5. **refactor-governance** — safe codebase improvement discipline

## Integration points with existing families
- All five → documentation-governance (doc impact analysis)
- Backend + data-model + refactor → cicd-governance (when changes affect deployment)
- Code quality → baseline referenced by all four domain families
- Refactor → references all four domain families plus code quality
