# Frontend Engineering Governance Instructions

Use this instruction file when writing, reviewing, or modifying React frontend code in the Lifeline `client/` directory.

## Purpose

Enforce consistent React patterns, component discipline, UI/UX quality, and frontend engineering standards across Lifeline's frontend codebase.

## Inherits from

This instruction set builds on top of `.github/instructions/code-quality-governance.instructions.md`. All general code quality rules apply. This file adds frontend-specific rules.

## Required behavior

### Component boundaries
- A component should have one clear responsibility.
- Page components (`pages/`) orchestrate layout and data flow — they should not contain reusable UI logic.
- Feature components (`components/<domain>/`) encapsulate domain-specific UI.
- Shared UI primitives (`components/ui/`, `components/common/`) are reusable across features.
- Do not mix page orchestration with reusable component logic in the same file.
- Extract a component when it exceeds ~150 lines of JSX or has its own state lifecycle.

### State ownership
- State should live at the lowest component that needs it.
- Lift state only when multiple siblings need the same data.
- Use context/providers (`providers/`) only for truly app-wide concerns: auth, theme, notifications.
- Do not use context as a replacement for prop drilling when the prop chain is ≤2 levels deep.
- Avoid storing derived data in state — compute it from source state.

### Provider and context discipline
- Providers live in `client/src/providers/`. Do not create providers elsewhere.
- Each provider should own one coherent concern: `AuthProvider`, `ThemeProvider`, `TodoProvider`.
- Do not create a provider for data that is only used by one component subtree — use local state or a custom hook.
- `LoadingContext` in `context/` is a legacy pattern — new context-based state should use the `providers/` directory.

### Hook discipline
- Custom hooks live in `client/src/hooks/`.
- Hooks should encapsulate reusable stateful logic, not just wrap a single `useState`.
- Name hooks with the `use` prefix: `useAuth`, `useApi`, `useMediaQuery`.
- A hook that fetches data should handle loading, error, and success states internally.
- Do not create hooks that only destructure context — just use the context directly.

### Page vs component responsibility
- Pages (`pages/`) are route-level entry points. They:
  - Receive route params
  - Compose feature components
  - Handle page-level layout
  - Connect to providers/hooks for data
- Pages should not contain reusable UI logic, inline form handling, or direct API calls.
- If a page grows past ~200 lines, extract feature sections into named components.

### Responsive layout behavior
- Use CSS Modules (`.module.css`) for component-scoped styles.
- Responsive breakpoints should use `useMediaQuery` hook, not inline media queries in JSX logic.
- Test layouts at mobile, tablet, and desktop widths.
- Navigation and shell components must degrade gracefully on small screens.

### Shell and navigation coherence
- The app shell (layout, navigation, topbar) is managed in `components/layout/`.
- Navigation state and route transitions should be predictable.
- Active route indicators must match the current route.
- Shell components must not depend on feature-specific state.

### Forms and input UX
- Form inputs should have visible labels (not just placeholders).
- Validation feedback should appear inline near the relevant field.
- Submit buttons should indicate loading state during async operations.
- Form state should reset appropriately after successful submission.

### Accessibility
- Interactive elements must be keyboard-accessible.
- Images must have `alt` attributes.
- Form inputs must have associated `<label>` elements or `aria-label`.
- Color must not be the sole means of conveying information.
- Focus management should be intentional after route transitions and modal operations.
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text.
- Touch targets should be at least 44×44 CSS pixels.

### Accessibility grading
| Grade | Standard | Expectation |
|-------|----------|-------------|
| **C** (minimum) | WCAG 2.1 Level A | Keyboard access, alt text, labels, no color-only info |
| **B** (target) | WCAG 2.1 Level AA | Contrast ratios, focus indicators, error identification, resize support |

All new frontend work should target Grade B. Grade C is the absolute minimum for any change.

### Loading, empty, and error states
- Every data-dependent view must handle three states: loading, empty, and error.
- Loading states should use consistent loading indicators (not blank screens).
- Empty states should provide guidance (e.g., "No todos yet. Create your first one.").
- Error states should be user-friendly and actionable, not raw error messages.

### Performance awareness
- Avoid creating new object/array/function references in render unless necessary.
- Use `React.memo` only when profiling shows a measurable re-render problem — not by default.
- Avoid fetching data in components that render frequently (move fetches to parent or hook).
- Lazy-load routes or heavy components when they are not needed at initial render.

### Performance priority rules (adapted from Vercel best practices)
- **CRITICAL — Eliminate waterfalls**: Do not `await` sequentially when requests are independent — use `Promise.all`. Defer data fetching to the component that needs it to avoid parent-blocking-child patterns.
- **CRITICAL — Control bundle size**: Avoid barrel imports (`import { x } from '../components'`) that pull in entire directories. Use `React.lazy` + `Suspense` for route-level code splitting. Defer third-party scripts that are not needed at first paint.
- **HIGH — Client-side data fetching**: Deduplicate identical requests. Use passive event listeners where possible. Avoid re-fetching data that hasn't changed.
- **MEDIUM — Re-render optimization**: Prefer functional state updates (`setState(prev => ...)`) over value-based when the update depends on previous state. Use `useRef` for values that change frequently but don't affect rendering. Lazy-initialize expensive state (`useState(() => computeExpensive())`).

