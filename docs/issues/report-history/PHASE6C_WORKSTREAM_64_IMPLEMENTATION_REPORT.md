# Phase 6C Workstream 6C.4 Implementation Report

## 1. Executive Summary

Workstream 6C.4 — Backend Runtime and API Contract Canon — is complete in this pass.

This workstream documented the backend runtime composition, auth/current-user/RBAC behavior, todo and auxiliary service layers, and the real API contract grouped by endpoint family. It also captured the current notifications-disabled state so older docs cannot continue implying live notification support.

## 2. Workstream Scope

This pass executed the planned backend/API documentation workstream after Workstream 6C.3 was closed:

- document backend runtime composition
- document auth, current-user attachment, and RBAC
- document todo services and use cases
- document tag/search/stats/export-import service behavior
- document API endpoint groups for public/health, auth/profile/settings, todos, tags, stats, and export/import
- document validation, auth, and error behavior
- keep backend docs separate from API contract docs

Governance inputs actively followed during this workstream:

- [.github/instructions/backend-docs.instructions.md](.github/instructions/backend-docs.instructions.md)
- [.github/instructions/api-docs.instructions.md](.github/instructions/api-docs.instructions.md)
- [.github/instructions/docs-governance.instructions.md](.github/instructions/docs-governance.instructions.md)
- documentation-governance skill, agent, team, and workflow
- [docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md](docs/reference/PHASE6C_SOURCE_OF_TRUTH_MAP.md)
- [docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md](docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md)

## 3. Todo Tracking and Completion Status

| Todo | Status | Notes |
| --- | --- | --- |
| Map backend runtime composition and write [docs/backend/runtime-composition.md](docs/backend/runtime-composition.md) | Completed | Verified initialization sequence, repository/use-case wiring, `/api` auth chain, rate limiting, Swagger serving, and frontend static serving |
| Write [docs/backend/auth-user-attachment-and-rbac.md](docs/backend/auth-user-attachment-and-rbac.md) | Completed | Verified `checkJwt`, `attachCurrentUser`, role mapping, `requireAuth`, `requireRole`, `requirePaid`, and auth-error normalization |
| Write [docs/backend/todo-services-and-use-cases.md](docs/backend/todo-services-and-use-cases.md) | Completed | Verified create/update/toggle/delete/archive/recurrence logic and repository-backed task-number behavior |
| Write [docs/backend/tag-search-stats-and-data-transfer-services.md](docs/backend/tag-search-stats-and-data-transfer-services.md) | Completed | Verified tag rules, repository-backed search, statistics aggregation, import/export support, and disabled notifications service state |
| Create API endpoint-group docs for public/health, auth/profile/settings, todos, tags, stats, export/import, and validation/auth/error behavior | Completed | Grounded in current route handlers, middleware, validators, and runtime caveats |
| Explicitly capture notifications-disabled current state | Completed | Documented empty pending list plus `410` notification mutation endpoints |
| Refresh [docs/backend/README.md](docs/backend/README.md) and [docs/api/README.md](docs/api/README.md) | Completed | Indexed the canonical backend and API docs |
| Perform backend/API coherence review | Completed | Preserved separation between backend internals and API contracts while aligning terminology with product/frontend docs |

## 4. Documents Created or Updated

### Created

- [docs/backend/runtime-composition.md](docs/backend/runtime-composition.md)
- [docs/backend/auth-user-attachment-and-rbac.md](docs/backend/auth-user-attachment-and-rbac.md)
- [docs/backend/todo-services-and-use-cases.md](docs/backend/todo-services-and-use-cases.md)
- [docs/backend/tag-search-stats-and-data-transfer-services.md](docs/backend/tag-search-stats-and-data-transfer-services.md)
- [docs/api/public-and-health-endpoints.md](docs/api/public-and-health-endpoints.md)
- [docs/api/auth-profile-and-settings-endpoints.md](docs/api/auth-profile-and-settings-endpoints.md)
- [docs/api/todo-endpoints.md](docs/api/todo-endpoints.md)
- [docs/api/tag-endpoints.md](docs/api/tag-endpoints.md)
- [docs/api/stats-endpoints.md](docs/api/stats-endpoints.md)
- [docs/api/export-import-endpoints.md](docs/api/export-import-endpoints.md)
- [docs/api/validation-auth-and-error-behavior.md](docs/api/validation-auth-and-error-behavior.md)

### Updated

- [docs/backend/README.md](docs/backend/README.md)
- [docs/api/README.md](docs/api/README.md)

## 5. Verification and Coherence Review

Verification outcomes for this workstream:

- backend docs were sourced from runtime code, repositories, middleware, and use cases rather than from the base Swagger file alone
- API docs were organized by endpoint family and kept distinct from backend internal implementation notes
- validation and error behavior was documented as a mixed but understandable current-state contract rather than falsely claiming perfect uniformity
- notifications were documented as disabled current state, preventing stale notification assumptions from re-entering canonical docs
- a current contract caveat was recorded for `/api/tags` because the route handler's anonymous fallback logic exists, but the `/api` auth chain still shapes practical runtime access

Coherence check result:

- backend and API docs are internally consistent
- terminology aligns with Workstream 6C.2 product vocabulary and Workstream 6C.3 frontend usage
- the workstream did not collapse backend internals into API-only docs or vice versa

## 6. Notes / Risks

- [backend/src/index.js](backend/src/index.js) remains a large all-in-one route surface, so future route changes can create documentation drift quickly if not mirrored here.
- Some handler branches still return direct `{ error: ... }` responses while others use the normalized error envelope; the docs capture that reality, but the API surface is not perfectly uniform yet.
- The `GET /api/tags` anonymous/default-tag intent remains partially tensioned with the global `/api` auth chain; future refactors should either formalize or remove that ambiguity.

## 7. Completion Status

**Workstream 6C.4 status:** Complete

**Closed in this pass:** Yes

**Ready for Workstream 6C.5:** Yes
