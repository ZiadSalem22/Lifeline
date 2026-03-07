# Engineering Governance Expansion — Family Design Baseline

## Date
2026-03-06

## Naming conventions

| Layer | Pattern | Example |
|-------|---------|---------|
| Instructions | `.github/instructions/<family>.instructions.md` | `code-quality-governance.instructions.md` |
| Skill | `.github/skills/<family>.md` | `code-quality-governance.md` |
| Builder agent | `.github/agents/<domain>-builder-agent.md` | `code-quality-builder-agent.md` |
| Review agent | `.github/agents/<domain>-review-agent.md` | `code-quality-review-agent.md` |
| Team | `.github/teams/<family>-team.md` | `code-quality-governance-team.md` |
| Workflow | `.github/workflows-governance/<family>-workflow.md` | `code-quality-governance-workflow.md` |

## Family names and domain prefixes

| # | Family name | Agent domain prefix |
|---|------------|-------------------|
| 1 | `code-quality-governance` | `code-quality` |
| 2 | `frontend-engineering-governance` | `frontend` |
| 3 | `backend-engineering-governance` | `backend` |
| 4 | `data-model-governance` | `data-model` |
| 5 | `refactor-governance` | `refactor` |

## Builder agent output pattern
- Implementation guidance and approach recommendations
- Decomposition/structure recommendations
- Quality/safety checklists for the domain
- Warnings about common anti-patterns
- Trigger signals for related governance families

## Review agent output pattern
- Quality/compliance assessment against family rules
- Specific findings with severity (blocker, warning, note)
- Approval/conditional-approval/rejection signal
- Doc-impact and cross-family trigger signals
- Actionable improvement recommendations

## Cross-family integration design

### Documentation governance triggers
All five families emit doc-impact signals that feed into the existing documentation-governance workflow.

### CI/CD governance triggers
Backend, data-model, and refactor families emit CI/CD-impact signals when changes affect deployment surfaces.

### Family hierarchy
- **code-quality-governance** is the foundational baseline — all other families inherit its general rules
- **frontend-engineering-governance** adds React/UI/UX-specific rules on top of code quality
- **backend-engineering-governance** adds backend layering rules on top of code quality
- **data-model-governance** adds schema/migration rules, references backend governance for persistence
- **refactor-governance** references all four domain families plus code quality as safety constraints

### ADR escalation
All five families include ADR escalation signals for durable structural changes.

## Supporting prompts to create
- `code-quality-review.prompt.md` — trigger code quality review
- `frontend-review.prompt.md` — trigger frontend engineering review
- `backend-review.prompt.md` — trigger backend engineering review
- `schema-change-review.prompt.md` — trigger data model review
- `refactor-review.prompt.md` — trigger refactor safety review

## Files to create per family (minimum)

Per family (5 families × 6 core files = 30 core files):
1. Instructions file
2. Skill file
3. Builder agent file
4. Review agent file
5. Team file
6. Workflow file

Plus supporting:
- 5 prompt files (one per family)
- Updated READMEs for skills, agents, teams, workflows directories
- Updated reference indexes

**Total estimated: ~39 files**