### UX quality pillars (adapted from Microsoft design review)
Evaluate every frontend change against three quality pillars:

1. **Frictionless task completion** — Can the user achieve their goal in ≤3 interactions? Is there a singular clear primary action? Are unnecessary steps removed?
2. **Quality craft** — Does the change follow the existing CSS Module design patterns? Is spacing, alignment, and visual hierarchy consistent with the rest of the app?
3. **Trustworthy feedback** — Does the UI explain loading states, errors, and empty states honestly? Are irreversible actions confirmed? Does the UI never appear broken or unresponsive?

### UX key metrics and numbers
When implementing or reviewing UI, use these reference numbers:
- Touch targets: minimum 44×44 CSS px
- Body text: minimum 16px
- Line height: 1.4–1.6 for body text
- Line length: 50–75 characters for readability
- Animation/transition duration: 200–400ms for UI transitions
- Feedback latency: user should see response within 100ms of interaction
- Contrast: 4.5:1 for normal text, 3:1 for large text

### UI pattern selection guidance
When choosing between UI patterns:
- **Modal/dialog**: Use for confirmations, small forms, or blocking decisions. Content should be completable in one step.
- **Side panel**: Use for detail views, editing secondary information, or contextual actions that don't replace the page.
- **Full page/route**: Use for primary workflows, multi-step forms, or content that needs the full viewport.
- **Inline expansion**: Use for progressive disclosure of details within a list or card.
- **Toast notification**: Use for transient success/info messages. Never use for errors that require action.
- **Inline error**: Use for validation errors near the relevant field. Always prefer inline over toast for errors.

## Lifeline-specific frontend context

### Directory structure
- `client/src/pages/` — route-level page components
- `client/src/components/` — feature and shared UI components, organized by domain
- `client/src/components/layout/` — app shell, topbar, sidebar, navigation
- `client/src/components/ui/` or `client/src/components/common/` — reusable primitives
- `client/src/hooks/` — custom React hooks
- `client/src/providers/` — app-wide context providers (auth, theme, todo)
- `client/src/context/` — legacy context directory (prefer `providers/`)
- `client/src/utils/` — pure utility functions
- `client/src/styles/` — global and shared CSS
- `client/src/assets/` — static assets
- `client/src/icons/` — icon components or SVGs

### Known structural debt
- `ProfilePanel.jsx` sits loose in `components/` root instead of an organized subdirectory.
- `context/` and `providers/` directories both exist — new context-based state should use `providers/` exclusively.
- Some components mix data fetching with complex rendering (container/presentation split needed).
- No TypeScript — all frontend code is plain JSX. Rely on PropTypes or careful naming for type safety.
- Some page components contain inline form handling that should be extracted to feature components.

### Stack
- React with JSX (no TypeScript)
- CSS Modules for component-scoped styling
- Vite for bundling and dev server
- Vitest for unit testing
- `useMediaQuery` hook for responsive breakpoints

## Severity taxonomy

| Severity | Meaning |
|----------|----------|
| CRITICAL | Broken user workflow, accessibility barrier (Grade C violation), or data loss |
| HIGH | Missing error handling, performance waterfall, or UX anti-pattern with user impact |
| MEDIUM | Responsive gap, missing loading state, or component structure issue |
| LOW | Style preference, naming, or minor documentation gap |

## Anti-patterns to flag

- Components with more than 300 lines of JSX
- Components that both fetch data AND render complex UI (split into container + presentation)
- Direct API calls inside component bodies (use hooks)
- Context/provider for single-component-subtree data
- Inline styles for anything beyond truly dynamic values
- Missing loading/empty/error state handling
- Non-accessible interactive elements
- Feature-specific logic in shell/layout components
- Loose component files outside of organized subdirectories (like `ProfilePanel.jsx` in `components/`)
- Barrel imports that re-export entire directories (`import { x } from '../components'`)
- Sequential awaits for independent requests (use `Promise.all`)
- `React.memo` applied without profiling evidence of re-render problems
- Toast notifications for errors that require user action (use inline errors instead)
- Modals with multi-step workflows (use full page/route instead)
- Touch targets smaller than 44×44 CSS px on interactive elements
- Body text below 16px

## Documentation impact

Frontend changes that alter page structure, navigation flow, component boundaries, or responsive behavior should trigger documentation-governance review for possible `docs/frontend/` updates. Changes to user-facing business flows should also trigger `docs/product/` review.
