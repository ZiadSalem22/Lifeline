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

## Documentation impact

Frontend changes that alter page structure, navigation flow, component boundaries, or responsive behavior should trigger documentation-governance review for possible `docs/frontend/` updates. Changes to user-facing business flows should also trigger `docs/product/` review.
