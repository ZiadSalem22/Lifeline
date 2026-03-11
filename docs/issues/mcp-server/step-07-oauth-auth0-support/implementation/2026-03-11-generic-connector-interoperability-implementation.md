# Step 07 implementation: generic connector interoperability hardening

## Scope

This implementation pass addressed the post-callback failure mode for hosted OAuth connectors:

- connector finishes Auth0 login successfully
- MCP connection still fails because the connector receives the wrong token audience or insufficient MCP scopes

## Changes applied

### Auth0 tenant changes

Applied directly in the production Auth0 tenant:

- set tenant `default_audience` to `https://lifeline-api`
- enabled `allow_offline_access: true` on the `Lifeline API` resource server
- updated and deployed the bound Post-Login Action `AddUserClaims`

The deployed Action now:

- preserves existing Lifeline custom claims
- detects when the issued token targets `https://lifeline-api`
- adds `tasks:read`
- adds `tasks:write`

### Repo code changes

Updated `services/lifeline-mcp` to improve failure diagnostics without loosening security:

- `src/auth/auth0TokenVerifier.js`
  - log expected issuer and audiences for rejected tokens
  - log a sanitized untrusted-token summary for debugging
  - return a clearer message for wrong-audience tokens
- `src/auth/principal.js`
  - make scope-denied wording auth-method neutral instead of API-key specific
- `test/mcpService.test.js`
  - assert the wrong-audience response message is explicit

### Canonical docs update

Updated:

- `docs/operations/lifeline-mcp-auth0-oauth-runbook.md`

Added operator guidance for:

- tenant Default Audience
- Lifeline API offline access
- Post-Login Action scope injection for generic connectors

## Why this shape was chosen

The MCP service already had the correct security boundary:

1. validate issuer and audience at the public MCP edge
2. only then resolve the OAuth principal inside the internal backend adapter

The failure was not caused by principal hydration or tool auth branching. The failure came from Auth0 issuing a browser-login-style token instead of a Lifeline API token for hosted connectors that do not expose explicit audience controls.

## What was intentionally not changed

- no acceptance of arbitrary Auth0 tenant tokens
- no acceptance of `/userinfo` audience tokens
- no fallback identity matching by email or name
- no client-specific Claude or VS Code logic in repo code

## Validation performed

### Tenant and Action state

Verified live after change:

- tenant `default_audience` is `https://lifeline-api`
- Lifeline API `allow_offline_access` is `true`
- updated Post-Login Action version is deployed and bound to `post-login`

### MCP package tests

Ran from `services/lifeline-mcp`:

- `npm test`

Result:

- 8 tests passed
- wrong-audience path now reports a specific audience mismatch message

## Remaining validation gap

This pass cannot fully prove hosted connector success without a fresh real connector login after the tenant changes.

The next real-world validation should confirm that Auth0 logs now show issuance for `https://lifeline-api` instead of Auth0 `userinfo` when a hosted connector such as Claude retries the connection.