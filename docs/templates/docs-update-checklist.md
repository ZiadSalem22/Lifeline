# Documentation Update Checklist

- Identify impacted documentation domains.
- Update existing docs before creating new duplicates.
- Keep product, frontend, backend, API, data-model, architecture, and operations docs separate.
- Classify any report or execution artifact as temporary or final before creating it.
- Decide the exact non-root path for any non-canonical artifact before writing it.
- Default temporary reports, plans, checkpoint outputs, workstream notes, and validation outputs away from repo root.
- Update the ownership matrix or backlog if the change reveals a new documentation gap.
- Add or update an ADR if the change is a durable design decision.
- Route historical implementation artifacts to a scoped `docs/issues/<initiative>/<step>/<artifact-class>/` path whenever possible.
- Use `docs/issues/report-history/unscoped/` only when the work cannot be scoped confidently.
- Keep root-level reporting to a singular explicitly approved permanent top-level artifact only when justified.
