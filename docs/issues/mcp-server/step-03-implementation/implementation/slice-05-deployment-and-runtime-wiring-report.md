# Lifeline MCP Step-03 Implementation — Slice 05 Report

## Slice

`step-03 implementation, slice-05: deployment and runtime wiring for lifeline-mcp`

## Scope completed

This slice implemented the bounded deployment and runtime wiring needed to fit `lifeline-mcp` into Lifeline’s existing deploy-branch VPS model without expanding MCP v1 scope.

Implemented scope:

- separate container packaging for `services/lifeline-mcp`
- production Compose integration for `lifeline-mcp` as a sibling service
- host-side environment wiring for MCP runtime settings and shared-secret flow
- dedicated Nginx server block for `mcp.lifeline.a2z-us.com`
- deploy helper/runtime verification updates for MCP health, loopback binding, and backend-adapter reachability
- bounded workflow diagnostics update for MCP container logs
- canonical architecture and operations documentation updates
- ADR capture for the now-implemented separate MCP runtime boundary

Out of scope and intentionally not implemented here:

- OAuth/Auth0 support for MCP clients
- public ChatGPT app submission or distribution flow
- API-key management UX
- new MCP product features
- broad CI/CD redesign

---

## Code, config, and doc changes made

## 1. `lifeline-mcp` container packaging

Added service-local container packaging under `services/lifeline-mcp/`:

- `Dockerfile`
- `.dockerignore`

The runtime image is:

- separate from the main app image
- production-oriented
- env-driven
- non-root at runtime
- limited to the service source and production dependencies

Also extended service config support so the runtime can expose its public base URL in health output:

- `services/lifeline-mcp/.env.example`
- `services/lifeline-mcp/src/config.js`
- `services/lifeline-mcp/src/app.js`

## 2. Production Compose integration

Updated [compose.production.yaml](../../../../compose.production.yaml) to add a sibling `lifeline-mcp` service.

Key production wiring now implemented:

- service name: `lifeline-mcp`
- build context: `./services/lifeline-mcp`
- backend path: `http://lifeline-app:3000`
- startup dependency: `lifeline-mcp` waits on healthy `lifeline-app`
- host exposure: `127.0.0.1:${MCP_PORT}:${MCP_PORT}`
- container healthcheck: `GET /health`

The existing `lifeline-app` production service was also extended to receive the env needed for MCP backend-internal auth resolution:

- `MCP_INTERNAL_SHARED_SECRET`
- `MCP_API_KEY_PEPPER`

## 3. Production environment wiring

Updated [compose.production.env.example](../../../../compose.production.env.example) with the MCP runtime settings now required by the production model:

- `MCP_PORT`
- `MCP_BIND_HOST`
- `MCP_PUBLIC_BASE_URL`
- `MCP_ALLOWED_HOSTS`
- `LIFELINE_BACKEND_BASE_URL`
- `MCP_INTERNAL_SHARED_SECRET`
- `MCP_API_KEY_PEPPER`
- `MCP_REQUEST_TIMEOUT_MS`
- `MCP_LOG_LEVEL`

Secret handling remains host-side and env-driven through `/opt/lifeline/shared/.env.production`.

## 4. Nginx routing

Added a dedicated MCP host config:

- `deploy/nginx/mcp.lifeline.a2z-us.com.conf`

This config:

- uses `mcp.lifeline.a2z-us.com`
- proxies to `http://127.0.0.1:3010`
- keeps MCP off the public Docker interface
- preserves Nginx as the public edge
- disables proxy buffering for the MCP host

The repo continues to store Nginx config in `deploy/nginx/`; host sync/reload remains an operator-managed step, not a workflow-managed one.

## 5. Deploy/runtime touchpoints

Updated [deploy/scripts/apply-release.sh](../../../../deploy/scripts/apply-release.sh) so deployment now verifies MCP runtime behavior explicitly.

New deploy-helper behavior:

- sources the shared production env file before verification
- checks `lifeline-mcp` container health
- checks internal MCP health at `http://127.0.0.1:${MCP_PORT}/health`
- checks public MCP health at `${MCP_PUBLIC_BASE_URL}/health`
- verifies MCP loopback-only binding
- verifies the `lifeline-mcp -> lifeline-app -> /internal/mcp/health` path from inside the MCP container using the shared-secret header
- captures MCP logs during rollback/failure diagnostics
- uses `--remove-orphans` on deploy and rollback compose re-application so pre-MCP releases do not leave orphaned MCP containers behind

Updated [.github/workflows/deploy-production.yml](../../../../.github/workflows/deploy-production.yml) only in the bounded way needed for diagnosability:

- failure diagnostics now include `lifeline-mcp` logs

No broader workflow redesign was introduced.

## 6. Canonical docs updates

Updated canonical docs to reflect implemented runtime truth:

