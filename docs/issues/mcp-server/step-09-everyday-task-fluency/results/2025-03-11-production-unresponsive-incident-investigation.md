# Production Incident Investigation: Server Unresponsive Until VPS Reboot

**Date**: 2025-03-11  
**Severity**: Service outage (auth-protected API routes)  
**Duration**: ~4 minutes observed (15:10–15:14 UTC), resolved by VPS reboot  
**Affected**: All authenticated API requests; static assets and health checks unaffected

---

## 1. Incident Summary

The Lifeline backend became unresponsive to all authenticated API requests (`/api/*` routes requiring JWT validation) while health checks (`/api/health/db`) and static frontend assets continued serving normally. The outage occurred approximately 21 minutes after the last successful API response and was resolved only by rebooting the VPS.

## 2. Reconstructed Timeline

| Time (UTC) | Event | Source |
|---|---|---|
| 09:46 | Deploy #1: auth0 connector fix (`6ff2082`) | Docker journal |
| 11:13 | Deploy #2: Step-08 docs (`fb75fea`) | Docker journal |
| 14:39 | Deploy #3: Step-09 merge (`0a063fc`); Docker socket error logged | Docker journal |
| 14:40–14:49 | App fully functional (200s on PATCH todos, POST settings, GET me/tags/todos) | nginx access log |
| 14:49–15:10 | 21-minute idle gap — no user requests | nginx access log |
| 15:10:54 | **First failure**: `GET /api/me → 401 Unauthorized` (fast response) | nginx access log |
| 15:11:07 | `GET /api/todos → 499`, `GET /api/tags → 499` (hung, client cancelled) | nginx access log |
| 15:12:07 | `GET /api/me → 504 Gateway Timeout` (nginx 60s proxy_read_timeout) | nginx error + access log |
| 15:12:24–50 | Static assets serve normally (200/304) while API routes remain hung | nginx access log |
| 15:13:24 | `GET /api/me → 504 Gateway Timeout` (second 60s cycle) | nginx error + access log |
| ~15:14 | VPS rebooted | uptime command |
| 15:14:39 | All services recovered immediately (200s on tags, me, todos) | nginx access log |

## 3. Evidence Reviewed

### A. Deploy & Release Infrastructure
- `compose.production.yaml`: 3 containers (postgres, lifeline-app, lifeline-mcp), all `restart: unless-stopped`, **no memory limits**
- `deploy/scripts/apply-release.sh`: Full deploy with `docker compose up -d --build`, health verification, rollback trap
- `.github/workflows/deploy-production.yml`: GitHub Actions → SSH deploy
- `git log origin/deploy..main`: **empty** — deploy branch is current with main; Step-09 IS deployed

### B. Resource Constraints
- **No container memory limits** in compose.production.yaml
- **No swap** on VPS (`free -h` shows 0B swap)
- No `--max-old-space-size` or Node.js memory flags
- VPS: 15Gi RAM, 193GB disk (5% used)

### C. Docker Daemon Journal (pre-reboot)
- 14:39:13 — Docker socket error: `http2: server: error reading preface from client @: read unix /run/docker.sock->@: read: connection reset by peer`
- 14:39 — Userland proxy error for port 3030 (MCP), containers stopped/recreated as part of deploy
- Post-reboot: Docker daemon restarted with fresh PID (993 vs pre-reboot 9111)

### D. Nginx Logs
- Error log: Two `upstream timed out (110: Connection timed out)` for `GET /api/me` to `127.0.0.1:3020` at 15:12:07 and 15:13:24
- Access log: Static assets (200/304) served concurrently with API timeouts
- Confirms failure is isolated to the upstream Express process, not nginx itself

### E. Database State
- PostgreSQL 16 running, 5 connections post-reboot, max 100
- `pg_trgm` extension **NOT installed** (migration 008 never run)
- No indexes on todos table
- DB user/database: `lifeline`/`lifeline`

### F. Auth Middleware Chain
- `express-oauth2-jwt-bearer` v1.7.1 → `jose` v4.15.9
- Route registration order: `/api/health/db` (line 185, **before** auth) → `app.use('/api', checkJwt, attachCurrentUser)` (line 393)
- Health checks and static assets bypass auth middleware entirely
- `attachCurrentUser` makes 3 DB calls per authenticated request

### G. DNS Configuration
- Container DNS: `127.0.0.11` (Docker embedded resolver)
- Docker forwards to host: `127.0.0.53` (systemd-resolved stub)
- Upstream: `153.92.2.6`, `1.1.1.1`, `8.8.4.4`
- Docker logs warning: "No non-localhost DNS nameservers are left in resolv.conf"

### H. JWKS Timeout Mechanism (Critical Finding)
- `express-oauth2-jwt-bearer` defaults: `cacheMaxAge = 600000` (10 min), `timeoutDuration = 5000` (5s), `cooldownDuration = 30000` (30s)
- jose `createRemoteJWKSet` passes `timeout` to `http.get(url, { timeout: 5000 })`
- Node.js `http.get({ timeout })` sets `socket.setTimeout()` — activates **only after TCP socket creation**
- **DNS resolution is NOT covered by the socket-level timeout**
- If DNS hangs, the 5s timeout never fires; the request blocks until the OS-level DNS timeout (potentially 60s+ with multiple nameservers)

## 4. Findings by Layer

