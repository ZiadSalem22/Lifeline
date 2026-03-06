# Dashboard and Day Routing

## Purpose

This document describes the current dashboard experience, selected-day state model, and the URL synchronization rules that connect the home view with deep-linked day routes.

## Canonical sources used for this document

- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx)
- [client/src/pages/DashboardPage.jsx](../../client/src/pages/DashboardPage.jsx)
- [client/src/components/calendar/ModernCalendar.jsx](../../client/src/components/calendar/ModernCalendar.jsx)
- [client/src/components/layout/Sidebar.jsx](../../client/src/components/layout/Sidebar.jsx)

## Dashboard ownership model

The current dashboard is implemented primarily in [client/src/app/App.jsx](../../client/src/app/App.jsx), not in the light wrapper component alone.

`DashboardPage` provides the shell placement, but the main task dashboard behavior lives in the app-level orchestration that manages:

- selected day
- search state
- add-task state
- editing state
- overlays such as settings, export/import, and recurrence
- top-bar and sidebar props
- route synchronization

## Selected-day model

The app uses a `selectedDate` state with these common values:

- `today`
- `tomorrow`
- a concrete `YYYY-MM-DD` date string

This selected-day state drives:

- which tasks appear in the main list
- the header title and progress summary
- calendar highlighting
- previous/today/next navigation
- deep linking through `/day/:day`

## Day filtering rules

The todo provider filters tasks according to the selected day.

Current behavior includes:

- exact matching for `today`
- exact matching for `tomorrow`
- exact matching for a specific date string
- special inclusion of `dateRange` recurrence tasks when the selected day falls inside the recurrence span

This makes day routing recurrence-aware rather than relying on plain due-date equality alone.

## URL-driven routing model

### Day route tokens

The app recognizes route tokens matching:

- `today`
- `tomorrow`
- `YYYY-MM-DD`

### URL-to-state sync

When the location matches `/day/:day`, the app:

- extracts the route token
- compares it to the current `selectedDate`
- updates `selectedDate` through the todo provider if they differ

### State-to-URL navigation

When the app needs to move the user to a specific day, `handleGoToDay()`:

- normalizes ISO-like date strings down to `YYYY-MM-DD`
- converts today and tomorrow into token routes when applicable
- navigates to `/day/:token`
- optionally appends `?taskId=<id>` for deep-linked task opening

## Deep-linked task opening

The day-routing system also supports task deep linking.

Current behavior:

- search results can navigate to a day route with `taskId` in the query string
- the dashboard reads `taskId` from `location.search`
- if that task exists in the current todo set, the app opens it in edit mode

This is the main bridge between advanced search and the home/day editing workflow.

## Home view behavior

The home route `/` shows the same dashboard surface without a required explicit day token.

Important home-surface behavior includes:

- guest-mode informational banner
- ordered display with incomplete tasks before completed tasks
- progress summary for the currently filtered set
- add-task panel that can auto-open when there are no tasks
- shared overlays for settings, recurrence, and export/import

## Calendar and day navigation

### Sidebar calendar

The sidebar hosts `ModernCalendar`, which:

- highlights the currently selected day
- can change month view
- syncs its visible month to the selected date so the active date stays in view
- sends selected dates back as `YYYY-MM-DD`

### Previous / Today / Next controls

The sidebar also exposes quick day navigation buttons for:

- previous day
- today
- next day

These buttons derive from the resolved current selection rather than always stepping from the literal current calendar date.

## Search interaction with the dashboard

The dashboard has a lightweight top-bar search field, while the advanced search screen provides the richer search workflow.

Important interaction rules:

- top-bar search text filters the provider's current dataset
- advanced search can send the user back to a specific day route for editing
- route-driven day navigation and search-driven deep linking coexist without replacing the selected-day model

## Ordering behavior on the main list

After provider-level filtering and sorting, the home surface groups tasks visually so:

- incomplete tasks appear first
- completed tasks follow after them

This ordering rule is part of the dashboard experience and should remain documented as a frontend behavior rather than a backend rule.

## Guest-mode dashboard cues

When `guestMode` is active, the dashboard shows a visible guest-state banner on the home surface.

The broader status system can also show guest-mode or auth-related messages through `StatusBanner`.

## Related canonical documents

- [routes-and-pages.md](routes-and-pages.md)
- [layout-navigation-and-responsive-behavior.md](layout-navigation-and-responsive-behavior.md)
- [advanced-search-flow.md](advanced-search-flow.md)
- [../product/task-lifecycle.md](../product/task-lifecycle.md)
