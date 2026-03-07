# Frontend Review

Trigger a frontend engineering and UI/UX review for changed frontend files.

## When to use
Use this prompt when you want an assessment of React component quality, state management, UI/UX patterns, accessibility, or responsive behavior for frontend changes.

## Steps

1. Identify the changed files in `client/src/`.
2. For each changed component or page, assess against Lifeline's frontend standards:
   - **Component boundaries**: single responsibility, extraction thresholds, correct placement
   - **State ownership**: lowest level, no unnecessary context, no derived state stored
   - **UI states**: loading, empty, and error state completeness
   - **Accessibility**: keyboard access, labels, alt text, focus management
   - **Responsive**: CSS Modules, media queries, graceful degradation
   - **UX coherence**: consistency, navigation predictability, form behavior
3. Apply code quality governance for general readability, naming, and complexity.
4. Produce findings with severity (blocker / warning / note), location, and recommendation.
5. Assess whether the change genuinely improved the frontend.
6. Identify cross-family triggers:
   - Documentation impact if page structure or navigation changed
   - Backend governance if API contracts are implied
   - Refactor governance if deeper restructuring is needed

## Sources
- `.github/skills/frontend-engineering-governance.md`
- `.github/instructions/frontend-engineering-governance.instructions.md`
- `.github/agents/frontend-review-agent.md`

## Output
Return a frontend engineering assessment with specific findings, severity levels, and actionable recommendations.
