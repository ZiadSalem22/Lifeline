# Refactor Review

Trigger a refactor governance review for refactoring work.

## When to use
Use this prompt when you want an assessment of refactoring quality — behavior preservation, decomposition quality, scope discipline, and genuine improvement.

## Steps

1. Identify the changed files and the refactor scope statement.
2. Check for a preserved-behavior statement. If missing, flag as a blocker.
3. For each changed file, assess against Lifeline's refactor standards:
   - **Behavior preservation**: are stated behaviors actually preserved?
   - **Decomposition quality**: clear names, focused files, simpler originals
   - **Extraction quality**: clean abstraction, multiple consumers, correct scope
   - **Scope discipline**: stayed within stated scope, no creep
   - **Incremental discipline**: independently reviewable steps
   - **Justification quality**: specific and valid, not just "feels cleaner"
4. Apply domain-specific governance (frontend, backend, data-model) as applicable.
5. Apply code quality governance for general readability and naming.
6. Produce findings with severity (blocker / warning / note), location, and recommendation.
7. Assess whether the refactor genuinely improved the codebase.
8. Log newly discovered issues as separate refactor candidates.
9. Identify cross-family triggers:
   - Documentation impact if module boundaries or APIs changed
   - Domain governance if domain rules were affected
   - ADR if the structural change is durable

## Sources
- `.github/skills/refactor-governance.md`
- `.github/instructions/refactor-governance.instructions.md`
- `.github/agents/refactor-review-agent.md`

## Output
Return a refactor governance assessment with behavior preservation verification, specific findings, severity levels, and actionable recommendations.
