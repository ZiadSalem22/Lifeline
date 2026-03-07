# External Skill Adoption Map

**Initiative**: engineering-governance-skill-adoption  
**Step**: discovery  
**Date**: 2026-03-06

---

## Audit summary

All 35 governance files across 5 families were inspected. Files range from 26–107 lines.  
Skills and instructions are the strongest artifact classes; prompts and teams are the weakest.

---

## 1. Code Quality Governance — Adoption Map

### Source set inspected
| Source | Key patterns extracted |
|--------|----------------------|
| **TerminalSkills/code-reviewer** | 6-category review checklist (Correctness→Security→Performance→Reliability→Readability→Testing), severity levels (CRITICAL/HIGH/MEDIUM/LOW), structured output format with file/line/issue/suggestion, summary with verdict (approve/request-changes), 30-line function smell threshold |
| **timi-ty/code-review** | 8-phase PR workflow (context→patterns→file-by-file→cross-cutting→report→verdict→confirm→apply), conformance checking against existing codebase patterns, dead-code focus, cross-cutting analysis for multi-file changes, parallel subagent exploration for large PRs |
| **lint-and-validate** | Mandatory quality loop (write→lint→analyze→fix→repeat), ecosystem-specific commands (ESLint, tsc), strict no-commit-without-passing rule, error handling for missing config |

### Current strengths (keep)
- Lifeline-specific thresholds (~300 lines/file, ~50 lines/function, 3-level nesting, 4 params)
- Anti-pattern recognition with Lifeline-specific examples
- Practical 10-item checklist in skill
- Behavior-preserving discipline
- Cross-family integration map

### Gaps to fill
- **Severity-based review output**: No CRITICAL/HIGH/MEDIUM/LOW severity system — just flat findings
- **Review categories missing**: No security, performance, reliability, or testing review dimensions
- **Lint/format gate**: No mandatory lint/check discipline before declaring work complete
- **Large-change handling**: No special guidance for multi-file or >500-line changes
- **Dead code**: Not explicitly called out as a review dimension
- **Cross-cutting analysis**: No explicit step for checking multi-file consistency
- **Conformance checking**: No guidance to study existing patterns before reviewing

### Adoption plan
- Add severity taxonomy (CRITICAL/HIGH/MEDIUM/LOW) to review agent and skill
- Add security, performance, reliability, testing as review categories in review agent
- Add lint/format/check gate to instructions, workflow, and builder agent
- Add large-change handling guidance to review agent and workflow
- Add dead-code detection to review agent criteria
- Add cross-cutting analysis step to workflow
- Strengthen prompt with severity output and Lifeline-specific steps

---

## 2. Frontend Engineering Governance — Adoption Map

### Source set inspected
| Source | Key patterns extracted |
|--------|----------------------|
| **microsoft/frontend-design-review** | Three quality pillars (Frictionless Insight-to-Action, Quality Craft, Trustworthy Building), design system workflow (before→during→review), review severity (blocking/major/minor), accessibility grading (Grade C = WCAG A, Grade B = WCAG AA), creative vs review modes |
| **vercel-react-best-practices** | 58 rules in 8 priority categories (Waterfalls→Bundle→Server→Client→Re-render→Rendering→JS→Advanced), specific anti-patterns (barrel imports, missing Suspense boundaries, mutable default props), performance-first prioritization |
| **szilu/ux-designer** | UX hierarchy of needs (Functional→Reliable→Usable→Convenient→Pleasurable), decision trees (modal vs panel vs full page, notification type), comprehensive checklists (before designing, visual, interaction, forms, navigation, accessibility), key metrics/numbers, anti-pattern catalog with 23 items |

### Current strengths (keep)
- Component boundary rules with Lifeline-specific directory map
- State ownership rules
- Provider/context discipline with `context/` → `providers/` migration guidance
- Hook discipline
- Loading/empty/error state requirements
- Performance awareness rules
- Known structural debt inventory

