# Lifeline Feature Canon

## Purpose

This file is the canonical current-state feature inventory for Lifeline.

It replaces the older suggestions-style feature list with an implementation-verified inventory of what the product currently supports.

## Canonical sources used for this document

- [docs/product/core-product-concepts.md](../product/core-product-concepts.md)
- [docs/product/task-lifecycle.md](../product/task-lifecycle.md)
- [docs/product/recurrence-behavior.md](../product/recurrence-behavior.md)
- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/pages](../../client/src/pages)
- [client/src/components](../../client/src/components)
- [client/src/providers](../../client/src/providers)
- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/application](../../backend/src/application)

## Feature status model

This inventory uses these labels:

- `Current` = implemented and part of the current product surface
- `Current with constraints` = implemented, but important limits or caveats apply
- `Compatibility only` = supported mainly for legacy payloads or retained behavior, not as the preferred current UX
- `Not current` = not part of the canonical current product, even if older docs mentioned it

## Current core features

### Identity and account modes

| Feature | Status | Notes |
| --- | --- | --- |
| Guest-mode task management | Current | Local browser storage with seeded default tags and local task numbering |
| Authenticated account mode | Current | Auth0-backed identity, server persistence, profile/settings support |
| Onboarding gate for authenticated users | Current | Authenticated users are redirected to onboarding until required profile fields are completed |
| Profile management | Current | Profile supports personal details editing, while week-start preference still exists elsewhere in the authenticated product model |
| Self-serve MCP API key management | Current with constraints | Lives on Profile; supports metadata list, bounded create, one-time reveal, and revoke for the current user only |

### Task management

| Feature | Status | Notes |
| --- | --- | --- |
| Create tasks with rich metadata | Current | Supports title, due date, due time, notes, tags, priority, duration, subtasks, and recurrence |
| Edit tasks | Current | Mutable task fields can be updated after creation |
| Complete and reopen tasks | Current | Completion toggles are supported; recurrence helper logic exists, but the main toggle path does not universally auto-create the next occurrence |
| Flag tasks | Current | Flagging is independent from completion and priority |
| Drag-and-drop ordering | Current | Display ordering can be rearranged in the dashboard |
| Task template loading by number | Current | Existing task data can prefill a new draft via `taskNumber` lookup |
| Archive-oriented deletion | Current with constraints | Normal authenticated delete behavior archives the task rather than hard-deleting the record |
| Per-user sequential task number | Current | Used for lookup, search, and template-loading workflows |

### Organization and filtering

| Feature | Status | Notes |
| --- | --- | --- |
| Default tags | Current | Seeded for guest and authenticated use |
| Custom tags | Current with constraints | Authenticated free-tier users are limited to 50 custom tags |
| Tag filtering | Current | Task filtering can require selected tags |
| Search by title and description | Current | Search is supported in both normal and advanced flows |
| Task-number-aware lookup and search | Current | Numeric task search is part of the product model |
| Priority sorting and filtering | Current | Priority is both display and search/filter metadata |

### Recurrence

| Feature | Status | Notes |
| --- | --- | --- |
| `daily` recurrence mode | Current | Current UI-supported mode |
| `dateRange` recurrence mode | Current | Logical spanning task across a date range |
| `specificDays` recurrence mode | Current | Weekday-based recurrence within a range |
| Legacy `weekly`, `monthly`, and `custom` recurrence payloads | Compatibility only | Backend and import compatibility, not the primary current UI vocabulary |

### Insight and data management

| Feature | Status | Notes |
| --- | --- | --- |
| Statistics dashboard | Current | Supports overall and ranged metrics, with guest fallback calculation |
| Export to JSON | Current | Authenticated export includes user-scoped task, tag, and stats data |
| Export to CSV | Current | Authenticated export alternative |
| Import with merge mode | Current | Adds imported tasks into existing account data |
| Import with replace mode | Current | Replaces account task and custom-tag data for the user |
| Reset account data | Current | Deletes authenticated user todos, custom tags, and saved settings |

### Personalization

| Feature | Status | Notes |
| --- | --- | --- |
| Theme selection | Current | Local persistence for all users, server persistence for authenticated users when available |
| Font selection | Current | Part of layout-oriented settings persistence |
| Week-start preference | Current | Derived from profile and settings, used by statistics/week-based behavior |

## Current constraints and caveats

### Free-tier limits

The current backend enforces these authenticated free-tier limits:

- 200 active non-archived tasks
- 50 custom tags

### Notifications

Notifications are **not** a current active feature.

Older documentation referenced notifications as live, but current backend behavior treats notification endpoints as disabled.

### Default versus custom tags

Default tags are part of the shared baseline experience. Custom tags are user-owned and subject to limits.

### Guest versus authenticated parity

Guest mode mirrors much of the task workflow, but it is not a full substitute for account-backed features such as profile persistence, export/import, or backend settings storage.

## Explicitly not part of the canonical current feature set

These items should not be described as active current features unless the implementation changes:

- live browser notification workflow
- collaboration or shared lists
- attachments
- project/category hierarchy
- command palette or keyboard-shortcut system as a named primary feature
- alternate board or timeline views as a shipped mode

## Cross-reference map

- product semantics: [../product/README.md](../product/README.md)
- frontend behavior: [../frontend/README.md](../frontend/README.md)
- backend behavior: [../backend/README.md](../backend/README.md)
- API contracts: [../api/README.md](../api/README.md)

## Historical note

The previous version of this file mixed implemented features, suggestions, and aspirational backlog ideas. That older approach is no longer canonical for current-state documentation.

