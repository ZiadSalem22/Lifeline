# Similarity Search

## Purpose

This document describes the history-aware similarity search feature that uses PostgreSQL trigram matching to find tasks with similar titles.

## Canonical sources used for this document

- [backend/src/application/FindSimilarTasks.js](../../backend/src/application/FindSimilarTasks.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/migrations/008_enable_pg_trgm_similarity.sql](../../backend/migrations/008_enable_pg_trgm_similarity.sql)

## Overview

Similarity search allows the MCP agent to check whether a user already has tasks with titles similar to one they are about to create. This prevents accidental duplicates and surfaces relevant historical context.

## Database prerequisites

### pg_trgm extension

Migration 008 enables the `pg_trgm` PostgreSQL extension, which provides trigram-based text similarity functions.

### GiST index

The same migration creates a GiST index on `todos.title`:

```sql
CREATE INDEX idx_todos_title_trgm ON todos USING gist (title gist_trgm_ops);
```

This index supports efficient `similarity()` queries against the title column.

## Application service

`FindSimilarTasks` is the application-layer use case.

### Input validation

| Parameter | Type | Default | Constraints |
| --- | --- | --- | --- |
| `title` | string | required | Must be non-empty after trimming |
| `limit` | integer | `5` | Must be between 1 and 20 |
| `threshold` | number | `0.3` | Must be between 0.1 and 1.0 |

Invalid inputs throw `ValidationError`.

### Execution

The service delegates to `todoRepository.findSimilarByTitle(userId, title, { limit, threshold })`.

## Repository implementation

`TypeORMTodoRepository.findSimilarByTitle` executes a query using the PostgreSQL `similarity()` function:

- Filters by `user_id` to enforce ownership boundaries
- Requires `similarity(title, $query) >= threshold`
- Orders results by similarity score descending
- Returns rows up to `limit`

Each result includes the computed `similarityScore` alongside the standard task fields.

## Scoring interpretation

| Score range | Interpretation |
| --- | --- |
| 0.8–1.0 | Near-exact match |
| 0.5–0.8 | Strong similarity |
| 0.3–0.5 | Moderate similarity |
| < 0.3 | Below default threshold, not returned |

The default threshold of 0.3 aims to surface moderately similar tasks without generating excessive noise.

## MCP tool integration

The `find_similar_tasks` MCP tool exposes this feature to agents. When an agent receives a user request to create a task, it can first call `find_similar_tasks` to check for duplicates.

The tool returns a formatted preview of similar tasks including their similarity scores, enabling the agent to inform the user before creating a potential duplicate.

## Related canonical documents

- [subtask-operations.md](subtask-operations.md)
- [todo-services-and-use-cases.md](todo-services-and-use-cases.md)
- [../api/internal-mcp-task-endpoints.md](../api/internal-mcp-task-endpoints.md)
- [../data-model/subtask-contract.md](../data-model/subtask-contract.md)
