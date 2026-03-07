# Lifeline MCP First Cutover Runbook

## Purpose

This runbook covers the bounded operator work for the first real Lifeline MCP release and first real MCP client validation.

It is grounded in the current deploy-branch VPS runtime, the separate `lifeline-mcp` container, and the repo-local CLI validation path that was exercised with the official MCP SDK client.

## Canonical sources used for this runbook

- [compose.production.yaml](../../compose.production.yaml)
- [compose.production.env.example](../../compose.production.env.example)
- [deploy/scripts/apply-release.sh](../../deploy/scripts/apply-release.sh)
- [deploy/nginx/mcp.lifeline.a2z-us.com.conf](../../deploy/nginx/mcp.lifeline.a2z-us.com.conf)
- [backend/src/scripts/issue-mcp-api-key.js](../../backend/src/scripts/issue-mcp-api-key.js)
- [services/lifeline-mcp/scripts/mcp-client-cli.js](../../services/lifeline-mcp/scripts/mcp-client-cli.js)
- [docs/operations/DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)
- [docs/operations/deployment-verification-and-smoke-checks.md](deployment-verification-and-smoke-checks.md)
- [docs/operations/production-runtime-and-rollback.md](production-runtime-and-rollback.md)

## Preconditions and first-release assumptions

Before treating the first MCP cutover as ready, confirm all of the following:

- DNS for `mcp.lifeline.a2z-us.com` resolves to the same VPS that serves `lifeline.a2z-us.com`.
- The VPS already uses the deploy-branch release layout under `/opt/lifeline/releases`, `/opt/lifeline/current`, and `/opt/lifeline/shared/.env.production`.
- The shared production env file contains the MCP runtime settings and secrets expected by [compose.production.yaml](../../compose.production.yaml).
- The host Nginx install is configured to load the Lifeline virtual-host files from its active include directory.
- Operators can run Docker, `curl`, and Nginx admin commands on the VPS.
- Operators can reach the VPS as `root`, or through an intentionally created deploy user with equivalent permissions. Do not assume a `ziyad` host account exists.
- A dedicated Lifeline smoke user already exists for MCP validation so cutover checks do not mutate a normal user's working task set.

## Required host-side env and secrets

At minimum, the first MCP cutover expects these values in `/opt/lifeline/shared/.env.production`:

- `MCP_PORT`
- `MCP_BIND_HOST`
- `MCP_PUBLIC_BASE_URL`
- `MCP_ALLOWED_HOSTS`
- `LIFELINE_BACKEND_BASE_URL`
- `MCP_INTERNAL_SHARED_SECRET`
- `MCP_API_KEY_PEPPER`

Also confirm the existing app/runtime values remain valid:

- `APP_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `CORS_ORIGIN`
- `APP_ORIGIN`

`MCP_INTERNAL_SHARED_SECRET` and `MCP_API_KEY_PEPPER` must stay host-side only. Do not move them into git or GitHub Actions secrets.

## First-release operator checklist

1. Confirm DNS for `mcp.lifeline.a2z-us.com` is already pointed at the production VPS.
2. Confirm `/opt/lifeline/shared/.env.production` includes the MCP variables listed above.
3. Confirm the GitHub production secret `VPS_SSH_USER` is either unset so the workflow falls back to `root`, or explicitly set to `root` until a dedicated deploy user is created.
4. Confirm the VPS uses one of the workflow-supported Nginx layouts: `/etc/nginx/conf.d/` or `/etc/nginx/sites-available` plus `/etc/nginx/sites-enabled`.
5. Merge or cherry-pick the approved MCP cutover commit(s) from `main` into `deploy`.
6. Push `deploy` and watch the `Deploy Lifeline Production` workflow.
7. Wait for the workflow to finish the release helper, sync [deploy/nginx/mcp.lifeline.a2z-us.com.conf](../../deploy/nginx/mcp.lifeline.a2z-us.com.conf), run `nginx -t`, reload Nginx, and verify the public MCP health endpoint.
8. Run the post-deploy smoke flow in the next section before declaring success.

## Post-deploy cutover validation flow

### 1. Health and bind verification

The deploy helper already checks these automatically, but operators should spot-check them during the first cutover:

- App health: `curl -fsS https://lifeline.a2z-us.com/api/health/db`
- MCP health: `curl -fsS https://mcp.lifeline.a2z-us.com/health`
- App loopback bind: `docker port lifeline-app 3000`
- MCP loopback bind: `docker port lifeline-mcp ${MCP_PORT:-3030}`
- Container status: `docker ps --filter "name=lifeline-"`

Expected result:

- both health endpoints return `200`
- app bind remains `127.0.0.1:3020`
- MCP bind remains `127.0.0.1:${MCP_PORT:-3030}`
- `lifeline-app`, `lifeline-mcp`, and `lifeline-postgres` are healthy

### 2. MCP-to-backend adapter verification

From the VPS host, verify that the running MCP container can still reach the backend internal adapter path:

