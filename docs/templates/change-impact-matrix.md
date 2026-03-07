# Change Impact Matrix

| Change type | Primary docs | Secondary docs |
| --- | --- | --- |
| frontend UI or flow change | `docs/frontend/` | `docs/features/`, `docs/product/` |
| backend business logic change | `docs/backend/` | `docs/product/`, `docs/api/` |
| endpoint contract change | `docs/api/` | `docs/backend/` |
| schema or entity change | `docs/data-model/` | `docs/architecture/` |
| deployment or runtime change | `docs/operations/` | `docs/architecture/` |
| durable design decision | `docs/adr/` | `docs/architecture/` |
| temporary phase/workstream/discovery artifact | `docs/issues/<initiative>/<step>/<artifact-class>/` | `docs/issues/report-history/unscoped/` when the work cannot be scoped confidently |
| singular explicitly retained final handoff report | `docs/issues/<initiative>/<step>/final/` | repo root only when explicitly approved as a permanent top-level artifact |