| Layer | Finding | Severity |
|---|---|---|
| **Auth middleware** | JWKS fetch timeout doesn't cover DNS resolution; 10-min cache means idle periods guarantee refetch | **Critical** — root cause |
| **Docker DNS** | Multi-hop chain (embedded → systemd-resolved → upstream); socket error at 14:39 may have degraded resolver | **High** — contributing factor |
| **Container config** | No memory limits, no swap; all containers share 15Gi with no guardrails | **Medium** — unrelated to this incident but risk |
| **Health checks** | Registered before auth middleware; pass even when auth is completely broken | **Medium** — masks auth failures |
| **Database** | pg_trgm not installed, no indexes on todos; functional but unoptimized | **Low** — not involved in this incident |
| **Step-09 code** | No changes to auth, compose, deploy, nginx, or DB connection config | **None** — not a contributor |

## 5. Most Likely Cause

**Auth middleware blocked on JWKS/OIDC discovery fetch after cache expiry, with DNS resolution hanging through Docker's multi-hop resolver chain.**

Sequence:
1. Step-09 deployed at 14:39; Docker socket error during container teardown indicates daemon stress
2. App serves correctly for ~10 minutes (14:40–14:49) using cached JWKS and DNS
3. 21-minute idle period; JWKS cache expires (`cacheMaxAge = 600000` = 10 min)
4. User returns at 15:10; first authenticated request triggers JWKS refresh from Auth0
5. JWKS fetch calls `http.get()` → DNS resolution via Docker embedded resolver (127.0.0.11) → systemd-resolved (127.0.0.53) → upstream
6. DNS resolution hangs (Docker DNS potentially degraded after socket error); jose's 5s socket timeout doesn't fire (no socket created yet)
7. `checkJwt` middleware blocks indefinitely; all subsequent `/api/*` requests queue behind it
8. Health check at `/api/health/db` (registered before `checkJwt`) continues passing → container stays "healthy"
9. nginx proxy_read_timeout fires at 60s → 504; client cancels earlier → 499
10. VPS reboot: fresh Docker daemon, fresh DNS state, fresh JWKS cache → immediate recovery

### Why the 401 appeared first (15:10:54)
The initial 401 likely came from a stale JWKS cache hit where the signing key wasn't found (key rotation during idle period), or from a failed discovery/JWKS fetch that resolved quickly before DNS degraded. The subsequent requests at 15:11+ then encountered the hung DNS state.

## 6. Confidence Assessment

**MEDIUM-HIGH (7/10)**

**Supporting evidence**:
- Failure signature exactly matches auth-middleware-blocking: API routes hung, health checks fine, static fine
- JWKS cache expiry guaranteed by 21-minute idle vs 10-minute cacheMaxAge
- jose timeout mechanism confirmed to NOT cover DNS resolution (source-verified)
- Docker socket error at 14:39 documented in journal
- Multi-hop DNS chain with Docker "no non-localhost nameservers" warning
- Instant recovery after reboot (fresh state)

**Evidence gaps**:
- Pre-reboot container application logs lost (Docker replaced after reboot)
- No OOM kills in dmesg (cleared by reboot)
- No direct DNS failure evidence (no resolution-level logging)
- Cannot prove Auth0 endpoint was unreachable vs DNS was unreachable
- Cannot prove Docker DNS resolver was degraded (no daemon-level DNS logs)

## 7. Step-09 Contribution

**None.** Step-09 added MCP tooling (subtask/tag handlers, task tools, internal backend client) and backend domain features (SubtaskOperations, FindSimilarTasks, SubtaskContract). It did NOT modify:
- Auth middleware (`auth0.js`, `attachCurrentUser.js`)
- Docker configuration (`compose.production.yaml`, `Dockerfile`)
- Deploy scripts (`apply-release.sh`)
- Nginx configuration
- Database connection config (`data-source-options.js`)
- Express route registration order in `index.js`

The deploy at 14:39 was a normal compose rebuild. The Docker socket error during teardown is an infrastructure-level event inherent to Docker's container lifecycle, not caused by Step-09's code changes. The pg_trgm migration (008) shipped in Step-09 but was never applied in production, so cannot have contributed.

## 8. Recommended Next Action (Smallest Correct Fix)

### Immediate: Request-level timeout guard on auth middleware

Add an `AbortSignal.timeout()` wrapper or request-level timeout middleware so that no single auth validation can block for more than 10 seconds, regardless of DNS or network state:

```js
// backend/src/middleware/auth0.js — add timeout guard
import { auth } from 'express-oauth2-jwt-bearer';

const baseAuth = auth({
  issuerBaseURL: process.env.AUTH0_BASE_URL,
  audience: process.env.AUTH0_AUDIENCE,
  tokenSigningAlg: 'RS256',
});

// Wrap checkJwt with a timeout so a hung JWKS fetch cannot block indefinitely
const checkJwt = (req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'Authentication service temporarily unavailable' });
    }
  }, 10000);

  baseAuth(req, res, (err) => {
    clearTimeout(timer);
    next(err);
  });
};
```

### Near-term hardening (follow-up items)
1. **Add container memory limits** to `compose.production.yaml` (e.g., `mem_limit: 2g` for app, `512m` for MCP, `2g` for postgres)
2. **Add swap** to VPS (`fallocate -l 2G /swapfile`) as OOM-kill safety net
3. **Run migration 008** (`008_enable_pg_trgm_similarity.sql`) to install pg_trgm extension
4. **Add an auth-aware health check** (or secondary `/api/health/auth` endpoint that passes through `checkJwt`) so container health reflects auth middleware state
5. **Configure explicit DNS** in Docker daemon config (`/etc/docker/daemon.json`: `{ "dns": ["1.1.1.1", "8.8.4.4"] }`) to bypass the systemd-resolved multi-hop chain

---

*Investigation performed from live VPS SSH session, git history, nginx logs, Docker journal, database queries, and source code analysis. Pre-reboot application logs were not available.*
