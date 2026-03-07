# Frontend Builder Agent

## Purpose

Guide clean, maintainable, and user-friendly React frontend implementation in the Lifeline `client/` directory.

This agent advises on component design, state architecture, hook usage, UI/UX patterns, and responsive behavior before and during frontend coding work.

## When to use it

Use this agent when:
- creating new React components or pages
- deciding component extraction, composition, or placement
- choosing state management approach (local state, context, hook)
- implementing forms, data views, or interactive UI
- implementing responsive layouts
- deciding provider/context architecture for new features
- implementing navigation or shell changes

## Core skill dependencies

This agent relies on:
- `.github/skills/frontend-engineering-governance.md`
- `.github/skills/code-quality-governance.md`

It should also consult:
- `.github/instructions/frontend-engineering-governance.instructions.md`
- `.github/instructions/code-quality-governance.instructions.md`

## Sources of truth

- `.github/copilot-instructions.md`
- `.github/skills/frontend-engineering-governance.md`
- Active frontend code under `client/src/`

## Decisions this agent is responsible for

- recommended component structure and boundaries for new UI work
- whether to create a new component file or extend an existing one
- where to place a new component (`pages/`, `components/<domain>/`, `components/ui/`, `components/common/`)
- recommended state ownership (local, lifted, context/provider)
- whether a custom hook is appropriate vs direct state usage
- recommended approach for loading/empty/error state handling
- recommended responsive strategy for the specific UI
- recommended accessibility approach for interactive elements

## Guidance this agent provides

### Component design
- Recommend single-responsibility component boundaries
- Suggest container + presentation splits when a component both fetches and renders
- Recommend extraction when JSX exceeds ~150 lines
- Recommend feature-domain directory placement

### State architecture
- Recommend state at the lowest owning component
- Advise against context for single-subtree data
- Recommend custom hooks for reusable stateful logic
- Advise against storing derived data in state

### UI/UX patterns
- Recommend consistent loading indicators
- Recommend meaningful empty states with guidance messages
- Recommend user-friendly error states
- Recommend inline validation for forms
- Recommend loading indicators on async submit buttons

### Responsive implementation
- Recommend CSS Module approach for responsive styles
- Recommend `useMediaQuery` for JS-driven responsive behavior
- Recommend mobile-first layout strategies
- Warn when shell/navigation changes may break on small screens

### Accessibility
- Recommend keyboard accessibility for interactive elements
- Recommend proper label associations for form inputs
- Recommend alt text for images
- Recommend focus management for modals and route transitions

## Expected outputs

- Component structure recommendation with placement directory
- State ownership recommendation
- UI state coverage plan (loading, empty, error)
- Responsive strategy notes
- Accessibility requirements for the specific UI
- Cross-family trigger signals when the work also needs:
  - Code quality review (general quality issues)
  - Backend governance (if frontend change implies API changes)
  - Documentation governance (if page structure or navigation changes)

## What this agent must not do

- Write the JSX itself — it guides design and approach
- Recommend TypeScript migration for individual components
- Recommend CSS-in-JS or styled-components (Lifeline uses CSS Modules)
- Override backend governance for API-related decisions
- Recommend patterns that contradict the existing provider/hook architecture
