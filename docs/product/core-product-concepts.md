# Core Product Concepts

## Purpose

Lifeline is a day-oriented task management application with two operating modes:

- `guest mode` for local-only use in the browser
- `authenticated mode` for server-backed use with profile, settings, export, and account-level features

The product is organized around a selected day, quick capture, task review, search, tagging, recurrence, and lightweight personal preferences.

This document defines the core concepts that the rest of the canonical product, frontend, backend, API, and data-model documentation builds on.

## Canonical sources used for this document

Primary implementation sources:

- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/providers/TodoProvider.jsx](../../client/src/providers/TodoProvider.jsx)
- [client/src/providers/AuthProvider.jsx](../../client/src/providers/AuthProvider.jsx)
- [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js)
- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/application/CreateTodo.js](../../backend/src/application/CreateTodo.js)
- [backend/src/application/TagUseCases.js](../../backend/src/application/TagUseCases.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/infra/db/defaultTags.js](../../backend/src/infra/db/defaultTags.js)

## Product model at a glance

Lifeline is not modeled as a generic unordered list. The live implementation treats the app as a structured personal workspace with these concepts:

1. a current identity mode
2. a selected day or date context
3. a collection of tasks owned by that identity
4. task metadata such as tags, priority, duration, notes, due time, subtasks, and recurrence
5. user profile and preference data when the user is authenticated
6. search, statistics, export, and import workflows layered on top of the task system

## Identity modes

### Guest mode

In `guest mode`, the app works entirely from browser storage.

Key behaviors:

- tasks and tags are loaded from local storage
- default guest tags are seeded automatically on first use
- protected server endpoints are not available
- the app can fall back into guest mode when authenticated requests fail because of missing or expired session state
- the same broad task-management experience is preserved, but account-level server features are not the source of truth

### Authenticated mode

In `authenticated mode`, task, tag, profile, and settings data are backed by the server.

Key behaviors:

- identity is resolved through Auth0-backed token flow
- the backend attaches the current user and user role to requests
- the user can complete onboarding and persist profile data
- export, import, and reset-account behaviors operate on server-side records
- settings such as theme or layout preferences can be persisted to the authenticated account

Identity-mode details are defined fully in [identity-and-access-modes.md](identity-and-access-modes.md).

## Day-oriented workflow

The core product flow is organized around a selected date rather than around projects or boards.

Important characteristics:

- the default view starts at today
- the app also supports tomorrow and arbitrary day routing
- filtering logic is driven by the currently selected day
- date-range recurrence tasks are treated specially so they remain visible across the dates covered by their recurrence span
- search can temporarily shift the experience away from the normal day-focused view, but the selected-day model remains part of the product vocabulary

## Task as the central product object

A task can carry more than a title. The live implementation supports:

- title
- completion state
- due date
- due time
- description or notes
- priority
- flagged state
- duration in minutes
- subtasks
- tags
- recurrence metadata
- immutable per-user `taskNumber`

Tasks are the center of the dashboard, advanced search, statistics, and export/import flows.

## Task numbering

Each task receives a per-user sequential `taskNumber`.

This number matters because the product uses it as a recognizable lookup handle for:

- searching for a specific task
- loading an existing task as a template into the create form
- returning a task directly by number from the backend

The numbering is user-scoped and monotonically increasing rather than recycled.

## Tag model

Tags are a first-class product concept.

The live implementation separates tags into two categories:

- default tags that are seeded for all users or guest sessions
- custom tags created by an individual user

Important rules:

- default tags are part of the baseline experience
- custom tags are user-owned
- free-tier authenticated users are limited to 50 custom tags
- tags participate in filtering, task display, search, export, and statistics

## Recurrence model

Recurring work is a core product behavior, but it has both modern and legacy shapes in the implementation.

The current user-facing recurrence UI supports these `recurrence modes`:

- `daily`
- `dateRange`
- `specificDays`

The backend and import flows still recognize legacy recurrence payloads:

- `daily`
- `weekly`
- `monthly`
- `custom`

This distinction matters because product documentation must describe what users can actively configure in the current UI separately from what the backend still accepts for compatibility.

Recurrence is documented in detail in [recurrence-behavior.md](recurrence-behavior.md).

## Preferences and personalization

The current product includes both profile data and preference data.

### Profile data

Authenticated users can persist:

- first name
- last name
- email
- phone
- country
- city
- timezone
- avatar URL
- preferred start day of week
- onboarding completion state

### Preference data

The implementation also supports settings persistence for:

- theme
- locale
- layout data such as font or week-start-related layout preferences

Guest users still get local personalization through browser storage, but authenticated users can persist key settings to the backend.

## Account-level workflows

Beyond daily task management, the product includes account-scoped workflows for authenticated users:

- onboarding before normal use
- profile updates
- statistics review
- export to JSON or CSV
- import using merge or replace mode
- reset-account deletion of todos, custom tags, and saved settings

These are core product capabilities, not secondary utilities.

## Current free-tier limits and guardrails

The current server-side implementation applies free-tier limits in authenticated mode:

- up to 200 active non-archived tasks
- up to 50 custom tags

These limits are enforced on the backend and should be treated as current product behavior.

## What this document intentionally does not cover

This document does not define:

- route-level frontend behavior
- endpoint request and response contracts
- repository internals or schema details
- deployment or runtime operations

Those topics belong to their own canonical domains.

## Related canonical documents

- [identity-and-access-modes.md](identity-and-access-modes.md)
- [task-lifecycle.md](task-lifecycle.md)
- [recurrence-behavior.md](recurrence-behavior.md)
- [onboarding-profile-and-preferences.md](onboarding-profile-and-preferences.md)
- [../features/FEATURES.md](../features/FEATURES.md)
