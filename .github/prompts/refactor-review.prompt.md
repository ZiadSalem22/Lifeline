# Refactor Review

Trigger a refactor governance review for refactoring work.

## When to use
Use this prompt when you want an assessment of refactoring quality — behavior preservation, decomposition quality, scope discipline, and genuine improvement.

## Steps

1. Identify the changed files and the refactor scope statement.
2. **Conformance check**: read sibling files in the target directory to understand existing patterns.
3. Check for a preserved-behavior statement. If missing, flag as CRITICAL.
4. **Smell identification**: identify which smell family triggered the refactor (Bloaters, Change Preventers, Dispensables, Couplers).
5. **Refactoring type**: verify the type is classified (preparatory / comprehension / litter-pickup).
6. For each changed file, assess:
   - **Behavior preservation**: are stated behaviors actually preserved?
   - **Decomposition quality**: clear names, focused files, simpler originals
   - **Extraction quality**: clean abstraction, multiple consumers, correct scope
   - **Scope discipline**: stayed within stated scope, no creep
   - **Incremental discipline**: independently reviewable steps
   - **Justification quality**: specific and valid, not just "feels cleaner"
7. **Safe refactoring loop**: was test → refactor → test → commit followed?
8. **Dead code review**: was dead code removed or flagged for removal?
9. Apply domain-specific governance (frontend, backend, data-model) as applicable.
10. Apply code quality governance for general readability and naming.
11. For multi-file refactors, perform **cross-cutting analysis**: verify consistency across all affected files and consumers.
12. Classify each finding with severity (CRITICAL / HIGH / MEDIUM / LOW).
13. Assess whether the refactor genuinely improved the codebase.
14. Log newly discovered issues as separate refactor candidates.
15. Emit review verdict: **Approve** / **Request changes** / **Needs discussion**.
16. Identify cross-family triggers:
    - Documentation impact if module boundaries or APIs changed
    - Domain governance if domain rules were affected
    - ADR if the structural change is durable

## Severity taxonomy

| Severity | Meaning |
|----------|----------|
| CRITICAL | Behavior change without acknowledgment, data loss risk, or broken functionality |
| HIGH | Missing preserved-behavior statement, scope creep, or bad abstraction |
| MEDIUM | Incomplete justification, missing regression test, or naming gap |
| LOW | Style preference, minor documentation gap, or cosmetic structure choice |

## Sources
- `.github/skills/refactor-governance.md`
- `.github/instructions/refactor-governance.instructions.md`
- `.github/agents/refactor-review-agent.md`

## Output format

```markdown
## Refactor Review — [refactor description]

### Verdict: [Approve | Request changes | Needs discussion]

### Refactoring context
- **Type**: [preparatory / comprehension / litter-pickup]
- **Smell family**: [Bloaters / Change Preventers / Dispensables / Couplers / N/A]
- **Transformation**: [Extract Function / Extract Component / Move Function / etc.]

### Findings

#### Finding 1
- **File**: [path]
- **Severity**: [CRITICAL / HIGH / MEDIUM / LOW]
- **Category**: [Behavior Preservation / Decomposition / Extraction / Scope / Incremental / Improvement / Justification / Smell / Dead Code / Conformance]
- **Why**: [description]
- **Recommendation**: [fix]

### Cross-family triggers
- [ ] Documentation: module boundaries or APIs changed
- [ ] Domain governance: frontend / backend / data-model rules affected
- [ ] ADR: durable structural decision

### Discovered issues (separate tasks)
- [ ] [issue description]
```
