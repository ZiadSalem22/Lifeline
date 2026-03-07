# Skill: backend-engineering-governance

## Purpose

Enforce consistent backend layering, service boundaries, validation discipline, error handling, auth safety, and engineering rigor across Lifeline's Node.js/Express backend.

This skill builds on top of code-quality-governance and adds backend-specific rules for the Express route → controller → use-case → domain → repository layered architecture.

## Scope

Use this skill to assess and guide:
- route/controller thinness
- service/use-case boundary clarity
- repository encapsulation
- validation placement (middleware vs use-case vs domain)
- error handling discipline
- auth and current-user safety
- contract-aware implementation (API contracts)
- search/stats/export/import behavior consistency
- backend modularity and layer discipline
- dependency direction compliance (inner layers never import outer)
- security surface (secrets, input sanitization, error exposure, auth coverage)
- performance surface (N+1, pagination, indexes, event loop blocking)
- reliability surface (timeouts, retries, resource cleanup, error handling)

## When to use it

Use this skill when:
- creating or modifying Express routes, controllers, or middleware
- creating or modifying use-cases/services in `application/`
- creating or modifying repositories in `infrastructure/`
- reviewing backend pull requests
- evaluating whether logic is placed in the correct layer
- assessing error handling completeness
- reviewing auth and user-scoping safety

## Sources of truth

Consult first:
- `.github/instructions/backend-engineering-governance.instructions.md`
- `.github/skills/code-quality-governance.md`
- `.github/copilot-instructions.md`

Then consult the implementation:
- `backend/src/routes/` for route patterns
- `backend/src/controllers/` for controller patterns
- `backend/src/application/` for use-case patterns
- `backend/src/domain/` for domain entities and interfaces
- `backend/src/infrastructure/` for repository patterns
- `backend/src/infra/db/` for data-source and entity definitions
- `backend/src/middleware/` for cross-cutting middleware
- `backend/src/validators/` for validation schemas

## What this skill must know

### Lifeline backend architecture
- Node.js with Express (plain JavaScript, no TypeScript)
- Layered architecture: routes → controllers → application/use-cases → domain → infrastructure/repositories
- TypeORM with EntitySchema pattern (not decorator-based)
- PostgreSQL as the database
- Auth0 for authentication via middleware
- Current user attached to request by `attachCurrentUser` middleware

### Layer responsibilities
- **Routes** (`routes/`): HTTP binding only — path, method, middleware chain, controller delegation
- **Controllers** (`controllers/`): Thin orchestration — parse request, call use-case, format response
- **Middleware** (`middleware/`): Cross-cutting — auth, validation, logging, rate limiting, errors
- **Application** (`application/`): Business logic — one use-case per business operation
- **Domain** (`domain/`): Domain entities, interfaces, domain logic
- **Infrastructure** (`infrastructure/`): TypeORM repositories — all data access encapsulation
- **Infra/db** (`infra/db/`): Data-source config, entity definitions, default seed data

### Known structural debt
- `infra/` vs `infrastructure/` split is confusing — do not add a third location
- Only 2 controllers exist (todo, tag) — other routes have inline logic
- Domain layer is thin — missing domain objects for some entities
- Validators are centralized in one file — should be more modular over time

### Thickness thresholds (guidance)
- Route files: binding only, no logic beyond middleware chain
- Controllers: ≤30 lines per method
- Use-cases: ≤100 lines; extract sub-operations if larger
- Repositories: any size but with clean interfaces

### Dependency direction rules
Dependencies must flow inward:
```
routes → controllers → application → domain ← infrastructure
```
- Inner layers must never import outer layers
- A use-case must never import a route or controller
- A domain entity must never import a repository
- Infrastructure (repositories) depends on domain interfaces, not application or controllers
- Violations are architectural regressions — treat as HIGH severity

### Security checklist
- No hardcoded secrets, API keys, or tokens in source files
- No internal error details (stack traces, SQL errors) in API responses
- All user input sanitized and validated before use
- All user-scoped queries filtered by authenticated user ID
- Sensitive endpoints rate-limited (auth, password reset, export)
- Security events logged without sensitive data

### Performance checklist
- No N+1 query patterns (database calls inside loops)
- Indexes exist for columns used in WHERE, JOIN, ORDER BY on large tables
- All list endpoints paginated — no unbounded result sets
- No event-loop-blocking synchronous computation
- Timeouts set on external HTTP calls and database queries

### Reliability checklist
- All I/O errors handled explicitly
- Timeouts on external calls to prevent hanging
- Retry logic for transient failures where appropriate
- Resources closed in finally blocks or teardown
- Critical endpoint response times monitored

### Severity taxonomy
| Severity | Meaning |
|----------|----------|
| CRITICAL | Security vulnerability, data loss, or production outage risk |
| HIGH | Dependency direction violation, missing error handling, or N+1 query |
| MEDIUM | Missing validation, weak logging, or layer boundary blur |
| LOW | Style preference, naming, or minor documentation gap |

## Practical checklist

When reviewing backend code:
1. Is business logic in the correct layer (use-case, not route or controller)?
2. Are controllers thin — just orchestrating between HTTP and use-cases?
3. Do repositories encapsulate all data access (no raw ORM outside)?
4. Is validation placed correctly (middleware for request shape, use-case for business rules)?
5. Are errors handled properly (no silent catch, structured error responses)?
6. Is the current user identity used correctly (from middleware, not re-derived)?
7. Are user-scoped queries properly filtered by user ID?
8. Are API contract changes explicit and documented?
9. Is the change maintaining consistent search/stats/export behavior?
10. Does the code follow the existing layer pattern?
11. Are dependency direction rules respected (inner layers never import outer)?
12. Are there security concerns (hardcoded secrets, exposed errors, unsanitized input, auth gaps)?
13. Are there performance concerns (N+1 queries, unbounded lists, missing pagination, blocking ops)?
14. Are there reliability concerns (missing timeouts, missing error handling, resource leaks)?
15. For multi-file changes: are all changed layers internally consistent?

## Cross-family integration

### Triggers documentation governance when
- API contracts change (request/response shapes, status codes)
- Service boundaries or backend layer structure changes
- Backend behavior changes affect documented product rules

### Triggers data-model governance when
- Entity or repository changes affect schema or migration surfaces
- New domain objects or repository methods are introduced

### Triggers CI/CD governance when
- Backend changes affect deployment, Docker, or Compose configuration

### Triggers code-quality governance when
- General readability, naming, or complexity issues outside backend-specific rules

### Triggers refactor governance when
- Backend restructuring is needed beyond the current file or layer
- Structural debt (e.g., `infra/` vs `infrastructure/`) should be addressed

### Referenced by
- refactor-governance (uses backend rules as safety constraints during backend refactors)
- data-model-governance (references layer boundaries for persistence changes)

## What this skill must not do

- Override frontend governance for shared utilities
- Override data-model governance for schema/migration rules
- Mandate TypeScript migration as part of individual backend work
- Recommend restructuring the `infra/` vs `infrastructure/` split during normal feature work (that is a refactor initiative)
- Treat controller thinness as an absolute rule when pragmatic exceptions are justified
- Conflate code movement with quality improvement
