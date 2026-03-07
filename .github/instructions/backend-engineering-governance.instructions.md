# Backend Engineering Governance Instructions

Use this instruction file when writing, reviewing, or modifying backend code in the Lifeline `backend/` directory.

## Purpose

Enforce consistent backend layering, service boundaries, validation discipline, error handling, and engineering rigor across Lifeline's Node.js/Express backend.

## Inherits from

This instruction set builds on top of `.github/instructions/code-quality-governance.instructions.md`. All general code quality rules apply. This file adds backend-specific rules.

## Required behavior

### Route/controller thinness
- Route files (`routes/`) bind HTTP endpoints to controller methods. They should contain only routing logic: path, method, middleware chain, and controller delegation.
- Route files must not contain business logic, validation logic, or database queries.
- Controllers (`controllers/`) orchestrate: parse request, call use-case/service, format response. They should remain thin.
- If a controller method exceeds ~30 lines, the extra logic likely belongs in a use-case or service.

### Service/use-case boundaries
- Business logic lives in `application/` as use-cases (e.g., `CreateTodo`, `ToggleTodo`, `GetStatistics`).
- Each use-case should have one clear business operation.
- Use-cases receive validated inputs and return domain results — they do not parse HTTP requests or format HTTP responses.
- Use-cases call repositories for data access — they do not use the ORM directly.
- Shared business logic across use-cases should be extracted into domain services or domain utilities.

### Repository boundaries
- Repositories (`infrastructure/`) encapsulate all data access for a domain aggregate.
- Repository methods should be named for domain operations: `findByUserId`, `save`, `delete`, `findWithTags`.
- Repositories should not expose raw SQL or ORM query details to consumers.
- TypeORM-specific code (query builders, entity managers, relations) stays inside repositories.
- Do not access repositories from route files or middleware — go through controllers and use-cases.

### Validation placement
- Request validation happens in middleware before the controller (`middleware/validate*` or `validators/`).
- Business-rule validation happens in use-cases or domain objects.
- Database-constraint validation is a last-resort safety net, not the primary validation layer.
- Validation errors should produce specific, user-helpful messages — not generic 400 errors.

### Error handling discipline
- Use the centralized error handler (`middleware/errorHandler`).
- Throw typed or structured errors from use-cases — do not let raw database errors propagate to the response.
- Every async route/controller must properly handle promise rejections.
- Do not catch errors silently — catch, log, and re-throw or respond appropriately.
- Error responses should be consistent: `{ error: { message, code } }` or equivalent.

### Auth and current-user discipline
- Auth middleware (`middleware/auth0`, `middleware/attachCurrentUser`) runs before controllers.
- The current user identity is attached to the request object by middleware — do not re-derive it.
- Use-cases should receive the user ID as a parameter, not reach into the request object.
- All user-scoped data queries must filter by the authenticated user's ID — no cross-user data leakage.
- Role-based access uses `middleware/roles` — do not implement ad-hoc role checks in controllers.

### Contract-aware implementation
- API endpoints have documented contracts in `docs/api/`.
- Changes to request/response shapes, status codes, or error formats are contract changes.
- Contract changes require updating `docs/api/` and may require frontend coordination.
- Do not silently add or remove fields from responses — name the contract change explicitly.

### Search/stats/export/import behavior
- Search logic (`SearchTodos`, `AdvancedSearch`) should maintain consistent filter semantics.
- Statistics logic (`GetStatistics`) should maintain consistent aggregation behavior.
- Export/import logic should preserve data shape fidelity.
- Changes to these behaviors require careful contract review.

## Lifeline-specific backend context

### Known structural debt
- `infra/` holds data-source config and TypeORM entities; `infrastructure/` holds repositories — this split is confusing but is the current reality. Do not introduce a third location.
- `controllers/` has only `todoController.js` and `tagController.js` — other routes likely handle inline logic. New work should use the controller pattern.
- `validators/` has a single `index.js` — validation should be more modular but expansion should follow the middleware pattern.
- Domain layer is thin (4 files) — domain objects for UserProfile, UserSettings, TodoTag do not exist as standalone domain files.

### Backend layer map
```
routes/          → HTTP binding (path, method, middleware, controller)
controllers/     → Orchestration (parse, call use-case, respond)
middleware/      → Cross-cutting (auth, validation, logging, errors)
application/     → Use-cases and services (business logic)
domain/          → Domain entities and interfaces
infrastructure/  → TypeORM repositories
infra/db/        → Data-source config and entity definitions
validators/      → Request validation schemas
```

## Anti-patterns to flag

- Business logic in route files
- Controllers that directly query the database
- Use-cases that parse HTTP request objects
- Raw ORM queries exposed outside repository boundaries
- Missing error handling on async operations
- Silent error suppression (catch without logging or response)
- Cross-user data access without user ID filtering
- Ad-hoc auth checks instead of middleware-based auth
- Undocumented contract changes (silently added/removed response fields)
- God controllers with >100 lines doing multiple operations

## Documentation impact

Backend changes that alter API contracts should trigger `docs/api/` updates. Changes to service boundaries or the backend layer should trigger `docs/backend/` review. Schema, entity, or repository changes may trigger `docs/data-model/` review. Deployment-affecting changes trigger CI/CD governance.