- `docker exec lifeline-mcp node -e "fetch(process.env.LIFELINE_BACKEND_BASE_URL + '/internal/mcp/health', { headers: { 'x-lifeline-internal-service-secret': process.env.MCP_INTERNAL_SHARED_SECRET } }).then(async (response) => { console.log(response.status); console.log(await response.text()); process.exit(response.ok ? 0 : 1); }).catch((error) => { console.error(error); process.exit(1); })"`

Expected result:

- HTTP `200`
- payload includes `service: "internal-mcp"`

### 3. Issue a real MCP API key

Use the bounded operator script in the app container.

For production cutover, issue a short-lived key for the dedicated MCP smoke user. Prefer an expiry window such as 30–60 minutes so the first-cutover credential cleans itself up without leaving a long-lived operator key behind.

For an existing dedicated smoke user:

- `docker exec lifeline-app node src/scripts/issue-mcp-api-key.js --user-id <mcp-smoke-user-id> --name "first-mcp-validation-rw" --scopes tasks:read,tasks:write --expires-at <iso-expiry-utc>`

For non-production local or pre-cutover validation only, where a dedicated validation user record does not exist yet:

- `docker exec lifeline-app node src/scripts/issue-mcp-api-key.js --user-id mcp-smoke-user-1 --email mcp-smoke-user-1@example.com --user-name "MCP Smoke User 1" --create-user-if-missing --name "first-mcp-validation-rw" --scopes tasks:read,tasks:write`

Do not use `--create-user-if-missing` as a normal production cutover path.

The script shows the plaintext key once. Capture it immediately.

Current v1 scope contract note:

- `tasks:write` currently covers create, update, complete, uncomplete, and delete operations.
- There is no separate `tasks:delete` issuance scope in the current bounded v1 implementation.

### 4. Validate tool discovery and end-to-end MCP usage

The strongest validated repo-local client path is the official MCP SDK client CLI in the MCP container.

Use the issued key against the public MCP endpoint:

- `docker exec lifeline-mcp node scripts/mcp-client-cli.js list-tools --server-url https://mcp.lifeline.a2z-us.com/mcp --api-key <issued-key>`
- `docker exec lifeline-mcp node scripts/mcp-client-cli.js smoke-rw --server-url https://mcp.lifeline.a2z-us.com/mcp --api-key <issued-key> --title-prefix "prod-cutover-smoke"`

Expected success:

- tool discovery includes `search_tasks`, `list_today`, `create_task`, `complete_task`, and `delete_task`
- the smoke flow creates a task, sees it in `list_today`, finds it via `search_tasks`, completes it, and receives `deleted: true` from `delete_task` with the current archive-style delete behavior

### 5. Optional scope check with a read-only key

Issue a second key for the same user:

- `docker exec lifeline-app node src/scripts/issue-mcp-api-key.js --user-id <mcp-smoke-user-id> --name "first-mcp-validation-ro" --scopes tasks:read --expires-at <iso-expiry-utc>`

Then validate the denial path:

- `docker exec lifeline-mcp node scripts/mcp-client-cli.js smoke-ro --server-url https://mcp.lifeline.a2z-us.com/mcp --api-key <read-only-key>`

Expected success:

- `search_tasks` works
- `create_task` fails with `scope_denied`

### 6. Optional cross-user scoping check

If you want a first-release proof that user scoping is preserved:

1. issue a second read/write key for a different Lifeline user
2. create a sentinel task with the second key using `call-tool create_task`
3. run the first user's smoke flow with `--assert-query-absent <sentinel-title>`
4. delete the sentinel task with the second user's key

Example create call:

- `docker exec lifeline-mcp node scripts/mcp-client-cli.js call-tool --server-url https://mcp.lifeline.a2z-us.com/mcp --api-key <user-2-key> --tool create_task --args-json '{"title":"scope-sentinel-2026-03-07","dueDate":"2026-03-07"}'`

Example absent-query assertion:

- `docker exec lifeline-mcp node scripts/mcp-client-cli.js smoke-rw --server-url https://mcp.lifeline.a2z-us.com/mcp --api-key <user-1-key> --assert-query-absent scope-sentinel-2026-03-07 --title-prefix "scope-check"`

### 7. Post-smoke credential hygiene

Because the current bounded v1 implementation includes key issuance but not a separate revocation CLI yet, production smoke credentials should be treated as temporary by policy:

- use a dedicated smoke user
- issue short-lived keys with `--expires-at`
- do not reuse first-cutover smoke keys for normal operator work
- if a smoke key must persist longer for investigation, record who holds it and when it should expire

## Minimal client-facing usage instructions

The validated MCP server URL is:

- `https://mcp.lifeline.a2z-us.com/mcp`

Auth expectation:

- send the issued MCP API key as `Authorization: Bearer <key>`
- the service also accepts `x-api-key`, but the validated path used Bearer auth

If your desktop or CLI MCP client supports remote Streamable HTTP plus custom headers, configure:

- server URL: `https://mcp.lifeline.a2z-us.com/mcp`
- auth header: `Authorization: Bearer <issued-key>`

If your client connects successfully but tool calls fail:

