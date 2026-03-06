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
- internal database health URL at `http://127.0.0.1:3020/api/health/db`
- public database health URL at `https://lifeline.a2z-us.com/api/health/db`
- public homepage availability at `https://lifeline.a2z-us.com/`
- loopback-only publication of container port `3000` as `127.0.0.1:3020`

If any of those checks fail, the deployment is treated as failed.

## Primary runtime health endpoints

### `/api/health/db`

This is the main application/database liveness check used in container healthchecks and deploy verification.

### `/api/health/db/schema`

This provides a deeper schema-oriented health/debug surface.

### `/api/public/info`

This exposes public environment/runtime information useful for low-risk verification.

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

## Practical verification checklist

After a production deployment, the minimum useful checks are:

1. confirm the GitHub Actions deploy run finished successfully
2. confirm `/api/health/db` is healthy publicly
3. confirm `/` loads successfully
4. confirm the loopback-only binding is still enforced
5. review app and database container status if anything looks wrong

## Failure diagnostics currently captured

When deployment fails, the workflow or deploy helper captures:

- current release symlink state
- `docker ps -a`
- recent `lifeline-app` logs
- recent `lifeline-postgres` logs

## Related canonical documents

- [DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)
- [production-runtime-and-rollback.md](production-runtime-and-rollback.md)
- [local-development-and-runtime-setup.md](local-development-and-runtime-setup.md)