### Architecture

- [docs/architecture/runtime-topology.md](../../architecture/runtime-topology.md)

Updated to describe:

- the separate MCP container
- public MCP traffic flow
- the private `lifeline-mcp -> lifeline-app` adapter path
- loopback-only exposure for both app and MCP

### Operations

- [docs/operations/DEPLOY_BRANCH_CD.md](../../operations/DEPLOY_BRANCH_CD.md)
- [docs/operations/production-runtime-and-rollback.md](../../operations/production-runtime-and-rollback.md)
- [docs/operations/deployment-verification-and-smoke-checks.md](../../operations/deployment-verification-and-smoke-checks.md)

Updated to describe:

- MCP runtime env expectations
- deploy helper smoke checks
- internal adapter verification
- MCP loopback binding
- operator-managed Nginx sync/reload expectations

## 7. ADR decision

Added an ADR because this slice made a durable deployment/auth/runtime boundary real:

- [docs/adr/0001-lifeline-mcp-runtime-boundary.md](../../adr/0001-lifeline-mcp-runtime-boundary.md)

The ADR records the accepted decision that Lifeline MCP runs as:

- a separate container
- a separate public host
- a thin edge over the backend internal adapter
- no direct DB access

---

## Important files touched

### Service/runtime packaging

- `services/lifeline-mcp/Dockerfile`
- `services/lifeline-mcp/.dockerignore`
- `services/lifeline-mcp/.env.example`
- `services/lifeline-mcp/src/config.js`
- `services/lifeline-mcp/src/app.js`

### Deployment/runtime wiring

- `compose.production.yaml`
- `compose.production.env.example`
- `deploy/nginx/mcp.lifeline.a2z-us.com.conf`
- `deploy/scripts/apply-release.sh`
- `.github/workflows/deploy-production.yml`

### Canonical docs

- `docs/architecture/runtime-topology.md`
- `docs/operations/DEPLOY_BRANCH_CD.md`
- `docs/operations/production-runtime-and-rollback.md`
- `docs/operations/deployment-verification-and-smoke-checks.md`
- `docs/adr/0001-lifeline-mcp-runtime-boundary.md`

---

## Runtime topology made explicit

The implemented production/runtime path is now:

- app traffic: `lifeline.a2z-us.com -> Nginx -> 127.0.0.1:3020 -> lifeline-app`
- MCP traffic: `mcp.lifeline.a2z-us.com -> Nginx -> 127.0.0.1:3010 -> lifeline-mcp`
- internal MCP adapter path: `lifeline-mcp -> http://lifeline-app:3000/internal/mcp/*`
- database path: `lifeline-app -> lifeline-postgres:5432`

What remains private/internal:

- `lifeline-app` host bind
- `lifeline-mcp` host bind
- `/internal/mcp/*`
- MCP internal shared secret
- API-key pepper

---

## Secret boundary note

This slice preserved the existing secret boundary.

Runtime secrets remain host-side in `/opt/lifeline/shared/.env.production`.

No real secrets were committed.

GitHub Actions still only uses deployment transport secrets:

- SSH host
- SSH user
- SSH key
- SSH port
- known hosts

Application and MCP runtime secrets remain VPS-side.

---

## Health and deployment behavior note

## Health behavior

- `lifeline-app` health remains `/api/health/db`
- `lifeline-mcp` health is `/health`
- deploy verification now also checks the internal adapter path from inside the MCP container

## Start-order assumption

`lifeline-mcp` depends on healthy `lifeline-app` in production Compose.

## Deployment behavior

The deploy-branch VPS model remains unchanged:

- push to `deploy`
- archive upload to VPS
- extract into `/opt/lifeline/releases/<release-id>`
- repoint `/opt/lifeline/current`
- run `docker compose up -d --build --remove-orphans`
- run smoke checks

Workflow changes were intentionally bounded to diagnostics only.

## Operational tradeoff

Host Nginx config remains operator-managed. The workflow does not install or reload Nginx config automatically.

---

## Validation performed

## 1. Compose syntax validation

Executed from repo root:

`docker compose --env-file compose.production.env.example -f compose.production.yaml config`

Result:

- passed
- production Compose resolved cleanly with the new `lifeline-mcp` service and env wiring

## 2. `lifeline-mcp` container build validation

Executed from repo root:

`docker build -f services/lifeline-mcp/Dockerfile services/lifeline-mcp -t lifeline-mcp-slice05:test`

Result:

- passed
- the MCP service image builds successfully in the chosen repo-consistent container pattern

## 3. Production-shaped Compose boot validation

Executed from repo root:

`docker compose --env-file compose.production.env.example -f compose.production.yaml up -d --build lifeline-postgres lifeline-app lifeline-mcp`

Result:

