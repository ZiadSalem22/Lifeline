# Non-Root Artifact Routing

Use this instruction block in discovery, planning, implementation, validation, and cleanup prompts when work may produce reports or execution artifacts.

Requirements:
- do not create root-level report files
- canonical docs go directly to their final `docs/<domain>/...` locations
- non-canonical artifacts go under `docs/issues/<initiative>/<step>/<artifact-class>/`
- use `discovery/`, `planning/`, `implementation/`, `results/`, or `final/` as the artifact-class folder
- decide the exact artifact path before writing output
- if a prompt does not provide a valid non-root target, derive `initiative` and `step` from the work and use the scoped pattern
- only if the work cannot be scoped confidently, use `docs/issues/report-history/unscoped/`
- treat repo root as a home for intentional top-level project files only
- allow a root-level artifact only when it is explicitly approved as a permanent top-level deliverable
