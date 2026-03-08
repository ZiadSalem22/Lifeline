# Step 07 discovery: Auth0/OAuth support for Lifeline MCP

## Scope

Bounded discovery for adding Auth0/OAuth support to `lifeline-mcp` alongside the existing MCP API-key path.

## Sources reviewed

- MCP edge service under [services/lifeline-mcp/src/app.js](../../../../../services/lifeline-mcp/src/app.js) and related auth/backend adapter files
- backend Auth0 and internal MCP surfaces under [backend/src/middleware/auth0.js](../../../../../backend/src/middleware/auth0.js), [backend/src/internal/mcp/router.js](../../../../../backend/src/internal/mcp/router.js), and [backend/src/internal/mcp/principal.js](../../../../../backend/src/internal/mcp/principal.js)
- production runtime wiring in [compose.production.yaml](../../../../../compose.production.yaml) and [deploy/nginx/mcp.lifeline.a2z-us.com.conf](../../../../../deploy/nginx/mcp.lifeline.a2z-us.com.conf)
- active operations and architecture docs under [docs/operations](../../../../operations/README.md) and [docs/architecture/runtime-topology.md](../../../../architecture/runtime-topology.md)
- installed MCP SDK auth-router support and current Auth0 MCP guidance

## Key findings

1. `lifeline-mcp` was API-key-only at the public edge before this step.
2. The main Lifeline backend already had stable Auth0 support and user hydration behavior.
3. The backend internal MCP principal model already anticipated OAuth via `oauth_access_token` and `auth0_oauth` constants.
4. Existing architecture direction already favored keeping OAuth termination at the MCP edge and preserving a thin backend-internal adapter.
5. MCP clients increasingly expect OAuth discovery endpoints for protected-resource and authorization-server metadata.
6. Auth0 MCP interoperability depends on RFC 8707 resource support and client-registration setup, not just JWT validation code.
7. The current deployment/runtime model already had a safe place to add Auth0 env wiring without changing the database or widening the MCP service boundary.

## Constraints carried forward

- Preserve existing API-key auth.
- Do not add direct database access to `lifeline-mcp`.
- Keep task tools and scope enforcement principal-driven rather than auth-method-specific.
- Keep secrets host-side and do not commit client secrets.
- Route retained artifacts under `docs/issues/mcp-server/step-07-oauth-auth0-support/`.

## Discovery conclusion

The safest bounded design is to validate Auth0 access tokens at the `lifeline-mcp` edge, expose MCP-compatible OAuth metadata there, and resolve validated claims into the existing normalized internal MCP principal model through a new backend-internal OAuth principal resolver.
