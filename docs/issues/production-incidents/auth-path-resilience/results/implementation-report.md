# Auth-Path Resilience Hardening — Implementation Report

## Initiative

Harden the Lifeline production auth middleware to prevent the class of outage identified in the [2025-03-11 production incident investigation](../../mcp-server/step-09-everyday-task-fluency/results/2025-03-11-production-unresponsive-incident-investigation.md).

## Root cause addressed

The `express-oauth2-jwt-bearer` + `jose` auth middleware can block indefinitely when:
1. The JWKS cache expires (10-minute TTL in jose)
2. A fresh OIDC discovery + JWKS fetch is triggered on the next authenticated request
3. DNS resolution hangs in Docker's multi-hop chain (container 127.0.0.11 → Docker embedded → host systemd-resolved 127.0.0.53 → upstream)
4. jose's 5s `socket.setTimeout()` does not cover DNS resolution time — only idle socket time after the socket already exists

Meanwhile, the existing `/api/health/db` health check bypasses auth middleware entirely, so health checks continue to pass even when all authenticated traffic is blocked.

## Changes delivered

### 1. Auth middleware timeout guard (`backend/src/middleware/auth0.js`)

Wrapped `express-oauth2-jwt-bearer`'s `auth()` handler with a full-lifecycle `setTimeout` guard:
- Default timeout: 10 seconds (configurable via `AUTH_TIMEOUT_MS` env var)
- Covers DNS + TCP + TLS + HTTP response — not just socket idle
- On timeout: logs error with request path/method/elapsed, returns 503, records failure in readiness state
- On success: records success, resets consecutive failure counter
- On slow success (>2s): logs warning for observability

### 2. JWKS pre-warm at startup (`backend/scripts/start-container.js`)

On server startup, the production entry point calls `warmUpAuth()`:
- Fetches Auth0 OIDC discovery document with timeout
- Fetches the JWKS endpoint with timeout
- Populates the jose cache before the first authenticated request arrives
- Failure is non-fatal: the server starts anyway and warms on first request

Note: `warmUpAuth()` is called from `start-container.js` (the production entry point), not from the `require.main === module` block in `index.js`, because production uses `start-container.js` which requires `index.js` as a module.

### 3. Auth-aware readiness endpoint (`/api/health/ready`)

Added at `backend/src/index.js` before the auth middleware registration:
- Returns 200 when both DB (`SELECT 1`) and auth readiness are healthy
- Returns 503 with diagnostic detail when degraded
- Auth readiness is "degraded" when JWKS hasn't been warmed or 3+ consecutive auth failures occur
- Does not require authentication itself (pre-auth endpoint)

### 4. Container memory limits (`compose.production.yaml`)

| Container | mem_limit | memswap_limit |
|-----------|-----------|---------------|
| lifeline-postgres | 2 GB | 2 GB |
| lifeline-app | 2 GB | 2 GB |
| lifeline-mcp | 512 MB | 512 MB |

### 5. Explicit DNS resolvers (`compose.production.yaml`)

`lifeline-app` and `lifeline-mcp` containers configured with:
```yaml
dns:
  - 1.1.1.1
  - 8.8.4.4
```

Bypasses the Docker embedded DNS multi-hop chain that likely contributed to the incident.

### 6. Deploy verification (`deploy/scripts/apply-release.sh`)

Added `wait_for_url "${INTERNAL_READY_URL}" 120` to the deploy script, verifying `/api/health/ready` returns 200 before the deployment is considered successful.

### 7. Operations documentation updates

- `docs/operations/deployment-verification-and-smoke-checks.md`: Added `/api/health/ready` to endpoint listing, primary runtime health endpoints section, and practical verification checklist
- `docs/operations/production-runtime-and-rollback.md`: Added new "Auth-path resilience and runtime hardening" section documenting all hardening measures

### 8. Tests (`backend/test/middleware/auth0.test.js`)

3 tests covering:
- AUTH_DISABLED=1 bypass behavior
- Module shape verification (exports checkJwt, warmUpAuth, getAuthReadiness)
- Readiness state tracking (initial state before warm-up)

## Files changed

| File | Change |
|------|--------|
| `backend/src/middleware/auth0.js` | Rewritten: timeout guard, readiness tracking, JWKS pre-warm |
| `backend/src/index.js` | Added `/api/health/ready` endpoint + `warmUpAuth` import |
| `backend/scripts/start-container.js` | Added `warmUpAuth()` call in listen callback |
| `compose.production.yaml` | Memory limits + DNS config for all containers |
| `deploy/scripts/apply-release.sh` | Added readiness endpoint to deploy verification |
| `docs/operations/deployment-verification-and-smoke-checks.md` | Updated with readiness endpoint |
| `docs/operations/production-runtime-and-rollback.md` | New hardening section |
| `backend/test/middleware/auth0.test.js` | New test file |

## Production validation

Deployed and validated on production VPS (187.124.7.88):

| Check | Result |
|-------|--------|
| `/api/health/db` | `{"db": "ok"}` |
| `/api/health/ready` | 200 — `ready: true`, `jwksWarmedUp: true`, `degraded: false` |
| JWKS pre-warm logs | Discovery + JWKS fetched, "pre-warm complete" |
| lifeline-postgres memory limit | 20 MiB / 2 GiB |
| lifeline-app memory limit | 46 MiB / 2 GiB |
| lifeline-mcp memory limit | 29 MiB / 512 MiB |
| lifeline-app DNS | `[1.1.1.1, 8.8.4.4]` |
| lifeline-mcp DNS | `[1.1.1.1, 8.8.4.4]` |
| Public `/api/health/db` | `{"db": "ok"}` |

## Deployment notes

First deploy attempt failed because `warmUpAuth()` was only called in the `require.main === module` block in `index.js`. Production uses `start-container.js` as the entry point, which requires `index.js` as a module — so the `require.main` guard never fires. Fixed by adding `warmUpAuth()` to `start-container.js`'s listen callback. Second deploy succeeded.
