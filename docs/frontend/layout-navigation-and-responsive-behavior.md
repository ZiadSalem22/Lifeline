# Layout, Navigation, and Responsive Behavior

## Purpose

This document defines the current application shell, navigation surfaces, and responsive behavior for desktop, tablet, and mobile layouts.

## Canonical sources used for this document

- [client/src/components/layout/AppLayout.jsx](../../client/src/components/layout/AppLayout.jsx)
- [client/src/components/layout/Sidebar.jsx](../../client/src/components/layout/Sidebar.jsx)
- [client/src/components/layout/TopBar.jsx](../../client/src/components/layout/TopBar.jsx)
- [client/src/hooks/useMediaQuery.js](../../client/src/hooks/useMediaQuery.js)
- [client/src/styles/design/breakpoints.css](../../client/src/styles/design/breakpoints.css)
- [docs/frontend/ui-wireframe.md](ui-wireframe.md)

## Shell structure

The primary routed screens use `AppLayout`, which composes:

- `Sidebar`
- `TopBar`
- a main content region

This gives the app a stable shell structure across:

- dashboard/home
- advanced search
- profile
- statistics

## Sidebar responsibilities

The current sidebar is more than a static nav list.

It owns:

- quick navigation to home, search, and statistics
- calendar-based day selection
- previous/today/next day stepping
- theme toggle
- settings entry
- mobile drawer behavior
- mobile-local search input while the drawer is open

### Sidebar navigation links

The sidebar currently links directly to:

- `/`
- `/search`
- `/statistics`

These are represented as compact icon-first controls rather than a long text menu.

## Top bar responsibilities

The top bar currently owns:

- menu button for opening the sidebar drawer
- page title area
- lightweight search input
- guest pill with login CTA when not authenticated
- identity chip with dropdown actions when authenticated

### Identity dropdown actions

When authenticated, the identity chip dropdown exposes:

- Profile
- Settings
- Logout

### Guest-state behavior

When the user is a guest or unauthenticated, the top bar swaps the identity menu for a guest pill and login button.

## Settings entry model

The current shell does not expose settings as a standalone routed page in the active route map.

Instead, settings is opened from shell navigation via:

- top-bar dropdown
- sidebar settings button

This means settings currently behaves like an overlay-driven shell function rather than a top-level route.

## Responsive behavior

### Breakpoint model

The frontend defines custom media breakpoints for:

- `--sm` at `max-width: 640px`
- `--md` at `max-width: 768px`
- `--lg` at `max-width: 1024px`

The sidebar currently uses a direct media-query hook based on `max-width: 768px` to determine mobile behavior.

### Desktop and larger layouts

On larger screens, the shell behaves like a persistent left-navigation layout with:

- always-present sidebar
- top bar across the main content region
- main content shown beside the sidebar

### Mobile layout

On mobile-sized screens:

- the sidebar becomes a portal-mounted drawer
- a full-screen overlay appears behind it
- escape closes the drawer
- the root element receives `has-open-sidebar` to help prevent background scrolling while the drawer is open
- the drawer itself hosts the search input so the top bar can stay compact

## Wireframe status and current truth

[ui-wireframe.md](ui-wireframe.md) is useful companion material for layout intent, but it is not the sole source of truth.

Current documentation rule:

- implementation in `AppLayout`, `Sidebar`, `TopBar`, and related styles is authoritative
- the wireframe document is companion guidance for shell intent and responsive expectations

## Navigation behaviors worth preserving

- the menu button opens the sidebar drawer when needed
- the identity dropdown closes on outside click
- the sidebar closes on overlay click or `Escape`
- mobile navigation actions typically close the drawer after navigation or settings launch
- theme toggle is reachable directly from the shell rather than buried in a settings-only route

## Search placement behavior

The app currently supports two shell-level search placements:

- a lightweight search field in the top bar
- a mobile drawer search field inside the sidebar

This arrangement preserves quick search access across screen sizes without requiring the advanced search page for simple filtering.

## Current layout limitations to document accurately

- `DashboardPage` itself still contains some older shell structure assumptions, but the canonical routed shell behavior is defined by the active `AppLayout` + `App.jsx` route usage
- the top-bar title is currently static `Home` in the component implementation, even though the dashboard content can represent day-specific views
- settings behavior is overlay-based even though a `SettingsPage` wrapper component exists in the codebase

## Related canonical documents

- [routes-and-pages.md](routes-and-pages.md)
- [dashboard-and-day-routing.md](dashboard-and-day-routing.md)
- [ui-wireframe.md](ui-wireframe.md)
