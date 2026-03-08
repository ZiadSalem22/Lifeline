# Step 07 implementation and hardening

## Implemented changes

### MCP edge service

Updated the public MCP service to support dual auth and OAuth metadata:

- [services/lifeline-mcp/src/config.js](../../../../../services/lifeline-mcp/src/config.js)
- [services/lifeline-mcp/src/app.js](../../../../../services/lifeline-mcp/src/app.js)
- [services/lifeline-mcp/src/errors.js](../../../../../services/lifeline-mcp/src/errors.js)
- [services/lifeline-mcp/src/auth/apiKeyAuth.js](../../../../../services/lifeline-mcp/src/auth/apiKeyAuth.js)
- [services/lifeline-mcp/src/auth/auth0TokenVerifier.js](../../../../../services/lifeline-mcp/src/auth/auth0TokenVerifier.js)
- [services/lifeline-mcp/src/auth/oauthAuth.js](../../../../../services/lifeline-mcp/src/auth/oauthAuth.js)
- [services/lifeline-mcp/src/auth/requestAuthenticator.js](../../../../../services/lifeline-mcp/src/auth/requestAuthenticator.js)
- [services/lifeline-mcp/src/backend/internalBackendClient.js](../../../../../services/lifeline-mcp/src/backend/internalBackendClient.js)
- [services/lifeline-mcp/scripts/mcp-client-cli.js](../../../../../services/lifeline-mcp/scripts/mcp-client-cli.js)
- [services/lifeline-mcp/package.json](../../../../../services/lifeline-mcp/package.json)

Key implementation outcomes:

- preserved API-key auth
- added Auth0 JWT validation through JWKS using `jose`
- added OAuth-aware `WWW-Authenticate` responses with protected-resource metadata
- exposed MCP-compatible OAuth well-known endpoints when Auth0 config is present
- kept one principal-driven MCP tool execution path

### Backend internal adapter

Added a bounded internal OAuth principal resolver:

- [backend/src/application/ResolveMcpOAuthPrincipal.js](../../../../../backend/src/application/ResolveMcpOAuthPrincipal.js)
- [backend/src/internal/mcp/authHandlers.js](../../../../../backend/src/internal/mcp/authHandlers.js)
- [backend/src/internal/mcp/authRouter.js](../../../../../backend/src/internal/mcp/authRouter.js)
- [backend/src/internal/mcp/router.js](../../../../../backend/src/internal/mcp/router.js)

Key backend outcome:

- validated Auth0 claims now become a normalized internal MCP principal through existing backend-owned user hydration behavior

### Runtime and env wiring

Updated production and local templates:

- [compose.production.yaml](../../../../../compose.production.yaml)
- [compose.production.env.example](../../../../../compose.production.env.example)
- [services/lifeline-mcp/.env.example](../../../../../services/lifeline-mcp/.env.example)

### Canonical documentation

Added or updated:

- [docs/api/mcp-server-endpoints-and-auth.md](../../../../api/mcp-server-endpoints-and-auth.md)
- [docs/backend/mcp-authentication-and-principal-resolution.md](../../../../backend/mcp-authentication-and-principal-resolution.md)
- [docs/operations/lifeline-mcp-auth0-oauth-runbook.md](../../../../operations/lifeline-mcp-auth0-oauth-runbook.md)
- [docs/operations/lifeline-mcp-first-cutover-runbook.md](../../../../operations/lifeline-mcp-first-cutover-runbook.md)
- [docs/operations/deployment-verification-and-smoke-checks.md](../../../../operations/deployment-verification-and-smoke-checks.md)
- [docs/architecture/runtime-topology.md](../../../../architecture/runtime-topology.md)
- [docs/adr/0002-lifeline-mcp-dual-auth-with-auth0.md](../../../../adr/0002-lifeline-mcp-dual-auth-with-auth0.md)
- impacted domain README files under `docs/api`, `docs/backend`, `docs/operations`, and `docs/adr`

## Hardening and review outcomes

### Behavior and boundary review

- OAuth terminates at the MCP edge, preserving the existing runtime boundary.
- The backend remains the owner of user hydration and business behavior.
- No direct DB access was added to `lifeline-mcp`.
- Existing API-key flows remain intact.

### Validation executed

#### Automated tests

- `services/lifeline-mcp`: `npm test` passed with OAuth metadata and bearer-token coverage
- `backend`: targeted internal MCP auth and internal MCP route regressions passed

#### Error scan

Changed source and test files were checked in-editor and reported no errors.

### Notable negative-path coverage

- expired OAuth access token rejected with `401`
- wrong-audience OAuth access token rejected with `401`
- missing OAuth subject rejected by backend internal principal resolver
- scope enforcement remains tool-layer driven

## Remaining deployment-time work

- populate production Auth0 env values on the VPS
- register MCP-capable Auth0 client applications and callback URLs
- promote the approved commit set from `main` to `deploy`
- run public health, metadata, API-key, and OAuth smoke checks after deployment
