# Step-05 plan: CI/CD stabilization and deploy reliability hardening

Date: 2026-03-07

## Objective

Make `Apply release on VPS` deterministic for `lifeline-mcp` by codifying the already-proven MCP-only recovery path, while preserving the current production topology and operator contract.

## Bounded plan

1. Refactor the release helper into an explicit staged startup flow.
2. Start PostgreSQL and the main app first.
3. Wait for database and app health before touching MCP.
4. Recreate only `lifeline-mcp` with `--no-deps --force-recreate`.
5. Add MCP-specific diagnostics for container state, port publication, and host listeners.
6. Replace the generic MCP loopback wait with a helper that emits targeted evidence on timeout.
7. Update only the canonical operations docs affected by the deploy behavior change.
8. Validate the edited files with editor diagnostics and Bash syntax checks.
9. Add a repository guardrail so shell scripts stay LF-normalized.

## Non-goals

- redesigning the release model
- changing the public MCP surface
- moving secrets into the repo
- changing Nginx topology
- changing app or database contracts

## Acceptance criteria

- `deploy/scripts/apply-release.sh` performs staged startup
- MCP recreation is explicit and deterministic
- MCP loopback timeout output includes focused diagnostics
- impacted operations docs match the new behavior
- `bash -n deploy/scripts/apply-release.sh` passes
- no new editor errors are introduced in changed files
