# Documentation Ownership Matrix

| Change surface | Primary docs owner | Secondary docs owner |
| --- | --- | --- |
| Product rules and user concepts | `docs/product/` | `docs/features/` |
| Feature inventory or scope summary | `docs/features/` | `docs/product/`, `docs/frontend/` |
| Frontend screens, flows, layout, state | `docs/frontend/` | `docs/features/`, `docs/product/` |
| Backend services, use cases, middleware | `docs/backend/` | `docs/product/`, `docs/api/` |
| Endpoint contracts and auth requirements | `docs/api/` | `docs/backend/` |
| Entities, schema, migrations, identity mapping | `docs/data-model/` | `docs/architecture/` |
| System boundaries and runtime topology | `docs/architecture/` | `docs/adr/` |
| Setup, deployment, CI/CD, runbooks | `docs/operations/` | `docs/architecture/` |
| Durable design decisions | `docs/adr/` | `docs/architecture/` |
| Temporary phase/workstream/discovery outputs | `docs/issues/<initiative>/<step>/<artifact-class>/` | `docs/issues/report-history/unscoped/` when the work cannot be scoped confidently |
| Singular explicitly retained final handoff report | `docs/issues/<initiative>/<step>/final/` | repo root only when explicitly approved as a permanent top-level artifact |
