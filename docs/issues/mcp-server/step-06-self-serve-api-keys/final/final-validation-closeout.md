# Step-06 final validation and closeout: self-serve MCP API keys in Profile

Date: 2026-03-07

## Outcome

The feature was released to production successfully.

Production runtime health, live MCP compatibility, and the deployed self-serve create/list/revoke flow were validated successfully.

One operator-only validation item remains outside this workspace session: an authenticated browser pass through the Profile UI could not be completed because no production Auth0 test credentials were available in-session.

## Final review status

Review-driven fixes were applied for:

- trustworthy initial-load behavior on the Profile details card
- trustworthy initial-load behavior on the API keys card
- accessible labeling for the one-time plaintext secret field
- bounded API key list responses
- OpenAPI coverage for the new backend routes
- API documentation structure cleanup

## Validation executed

### Backend

Focused Jest validation passed for:

- `CreateSelfServeMcpApiKey`
- `McpApiKeyManagement`
- `SelfServeMcpApiKeyCompatibility`
- `mcpApiKeyRoutes`
- existing `IssueMcpApiKey`

### Frontend

Focused Vitest validation passed for:

- `client/src/tests/profileUpdate.test.jsx`
- `client/src/tests/profileApiKeys.test.jsx`

### Quality gates

- targeted frontend lint on changed files passed
- frontend production build passed
- no editor-detected errors remained in the hardened files

## Deployment status

Production deployment was executed through the repo's existing `deploy` branch workflow.

Release details:

- source commit on `main`: `9f740db6` `feat(profile): add self-serve MCP API key management`
- promoted commit on `deploy`: `e1f75e8f` `feat(profile): add self-serve MCP API key management`
- GitHub Actions workflow: `deploy-production.yml`
- workflow run: `22807666834`
- first attempt failed due a transient SSH/SCP timeout from the GitHub runner to the VPS
- rerun attempt 2 completed successfully
- deployed release on VPS: `/opt/lifeline/releases/lifeline-20260307213738-e1f75e8`

## Production validation executed

### Runtime and health

Validated successfully:

- `/opt/lifeline/current` points to `/opt/lifeline/releases/lifeline-20260307213738-e1f75e8`
- containers `lifeline-app`, `lifeline-mcp`, and `lifeline-postgres` are healthy
- internal app DB health returned `{"db":"ok"}`
- internal MCP health returned `{"status":"ok","service":"lifeline-mcp",...}`
- public app info endpoint `https://lifeline.a2z-us.com/api/public/info` returned healthy JSON
- public MCP health endpoint `https://mcp.lifeline.a2z-us.com/health` returned healthy JSON

### Browser gate check

Validated successfully:

- unauthenticated navigation to the production Profile route redirects to the Auth0 login page as expected

Blocked in-session:

- authenticated browser validation of the Profile API Keys UI could not be completed because no production Auth0 test credentials were available in the workspace session

### Live MCP compatibility

Validated successfully against the production MCP endpoint using a short-lived key issued for the documented smoke principal `mcp-smoke-user-1`:

- tool discovery returned 9 tools including `search_tasks`, `list_today`, `create_task`, `complete_task`, and `delete_task`
- the read/write smoke flow successfully created a task, listed it, found it through search, completed it, and deleted it

### Deployed self-serve API key flow

Validated successfully inside the live production app container using the deployed step-06 code path for `mcp-smoke-user-1`:

- create returned a new active key record with the expected `read_write` scope preset and bounded `1_day` expiry preset
- list returned the newly created key metadata without exposing the secret again
- revoke changed the key status to `revoked` and set `revokedAt`
- cross-user revoke protection held: attempting to revoke the key as a different user returned `404`

## Production impact

Observed impact is limited to:

- a new authenticated Profile UI section for MCP API key management
- new authenticated `/api/mcp-api-keys` product endpoints
- no schema migration requirement
- no deployment topology change

## Recommendation

Production release is successful.

Recommended follow-up:

1. perform one operator-authenticated browser pass on the production Profile page when a safe test login is available
2. confirm one-time secret reveal behavior from the live browser UI
