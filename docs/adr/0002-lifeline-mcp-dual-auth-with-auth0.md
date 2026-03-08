# ADR 0002: Dual-auth Lifeline MCP with Auth0 OAuth at the MCP edge

## Status

Accepted

## Date

2026-03-08

## Context

Lifeline MCP is already running as a separate public service boundary with API-key authentication.

That API-key path works for current smoke and operator flows, but remote MCP clients increasingly expect OAuth metadata discovery and bearer-token authorization flows.

The existing Lifeline product already uses Auth0 for the main app, and the backend already has stable Auth0 user-upsert behavior through `ensureUserFromAuth0Claims()`.

The architectural question for this phase was whether OAuth support should:

- terminate at `lifeline-mcp`
- terminate deeper in the backend
- replace API keys entirely
- or introduce a second tool/business path

## Decision

Lifeline MCP keeps API-key auth and adds Auth0/OAuth bearer-token auth at the `lifeline-mcp` edge.

The accepted auth/runtime shape is:

- `lifeline-mcp` accepts either MCP API keys or Auth0 OAuth bearer tokens
- `lifeline-mcp` validates Auth0 bearer tokens itself
- `lifeline-mcp` exposes MCP-compatible OAuth metadata endpoints for the `/mcp` protected resource
- `lifeline-mcp` resolves both auth methods into the same normalized MCP principal contract
- the backend stays the source of truth for user attachment and task behavior
- the backend receives OAuth-authenticated MCP requests only as trusted internal principal context through the internal MCP adapter

The bounded backend addition is an internal OAuth principal resolver that uses the existing Auth0-backed user repository logic.

## Consequences

### Positive

- remote MCP clients now have a standards-aligned OAuth discovery path
- API-key auth remains available for existing operator and smoke flows
- the tool layer remains unchanged and principal-driven
- `lifeline-mcp` still does not connect directly to PostgreSQL
- user persistence and Auth0 claim hydration remain backend-owned

### Tradeoffs

- operators must configure Auth0 for MCP-specific OAuth use, including resource-parameter compatibility and client registration
- redirect URIs remain client-specific operational configuration, not repo-embedded constants
- Auth0 dynamic client registration is optional and requires explicit tenant hardening before use in production

## Related documentation updates

- [docs/api/mcp-server-endpoints-and-auth.md](../api/mcp-server-endpoints-and-auth.md)
- [docs/backend/mcp-authentication-and-principal-resolution.md](../backend/mcp-authentication-and-principal-resolution.md)
- [docs/operations/lifeline-mcp-auth0-oauth-runbook.md](../operations/lifeline-mcp-auth0-oauth-runbook.md)
- [docs/architecture/runtime-topology.md](../architecture/runtime-topology.md)
