# Runtime Composition

## Purpose

This document describes how the current backend runtime is composed, initialized, and layered in the Lifeline server.

## Canonical sources used for this document

- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/infra/db/data-source.js](../../backend/src/infra/db/data-source.js)
- [backend/src/infrastructure/TypeORMTodoRepository.js](../../backend/src/infrastructure/TypeORMTodoRepository.js)
- [backend/src/infrastructure/TypeORMTagRepository.js](../../backend/src/infrastructure/TypeORMTagRepository.js)
- [backend/src/infrastructure/TypeORMUserRepository.js](../../backend/src/infrastructure/TypeORMUserRepository.js)
- [backend/src/infrastructure/TypeORMUserProfileRepository.js](../../backend/src/infrastructure/TypeORMUserProfileRepository.js)
- [backend/src/infrastructure/TypeORMUserSettingsRepository.js](../../backend/src/infrastructure/TypeORMUserSettingsRepository.js)
- [backend/src/swagger.js](../../backend/src/swagger.js)

## Runtime entry point

The backend runtime is composed from a single primary Express entry point in [backend/src/index.js](../../backend/src/index.js).

That file is responsible for:

- loading environment variables
- creating the Express app
- configuring CORS and JSON body parsing
- initializing the TypeORM data source
- constructing repository-backed application services
- attaching shared middleware
- defining routes
- serving generated Swagger UI
- serving built frontend assets when present
- registering fallback and error handlers

## Initialization sequence

### Environment loading

The runtime loads:

- `.env.local` in development
- `.env` otherwise

### Express foundation

The server then configures:

- CORS with an allowlist driven by both fixed local/production values and environment variables
- JSON request parsing through `bodyParser.json()`

### Swagger setup

Swagger UI is registered early through [backend/src/swagger.js](../../backend/src/swagger.js), which dynamically merges the base Swagger file with JSDoc-generated OpenAPI material.

### Data source initialization

The backend uses a TypeORM `DataSource` created from the app data-source options.

Startup then performs `initDataSources()` to:

- initialize the PostgreSQL-backed TypeORM data source if needed
- create repository instances
- wire use-case and service instances that depend on those repositories

### Service wiring

After the data source is ready, the runtime wires:

- `NotificationService`
- `CreateTodo`
- `ListTodos`
- `ToggleTodo`
- `CompleteRecurringTodo`
- `DeleteTodo`
- `UpdateTodo`
- `SearchTodos`
- `GetStatistics`
- `CreateTag`
- `ListTags`
- `DeleteTag`
- `UpdateTag`

## Layering model

The current backend follows a practical layered structure.

### Application layer

Application use-case classes live under [backend/src/application](../../backend/src/application) and coordinate business operations such as:

- create/update/delete/toggle todo behavior
- recurrence handling
- search
- statistics
- tag creation/update/delete

### Repository layer

Repository implementations live under [backend/src/infrastructure](../../backend/src/infrastructure) and translate between domain objects and TypeORM persistence.

### Middleware layer

Middleware under [backend/src/middleware](../../backend/src/middleware) handles:

- JWT validation
- current-user attachment
- role checks
- validation
- rate limiting
- error normalization

### Persistence layer

The TypeORM data source and entity configuration under [backend/src/infra/db](../../backend/src/infra/db) provide the runtime persistence foundation.

## Request pipeline shape

The high-level request pipeline is:

1. CORS and JSON parsing
2. public pre-auth routes such as `/api/public/info` and DB health routes where defined before auth middleware
3. global `/api` middleware chain using `checkJwt` and `attachCurrentUser`
4. route-scoped rate limiting for selected prefixes
5. route-scoped auth and role gates such as `requireAuth()`, `requireRole()`, or `requirePaid()`
6. route handlers that call application services or repositories
7. fallback not-found handling
8. global error handling

## Auth and identity attachment in runtime context

The runtime places `checkJwt` and `attachCurrentUser` on the `/api` prefix.

That means authenticated API requests typically flow through:

- JWT validation
- current-user resolution and upsert behavior
- route-specific authorization checks

This also means route handlers can usually depend on `req.currentUser` when they are intended for authenticated use.

## Rate limiting

The runtime currently applies dedicated rate limiters to:

- `/api/todos`
- `/api/ai`

The todo limiter uses a user-id-or-IP key. The AI limiter also uses a user-id-or-IP key and exempts admin users.

## Frontend asset serving

The backend can serve the built frontend when `client/dist` exists.

Current behavior:

- static files are served from the built client output
- non-API, non-doc, non-static-asset GET requests fall back to the frontend `index.html`
- reserved backend prefixes such as `/api`, `/api-docs`, and `/swagger-ui` are excluded from SPA fallback

## Current runtime posture for notifications

The backend still wires `NotificationService`, but the service is intentionally disabled for the PostgreSQL-only runtime.

Runtime consequences:

- pending notifications return an empty array
- notification mutation endpoints return `410`
- notification scheduling is not an active runtime capability

## Related canonical documents

- [auth-user-attachment-and-rbac.md](auth-user-attachment-and-rbac.md)
- [todo-services-and-use-cases.md](todo-services-and-use-cases.md)
- [tag-search-stats-and-data-transfer-services.md](tag-search-stats-and-data-transfer-services.md)
- [../api/public-and-health-endpoints.md](../api/public-and-health-endpoints.md)
- [../architecture/runtime-topology.md](../architecture/runtime-topology.md)
