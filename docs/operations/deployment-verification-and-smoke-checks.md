# Deployment Verification and Smoke Checks

## Purpose

This document captures the current verification surfaces and smoke-check methods used after local runtime setup and production deployment.

## Canonical sources used for this document

- [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh)
- [.github/workflows/deploy-production.yml](../../.github/workflows/deploy-production.yml)
- [backend/scripts/verify-local-postgres-runtime.js](../../backend/scripts/verify-local-postgres-runtime.js)
- [backend/scripts/verify-compose-runtime.js](../../backend/scripts/verify-compose-runtime.js)
- [client/scripts/ui-smoke.js](../../client/scripts/ui-smoke.js)
- [backend/src/index.js](../../backend/src/index.js)

## Production verification built into deployment

The production deploy helper verifies:

- Postgres container health
- app container health
- MCP container health
- internal database health URL at `http://127.0.0.1:3020/api/health/db`
- public database health URL at `https://lifeline.a2z-us.com/api/health/db`
- public app info availability at `https://lifeline.a2z-us.com/api/public/info`
- internal MCP health URL at `http://127.0.0.1:3030/health`
- public MCP health URL at `https://mcp.lifeline.a2z-us.com/health`
- MCP-to-backend internal adapter reachability from inside the `lifeline-mcp` container
- loopback-only publication of container port `3000` as `127.0.0.1:3020`
- loopback-only publication of the MCP port as `127.0.0.1:3030`

If any of those checks fail, the deployment is treated as failed.

## Primary runtime health endpoints

### `/api/health/db`

This is the main application/database liveness check used in container healthchecks and deploy verification.

### `/api/health/db/schema`

This provides a deeper schema-oriented health/debug surface.

### `/api/public/info`

This exposes public environment/runtime information useful for low-risk verification.

### `/health` on `lifeline-mcp`

This is the MCP service liveness check used for container health and public/private smoke checks.

It confirms that the MCP HTTP edge is listening, but it does not replace backend container health verification.

### Internal adapter path check

The deploy helper also performs an in-container fetch from `lifeline-mcp` to `http://lifeline-app:3000/internal/mcp/health` using the shared-secret header.

That verifies the Docker-network path and shared-secret runtime wiring, not just MCP liveness.

## Local verification scripts

### `npm run verify:local`

The local Postgres verification script checks representative authenticated runtime flows directly against the Express app, including:

- current-user loading
- profile persistence
- settings persistence
- tag create/list
- todo create/update/toggle/list
- statistics
- export
- disabled notifications behavior

### `npm run verify:compose`

The compose verification script checks:

- the frontend shell on `/`
- SPA fallback routing on `/statistics`
- database health
- representative authenticated CRUD flows via HTTP

## UI smoke support

[client/scripts/ui-smoke.js](../../client/scripts/ui-smoke.js) provides a browser-level smoke test that opens the UI and looks for visible task-number behavior after task creation.

It is a useful adjunct check when validating the integrated UI surface rather than only API/runtime behavior.

## MCP client validation support

The repo now includes two bounded MCP operator/dev utilities:

- [backend/src/scripts/issue-mcp-api-key.js](../../backend/src/scripts/issue-mcp-api-key.js) for one-time API-key issuance to a specific Lifeline user
- [services/lifeline-mcp/scripts/mcp-client-cli.js](../../services/lifeline-mcp/scripts/mcp-client-cli.js) for official-SDK tool discovery, direct tool calls, and repeatable read/write smoke checks through the real MCP service path

Use [lifeline-mcp-first-cutover-runbook.md](lifeline-mcp-first-cutover-runbook.md) for the concrete first-release sequence.

For production validation, use a dedicated Lifeline smoke user and short-lived MCP API keys issued specifically for the validation window. Do not reuse a normal user's long-lived key for deploy smoke.

## Practical verification checklist

After a production deployment, the minimum useful checks are:

1. confirm the GitHub Actions deploy run finished successfully
2. confirm `/api/health/db` is healthy publicly
3. confirm `/api/public/info` responds successfully publicly
4. confirm `https://mcp.lifeline.a2z-us.com/health` is healthy publicly
5. confirm the loopback-only bindings are still enforced for both app and MCP services
6. issue a short-lived MCP API key for the dedicated smoke user and run `list-tools` plus the bounded MCP smoke flow
7. review app, MCP, and database container status if anything looks wrong

## Failure diagnostics currently captured

When deployment fails, the workflow or deploy helper captures:

- current release symlink state
- `docker ps -a`
- recent `lifeline-app` logs
- recent `lifeline-mcp` logs
- recent `lifeline-postgres` logs

## Related canonical documents

- [DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)
- [production-runtime-and-rollback.md](production-runtime-and-rollback.md)
- [lifeline-mcp-first-cutover-runbook.md](lifeline-mcp-first-cutover-runbook.md)
- [local-development-and-runtime-setup.md](local-development-and-runtime-setup.md)
