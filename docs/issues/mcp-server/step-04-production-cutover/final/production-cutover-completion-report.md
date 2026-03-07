# Lifeline MCP step-04 production cutover completion report

Date: 2026-03-07

## Scope

This report records the final live completion work for the first public production cutover of `lifeline-mcp` on the real VPS.

## Starting point

Before this continuation:

- `lifeline-mcp` had already been moved to host port `3030`
- the live shared env already used `MCP_PORT=3030`
- the app, Postgres, and MCP containers had been stabilized previously
- the remaining blocker was external DNS for `mcp.lifeline.a2z-us.com`

Operator update for this continuation:

- public DNS for `mcp.lifeline.a2z-us.com` had been added

## Actions executed

1. Verified public DNS resolution for `mcp.lifeline.a2z-us.com` against local DNS, Cloudflare `1.1.1.1`, and Google `8.8.8.8`.
2. Confirmed the active MCP Nginx host config on the VPS and verified that no enabled duplicate MCP site remained under `sites-enabled`.
3. Issued and installed the TLS certificate for `mcp.lifeline.a2z-us.com` with Certbot using the live Nginx configuration.
4. Ran `nginx -t` and reloaded Nginx after certificate deployment.
5. Corrected the live shared env so `MCP_PUBLIC_BASE_URL=https://mcp.lifeline.a2z-us.com`.
6. Recreated only `lifeline-mcp` from the active release to restore the working loopback publication and live proxy path after the failed automated redeploy had left the MCP proxy target unavailable.
7. Validated the MCP loopback health endpoint, the public HTTPS health endpoint, and the MCP-to-backend internal adapter path.
8. Used the dedicated smoke principal `mcp-smoke-user-1` with short-lived production validation keys.
9. Ran the official repo MCP client against the real public HTTPS endpoint for:
   - tool discovery
   - read/write smoke
   - read-only scope denial
10. Updated the tracked MCP Nginx vhost file so future deploys preserve the working TLS vhost shape.

## DNS validation

Observed resolution:

- local resolver: `mcp.lifeline.a2z-us.com -> 187.124.7.88`
- Cloudflare `1.1.1.1`: `mcp.lifeline.a2z-us.com -> 187.124.7.88`
- Google `8.8.8.8`: `mcp.lifeline.a2z-us.com -> 187.124.7.88`

## TLS issuance result

Certbot succeeded for `mcp.lifeline.a2z-us.com`.

Installed certificate record:

- certificate name: `mcp.lifeline.a2z-us.com`
- expiry: `2026-06-05 11:57:08+00:00`
- path: `/etc/letsencrypt/live/mcp.lifeline.a2z-us.com/fullchain.pem`

## Nginx validation result

Executed successfully:

- `nginx -t`
- `systemctl reload nginx`

The active MCP vhost now terminates TLS for `mcp.lifeline.a2z-us.com` and proxies to `http://127.0.0.1:3030`.

## Final live runtime validation

Active release at validation time:

- `/opt/lifeline/releases/lifeline-20260307115558-8aab34b`

Container state:

- `lifeline-app` healthy on `127.0.0.1:3020`
- `lifeline-mcp` healthy on `127.0.0.1:3030`
- `lifeline-postgres` healthy

Validated successfully:

- app public DB health: `https://lifeline.a2z-us.com/api/health/db`
- app public info: `https://lifeline.a2z-us.com/api/public/info`
- MCP loopback health: `http://127.0.0.1:3030/health`
- MCP public HTTPS health: `https://mcp.lifeline.a2z-us.com/health`
- MCP internal adapter path from inside `lifeline-mcp`: `/internal/mcp/health`

Observed MCP health payload after final env correction:

- `status: ok`
- `service: lifeline-mcp`
- `publicBaseUrl: https://mcp.lifeline.a2z-us.com`

Observed internal adapter payload:

- HTTP `200`
- `service: internal-mcp`
- `authenticatedService: lifeline-mcp`

## Real public MCP client validation

Validation target:

- `https://mcp.lifeline.a2z-us.com/mcp`

Client path used:

- `services/lifeline-mcp/scripts/mcp-client-cli.js`

### Smoke principal and credentials

Used bounded short-lived validation credentials only.

Smoke principal:

- user id: `mcp-smoke-user-1`

Issued credentials:

- RW key prefix: `lk_02793220`
- RW expiry window: 45 minutes
- RO key prefix: `lk_402c0ce4`
- RO expiry window: 45 minutes

No raw plaintext keys are retained in this report.

### Tool discovery result

The public MCP endpoint advertised 9 tools, including the required production validation set:

- `search_tasks`
- `list_today`
- `create_task`
- `complete_task`
- `delete_task`

### Read/write smoke result

The public MCP read/write smoke succeeded end-to-end:

- created a task titled with the `prod-cutover-smoke` prefix
- `list_today` returned the created task
- `search_tasks` returned the created task
- `complete_task` marked the task completed
- `delete_task` returned `deleted: true`
- observed delete mode: `archived`

### Read-only denial result

The public read-only validation succeeded:

- `search_tasks` worked with the read-only key
- `create_task` was denied with `scope_denied`

## Main app regression check

No regression was observed on the main Lifeline app during this continuation.

Validated successfully:

- `https://lifeline.a2z-us.com/api/health/db`
- `https://lifeline.a2z-us.com/api/public/info`
- `lifeline-app` container remained healthy throughout final validation

## CI/CD follow-up note

The tracked MCP Nginx vhost was updated and pushed so future deploys preserve the live TLS configuration.

However, the latest deploy-branch workflow rerun still failed during `Apply release on VPS` even though the live stack was subsequently validated successfully. The live remediation that restored service was recreating only `lifeline-mcp` from the active release after the failed automated redeploy had left the MCP proxy target unavailable.

This means the public production cutover is complete, but the deployment automation still needs a bounded hardening pass so the MCP loopback publication remains deterministic after automated recreates.

## Final production status

`lifeline-mcp` is live and operational on:

- `https://mcp.lifeline.a2z-us.com`

Cutover completion criteria satisfied in live production:

- DNS resolves publicly to the VPS
- TLS is issued and installed
- Nginx config test and reload succeeded
- MCP loopback health succeeded
- MCP public HTTPS health succeeded
- MCP internal adapter reachability succeeded
- real public tool discovery succeeded
- real public read/write smoke succeeded
- read-only scope denial succeeded
- the main Lifeline app remained healthy

## Bounded follow-up items

1. Harden the deploy workflow so automated `lifeline-mcp` recreates do not intermittently leave the host loopback publication unavailable after `Apply release on VPS`.
2. Keep the tracked MCP Nginx vhost aligned with the live Certbot-managed TLS shape.
3. Continue using only dedicated smoke principals and short-lived validation keys for future production MCP checks.
