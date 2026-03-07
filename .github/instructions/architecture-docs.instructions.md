# Architecture Documentation Instructions

Use this file for work that writes or updates `docs/architecture/` or `docs/adr/`.

## Source of truth

- system structure across `client/`, `backend/`, deployment files, and docs
- integration boundaries
- current production deployment model

## Cover

- system boundaries and responsibilities
- runtime topology
- integration points
- cross-cutting concerns such as auth and persistence
- why the system is structured the way it is

## ADR trigger

Create or update an ADR when a durable design decision changes deployment, auth, persistence, domain boundaries, or documentation governance.
