# Export and Import Endpoints

## Purpose

This document describes the current authenticated export and import API contracts.

## Canonical sources used for this document

- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/application/TagUseCases.js](../../backend/src/application/TagUseCases.js)

## Endpoint summary

| Endpoint | Method | Auth requirement | Purpose |
| --- | --- | --- | --- |
| `/api/export` | `GET` | Authenticated | Exports current user data in JSON or CSV |
| `/api/import` | `POST` | Authenticated | Imports todo data in merge or replace mode |

## `GET /api/export`

### Purpose

Exports the current authenticated user's data.

### Current query parameters

- `format=json`
- `format=csv`

If no format is supplied, JSON is used.

### JSON export behavior

JSON export returns an attachment whose payload includes:

- `exported_at`
- `user` object with id, email, profile, and settings
- `todos` array
- `tags` array
- `stats`

Each exported todo can include:

- identity and title fields
- description
- due date and due time
- completion and flag state
- priority and duration
- tag summaries
- subtasks
- recurrence
- `originalId`

### CSV export behavior

CSV export returns a flat attachment with columns for:

- id
- title
- description
- dueDate
- dueTime
- completion and flag state
- priority
- duration
- tags
- subtasks
- recurrence

## `POST /api/import`

### Purpose

Imports todo data for the current authenticated user.

### Current request shape

The handler expects a JSON body with:

- `data` as a JSON-string payload
- `mode` as `merge` or `replace`

### Validation behavior

Current request failures include:

- missing or non-string `data` -> `400`
- invalid JSON -> `400`
- missing `todos` array in parsed data -> `400`

### Replace-mode behavior

When `mode === 'replace'`, the route deletes the current user's:

- todo-tag join rows
- todos
- non-default custom tags

before importing the new payload.

### Tag remapping behavior

Import does not blindly trust incoming tag ids.

Current behavior:

- default tags are matched by name against the current default-tag set
- custom tags are matched by name against the current user's tags
- missing custom tags can be created for the importing user
- imported todo tags are remapped to current tag ids before todos are saved

### Success response

Returns:

- `success`
- `message`
- `importedCount`

## Related canonical documents

- [stats-endpoints.md](stats-endpoints.md)
- [validation-auth-and-error-behavior.md](validation-auth-and-error-behavior.md)
- [../backend/tag-search-stats-and-data-transfer-services.md](../backend/tag-search-stats-and-data-transfer-services.md)
- [../product/onboarding-profile-and-preferences.md](../product/onboarding-profile-and-preferences.md)
