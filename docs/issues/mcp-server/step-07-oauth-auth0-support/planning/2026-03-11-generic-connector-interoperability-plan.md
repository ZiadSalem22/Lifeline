# Step 07 plan extension: generic connector interoperability for Lifeline MCP

## Objective

Make the public Lifeline MCP OAuth path work for present and future hosted OAuth connectors without weakening backend token validation.

The goal is not to accept arbitrary Auth0 tenant tokens. The goal is to ensure that standards-based connectors receive a valid Lifeline API access token by default, so the existing MCP edge and principal-resolution flow can accept them consistently.

## Governance basis used for this plan

- backend-engineering governance: keep token validation at the MCP edge and preserve dependency direction
- code-quality governance: prefer a bounded fix at the source of failure instead of spreading fallback logic across layers
- documentation governance: retain this plan under the existing Step-07 issue-history path and update operations docs only if runtime or operator expectations change

## Current failure model

Observed Claude connector behavior now reaches successful Auth0 login, but recent Auth0 logs show issuance for:

- audience: `https://dev-1b4upl01bjz8l8li.us.auth0.com/userinfo`
- granted scope: `offline_access`

instead of a Lifeline API token for:

- audience: `https://lifeline-api`
- MCP task scopes such as `tasks:read` and `tasks:write`

This means the callback problem is resolved, but generic hosted connectors can still fail if Auth0 defaults to an OIDC login token instead of an API access token.

## Architecture decision

Keep the current security boundary:

1. the public MCP service validates Auth0 bearer tokens by issuer and audience
2. only validated claims are forwarded to the internal backend adapter
3. the backend resolves validated claims into a normalized Lifeline principal
4. tool authorization continues to depend on Lifeline MCP scopes

Do not loosen the MCP edge to accept:

- any token from the tenant regardless of audience
- `/userinfo` audience tokens
- login success without API access token semantics

## Workstreams

### 1. Tenant issuance audit

Inspect current Auth0 tenant and API settings for:

- default audience
- default directory and login behavior only as relevant to token issuance
- Lifeline API resource server scopes and grants
- Resource Parameter Compatibility Profile
- existing Post-Login Actions or Actions bindings that affect access-token issuance

### 2. Generic connector Auth0 strategy

Adopt one generic contract for connector interoperability:

- any approved public Auth0 client may be used for MCP
- the token must be minted for the Lifeline API audience
- the token must contain Lifeline MCP scopes required by the tool layer

Prefer tenant-side defaults that help generic connectors obtain the correct API token even when they do not expose explicit audience or resource controls.

### 3. Tenant changes

If the audit confirms the current gap, apply:

- tenant Default Audience set to `https://lifeline-api`
- confirm Resource Parameter Compatibility Profile remains enabled
- client grant coverage for the dedicated MCP public client against the Lifeline API
- Post-Login Action or equivalent issuance logic so Lifeline API access tokens include `tasks:read` and `tasks:write` for approved connector flows

### 4. MCP-edge hardening

Make only bounded code changes if useful for diagnostics or interoperability clarity:

- improve rejected-token diagnostics in `services/lifeline-mcp/src/auth/auth0TokenVerifier.js`
- improve OAuth error messaging in `services/lifeline-mcp/src/auth/oauthAuth.js`
- keep audience validation strict

### 5. Validation

Validate in this order:

1. Auth0 logs show connector token issuance for `https://lifeline-api`, not `/userinfo`
2. granted scopes include Lifeline task scopes
3. MCP initialization succeeds with OAuth bearer token
4. at least one read tool succeeds
5. at least one write tool succeeds if `tasks:write` is granted

## Non-goals

- no acceptance of arbitrary tenant tokens
- no fallback user matching by email or display name
- no moving public bearer-token validation from MCP edge into backend
- no client-specific code branches for Claude, VS Code, OpenAI, or other connectors

## Expected code impact

Primary fix is expected to be Auth0 configuration, not backend redesign.

Potential code changes are limited to the MCP edge for clearer diagnostics and operator visibility.

## Expected docs impact

If tenant defaults or operator expectations change, update:

- `docs/operations/lifeline-mcp-auth0-oauth-runbook.md`

Retain implementation and validation artifacts under the existing Step-07 issue-history path.

## Execution sequence

1. audit current tenant default-audience and Actions state
2. inspect current Lifeline API grants and scopes for the MCP public client
3. apply the smallest Auth0-side changes that guarantee Lifeline API token issuance for generic connectors
4. add bounded MCP-edge diagnostics only if the tenant fix alone is insufficient
5. re-test with a real connector and confirm the token audience and scopes in Auth0 logs
6. retain closeout findings under `docs/issues/mcp-server/step-07-oauth-auth0-support/final/`