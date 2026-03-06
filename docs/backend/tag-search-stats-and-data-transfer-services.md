# Tag, Search, Stats, and Data-Transfer Services

## Purpose

This document covers the backend services and repository behaviors that support tags, search, statistics, export/import, and notification-disabled state.

## Canonical sources used for this document

- [backend/src/application/TagUseCases.js](../../backend/src/application/TagUseCases.js)
- [backend/src/application/SearchTodos.js](../../backend/src/application/SearchTodos.js)
- [backend/src/application/GetStatistics.js](../../backend/src/application/GetStatistics.js)
- [backend/src/application/NotificationService.js](../../backend/src/application/NotificationService.js)
- [backend/src/infrastructure/TypeORMTagRepository.js](../../backend/src/infrastructure/TypeORMTagRepository.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/index.js](../../backend/src/index.js)

## Tag use cases

The tag service set consists of:

- `CreateTag`
- `ListTags`
- `DeleteTag`
- `UpdateTag`

### `CreateTag`

`CreateTag` enforces the free-tier custom-tag limit when limit information is supplied.

Current behavior:

- counts custom tags for the user
- throws when the free-tier limit is reached
- creates only custom user-owned tags

### `ListTags`

Returns the tag set for the current user through repository logic.

### `DeleteTag`

Delegates deletion to the repository, which enforces ownership and default-tag protection.

### `UpdateTag`

Current safeguards:

- the tag must exist
- default tags cannot be edited
- the tag must belong to the current user

## Tag repository behavior

`TypeORMTagRepository` provides the persistence-side rules for tags.

Important current rules include:

- default tags are immutable through the API layer
- default tags cannot be deleted
- user ownership is enforced for destructive tag actions
- authenticated tag listing returns default tags plus that user's custom tags
- custom-tag counts are user-scoped and exclude default tags

## Search service

`SearchTodos` is intentionally thin and delegates search behavior to the todo repository.

The important backend point is that search is repository-backed, not implemented as a controller-local filter.

That repository-level search supports:

- text query
- task number
- tags
- priority
- status
- date range
- duration range
- flagged filter
- sort modes
- pagination

## Statistics service

`GetStatistics` also delegates to the repository layer.

The heavier statistics work is performed by repository helpers that can:

- aggregate overall active-task metrics
- aggregate within an explicit date range
- group by period
- compute top tags
- compute completion and duration metrics

The route layer adds request-shape decisions around:

- `period`
- `startDate`
- `endDate`

and falls back to naive in-memory grouping if richer repository aggregation is not available.

## Export and import backend behavior

Although export/import is documented as API contracts elsewhere, some important backend service rules belong here.

### Export behavior

The export path:

- loads user-scoped todos and tags
- supports JSON and CSV output modes
- includes task details such as recurrence and subtasks
- includes computed stats in JSON output

### Import behavior

The import path:

- validates that incoming `data` is a JSON string payload
- rejects missing or malformed import data
- supports `merge` and `replace` modes
- preserves default-tag mapping by name where possible
- creates missing custom tags for the importing user when needed
- rewrites imported tags to current tag ids before saving imported todos

## Notifications-disabled service state

`NotificationService` is intentionally a disabled stub in the current PostgreSQL-only runtime.

Current service behavior:

- returns a structured disabled response
- does not schedule notifications
- returns empty pending notifications
- treats mark-sent and delete operations as no-op service methods

This is important backend truth because older docs can imply that notifications are active.

## Related canonical documents

- [runtime-composition.md](runtime-composition.md)
- [todo-services-and-use-cases.md](todo-services-and-use-cases.md)
- [../api/tag-endpoints.md](../api/tag-endpoints.md)
- [../api/stats-endpoints.md](../api/stats-endpoints.md)
- [../api/export-import-endpoints.md](../api/export-import-endpoints.md)
