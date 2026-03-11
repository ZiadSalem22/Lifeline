# Auth-Path Resilience: Discovery & Implementation Plan

**Date**: 2025-03-11  
**Scope**: Auth timeout hardening, reliability improvement, readiness truthfulness, runtime safeguards

---

## Discovery Findings

### 1. Current Auth Path

- `backend/src/middleware/auth0.js` exports `checkJwt` (wrapped in `authDebugWrapper`)
- Uses `express-oauth2-jwt-bearer` v1.7.1 → `jose` v4.15.9
- `auth()` call at module load creates the JWKS fetcher with library defaults:
  - `cacheMaxAge: 600000` (10 min)
  - `timeoutDuration: 5000` (5s socket-level only)
  - `cooldownDuration: 30000` (30s)
- Route registration at `index.js:393`: `app.use('/api', checkJwt, attachCurrentUser)`
- Health endpoints at `index.js:185` (`/api/health/db`) registered BEFORE auth — bypass jwt
- No auth-aware health/readiness signal exists 
- No request-level timeout wraps auth middleware
- JWKS socket timeout does NOT cover DNS resolution hangs (source-verified in jose)

### 2. Current Readiness/Health

- `/api/health/db` — DB liveness via `SELECT 1`; bypasses auth entirely
- `/api/health/db/schema` — deeper schema check; also pre-auth
- `/api/public/info` — version/env info; public
- Docker healthcheck uses `/api/health/db` → passes even when auth middleware is completely hung
- Deploy script checks `/api/health/db` internal + public, `/api/public/info`, MCP `/health`
- No endpoint proves auth middleware can complete

### 3. Current DNS/Network/Runtime

- Container DNS: Docker embedded 127.0.0.11 → host systemd-resolved 127.0.0.53 → upstream
- Docker warns: "No non-localhost DNS nameservers..."
- compose.production.yaml: no container memory limits
- VPS: no swap (15Gi RAM, 0B swap)
- Node.js: no `--max-old-space-size`

### 4. Current Resource Protections

- None. All containers share full host memory.

---

## Implementation Decision

### What we ARE changing

| # | Change | Justification |
|---|--------|---------------|
| 1 | **Auth timeout guard** — wrap checkJwt with a 10s request-level timeout | Prevents indefinite blocking; covers DNS+socket+TLS |
| 2 | **JWKS pre-warm on startup** — eagerly fetch JWKS at app start | Reduces first-request-after-cold-start/idle risk |
| 3 | **Auth-aware readiness endpoint** — `/api/health/ready` | Proves auth middleware can run; Docker healthcheck can optionally use it |
| 4 | **Auth timeout diagnostics** — structured logging on timeout/failure | Makes future stalls diagnosable |
| 5 | **Lifeline container memory limits** — compose.production.yaml | Adds resource guardrails for lifeline-app, lifeline-mcp, lifeline-postgres |
| 6 | **Explicit Docker DNS** — compose.production.yaml dns config | Bypasses multi-hop Docker→systemd-resolved chain |
| 7 | **Updated operations docs** — smoke check and runtime docs | Reflects new health endpoints and hardening |

### What we are NOT changing

- Auth0 product flow / user auth flow (out of scope)
- MCP feature logic (out of scope)
- Frontend code (out of scope)
- VPS swap (operator action; will document recommendation, not automate)
- Background JWKS keep-warm timer (over-engineering for current usage pattern)
- Global/non-Lifeline container limits (explicitly excluded)

### Why this set is sufficient

1. The timeout guard directly prevents the incident scenario (blast-radius reduction)
2. Pre-warm reduces probability of the stall (reliability improvement)
3. Readiness endpoint makes auth stalls visible (operational truthfulness)
4. DNS config addresses the likely contributing factor (underlying reliability)
5. Memory limits add missing production guardrails (runtime safety)
6. Together these address both symptom AND cause
