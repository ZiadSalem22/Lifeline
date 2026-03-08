# MCP server endpoints and authentication

## Purpose

This document describes the public Lifeline MCP HTTP surface, its authentication modes, and the OAuth metadata endpoints exposed for remote MCP clients.

## Canonical sources used for this document

- [services/lifeline-mcp/src/app.js](../../services/lifeline-mcp/src/app.js)
- [services/lifeline-mcp/src/config.js](../../services/lifeline-mcp/src/config.js)
- [services/lifeline-mcp/src/auth/requestAuthenticator.js](../../services/lifeline-mcp/src/auth/requestAuthenticator.js)
- [services/lifeline-mcp/src/auth/apiKeyAuth.js](../../services/lifeline-mcp/src/auth/apiKeyAuth.js)
- [services/lifeline-mcp/src/auth/auth0TokenVerifier.js](../../services/lifeline-mcp/src/auth/auth0TokenVerifier.js)
- [services/lifeline-mcp/src/auth/oauthAuth.js](../../services/lifeline-mcp/src/auth/oauthAuth.js)
- [services/lifeline-mcp/src/backend/internalBackendClient.js](../../services/lifeline-mcp/src/backend/internalBackendClient.js)

## Public endpoints

### `GET /health`

Returns MCP runtime health and currently enabled auth modes.

Successful response includes:

- `status`
- `service`
- `publicBaseUrl`
- `transport`
- `auth`
- `oauth` when Auth0/OAuth is enabled
- `mode`

### `POST /mcp`

The MCP Streamable HTTP endpoint.

#### Supported auth modes

The server accepts either of the following:

- API key auth
  - `Authorization: Bearer <mcp-api-key>`
  - `x-api-key: <mcp-api-key>`
- Auth0 OAuth access token auth
  - `Authorization: Bearer <auth0-access-token>`

#### Auth behavior

- if `x-api-key` is present, the request is treated as API-key auth
- if the bearer token looks like a JWT and Auth0/OAuth is enabled, the request is treated as OAuth auth
- otherwise the bearer token is treated as an MCP API key

#### OAuth validation rules

For Auth0 bearer tokens, the MCP service:

- validates the JWT against the configured Auth0 issuer JWKS
- requires the token issuer to match the configured Auth0 issuer
- requires the token audience to match `MCP_AUTH0_AUDIENCE` / `AUTH0_AUDIENCE` or their `*_ALT` variants
- extracts scopes from the token `scope` claim and Auth0 `permissions` array when present
- resolves the Lifeline principal through the backend-internal OAuth principal resolver

#### Scope behavior

OAuth-authenticated principals and API-key-authenticated principals both flow into the same normalized principal contract.

The MCP tool layer still enforces the existing tool scopes:

- `tasks:read`
- `tasks:write`
- `tasks:*`
- `*`

A token may authenticate successfully and still fail tool execution if it lacks the required task scopes.

### `GET /.well-known/oauth-protected-resource/mcp`

Returns OAuth 2.0 Protected Resource Metadata for the `/mcp` resource.

The response advertises:

- the MCP resource URL
- the Auth0 authorization server issuer used for OAuth
- supported MCP task scopes
- the configured MCP resource name when present

### `GET /.well-known/oauth-authorization-server`

Returns the OAuth authorization server metadata that MCP clients use for discovery.

The current metadata relays the configured Auth0 authorization endpoints, including:

- `issuer`
- `authorization_endpoint`
- `token_endpoint`
- `jwks_uri`
- `revocation_endpoint` when configured
- `registration_endpoint` when configured
- supported grant, response, PKCE, and scope metadata

## Error behavior

### Missing API key in API-key-only mode

When Auth0/OAuth is not enabled and no API key is provided, `/mcp` returns `401` with an MCP JSON-RPC error payload containing:

- `code: missing_api_key`
- a message instructing the client to provide a bearer token or `x-api-key`

### Missing or invalid OAuth bearer token

When Auth0/OAuth is enabled and the OAuth path fails, `/mcp` returns `401` and includes a `WWW-Authenticate` header that points clients at the protected-resource metadata document.

Representative MCP error codes include:

- `missing_auth`
- `oauth_token_expired`
- `invalid_oauth_token`
- `oauth_principal_resolution_failed`

### Scope failures

Tool-level scope denials continue to return MCP JSON-RPC errors with:

- HTTP `403`
- MCP error code `scope_denied`

## Client registration assumptions

The server now exposes the metadata remote MCP clients expect, but client registration remains an Auth0 concern.

Current operational assumptions are:

- static Auth0 client registration is the default and recommended production path
- dynamic client registration is optional and only advertised when `MCP_AUTH0_REGISTRATION_ENDPOINT` is configured
- redirect URIs are client-specific and must be registered in Auth0 using the chosen MCP client's documented callback values
- for operator validation, the repo-local CLI can now use `--access-token` as a bearer-token alias

## Related canonical documents

- [docs/backend/mcp-authentication-and-principal-resolution.md](../backend/mcp-authentication-and-principal-resolution.md)
- [docs/operations/lifeline-mcp-auth0-oauth-runbook.md](../operations/lifeline-mcp-auth0-oauth-runbook.md)
- [docs/architecture/runtime-topology.md](../architecture/runtime-topology.md)
