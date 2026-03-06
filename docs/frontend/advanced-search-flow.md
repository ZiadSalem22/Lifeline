# Advanced Search Flow

## Purpose

This document describes the current advanced search experience, including search inputs, preview-versus-live behavior, result interactions, and batch operations.

## Canonical sources used for this document

- [client/src/pages/AdvancedSearchPage.jsx](../../client/src/pages/AdvancedSearchPage.jsx)
- [client/src/components/search/AdvancedSearch.jsx](../../client/src/components/search/AdvancedSearch.jsx)
- [client/src/utils/api.js](../../client/src/utils/api.js)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)

## Surface summary

The advanced search experience is exposed through:

- `/search`
- `/advanced-search`

Both routes render the same `AdvancedSearchPage`, which wraps the `AdvancedSearch` component inside the shared application shell.

## Search inputs and filters

The current advanced search UI supports these controls:

- free-text query for title and notes-like content
- direct `taskNumber` search
- tag filters
- priority filter
- completion-status filter
- flagged-only filter
- start-date and end-date range filters
- minimum and maximum duration filters
- sort selection

It also provides quick-filter buttons for:

- high priority
- active
- completed
- newest versus oldest sorting

## Data-loading model

### Guest mode

In `guest mode`, the advanced search screen uses the locally available guest todos and guest tags.

### Authenticated mode

In `authenticated mode`, the screen:

- fetches tag data
- preloads the current month of todos for a useful default dataset
- switches into server-backed search when filters are applied

## Preview versus live behavior

The current search UI has a hybrid model.

It distinguishes between:

- preview/client-side result sets
- live/server-backed result sets

The header badge communicates whether the current result mode is showing:

- `Preview`
- `Live`
- `Live — searching`

This matters because the UI can continue to show useful results even while the server-backed search is still settling.

## Default authenticated search state

When an authenticated user has not applied any filters:

- the screen defaults to the preloaded current-month dataset
- it shows those tasks as the starting result set
- no empty-state search is required before the screen becomes useful

## Result interactions

### Open/edit

Each result row exposes an edit/open action that sends the selected task back into the home workflow.

### Jump to day

A result can jump the user to the relevant day in two ways:

- double-clicking a result row
- double-tapping on touch devices within the supported timing window

That jump uses the app-level day-routing helper and can include the task id so the dashboard opens the task in edit mode.

### Selection model

The result list supports row selection for batch operations.

Current behavior includes:

- click-to-select or deselect
- shift-click range selection
- `Escape` to clear the selection set

## Batch operations

When one or more rows are selected, the UI shows batch actions for:

- delete
- mark done / mark undone

Batch behavior differs slightly by mode:

- in guest mode, the list is updated locally
- in authenticated mode, the UI calls the batch endpoint and then applies the corresponding local result refresh behavior

## Result grouping and pagination

### Grouping

When sorted by date-oriented modes, results are grouped into:

- `This Week`
- `Older`

### Pagination

The UI exposes previous and next pagination controls plus metadata showing:

- current page
- total pages
- how many results are being shown from the overall result count

## Search result content

Each row can show:

- `taskNumber`
- title
- due-date pill
- description
- tags
- flagged state
- edit action

This makes the search screen a genuine working surface rather than a simple lookup table.

## UX rules worth preserving

- clear resets every active filter and local result set
- numeric task-number search is a first-class search path
- advanced search is allowed to work from either guest-local or authenticated-server data
- result navigation returns the user to the dashboard/day view rather than editing inside the search page itself

## Related canonical documents

- [routes-and-pages.md](routes-and-pages.md)
- [dashboard-and-day-routing.md](dashboard-and-day-routing.md)
- [settings-statistics-and-data-management.md](settings-statistics-and-data-management.md)
- [../product/task-lifecycle.md](../product/task-lifecycle.md)