### Gaps to fill
- **UX quality pillars**: No systematic pillar-based quality evaluation
- **Review severity**: No blocking/major/minor finding classification
- **UX decision trees**: No guidance on choosing UI patterns (modal vs panel vs page)
- **UX checklists**: Checklist is code-focused but lacks UX-specific items (visual hierarchy, interaction feedback timings, touch targets)
- **Accessibility grading**: No formal WCAG grade system
- **Performance rules**: Generic awareness but no priority-ordered rule categories like Vercel's
- **UX metrics**: No key numbers (touch targets, animation durations, contrast ratios, line lengths)
- **UX anti-patterns**: Current anti-patterns are code-structural — missing UX-behavioral anti-patterns

### Adoption plan
- Add UX quality pillars (Frictionless, Craft, Trustworthy) to instructions
- Add blocking/major/minor severity to review agent
- Add UI pattern decision guidance to builder agent
- Strengthen accessibility section with WCAG grade system and specific numbers
- Add React-specific performance rules (waterfall elimination, barrel import avoidance, memoization guidance)
- Add UX key metrics to skill and instructions
- Add UX decision trees to builder agent
- Strengthen prompt with UX-specific review steps

---

## 3. Backend Engineering Governance — Adoption Map

### Source set inspected
| Source | Key patterns extracted |
|--------|----------------------|
| **TerminalSkills/code-reviewer** | Security review checklist (SQL injection, XSS, hardcoded secrets, auth checks, rate limiting), performance checklist (N+1, missing indexes, unbounded memory, blocking operations), reliability checklist (missing timeouts, resource leaks, no retry logic) |
| **timi-ty/code-review** | Pattern conformance checking (study 2-3 sibling files before reviewing), cross-cutting analysis (new dependencies, internal consistency, API contract changes, missing changes) |
| **api-design-principles** | Consumer-first API design, error/versioning/pagination/auth strategy review, REST resource modeling |
| **senior-backend** | API scaffolding patterns, database optimization, security practices, layered development workflow |

### Current strengths (keep)
- Layer responsibility definitions and thickness thresholds
- Route/controller thinness enforcement
- Validation placement rules
- Auth/current-user discipline
- Contract-aware implementation
- Known structural debt documentation
- `docs/api/` as contract source of truth

### Gaps to fill
- **Security review category**: No explicit SQL injection, XSS, secrets, auth bypass checks
- **Performance review category**: No N+1, missing index, unbounded memory checks
- **Reliability review category**: No timeout, retry, resource leak checks
- **API design review**: No consumer-first design criteria, no versioning/pagination review
- **Pattern conformance**: No guidance to study sibling files/patterns before reviewing
- **Dependency direction**: No explicit dependency-direction rules (inner layers must not import outer)
- **Cross-cutting analysis**: No multi-file consistency check

### Adoption plan
- Add security, performance, reliability categories to review agent
- Add API design review criteria to review agent and skill
- Add dependency-direction rules to instructions
- Add pattern conformance step to workflow
- Add cross-cutting analysis to workflow for multi-file changes
- Strengthen builder agent with API design guidance
- Add severity taxonomy to review agent

---

## 4. Data Model Governance — Adoption Map

### Source set inspected
| Source | Key patterns extracted |
|--------|----------------------|
| **wshobson/database-migration** | TypeORM migration patterns (up/down, createTable, addColumn), zero-downtime patterns (blue-green deployment, add→backfill→switch→remove), rollback strategies (transaction-based, checkpoint-based), common pitfalls (not testing rollback, NULL handling, foreign key constraints, migrating too much data) |
| **BennettPhil/database-migration-generator** | Schema diff comparison, up/down SQL generation with safety checks |

### Current strengths (keep)
- Entity inventory table (6 entities with owners)
- ASCII ownership tree
- Entity file map with exact paths
- Migration discipline rules (idempotent, never modify applied, gap at 003)
- JSONB shape discipline
- Dual migration system documentation
- Source-of-truth hierarchy

### Gaps to fill
- **Zero-downtime patterns**: No blue-green deployment strategy for migrations
- **Rollback strategies**: No transaction-based or checkpoint-based rollback guidance
- **Common pitfalls catalog**: No explicit list of migration pitfalls
- **Migration review checklist**: No structured checklist for reviewing migrations
- **Data transformation safety**: No guidance for data transformations within migrations
- **Column operation safety**: No specific guidance for add/rename/remove/type-change operations
- **Severity in migration review**: No severity levels for migration findings

