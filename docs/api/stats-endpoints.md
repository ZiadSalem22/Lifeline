# Stats Endpoints

## Purpose

This document describes the current statistics endpoint behavior.

## Canonical sources used for this document

- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/application/GetStatistics.js](../../backend/src/application/GetStatistics.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)

## Endpoint summary

| Endpoint | Method | Auth requirement | Purpose |
| --- | --- | --- | --- |
| `/api/stats` | `GET` | Authenticated | Returns aggregate stats for the current user |

## `GET /api/stats`

### Purpose

Returns statistics for the current authenticated user.

### Current query parameters

The route currently supports:

- `period`
- `startDate`
- `endDate`

### Current behavior

The route chooses among three paths:

1. explicit range aggregation when both `startDate` and `endDate` are present and repository range support exists
2. repository period aggregation when range arguments are not used and aggregate support exists
3. fallback in-memory grouping when richer repository aggregation is unavailable

### Current response shape

The response can include:

- top-level totals such as `totalTodos`, `completedCount`, and `completionRate`
- `periodTotals`
- `groups`
- `topTagsInPeriod`

In the stronger aggregation paths, average duration and total time-spent values are also included.

### Auth behavior

The route requires `req.currentUser.id` and returns `401` if the current user is missing.

### Error behavior

Unexpected failures return `500` with an error payload and are logged server-side.

## Related canonical documents

- [validation-auth-and-error-behavior.md](validation-auth-and-error-behavior.md)
- [export-import-endpoints.md](export-import-endpoints.md)
- [../backend/tag-search-stats-and-data-transfer-services.md](../backend/tag-search-stats-and-data-transfer-services.md)
