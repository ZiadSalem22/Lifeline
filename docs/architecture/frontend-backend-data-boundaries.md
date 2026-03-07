# Frontend, Backend, and Data Boundaries

## Purpose

This document explains the main structural boundaries between the frontend, backend, and persistence layers.

## Canonical sources used for this document

- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/providers](../../client/src/providers)
- [client/src/utils/guestApi.js](../../client/src/utils/guestApi.js)
- [client/src/hooks/useGuestStorage.js](../../client/src/hooks/useGuestStorage.js)
- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/middleware](../../backend/src/middleware)
- [backend/src/application](../../backend/src/application)
- [backend/src/infrastructure](../../backend/src/infrastructure)
- [backend/src/infra/db](../../backend/src/infra/db)

## Frontend boundary

The frontend owns:

- page routing and layout composition
- user interaction state
- guest-mode local storage and guest-mode API adaptation
- authenticated API invocation
- route protection and onboarding redirects in the UI

The frontend does not directly manage relational persistence.

## Backend boundary

The backend owns:

- authenticated route handling
- request validation
- current-user attachment
- role and paid-tier enforcement
- orchestration of use cases and repositories
- translation between HTTP payloads and persisted rows

The backend is the only server-side layer that should define the HTTP contract and persistence writes for authenticated mode.

## Persistence boundary

The database layer owns durable authenticated data, but only through backend-managed access.

Current live persistence is limited to:

- users
- profiles
- settings
- todos
- tags
- todo-tags

The frontend never talks to PostgreSQL directly.

## Guest-mode boundary

A major current architecture seam is the split between:

- `guest mode`, which is browser-local and frontend-managed
- `authenticated mode`, which is backend- and Postgres-backed

This means some feature flows have dual implementations:

- local/guest behavior in the frontend
- server-backed/authenticated behavior in the backend

## Auth boundary

The auth boundary sits at the backend `/api` middleware chain.

Current shape:

- the frontend acquires identity context and tokens
- the backend validates JWTs when required
- the backend upserts or resolves the local user record
- downstream route handlers consume `req.currentUser`

## Data-shape boundary

The current data-shape model is split as follows:

### Shared conceptual shapes

Frontend and backend both work with the same broad concepts:

- todo
- tag
- profile
- settings
- recurrence

### Backend-authoritative persisted shapes

The backend is authoritative for:

- exact persisted row structure
- database constraints
- ownership rules
- canonical archive behavior
- import/export persistence mapping

### Frontend-authoritative presentation shapes

The frontend is authoritative for:

- view state
- filter state
- navigation state
- responsive layout state
- guest-mode storage structures

## Static asset boundary in deployed runtime

In containerized and production runtime, the backend also serves the built frontend assets.

That does not collapse the code boundary: it only means the backend process is also the static-file host for the compiled frontend.

## Boundary summary

| Boundary | Owned by | Notes |
| --- | --- | --- |
| routes, pages, layout | frontend | user-visible composition |
| HTTP contracts and auth enforcement | backend | `/api` surface |
| durable authenticated persistence | backend + Postgres | through repositories |
| guest-mode local persistence | frontend | browser-local only |
| production traffic entrypoint | Nginx + backend | Nginx proxies to app container |

## Related canonical documents

- [system-overview.md](system-overview.md)
- [runtime-topology.md](runtime-topology.md)
- [../product/identity-and-access-modes.md](../product/identity-and-access-modes.md)
- [../frontend/layout-navigation-and-responsive-behavior.md](../frontend/layout-navigation-and-responsive-behavior.md)
- [../backend/auth-user-attachment-and-rbac.md](../backend/auth-user-attachment-and-rbac.md)
- [../data-model/overview-and-current-source-of-truth.md](../data-model/overview-and-current-source-of-truth.md)
