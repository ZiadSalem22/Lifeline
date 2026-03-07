# Recurrence Behavior

## Purpose

This document defines the canonical product meaning of recurring tasks in Lifeline, including the current UI-supported recurrence options, the compatibility behavior still accepted by the backend, and the completion rules that affect future occurrences.

## Canonical sources used for this document

- [client/src/components/calendar/RecurrenceSelector.jsx](../../client/src/components/calendar/RecurrenceSelector.jsx)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx)
- [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js)
- [backend/src/application/CreateTodo.js](../../backend/src/application/CreateTodo.js)
- [backend/src/application/RecurrenceService.js](../../backend/src/application/RecurrenceService.js)
- [backend/src/application/CompleteRecurringTodo.js](../../backend/src/application/CompleteRecurringTodo.js)
- [backend/src/domain/Todo.js](../../backend/src/domain/Todo.js)

## Canonical recurrence vocabulary

The canonical product term is `recurrence modes`.

The current codebase contains both:

- modern UI-supported recurrence modes
- legacy recurrence payload shapes retained for compatibility

Canonical docs must keep those categories separate.

## Current UI-supported recurrence modes

The current recurrence selector exposes these user-facing modes:

- `daily`
- `dateRange`
- `specificDays`

These are the recurrence options that matter most for current product documentation and current frontend guidance.

## Modern recurrence modes in product terms

### `daily`

`daily` represents recurring work that should exist on every day in the configured range.

Creation behavior:

- the backend creates one task for each day in the selected range
- guest mode mirrors the same expansion behavior locally

Completion behavior:

- helper-driven recurrence completion can create the next occurrence when there is another valid day in range, but the main toggle flow does not universally do this today

### `dateRange`

`dateRange` is not modeled as an endless stream of individual future tasks.

Instead, it behaves as a single logical task spanning a start and end date.

Product consequences:

- the task remains visible across days that fall inside the configured range
- day-based filtering includes the task when the selected date falls between the recurrence start and end dates
- completion does not generate a next follow-on occurrence

This is one of the most important recurrence rules in the product because it differs intentionally from standard repeating-task behavior.

### `specificDays`

`specificDays` represents recurring work that should appear only on named weekdays within a bounded date range.

Creation behavior:

- the system evaluates each date inside the configured range
- a task is created only for dates whose weekday matches the selected weekday list

Completion behavior:

- helper-driven recurrence completion calculates the next occurrence by searching forward for the next matching selected weekday within the allowed range

## Legacy compatibility recurrence shapes

The backend and import paths still support older recurrence payloads based on `type` and `interval`.

Legacy accepted types are:

- `daily`
- `weekly`
- `monthly`
- `custom`

These matter because:

- imported data may still contain them
- older stored tasks may still use them
- compatibility logic still knows how to expand and advance them

Canonical product docs should describe them as compatibility behavior, not as the primary current UI model.

## Creation semantics

### Single task versus expanded set

Recurrence does not always mean the same creation pattern.

Current behavior is:

- no recurrence: create one task
- `daily`: create one task per day in the range
- `specificDays`: create one task for each matching weekday in the range
- `dateRange`: create one logical spanning task using the start date as the primary stored due date
- legacy `type`-based recurrence: expand according to interval and end date

This mixed model is why recurrence needs its own canonical documentation instead of being treated as a simple toggle.

## Completion semantics

### General rule

When recurrence-completion helper logic is used for a recurring task, the system may generate the next occurrence.

### Exceptions and special rules

- `dateRange` is explicitly excluded from next-occurrence generation
- modern `specificDays` calculates the next valid selected weekday
- legacy `weekly`, `monthly`, `daily`, and `custom` advance by interval
- new occurrences reset subtask completion state

## Display semantics

The recurrence system also affects how tasks are interpreted in the UI.

Important product-visible behaviors include:

- recurrence badges or recurrence-aware display text
- date-range tasks remaining visible across covered dates
- recurring tasks carrying recurrence metadata into export/import workflows

## Boundaries and end dates

End dates matter in several recurrence flows:

- `daily` expansion stops when the configured end date is reached
- `specificDays` only emits tasks inside its bounded range
- next-occurrence generation returns no further task when the recurrence has ended
- legacy interval-based recurrence also stops when the end date is exceeded

## Product writing rules for recurrence

Other canonical docs should preserve these rules:

- distinguish current UI-supported recurrence modes from legacy accepted payloads
- treat `dateRange` as a spanning logical task, not as an endless repeating series
- describe `specificDays` as weekday-based bounded recurrence
- describe completion-generated future occurrences as helper-supported conditional behavior, not as a universal rule

## Related canonical documents

- [core-product-concepts.md](core-product-concepts.md)
- [task-lifecycle.md](task-lifecycle.md)
- [../frontend/recurrence-ui.md](../frontend/recurrence-ui.md)
- [../backend/todo-services-and-use-cases.md](../backend/todo-services-and-use-cases.md)
- [../data-model/recurrence-subtasks-and-task-numbering.md](../data-model/recurrence-subtasks-and-task-numbering.md)
