# Skill: frontend-engineering-governance

## Purpose

Enforce consistent React patterns, component discipline, state management quality, UI/UX standards, and frontend engineering rigor across Lifeline's `client/` directory.

This skill builds on top of code-quality-governance and adds frontend-specific rules for React component architecture, state ownership, accessibility, responsive behavior, and UI coherence.

## Scope

Use this skill to assess and guide:
- component boundaries and responsibility
- state ownership and lifting decisions
- provider/context usage and discipline
- custom hook design and placement
- page vs component responsibility
- responsive and accessible implementation
- loading/empty/error state completeness
- shell/navigation coherence
- forms and input UX quality
- CSS Module usage and style scoping
- performance-sensitive React patterns

## When to use it

Use this skill when:
- creating or modifying React components
- reviewing frontend pull requests
- deciding component extraction or composition
- evaluating state management choices
- assessing accessibility compliance
- reviewing responsive behavior
- evaluating UI/UX quality of a frontend change

## Sources of truth

Consult first:
- `.github/instructions/frontend-engineering-governance.instructions.md`
- `.github/skills/code-quality-governance.md`
- `.github/copilot-instructions.md`

Then consult the implementation:
- `client/src/components/` for component organization
- `client/src/pages/` for page-level patterns
- `client/src/hooks/` for custom hook patterns
- `client/src/providers/` for provider patterns
- `client/src/context/` for legacy context (should not grow)
- `client/src/styles/` for global style patterns

## What this skill must know

### Lifeline frontend structure
- React with functional components and hooks (no class components)
- JSX files (`.jsx`) — no TypeScript
- CSS Modules (`.module.css`) for component-scoped styles
- Pages are route-level entry points in `pages/`
- Feature components organized by domain under `components/` subdirectories: `auth/`, `calendar/`, `dashboard/`, `search/`, `settings/`, `statistics/`
- Shared primitives in `components/ui/` and `components/common/`
- Known structural debt: `ProfilePanel.jsx` loose in `components/` root
- Known structural debt: `context/` has one file (`LoadingContext`) while `providers/` has five — new context should go to `providers/`
- App shell managed in `components/layout/`
- Background components in `components/background/`

### Component boundary rules
- One clear responsibility per component
- Page components orchestrate; they don't contain reusable logic
- Extract at ~150 lines of JSX or when a component has its own state lifecycle
- Shared UI goes to `components/ui/` or `components/common/`
- Feature UI goes to `components/<domain>/`

### State ownership rules
- State at the lowest component that needs it
- Lift only when siblings need the same data
- Context/providers for truly app-wide concerns only
- No context for single-subtree data
- No derived data in state — compute from source

### Required UI states
Every data-dependent view must handle:
1. Loading state (consistent loading indicator)
2. Empty state (guidance message)
3. Error state (user-friendly, actionable)

### Accessibility minimums
- Keyboard-accessible interactive elements
- `alt` on images
- `label` or `aria-label` on form inputs
- Color is not sole information channel
- Focus management after route transitions and modals
- Contrast: 4.5:1 normal text, 3:1 large text
- Touch targets: minimum 44×44 CSS px

### Accessibility grading
| Grade | Standard | Expectation |
|-------|----------|-------------|
| **C** (minimum) | WCAG 2.1 Level A | Keyboard, alt, labels, no color-only |
| **B** (target) | WCAG 2.1 Level AA | Contrast, focus indicators, error ID, resize |

### UX quality pillars
Evaluate every frontend change against:
1. **Frictionless task completion** — goal achievable in ≤3 interactions, singular primary action, no unnecessary steps
2. **Quality craft** — CSS Module patterns followed, spacing/alignment/hierarchy consistent
3. **Trustworthy feedback** — loading/error/empty states honest, irreversible actions confirmed, UI never appears broken

### UX key metrics
- Touch targets: min 44×44 CSS px
- Body text: min 16px
- Line height: 1.4–1.6
- Line length: 50–75 characters
- Transitions: 200–400ms
- Feedback latency: <100ms
- Contrast: 4.5:1 normal text

### Performance priority rules
- **CRITICAL**: Eliminate waterfalls — `Promise.all` for independent requests, defer data fetching to consumers
- **CRITICAL**: Control bundle size — no barrel imports, `React.lazy` + `Suspense` for route splitting
- **HIGH**: Deduplicate identical requests, passive event listeners
- **MEDIUM**: Functional state updates (`setState(prev => ...)`), `useRef` for transient values, lazy state init

### UI pattern selection
- **Modal**: confirmations, small single-step forms, blocking decisions
- **Side panel**: detail views, secondary editing, contextual actions
- **Full page/route**: primary workflows, multi-step forms
- **Inline expansion**: progressive disclosure in lists/cards
- **Toast**: transient success/info only — never for errors requiring action
- **Inline error**: validation errors near the relevant field

### Severity taxonomy
| Severity | Meaning |
|----------|----------|
| CRITICAL | Broken user workflow, accessibility barrier (Grade C violation), or data loss |
| HIGH | Missing error handling, performance waterfall, or UX anti-pattern with user impact |
| MEDIUM | Responsive gap, missing loading state, or component structure issue |
| LOW | Style preference, naming, or minor documentation gap |

## Practical checklist

When reviewing frontend code:
1. Does each component have one clear responsibility?
2. Is state owned at the right level?
3. Are providers/context used appropriately (app-wide only)?
4. Does the component handle loading, empty, and error states?
5. Are interactive elements keyboard-accessible with proper contrast?
6. Is the component organized in the right directory?
7. Does the page delegate to feature components instead of containing everything inline?
8. Are styles scoped via CSS Modules?
9. Is responsive behavior appropriate?
10. Does the change improve or maintain UI consistency?
11. Does the change meet the three UX quality pillars (frictionless, craft, trustworthy)?
12. Are there performance problems (waterfalls, barrel imports, unneeded re-renders)?
13. Is the right UI pattern used (modal vs panel vs page vs inline)?
14. Are touch targets ≥44×44 px and body text ≥16px?
15. Does the change target accessibility Grade B (WCAG AA)?

## Cross-family integration

### Triggers documentation governance when
- Page structure, navigation flow, or responsive behavior changes
- Component boundaries change in ways that affect documented frontend architecture
- User-facing business flow changes

### Triggers code-quality governance when
- General readability, duplication, or complexity issues are found outside frontend-specific rules

### Triggers refactor governance when
- Frontend restructuring is needed beyond the current component or file
- Structural debt (e.g., `context/` vs `providers/` rationalization) should be addressed

### Referenced by
- refactor-governance (uses frontend rules as safety constraints during frontend refactors)

## What this skill must not do

- Override backend engineering rules for shared utilities
- Mandate TypeScript migration as part of individual component work
- Require `React.memo` without profiling evidence
- Treat CSS-in-JS or styled-components as alternatives — Lifeline uses CSS Modules
- Flag responsive behavior issues without checking `useMediaQuery` usage first
- Conflate visual change with UX improvement — assess whether UX actually improved