- verify the key still exists and has the right scopes
- verify you are using the dedicated smoke user's key when running cutover validation
- verify `https://mcp.lifeline.a2z-us.com/health`
- verify the MCP container can still reach `/internal/mcp/health`
- verify the key belongs to the expected Lifeline user

## Rollback awareness

If the first cutover fails after deployment:

- the deploy helper restores `/opt/lifeline/current` to the previous release automatically
- the deploy helper re-applies the previous Compose release with `--remove-orphans`
- recent logs from `lifeline-app`, `lifeline-mcp`, and `lifeline-postgres` are captured for diagnostics

If you perform a manual rollback later:

1. repoint `/opt/lifeline/current` to the previous release
2. rerun `docker compose -p lifeline --env-file /opt/lifeline/shared/.env.production -f compose.production.yaml up -d --build --remove-orphans`
3. re-run the app and MCP health checks

## What success looks like

Treat the first MCP cutover as successful only when all of the following are true:

- GitHub Actions deployment succeeds from `deploy`
- Nginx config test and reload succeed on the VPS
- app and MCP public health checks return `200`
- app and MCP containers remain loopback-only on the VPS host
- MCP can still reach the backend internal adapter path
- a newly issued MCP API key authenticates successfully
- tool discovery works through the MCP layer
- representative task tools succeed end-to-end through the MCP service

## Troubleshooting first-release failures

### MCP container is unhealthy

Symptoms:

- `docker ps` shows `lifeline-mcp` as `unhealthy` or restarting
- `/health` fails on `127.0.0.1:${MCP_PORT:-3030}`

Checks:

- `docker logs --tail 200 lifeline-mcp`
- confirm `MCP_PORT`, `MCP_BIND_HOST`, `MCP_INTERNAL_SHARED_SECRET`, and `LIFELINE_BACKEND_BASE_URL`
- confirm `lifeline-app` is already healthy

Likely causes:

- wrong or missing runtime env values
- MCP container started before the backend became healthy enough to answer the adapter path

### MCP host responds but tool calls fail

Symptoms:

- `GET /health` returns `200`
- `list-tools` or tool calls return JSON-RPC errors

Checks:

- run `list-tools` first to separate connection problems from tool-execution problems
- inspect the returned `error.code` and `error.message`
- verify the key scopes match the attempted tools

Likely causes:

- invalid API key
- scope mismatch such as using a read-only key for `create_task`
- backend adapter failure behind an otherwise healthy MCP edge

### MCP cannot reach the backend internal adapter

Symptoms:

- deploy helper fails on the internal adapter verification step
- tool calls return backend/network errors even though `/health` works

Checks:

- run the in-container `/internal/mcp/health` fetch shown earlier
- verify `LIFELINE_BACKEND_BASE_URL=http://lifeline-app:3000`
- verify `lifeline-app` is healthy on the Compose network

Likely causes:

- bad `LIFELINE_BACKEND_BASE_URL`
- broken Docker network wiring
- backend not healthy enough to serve `/internal/mcp/*`

### Invalid or missing shared secret

Symptoms:

- `/internal/mcp/health` from inside `lifeline-mcp` returns `401` or `403`
- MCP tool calls fail even with a valid API key

Checks:

- verify the same `MCP_INTERNAL_SHARED_SECRET` value is present for both `lifeline-app` and `lifeline-mcp`
- verify the value exists in `/opt/lifeline/shared/.env.production`

Likely causes:

- missing host env entry
- mismatch between the app and MCP container values

### API key auth resolution fails

Symptoms:

- MCP returns `missing_api_key`, `invalid_api_key`, `API key revoked`, or `API key expired`

Checks:

- reissue a key with [backend/src/scripts/issue-mcp-api-key.js](../../backend/src/scripts/issue-mcp-api-key.js)
- confirm the key was copied exactly as emitted
- confirm `MCP_API_KEY_PEPPER` matches the value used when the key was issued

Likely causes:

- pasted key is incomplete
- the hash pepper changed after issuance
- the key record was revoked, expired, or bound to a different environment

### Principal or scope failures

Symptoms:

- read tools work but write tools return `scope_denied`
- writes operate on the wrong user's expected data set

Checks:

- inspect the scopes shown at issuance time
- issue a dedicated read/write key for write validation
- for scoping concerns, run the optional cross-user sentinel check

Likely causes:

- wrong scope set during issuance
- operator used the wrong user's key

### Nginx routing or TLS mismatch

Symptoms:

- `curl https://mcp.lifeline.a2z-us.com/health` fails but `curl http://127.0.0.1:${MCP_PORT:-3030}/health` works
- TLS certificate warnings or host mismatch errors

Checks:

- verify the live Nginx config contains `server_name mcp.lifeline.a2z-us.com`
- verify the proxy target is `http://127.0.0.1:3030`
- run `sudo nginx -t`
- confirm DNS still points at the correct VPS

Likely causes:

- Nginx config not copied or not reloaded
- DNS not updated yet
- TLS material on the VPS does not include the MCP hostname yet
