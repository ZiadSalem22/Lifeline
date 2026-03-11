# Step 07 closeout update: generic connector interoperability

## Result

This pass completed the tenant-side and MCP-edge work needed to make Lifeline MCP compatible with generic hosted OAuth connectors without weakening token validation.

The implementation is complete.

The remaining blocker is external validation: a real hosted connector must retry the connection so Auth0 logs can confirm that the connector now receives a Lifeline API token and that the MCP server accepts it end-to-end.

## What changed

### Production Auth0 tenant

- tenant Default Audience set to `https://lifeline-api`
- Lifeline API resource server now allows offline access
- bound Post-Login Action now adds `tasks:read` and `tasks:write` for `https://lifeline-api` access tokens

### Repo code

- clearer MCP-edge diagnostics for wrong-audience and wrong-issuer bearer tokens
- auth-method neutral scope-denied wording
- OAuth negative-path test tightened

### Canonical docs

- operations runbook updated to document the connector-safe Auth0 defaults

## Security stance preserved

The MCP server still does not accept:

- arbitrary tokens from the Auth0 tenant
- `userinfo` audience tokens
- login success without a Lifeline API access token

This is intentional.

The generic-connector fix was implemented at the token-issuance layer, not by weakening bearer-token validation.

## Evidence summary

Before this pass:

- hosted connector login completed
- Auth0 issued tokens for `https://dev-1b4upl01bjz8l8li.us.auth0.com/userinfo`
- MCP rejected the credentials

After this pass:

- tenant defaults now target `https://lifeline-api`
- the Lifeline API can participate in refresh-token style connector sessions
- issued Lifeline API tokens will receive the task scopes that MCP tools expect
- repo tests passed after the MCP-edge diagnostics hardening

## Exact retained artifact paths

- `docs/issues/mcp-server/step-07-oauth-auth0-support/planning/2026-03-11-generic-connector-interoperability-plan.md`
- `docs/issues/mcp-server/step-07-oauth-auth0-support/implementation/2026-03-11-generic-connector-interoperability-implementation.md`
- `docs/issues/mcp-server/step-07-oauth-auth0-support/final/2026-03-11-generic-connector-interoperability-closeout.md`

## Next smallest step

Retry the Claude hosted connector against `https://mcp.lifeline.a2z-us.com/mcp`.

If it still fails, inspect the next Auth0 log event and confirm whether the connector now receives:

- audience `https://lifeline-api`
- scopes including `tasks:read` and `tasks:write`

If both are present and the MCP server still rejects the connection, the next blocker is inside the connector or the MCP edge, not Auth0 issuance.