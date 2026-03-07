# Data Model Documentation

Use this section for schema notes, entity relationships, migration strategy, and database-model documentation.

Current canonical documents:

- [overview-and-current-source-of-truth.md](overview-and-current-source-of-truth.md)
- [mcp-api-keys.md](mcp-api-keys.md)
- [users-profiles-and-settings.md](users-profiles-and-settings.md)
- [todos-tags-and-relationships.md](todos-tags-and-relationships.md)
- [recurrence-subtasks-and-task-numbering.md](recurrence-subtasks-and-task-numbering.md)
- [migrations-and-historical-schema-context.md](migrations-and-historical-schema-context.md)

Primary implementation truth for this domain lives under:

- [backend/src/infra/db/entities](../../backend/src/infra/db/entities)
- [backend/src/migrations](../../backend/src/migrations)
- [backend/src/infrastructure](../../backend/src/infrastructure)
- [backend/src/infra/db/data-source-options.js](../../backend/src/infra/db/data-source-options.js)

Historical SQL and MSSQL artifacts can still provide migration context, but they are not the canonical definition of the live authenticated Postgres schema.