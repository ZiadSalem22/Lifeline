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
- deterministic MCP host-loopback publication after the targeted post-app `lifeline-mcp` recreate
- internal database health URL at `http://127.0.0.1:3020/api/health/db`
- internal readiness URL at `http://127.0.0.1:3020/api/health/ready` (covers DB + auth-path health)
- public database health URL at `https://lifeline.a2z-us.com/api/health/db`
- public app info availability at `https://lifeline.a2z-us.com/api/public/info`
- internal MCP health URL at `http://127.0.0.1:3030/health`
- public MCP health URL at `https://mcp.lifeline.a2z-us.com/health`
- MCP-to-backend internal adapter reachability from inside the `lifeline-mcp` container
- loopback-only publication of container port `3000` as `127.0.0.1:3020`
- loopback-only publication of the MCP port as `127.0.0.1:3030`

If any of those checks fail, the deployment is treated as failed.

OAuth metadata endpoints are not currently a workflow-gated deploy check. Treat them as required post-deploy validation when OAuth is enabled.

## Primary runtime health endpoints

### `/api/health/db`

This is the main application/database liveness check used in container healthchecks and deploy verification.

### `/api/health/ready`

This is the combined readiness check that covers both database connectivity (`SELECT 1`) and auth-path health (JWKS cache warmed, no consecutive auth failures). It returns 200 when the service is fully ready to handle authenticated traffic and 503 when degraded. This endpoint is registered before the auth middleware and does not require authentication itself.

Use this endpoint to verify that the auth path is healthy after deployment, not just that the server is alive.

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

The MCP CLI supports both:

- `--api-key <issued-key>` for the existing API-key path
- `--access-token <auth0-token>` for the new Auth0/OAuth path

Use [lifeline-mcp-first-cutover-runbook.md](lifeline-mcp-first-cutover-runbook.md) for the concrete first-release sequence.

For production validation, use a dedicated Lifeline smoke user and short-lived MCP API keys issued specifically for the validation window. Do not reuse a normal user's long-lived key for deploy smoke.

## Practical verification checklist

After a production deployment, the minimum useful checks are:

1. confirm the GitHub Actions deploy run finished successfully
2. confirm `/api/health/db` is healthy publicly
3. confirm `/api/health/ready` returns 200 (DB + auth-path both healthy)
4. confirm `/api/public/info` responds successfully publicly
5. confirm `https://mcp.lifeline.a2z-us.com/health` is healthy publicly
6. if OAuth is enabled, confirm both MCP well-known metadata endpoints respond publicly
7. confirm the loopback-only bindings are still enforced for both app and MCP services
8. issue a short-lived MCP API key for the dedicated smoke user and run `list-tools` plus the bounded MCP smoke flow
9. if OAuth is enabled, obtain a valid Auth0 access token and run at least one MCP `list-tools` or `search_tasks` call over the bearer-token path
9. review app, MCP, and database container status if anything looks wrong

### Step-09 tool smoke checks

After deploying the step-09 everyday-task-fluency changes, also verify:

10. `list-tools` shows the new tools: `archive_task`, `restore_task`, `list_tasks`, `find_similar_tasks`, `add_subtask`, `complete_subtask`, `uncomplete_subtask`, `update_subtask`, `remove_subtask`
11. call `search_tasks` — confirms basic backend connectivity
12. call `list_tasks` with window `this_week` — confirms window-query handler and date-filter logic
13. call `find_similar_tasks` with a title — confirms pg_trgm extension is active and the GiST index exists
14. create a test task, `add_subtask`, `complete_subtask`, then `remove_subtask` — confirms subtask CRUD flow
15. `archive_task` the test task, confirm an `update_task` call returns `409`, then `restore_task` — confirms archive lifecycle guards
16. call `search_tasks` and `create_task` → `complete_task` → `uncomplete_task` to verify pre-step-09 tools still work (backward-compat)

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
