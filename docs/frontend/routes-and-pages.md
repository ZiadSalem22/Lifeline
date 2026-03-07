# Routes and Pages

## Purpose

This document is the canonical route and page inventory for the Lifeline frontend.

It describes the current router shape, route aliases, protected-route behavior, and which page components own each top-level user-visible surface.

## Canonical sources used for this document

- [client/src/app/main.jsx](../../client/src/app/main.jsx)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/components/auth/ProtectedRoute.jsx](../../client/src/components/auth/ProtectedRoute.jsx)
- [client/src/pages/DashboardPage.jsx](../../client/src/pages/DashboardPage.jsx)
- [client/src/pages/AdvancedSearchPage.jsx](../../client/src/pages/AdvancedSearchPage.jsx)
- [client/src/pages/StatisticsPage.jsx](../../client/src/pages/StatisticsPage.jsx)
- [client/src/pages/ProfilePage.jsx](../../client/src/pages/ProfilePage.jsx)
- [client/src/pages/OnboardingPage.jsx](../../client/src/pages/OnboardingPage.jsx)
- [client/src/pages/AuthPage.jsx](../../client/src/pages/AuthPage.jsx)

## Router foundation

The app uses `BrowserRouter` with:

- `basename="/"`
- the React Router future flags already enabled in [client/src/app/main.jsx](../../client/src/app/main.jsx)

Top-level app providers wrap the router-driven UI for:

- auth adapter behavior
- error handling
- loading state

## Canonical route inventory

| Route | Canonical purpose | Protection | Main page surface |
| --- | --- | --- | --- |
| `/` | Primary dashboard and day-oriented home view | Public | `DashboardPage` plus the large dashboard orchestration inside `App.jsx` |
| `/day/:day` | Deep-linked day view for `today`, `tomorrow`, or `YYYY-MM-DD` | Public | Same dashboard surface, but with URL-driven selected-day sync |
| `/profile` | Account profile editing screen | Protected | `ProfilePage` |
| `/onboarding` | Required authenticated first-run profile completion flow | Protected | `OnboardingPage` |
| `/search` | Advanced search screen | Public | `AdvancedSearchPage` |
| `/advanced-search` | Alias to the advanced search experience | Public | `AdvancedSearchPage` |
| `/statistics` | Statistics dashboard | Public | `StatisticsPage` |
| `/stats` | Alias to the statistics dashboard | Public | `StatisticsPage` |
| `/auth` | Auth0 login redirect entry page | Public | `AuthPage` |
| `*` | Unknown-route fallback | Public | Redirects to `/` |

## Protected-route behavior

`ProtectedRoute` uses the auth hook directly.

Current behavior:

- while auth state is loading, it renders nothing
- if the user is not authenticated, it redirects to `/auth`
- otherwise it renders the protected child content

Routes currently protected in the app shell:

- `/profile`
- `/onboarding`

## Important route semantics

### `/` and `/day/:day` share the same dashboard product surface

The app does not treat `/day/:day` as a different page family.

Instead:

- `/` is the default home entry
- `/day/:day` is the deep-linkable day-specific form of the same dashboard experience
- the route token can be `today`, `tomorrow`, or a concrete `YYYY-MM-DD` string

### Search and statistics have aliases

Both of these surfaces expose canonical paths plus route aliases:

- search: `/search` and `/advanced-search`
- statistics: `/statistics` and `/stats`

Canonical documentation should treat the experiences as single surfaces with alias routes, not as separate pages.

### Settings is not a standalone route

A `SettingsPage` component exists, but the current route map does not expose a `/settings` route.

Current user-facing settings behavior is modal/overlay-driven from the app shell rather than route-driven.

## Page ownership summary

### `DashboardPage`

`DashboardPage` is a layout wrapper used for the main home/day view, but the detailed dashboard behavior is orchestrated in [client/src/app/App.jsx](../../client/src/app/App.jsx).

### `AdvancedSearchPage`

Wraps the advanced search component inside the shared app layout.

### `StatisticsPage`

Wraps the statistics component inside the shared app layout.

### `ProfilePage`

Wraps `ProfilePanel` in the shared app layout and protects it with `ProtectedRoute`.

### `OnboardingPage`

Owns the dedicated onboarding form and redirects away if:

- the user is not authenticated
- the user is in guest mode
- onboarding is already complete

### `AuthPage`

Initiates login when the user is not authenticated and redirects home when they already are.

## Route-to-layout relationship

Most major screens use `AppLayout`, which means they inherit:

- `Sidebar`
- `TopBar`
- consistent main-content placement

The notable exception is the auth redirect page, which does not use the full application shell.

## Related canonical documents

- [dashboard-and-day-routing.md](dashboard-and-day-routing.md)
- [layout-navigation-and-responsive-behavior.md](layout-navigation-and-responsive-behavior.md)
- [advanced-search-flow.md](advanced-search-flow.md)
- [profile-and-onboarding-screens.md](profile-and-onboarding-screens.md)
- [settings-statistics-and-data-management.md](settings-statistics-and-data-management.md)
