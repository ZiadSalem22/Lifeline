# System Overview

## Purpose

This document describes the current high-level structure of Lifeline as a full-stack system.

## Canonical sources used for this document

- [client/src/app/App.jsx](../../client/src/app/App.jsx)
- [client/src/providers](../../client/src/providers)
- [backend/src/index.js](../../backend/src/index.js)
- [backend/src/application](../../backend/src/application)
- [backend/src/infrastructure](../../backend/src/infrastructure)
- [backend/src/infra/db](../../backend/src/infra/db)
- [Dockerfile](../../Dockerfile)
- [compose.production.yaml](../../compose.production.yaml)
- [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh)
- [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml)

## Current system shape

Lifeline is a full-stack application with four primary structural layers:

1. a React/Vite frontend in [client](../../client)
2. an Express backend in [backend](../../backend)
3. a PostgreSQL persistence layer reached through TypeORM
4. a containerized deployment/runtime layer used for production and supported local compose runs

## Frontend responsibility

The frontend is responsible for:

- route and page composition
- authenticated-mode and guest-mode UI flows
- day-oriented task interaction
- local guest-mode persistence and API abstraction
- onboarding, profile, search, statistics, and settings user experiences

## Backend responsibility

The backend is responsible for:

- authenticated API endpoints
- current-user resolution from JWT claims
- product and persistence validation
- todo, tag, profile, settings, export, import, and stats operations
- Swagger exposure and health endpoints
- serving built frontend assets in containerized/runtime deployments

## Persistence responsibility

The database layer is responsible for persisting authenticated-mode state for:

- users
- profiles
- settings
- todos
- tags
- todo-tag relationships

Guest-mode data is intentionally outside this server-side persistence boundary.

## Current deployment responsibility split

Production deployment responsibility is split across:

- GitHub Actions for release packaging and remote orchestration
- the VPS for release storage, Docker Compose execution, and Nginx reverse proxying
- Docker for application/runtime packaging
- PostgreSQL for durable authenticated-mode data storage

## Main integration seams

The main integration seams are:

- frontend to backend through `/api` HTTP calls
- backend to PostgreSQL through TypeORM repositories and migrations
- GitHub Actions to VPS through SSH/SCP
- Nginx to the app container through a private `127.0.0.1:3020 -> 3000` proxy path

## Cross-cutting concerns

Cross-cutting concerns that shape the architecture include:

- Auth0-backed authenticated mode
- guest-mode fallback in the frontend
- per-user ownership boundaries across todos, tags, profile, and settings data
- build-time bundling of the frontend into the runtime image
- container-start migration execution before app start

## Why the system is currently structured this way

The current structure supports:

- one repo for frontend, backend, deployment automation, and canonical docs
- one production app container that serves both API responses and the built SPA
- a separate Postgres container for durable authenticated data
- a deploy-branch production model with release directories and rollback support
- a clean domain split between product/frontend/backend/API/data-model/architecture/operations documentation

## Related canonical documents

- [runtime-topology.md](runtime-topology.md)
- [frontend-backend-data-boundaries.md](frontend-backend-data-boundaries.md)
- [../frontend/routes-and-pages.md](../frontend/routes-and-pages.md)
- [../backend/runtime-composition.md](../backend/runtime-composition.md)
- [../operations/production-runtime-and-rollback.md](../operations/production-runtime-and-rollback.md)
