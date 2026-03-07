# Frontend Engineering Governance Workflow

## Purpose

Define the repeatable execution path for frontend engineering governance in Lifeline.

This workflow sits above the frontend-engineering-governance skill, agents, and team and turns them into a practical review sequence for frontend changes.

## Built on

- `.github/skills/frontend-engineering-governance.md`
- `.github/skills/code-quality-governance.md`
- `.github/agents/frontend-builder-agent.md`
- `.github/agents/frontend-review-agent.md`
- `.github/teams/frontend-engineering-governance-team.md`

## Inputs

- proposed or completed frontend change
- changed files in `client/src/`
- change description or PR context
- code quality review findings when available

## Workflow sequence

### Pre-implementation (builder guidance)
1. Inspect the proposed frontend work scope.
2. **Conformance check**: read 2–3 sibling components to learn the established pattern.
3. Recommend component structure and placement directory.
4. Recommend state ownership approach.
5. **Select UI pattern**: modal vs side panel vs full page vs inline (use decision guidance).
6. Identify loading/empty/error state requirements.
7. Identify accessibility requirements (target Grade B / WCAG AA).
8. Recommend responsive strategy.
9. **Performance check**: flag potential waterfalls, barrel imports, or code-splitting needs.
10. **UX quality pillar check**: verify the approach meets frictionless, craft, and trustworthy pillars.
11. Emit frontend implementation guidance.

### Post-implementation (lint gate)
1. Run `npm run lint` from `client/`.
2. Fix any new lint warnings or errors before review.

### Post-implementation (review)
1. Inspect the changed frontend files.
2. Assess component boundaries: single responsibility, appropriate size, correct placement.
3. Assess state ownership: lowest level, no unnecessary context, no derived state stored.
4. Assess provider/context discipline: appropriate scope, correct directory, one concern per provider.
5. Assess hook quality: meaningful abstraction, proper naming, correct placement.
6. Verify UI state completeness: loading, empty, and error states for data-dependent views.
7. Verify accessibility: keyboard access, labels, alt text, contrast (4.5:1), focus management, touch targets (44×44 px).
8. Verify responsive behavior: CSS Modules, media queries, graceful degradation.
9. Assess UI/UX coherence: consistency with existing app, navigation predictability, form behavior.
10. **UX quality pillar assessment**: frictionless (≤3 interactions), craft (consistent patterns), trustworthy (honest feedback).
11. **Performance review**: waterfalls, barrel imports, unnecessary memoization, re-render patterns, data fetching placement.
12. **UX anti-pattern check**: toast for errors, modals for multi-step, small touch targets, missing feedback.
13. Apply code quality governance rules for general readability, naming, and complexity.
14. Determine whether the change genuinely improved the frontend.
15. Classify findings with severity: CRITICAL / HIGH / MEDIUM / LOW.
16. Produce verdict: Approve / Request changes / Needs discussion.
17. Determine cross-family triggers:
    - Documentation governance: if page structure, navigation, or UX flow changed
    - Backend governance: if the change implies API contract needs
    - Refactor governance: if deeper frontend restructuring is needed
    - ADR: if durable frontend architecture decisions were made

## Rules it enforces

- Components have single responsibility with appropriate extraction thresholds
- State is owned at the lowest component that needs it
- Context/providers are for app-wide concerns only
- Custom hooks encapsulate meaningful reusable logic
- Every data-dependent view handles loading, empty, and error states
- Interactive elements are keyboard-accessible
- Form inputs have associated labels
- Styles use CSS Modules for scoping
- Pages orchestrate; they don't contain reusable logic
- Shell/navigation components don't depend on feature-specific state
- New components go in organized subdirectories, not loose in `components/`

## Outputs it produces

- Frontend engineering assessment (pass / conditional pass / fail)
- Component boundary findings
- State ownership findings
- UI state completeness verification
- Accessibility findings
- Responsive behavior findings
- UI/UX coherence assessment
- Cross-family trigger signals
- Documentation update requirements

## Failure modes and warnings

Emit warnings when:
- a component exceeds 150 lines of JSX without extraction
- a page contains reusable logic instead of delegating to components
- context/provider is used for single-subtree data
- loading, empty, or error states are missing
- interactive elements lack keyboard accessibility
- form inputs lack labels
- a component is placed loose in `components/` instead of a subdirectory
- state is stored for derived data
- visual change is claimed as UX improvement without evidence

## Anti-patterns this workflow prevents

- god components that fetch, transform, and render everything
- context as a substitute for simple prop passing
- missing UI states that leave users with blank screens
- inaccessible interactive elements
- responsive breakage from untested layout changes
- feature logic leaking into shell/navigation components
- loose component files outside organized directories
