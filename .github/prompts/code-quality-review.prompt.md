# Code Quality Review

Trigger a code quality review for changed files.

## When to use
Use this prompt when you want a code quality assessment of recent changes or a specific set of files.

## Steps

1. Identify the changed files or target files for review.
2. For each file, assess against Lifeline's code quality standards:
   - **Readability**: naming, nesting depth, function size, file focus, self-documenting code
   - **Duplication**: copy-paste blocks, missed reuse, extraction quality
   - **Complexity**: file lines, function lines, nesting levels, parameter counts
   - **Cohesion**: single responsibility, explicit dependencies, clean exports
   - **Naming**: convention compliance, consistency within file, descriptiveness
   - **Cleanliness**: dead code, commented-out code, magic values, silent error suppression, TODO quality
3. For structural changes, verify behavior preservation.
4. Produce findings with severity (blocker / warning / note), location, and recommendation.
5. Assess whether the change genuinely improved quality.
6. Identify cross-family triggers:
   - Documentation impact if module boundaries or APIs changed
   - Refactor governance if systemic issues need deeper work
   - Frontend/backend governance if domain-specific issues found

## Sources
- `.github/skills/code-quality-governance.md`
- `.github/instructions/code-quality-governance.instructions.md`
- `.github/agents/code-quality-review-agent.md`

## Output
Return a quality assessment with specific findings, severity levels, and actionable recommendations.