- passed after resetting a stale local Postgres validation volume
- `lifeline-postgres`, `lifeline-app`, and `lifeline-mcp` all reached healthy status

Local validation note:

- the first boot attempt failed because an old local Docker volume contained mismatched Postgres credentials
- the validation stack was reset with `docker compose ... down -v`, then re-run successfully
- this was a local validation artifact, not a repo wiring defect

## 4. Loopback health verification

Executed from repo root against the locally published production-shaped ports:

- `http://127.0.0.1:3020/api/health/db`
- `http://127.0.0.1:3010/health`

Result:

- both returned `200`

## 5. Internal MCP-to-backend path verification

Executed from repo root:

`docker exec lifeline-mcp node -e "fetch('http://lifeline-app:3000/internal/mcp/health', { headers: { 'x-lifeline-internal-service-secret': process.env.MCP_INTERNAL_SHARED_SECRET } })..."`

Result:

- passed with `200`
- confirmed the `lifeline-mcp -> lifeline-app` Docker-network path and shared-secret runtime wiring

## 6. Nginx config syntax validation

Executed from repo root using an Nginx container:

`Get-Content -Raw "deploy/nginx/mcp.lifeline.a2z-us.com.conf" | docker run --rm -i nginx:1.27-alpine sh -lc "cat >/etc/nginx/conf.d/default.conf && nginx -t"`

Result:

- passed
- new MCP Nginx server block syntax is valid

## 7. Targeted MCP regression tests

Executed:

- `services/lifeline-mcp`: `npm test`
- `backend`: `npm test -- --runInBand test/internal/internalMcpRoutes.test.js test/internal/internalMcpAuthResolveRoutes.test.js test/internal/internalMcpTaskReadRoutes.test.js test/internal/internalMcpTaskWriteRoutes.test.js test/internal/mcpPrincipal.test.js test/internal/mcpApiKeyScaffold.test.js`

Result:

- service tests: **5/5 passed**
- backend targeted MCP suite: **6/6 suites**, **32/32 tests passed**

## 8. Deploy-script syntax validation

Executed:

`bash -n deploy/scripts/apply-release.sh`

Result:

- passed

## 9. Diagnostics

Result:

- edited source/config/doc/workflow/script files were clean in diagnostics
- advisory-only Dockerfile security scanning still reports inherited base-image vulnerabilities from `node:20-alpine`, consistent with the existing repo Docker baseline

## 10. Lint gate note

Checked lint availability in the touched runtime packages:

- `services/lifeline-mcp`: `npm run lint`
- `backend`: `npm run lint`

Result:

- both packages currently have **no `lint` script**
- lint validation is therefore not currently available as a runnable repo command for this slice

---

## Governance usage note

This slice was implemented through the repo-native governance stack.

Material governance layers used:

- **CI/CD governance**
  - preserved the deploy-branch VPS model
  - preserved host-side runtime secrets
  - preserved loopback-only exposure
  - extended smoke checks and diagnostics without redesigning the workflow

- **backend engineering governance**
  - preserved the backend as source of truth
  - kept the MCP-to-backend path private and explicit
  - avoided direct DB access from `lifeline-mcp`

- **documentation governance**
  - routed the implementation artifact to the scoped non-root issue-history path
  - updated the correct canonical domains: `docs/architecture/`, `docs/operations/`, and `docs/adr/`

- **code-quality governance**
  - kept runtime concerns separated across service config, Compose wiring, deploy helper, Nginx config, and docs
  - kept changes focused and incremental

- **refactor governance (bounded only)**
  - preserved the deploy model while making the smallest viable deploy-helper and config changes needed for MCP runtime support

Post-implementation governance review outcome for the slice after fixes:

- **Approve**

---

## ADR decision

ADR added.

Reason:

- this slice made a durable runtime, deployment, and internal-auth boundary real
- architecture guidance for Lifeline calls for an ADR when a durable design decision changes deployment or auth boundaries

ADR path:

- [docs/adr/0001-lifeline-mcp-runtime-boundary.md](../../adr/0001-lifeline-mcp-runtime-boundary.md)

---

## Slice result

This slice made `lifeline-mcp` operationally real in the repository’s deployment model without broadening MCP v1 scope.

The repo now contains:

- a separate MCP container packaging path
- a production Compose service for MCP
- host-side MCP env/config wiring
- dedicated MCP Nginx routing
- deploy/runtime verification for MCP health, loopback binding, and adapter reachability
- updated architecture/operations truth
- a durable ADR for the new runtime boundary

---

## Recommended next slice

`step-03 implementation, slice-06: production cutover readiness and operator-facing MCP runtime validation`

Recommended focus:

- first production cutover checklist
- operator validation flow for host Nginx sync/reload
- non-secret API-key operational readiness checks
- bounded runtime troubleshooting guidance for MCP failures
