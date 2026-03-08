# MCP authentication and principal resolution

## Purpose

This document describes how Lifeline MCP now supports both API-key auth and Auth0/OAuth bearer-token auth while preserving one normalized principal-driven execution path.

## Canonical sources used for this document

- [services/lifeline-mcp/src/app.js](../../services/lifeline-mcp/src/app.js)
- [services/lifeline-mcp/src/auth/requestAuthenticator.js](../../services/lifeline-mcp/src/auth/requestAuthenticator.js)
- [services/lifeline-mcp/src/auth/apiKeyAuth.js](../../services/lifeline-mcp/src/auth/apiKeyAuth.js)
- [services/lifeline-mcp/src/auth/auth0TokenVerifier.js](../../services/lifeline-mcp/src/auth/auth0TokenVerifier.js)
- [services/lifeline-mcp/src/auth/oauthAuth.js](../../services/lifeline-mcp/src/auth/oauthAuth.js)
- [services/lifeline-mcp/src/auth/principal.js](../../services/lifeline-mcp/src/auth/principal.js)
- [services/lifeline-mcp/src/backend/internalBackendClient.js](../../services/lifeline-mcp/src/backend/internalBackendClient.js)
- [backend/src/internal/mcp/router.js](../../backend/src/internal/mcp/router.js)
- [backend/src/internal/mcp/authRouter.js](../../backend/src/internal/mcp/authRouter.js)
- [backend/src/internal/mcp/authHandlers.js](../../backend/src/internal/mcp/authHandlers.js)
- [backend/src/application/ResolveMcpApiKeyPrincipal.js](../../backend/src/application/ResolveMcpApiKeyPrincipal.js)
- [backend/src/application/ResolveMcpOAuthPrincipal.js](../../backend/src/application/ResolveMcpOAuthPrincipal.js)
- [backend/src/infrastructure/TypeORMUserRepository.js](../../backend/src/infrastructure/TypeORMUserRepository.js)

## Auth termination point

OAuth termination remains at `lifeline-mcp`.

That means the MCP edge service is responsible for:

- choosing the external auth path for the incoming request
- validating Auth0 bearer tokens
- resolving API keys
- normalizing either auth result into one principal contract before any tool logic runs

The backend does **not** validate external OAuth bearer tokens on the internal MCP adapter path.

## Dual-auth selection rules

The MCP service now selects auth mode as follows:

1. if `x-api-key` is present, use API-key auth
2. else if the `Authorization` bearer token looks like a JWT and Auth0/OAuth is enabled, use Auth0/OAuth auth
3. otherwise treat the bearer token as an MCP API key

This preserves the current API-key compatibility path while allowing OAuth-style remote MCP clients to send bearer JWTs.

## API-key path

The API-key path is unchanged in its core behavior.

The MCP service still:

- extracts the presented key
- calls the backend-internal API-key resolver
- receives a normalized principal
- runs the unchanged tool layer with API-key scopes

## OAuth/Auth0 path

The new OAuth path is intentionally thin.

### Step 1: JWT validation in `lifeline-mcp`

The MCP service validates the bearer token using the configured Auth0 issuer and JWKS.

It requires:

- issuer match
- audience match
- RS256-signed JWT
- a stable `sub` claim

### Step 2: Scope extraction

The MCP service merges scope data from:

- the OAuth `scope` claim
- the Auth0 `permissions` array when present

Those values are passed through unchanged into the normalized MCP principal so the tool layer can continue enforcing `tasks:read` and `tasks:write` exactly as it already does for API keys.

### Step 3: Backend user resolution

After token validation succeeds, `lifeline-mcp` calls the backend-internal route:

- `/internal/mcp/auth/resolve-oauth-principal`

The backend-internal resolver then:

- calls `TypeORMUserRepository.ensureUserFromAuth0Claims()`
- updates or creates the current Lifeline user record based on the validated Auth0 claims
- returns a normalized internal MCP principal with:
  - `subjectType: oauth_access_token`
  - `authMethod: auth0_oauth`
  - the Auth0 `sub` as both subject anchor and Lifeline user id
  - the OAuth-derived task scopes

This keeps DB and current-user attachment behavior anchored in the backend rather than duplicating persistence logic in `lifeline-mcp`.

## Shared normalized principal model

Both auth paths converge into the same principal shape:

- `subjectType`
- `lifelineUserId`
- `authMethod`
- `scopes`
- `subjectId`
- `displayName`

Because of that shared contract:

- the MCP tool registry does not fork by auth method
- backend adapter calls stay unchanged
- task read and write tools still use the same scope checks

## Internal backend changes

The bounded backend addition for OAuth support is:

- `ResolveMcpOAuthPrincipal`
- `POST /internal/mcp/auth/resolve-oauth-principal`

This is intentionally parallel to the existing API-key resolver and stays within the internal MCP adapter boundary.

## Security boundary

The auth boundary remains:

- external OAuth validation and MCP protocol auth concerns at `lifeline-mcp`
- internal principal hydration and business logic inside the backend
- no direct PostgreSQL access from `lifeline-mcp`
- no committed secrets or client secrets in the repository

## Related canonical documents

- [docs/api/mcp-server-endpoints-and-auth.md](../api/mcp-server-endpoints-and-auth.md)
- [docs/backend/auth-user-attachment-and-rbac.md](auth-user-attachment-and-rbac.md)
- [docs/operations/lifeline-mcp-auth0-oauth-runbook.md](../operations/lifeline-mcp-auth0-oauth-runbook.md)
- [docs/adr/0002-lifeline-mcp-dual-auth-with-auth0.md](../adr/0002-lifeline-mcp-dual-auth-with-auth0.md)