### Adoption plan
- Add zero-downtime migration patterns to instructions and skill
- Add rollback strategy guidance to builder agent
- Add common migration pitfalls to instructions
- Add structured migration review checklist to review agent
- Add column operation safety rules to skill
- Add severity taxonomy to review agent
- Strengthen prompt with migration-specific review steps

---

## 5. Refactor Governance — Adoption Map

### Source set inspected
| Source | Key patterns extracted |
|--------|----------------------|
| **christophacham/refactoring-patterns** | 6-area framework (Code Smells, Composing Methods, Moving Features, Organizing Data, Simplifying Conditionals, Safe Workflow), smell-to-refactoring mapping tables, scoring system (0-10 structural quality), 5 smell families (Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers), named transformations (Extract Method, Move Method, etc.), refactoring types (preparatory, comprehension, litter-pickup), Rule of Three, Branch by Abstraction for large refactors |
| **lint-and-validate** | Dead code as a first-class review concern, mandatory validation before/after refactoring |

### Current strengths (keep)
- Preserved-behavior statement format and template
- Valid vs invalid justification taxonomy
- Per-domain safety constraints
- Scope control guidance
- Incremental change discipline
- Regression discipline
- Known refactor opportunities list
- "Genuine improvement" as review criterion

### Gaps to fill
- **Named refactoring transformations**: No catalog of named transformations (Extract Method, Move Method, etc.)
- **Smell-driven refactoring**: No smell families or smell-to-fix mapping
- **Scoring system**: No 0-10 structural quality scoring
- **Refactoring types**: No preparatory/comprehension/litter-pickup classification
- **Rule of Three**: Not mentioned for duplication thresholds
- **Dead code cleanup**: Not a first-class review dimension
- **Safe refactoring loop**: "Test→refactor→test→commit" cycle not explicitly codified
- **Large-scale strategies**: No Branch by Abstraction or Parallel Change guidance
- **React-specific refactoring**: No component-level decomposition guidance

### Adoption plan
- Add named transformation catalog (scoped to Lifeline: Extract Method/Hook/Component, Move Function, Inline)
- Add smell families to skill
- Add safe refactoring loop to instructions and workflow
- Add refactoring types (preparatory, comprehension, litter-pickup) to builder agent
- Add Rule of Three to instructions
- Add dead code cleanup as explicit review dimension
- Add large-scale refactoring strategies to skill
- Add React-specific refactoring guidance to skill
- Strengthen prompt with refactoring-type and transformation review steps

---

## Cross-family adoption patterns

### Universal upgrades (all 5 families)
1. **Severity taxonomy**: CRITICAL / HIGH / MEDIUM / LOW for all review agents
2. **Structured review output**: File/line/severity/issue/suggestion format
3. **Verdict system**: approve / request-changes / needs-discussion
4. **Cross-cutting analysis step**: Added to all workflows for multi-file changes
5. **Prompt strengthening**: Add Lifeline-specific steps and severity output expectations

### Rejected patterns
| Pattern | Source | Why rejected |
|---------|--------|-------------|
| GitHub CLI PR integration | timi-ty/code-review | Lifeline governance is not PR-workflow-bound; reviews happen during AI-assisted work |
| Scoring system (0-10) | refactoring-patterns | Doesn't fit Lifeline's findings-based review model; severity levels are more actionable |
| Design system/Figma workflow | frontend-design-review | Lifeline has no Figma design system; CSS Modules are the design layer |
| Creative frontend design mode | frontend-design-review | Not relevant; Lifeline is a productivity app, not a design showcase |
| Framework-specific patterns (NestJS, FastAPI, Prisma) | Various | Lifeline uses Express + TypeORM specifically |
| Python/Go backend skills | senior-backend | Lifeline is Node.js/Express only |
| Collaborative/canvas/AI UX patterns | ux-designer | Not relevant to Lifeline's current feature set |
