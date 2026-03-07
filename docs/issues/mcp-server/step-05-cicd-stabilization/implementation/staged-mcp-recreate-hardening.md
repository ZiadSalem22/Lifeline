# Step-05 implementation: staged MCP recreate hardening

Date: 2026-03-07

## Implemented changes

### Release helper hardening

Updated `deploy/scripts/apply-release.sh` to:

- derive `COMPOSE_FILE_PATH` once and build a reusable compose command array
- add `start_core_services()` for PostgreSQL plus app startup
- add `recreate_mcp_service()` for a targeted `lifeline-mcp` force-recreate
- add `capture_mcp_runtime_state()` for MCP-specific failure evidence
- add `wait_for_mcp_loopback()` so MCP loopback failures report focused diagnostics
- change the release flow to app/database first, then MCP recreate, then runtime verification

### Shell-line-ending guardrail

Added `.gitattributes` with LF enforcement for `*.sh` so Bash validation remains reliable in the Windows workspace.

### Operations doc refresh

Updated the canonical deployment docs to describe the staged deploy behavior and deterministic MCP loopback publication:

- `docs/operations/DEPLOY_BRANCH_CD.md`
- `docs/operations/deployment-verification-and-smoke-checks.md`
- `docs/operations/production-runtime-and-rollback.md`

## Review outcome

The bounded design preserved the deploy-branch model, release-directory topology, VPS-side secret boundary, and private loopback binding contract.

The only blocker found during review was CRLF line endings in `deploy/scripts/apply-release.sh`. That blocker was resolved by normalizing the script to LF and adding the repository guardrail.
