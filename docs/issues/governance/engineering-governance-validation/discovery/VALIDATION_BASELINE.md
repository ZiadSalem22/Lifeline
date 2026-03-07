# Engineering Governance Validation Baseline

**Baseline commit**: `cfa3b324` — "governance: external skill adoption pass across all 5 families"
**Branch**: main (HEAD, origin/main)
**Working tree state**: Clean (no staged/unstaged changes)
**Date locked**: This document

---

## Purpose

Lock the exact set of governance artifacts being validated and define per-family what "validated" means.

---

## Authoritative files (35 total — 7 per family × 5 families)

### Code Quality Family

| Layer | File | Lines |
|-------|------|-------|
| Instruction | `.github/instructions/code-quality-governance.instructions.md` | 116 |
| Skill | `.github/skills/code-quality-governance.md` | ~180 |
| Builder Agent | `.github/agents/code-quality-builder-agent.md` | ~100 |
| Review Agent | `.github/agents/code-quality-review-agent.md` | 166 |
| Team | `.github/teams/code-quality-governance-team.md` | ~60 |
| Workflow | `.github/workflows-governance/code-quality-governance-workflow.md` | ~120 |
| Prompt | `.github/prompts/code-quality-review.prompt.md` | ~100 |

**Key capabilities to validate**:
- 6-dimension review (Correctness, Security, Performance, Reliability, Readability, Testing)
- Severity taxonomy (CRITICAL/HIGH/MEDIUM/LOW) with consistent meaning
- Lint/format gate enforcement
- Dead code discipline
- Conformance check against sibling files
- Cross-cutting analysis for multi-file changes
- Structured findings format
- Review verdict system (Approve / Request changes / Needs discussion)

### Frontend Family

| Layer | File | Lines |
|-------|------|-------|
| Instruction | `.github/instructions/frontend-engineering-governance.instructions.md` | ~180 |
| Skill | `.github/skills/frontend-engineering-governance.md` | 180 |
| Builder Agent | `.github/agents/frontend-builder-agent.md` | 128 |
| Review Agent | `.github/agents/frontend-review-agent.md` | ~160 |
| Team | `.github/teams/frontend-engineering-governance-team.md` | ~60 |
| Workflow | `.github/workflows-governance/frontend-engineering-governance-workflow.md` | ~130 |
| Prompt | `.github/prompts/frontend-review.prompt.md` | ~120 |

**Key capabilities to validate**:
- Accessibility grading (Grade C = WCAG A, Grade B = WCAG AA)
- Performance priority rules
- UX quality pillars (Frictionless / Craft / Trustworthy)
- UX key metrics
- UI pattern selection guidance
- Component boundary and state ownership
- Loading/empty/error state completeness
- Severity taxonomy with frontend-specific meanings

### Backend Family

| Layer | File | Lines |
|-------|------|-------|
| Instruction | `.github/instructions/backend-engineering-governance.instructions.md` | ~170 |
| Skill | `.github/skills/backend-engineering-governance.md` | ~180 |
| Builder Agent | `.github/agents/backend-builder-agent.md` | ~110 |
| Review Agent | `.github/agents/backend-review-agent.md` | 153 |
| Team | `.github/teams/backend-engineering-governance-team.md` | ~60 |
| Workflow | `.github/workflows-governance/backend-engineering-governance-workflow.md` | ~130 |
| Prompt | `.github/prompts/backend-review.prompt.md` | ~120 |

**Key capabilities to validate**:
- Dependency direction enforcement (routes → controllers → application → domain ← infrastructure)
- Security discipline (6 rules)
- Performance discipline (5 rules)
- Reliability discipline (5 rules)
- Controller thinness
- Repository encapsulation
- Validation placement rules
- Auth and user scoping checks
- Contract compliance

### Data Model Family

| Layer | File | Lines |
|-------|------|-------|
| Instruction | `.github/instructions/data-model-governance.instructions.md` | 154 |
| Skill | `.github/skills/data-model-governance.md` | ~180 |
| Builder Agent | `.github/agents/data-model-builder-agent.md` | ~110 |
| Review Agent | `.github/agents/data-model-review-agent.md` | ~160 |
| Team | `.github/teams/data-model-governance-team.md` | ~60 |
| Workflow | `.github/workflows-governance/data-model-governance-workflow.md` | ~130 |
| Prompt | `.github/prompts/schema-change-review.prompt.md` | ~130 |

**Key capabilities to validate**:
- Zero-downtime 5-phase migration pattern (add → dual-write → backfill → read-from-new → remove)
- Rollback strategy requirements
- Column operation safety rules table
- 6 common migration pitfalls catalog
- JSONB shape discipline
- Entity ownership chain enforcement
- Single source of truth (EntitySchema definitions)
- Migration idempotency requirement

### Refactor Family

| Layer | File | Lines |
|-------|------|-------|
| Instruction | `.github/instructions/refactor-governance.instructions.md` | 178 |
| Skill | `.github/skills/refactor-governance.md` | ~180 |
| Builder Agent | `.github/agents/refactor-builder-agent.md` | ~110 |
| Review Agent | `.github/agents/refactor-review-agent.md` | ~160 |
| Team | `.github/teams/refactor-governance-team.md` | ~60 |
| Workflow | `.github/workflows-governance/refactor-governance-workflow.md` | ~130 |
| Prompt | `.github/prompts/refactor-review.prompt.md` | ~130 |

**Key capabilities to validate**:
- Safe refactoring loop (test → refactor → test → commit)
- Refactoring types (preparatory / comprehension / litter-pickup)
- Rule of Three
- Named refactoring catalog (8 transformations)
- Smell families with mapping
- Dead code cleanup discipline
- Branch by Abstraction for large changes
- React-specific refactoring guidance
- Scope control and justification requirements

---

## Universal features across all 5 families

These must be validated in every family:

| Feature | Expected behavior |
|---------|-------------------|
| Severity taxonomy | CRITICAL / HIGH / MEDIUM / LOW with family-specific meanings |
| Structured findings | File / Severity / Category / Why / Recommendation |
| Review verdict | Approve / Request changes / Needs discussion |
| Conformance check | Read sibling files before building/reviewing |
| Cross-cutting analysis | Consistency check for multi-file changes |
| 15-item practical checklist | Quick-reference checklist in skill file |
| Inheritance chain | Each family references parent governance files |

---

## What "validated" means

A family is considered **validated** when:

1. **Scenario coverage**: The family correctly handles ≥80% of realistic scenarios in its domain (good code receives approval, bad code receives findings with correct severity).
2. **Layer coherence**: All 7 layers within the family teach the same rules and don't contradict each other.
3. **Negative resilience**: The family correctly rejects or flags adversarial inputs (scope-creeping "refactors", unsafe migrations disguised as minor changes, etc.).
4. **Real-code applicability**: The family produces useful, actionable guidance when applied to actual Lifeline code — not just hypothetical scenarios.
5. **Cross-family consistency**: The family's severity taxonomy, findings format, and verdict system are compatible with all other families.
6. **No orphan rules**: Every rule in the instruction/skill is referenced or exercised by at least one agent, workflow, or prompt.
7. **No contradictions**: No rule in one layer contradicts a rule in another layer of the same family.
