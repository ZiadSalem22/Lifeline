# Frontend Review

Trigger a frontend engineering and UI/UX review for changed frontend files.

## When to use
Use this prompt when you want an assessment of React component quality, state management, UI/UX patterns, accessibility, or responsive behavior for frontend changes.

## Steps

1. **Identify scope**: Identify the changed files in `client/src/`.
2. **Lint gate**: Verify changes pass `npm run lint` from `client/`. If lint fails, report as CRITICAL.
3. **Conformance check**: read sibling components in the same directory to check for pattern consistency.
4. **Component and state review**: For each changed component or page, assess:
   - **Component boundaries**: single responsibility, extraction thresholds, correct placement
   - **State ownership**: lowest level, no unnecessary context, no derived state stored
   - **UI states**: loading, empty, and error state completeness
4. **Accessibility review** (target Grade B / WCAG AA):
   - Keyboard access, labels, alt text, focus management
   - Contrast ratio ≥4.5:1, touch targets ≥44×44 px
5. **UX quality pillar check**:
   - **Frictionless**: goal reachable in ≤3 interactions, clear primary action
   - **Craft**: consistent with existing CSS Module patterns, visual hierarchy intact
   - **Trustworthy**: honest loading/error/empty states, irreversible actions confirmed
6. **Performance review**:
   - Sequential awaits for independent requests (CRITICAL — use `Promise.all`)
   - Barrel imports (CRITICAL — use direct imports)
   - Unnecessary `React.memo` (MEDIUM)
   - Data fetching in frequently-rendering components
7. **UX anti-pattern check**: toast for errors, modals for multi-step, touch targets <44×44px, body text <16px, line height outside 1.4–1.6, animation duration outside 200–400ms, feedback latency >100ms, placeholders as sole labels
8. **Responsive and UX coherence**: CSS Modules, graceful degradation, navigation predictability, form behavior
9. Apply code quality governance for general readability, naming, and complexity.
10. **Classify findings**: CRITICAL / HIGH / MEDIUM / LOW with category and location.
11. **Verdict**: Approve / Request changes / Needs discussion.
12. **Cross-family triggers**:
    - Documentation impact if page structure or navigation changed
    - Backend governance if API contracts are implied
    - Refactor governance if deeper restructuring is needed

## Severity taxonomy

| Severity | Meaning |
|----------|----------|
| CRITICAL | Broken user workflow, accessibility barrier (Grade C violation), or data loss |
| HIGH | Missing error handling, performance waterfall, or UX anti-pattern with user impact |
| MEDIUM | Responsive gap, missing loading state, or component structure issue |
| LOW | Style preference, naming, or minor documentation gap |

## Sources

## Output format

```markdown
## Frontend Review Summary
**Verdict**: [Approve | Request changes | Needs discussion]
**Findings**: [count by severity]
**UX Pillar Status**: Frictionless [pass/fail] | Craft [pass/fail] | Trustworthy [pass/fail]

### [SEVERITY] Category: Brief title
**File**: path — component name
**Issue**: description
**Why**: explanation of impact
**Recommendation**: actionable fix
```

Repeat the finding block for each issue. End with cross-family triggers.
