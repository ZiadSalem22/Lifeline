# Lifeline MCP Auth0/OAuth operator runbook

## Purpose

This runbook covers the bounded operator work needed to enable and validate Auth0/OAuth authentication for the public Lifeline MCP service while preserving existing API-key auth.

## Canonical sources used for this document

- [compose.production.yaml](../../compose.production.yaml)
- [compose.production.env.example](../../compose.production.env.example)
- [services/lifeline-mcp/.env.example](../../services/lifeline-mcp/.env.example)
- [services/lifeline-mcp/src/app.js](../../services/lifeline-mcp/src/app.js)
- [services/lifeline-mcp/src/config.js](../../services/lifeline-mcp/src/config.js)
- [services/lifeline-mcp/scripts/mcp-client-cli.js](../../services/lifeline-mcp/scripts/mcp-client-cli.js)
- [docs/api/mcp-server-endpoints-and-auth.md](../api/mcp-server-endpoints-and-auth.md)
- [docs/operations/DEPLOY_BRANCH_CD.md](DEPLOY_BRANCH_CD.md)
- [docs/operations/deployment-verification-and-smoke-checks.md](deployment-verification-and-smoke-checks.md)

## Required host-side env and runtime settings

At minimum, production OAuth enablement expects these values in `/opt/lifeline/shared/.env.production`:

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_AUDIENCE_ALT` when multiple audiences are intentionally accepted
- `AUTH0_ISSUER`
- `MCP_AUTH0_DOMAIN` only when the MCP service should use a different Auth0 domain than the main app
- `MCP_AUTH0_AUDIENCE` only when the MCP service should use a different audience than the main app
- `MCP_AUTH0_AUDIENCE_ALT`
- `MCP_AUTH0_ISSUER`
- `MCP_AUTH0_SUPPORTED_SCOPES`
- `MCP_AUTH0_REGISTRATION_ENDPOINT` when Auth0 dynamic client registration is intentionally enabled
- `MCP_AUTH0_REVOCATION_ENDPOINT` when a non-default revocation endpoint must be advertised
- `MCP_AUTH0_RESOURCE_NAME`
- `MCP_AUTH0_SERVICE_DOCUMENTATION_URL` when a public documentation URL should be advertised in metadata

If the MCP runtime should reuse the main app Auth0 issuer and audience, leave the `MCP_AUTH0_*` override variables blank and rely on the shared `AUTH0_*` values.

If the MCP runtime should use a different Auth0 tenant or API than the main app, set `MCP_AUTH0_ISSUER` together with the matching `MCP_AUTH0_DOMAIN`, `MCP_AUTH0_AUDIENCE`, and optional `MCP_AUTH0_AUDIENCE_ALT` values. Setting only `MCP_AUTH0_DOMAIN` will not override a populated shared `AUTH0_ISSUER`.

## Auth0 tenant prerequisites

Before enabling OAuth for MCP clients, operators should complete these Auth0-side checks.

### 1. Enable the Resource Parameter Compatibility Profile

Auth0 MCP guidance requires resource-parameter compatibility so standards-based MCP clients can request tokens for the MCP protected resource.

Enable it in the Auth0 Dashboard:

1. open **Settings**
2. open **Advanced**
3. enable **Resource Parameter Compatibility Profile**

This is important because MCP clients use the RFC 8707 `resource` parameter rather than Auth0's historical `audience`-only flow.

### 2. Decide client registration mode

Recommended production default:

- static client registration in Auth0

Optional advanced path:

- dynamic client registration only when tenant controls, ACLs, and monitoring are in place

If DCR is enabled and should be advertised to MCP clients, copy the Auth0 registration endpoint into `MCP_AUTH0_REGISTRATION_ENDPOINT`.

### 3. Create or assign an MCP-capable Auth0 client application

Recommended shape:

- a dedicated MCP-oriented Auth0 application/client
- callback URLs registered for the exact MCP clients you want to support
- PKCE-capable authorization code flow enabled for interactive clients

Redirect URI values are client-specific and are not defined in repository code. Use the chosen MCP client's documented callback URLs when registering it in Auth0.

For MCP Inspector, Auth0 documentation currently shows `http://localhost:6274/oauth/callback` as a static-registration example.

### 4. Grant the Lifeline MCP task scopes

Recommended OAuth API permissions mirror the current MCP tool-layer contract:

- `tasks:read`
- `tasks:write`

If a token authenticates successfully but does not include the required task scopes, the server will initialize but write or read tools may fail with `scope_denied`.

## Deployment behavior

No new deployment workflow is introduced.

OAuth support ships through the existing production path:

- merge to `main`
- promote to `deploy`
- let `deploy-production.yml` update the release and restart containers

The MCP container now receives both the shared `AUTH0_*` values and the optional `MCP_AUTH0_*` overrides from `compose.production.yaml`.

## Post-deploy validation checklist

### 1. Health and metadata

Validate:

- `https://mcp.lifeline.a2z-us.com/health`
- `https://mcp.lifeline.a2z-us.com/.well-known/oauth-protected-resource/mcp`
- `https://mcp.lifeline.a2z-us.com/.well-known/oauth-authorization-server`

Expected result:

- health returns `200`
- health includes both `api-key` and `auth0-oauth` in the `auth` field when OAuth is enabled
- the protected-resource metadata points to the MCP resource
- the authorization-server metadata points to the configured Auth0 issuer and endpoints

### 2. Existing API-key regression check

Validate that the current public API-key path still works, for example with the repo-local CLI:

- `node scripts/mcp-client-cli.js list-tools --server-url https://mcp.lifeline.a2z-us.com/mcp --api-key <issued-key>`

### 3. OAuth bearer-token validation

After obtaining a valid Auth0 access token for the MCP audience and task scopes, validate:

- `node scripts/mcp-client-cli.js list-tools --server-url https://mcp.lifeline.a2z-us.com/mcp --access-token <token>`
- `node scripts/mcp-client-cli.js call-tool --server-url https://mcp.lifeline.a2z-us.com/mcp --access-token <token> --tool search_tasks --args-json '{"query":"smoke"}'`

### 4. Negative-path validation

Confirm at least one of:

- expired token returns `401`
- wrong-audience token returns `401`
- insufficient-scope token initializes but tool calls fail with `scope_denied`

## Troubleshooting hints

### Metadata endpoint is missing

Check:

- the MCP container received Auth0 issuer and audience values
- `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` or MCP overrides are not blank
- the MCP service restarted with the new env

### OAuth token is rejected immediately

Check:

- issuer matches the token `iss`
- audience matches the token `aud`
- Auth0 Resource Parameter Compatibility Profile is enabled
- the token was issued for the MCP resource/API and not only for browser login

### Token authenticates but tools fail with `scope_denied`

Check:

- the token contains `tasks:read` and/or `tasks:write`
- Auth0 API permissions were granted to the client
- the user completed a fresh consent flow after permissions changed

## Related canonical documents

- [docs/api/mcp-server-endpoints-and-auth.md](../api/mcp-server-endpoints-and-auth.md)
- [docs/backend/mcp-authentication-and-principal-resolution.md](../backend/mcp-authentication-and-principal-resolution.md)
- [docs/architecture/runtime-topology.md](../architecture/runtime-topology.md)
