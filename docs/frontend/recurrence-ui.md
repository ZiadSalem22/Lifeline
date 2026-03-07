# Recurrence UI

## Purpose

This document describes the current frontend recurrence selector and how the UI communicates recurrence choices to the rest of the app.

## Canonical sources used for this document

- [client/src/components/calendar/RecurrenceSelector.jsx](../../client/src/components/calendar/RecurrenceSelector.jsx)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx)

## Surface summary

The recurrence picker is implemented as an overlay modal opened from the task-creation flow.

It is not a standalone page.

The selector receives:

- the current recurrence value
- the base schedule date
- open/close handlers
- apply and clear handlers

## Current selectable modes

The UI currently offers exactly three recurrence choices:

- `Daily`
- `Date Range`
- `Specific Weekdays`

These map to the canonical product `recurrence modes`:

- `daily`
- `dateRange`
- `specificDays`

## Mode-specific UI behavior

### Daily

The UI describes daily recurrence as:

- every day between start and end
- separate tasks for each day in the selected span

The user must provide:

- start date
- end date

### Date Range

The UI describes date range as:

- a single continuous task
- rendered until it is done

The user must provide:

- start date
- end date

This wording is important because it tells the user that `dateRange` is not just another repeated-per-day expansion rule.

### Specific Weekdays

The UI describes specific weekdays as:

- a task that appears only on selected weekdays within the date range

The user must provide:

- start date
- end date
- at least one selected weekday

## Validation rules in the UI

The selector currently enforces:

- valid start and end dates
- start date not later than end date
- at least one selected weekday for `specificDays`

Invalid state is currently handled through simple alert-driven feedback.

## Clear and cancel behavior

The selector exposes three exit paths:

- `Apply` to save the currently configured recurrence object
- `Cancel` to close without applying new changes
- `Clear` to reset the recurrence and notify the parent that recurrence should be removed

## Parent-flow integration

In the app-level task creation flow:

- opening the selector uses the task's current scheduled date as the base date
- applying recurrence stores the chosen recurrence object in app state
- clearing recurrence resets that app state to `null`
- the saved recurrence is then included when creating a task

## UI-documentation rules to preserve

- the current recurrence selector only documents the three modern modes
- legacy recurrence payload shapes are backend compatibility behavior, not active frontend configuration choices
- `dateRange` must be described in UI docs as one logical task across a span
- recurrence is configured in an overlay during task creation rather than on a dedicated route

## Related canonical documents

- [dashboard-and-day-routing.md](dashboard-and-day-routing.md)
- [../product/recurrence-behavior.md](../product/recurrence-behavior.md)
- [../backend/todo-services-and-use-cases.md](../backend/todo-services-and-use-cases.md)
