# ADR 0001: Separate lifeline-mcp runtime boundary

## Status

Accepted

## Date

2026-03-07

## Context

The Lifeline MCP initiative introduces a remote HTTP MCP surface for task-management tools.

The existing Lifeline production runtime already uses:

- the `deploy` branch as the production trigger
- GitHub Actions to ship release archives to the VPS
- release directories under `/opt/lifeline/releases`
- `/opt/lifeline/current` as the active symlink
- Docker Compose for runtime services
- Nginx as the public edge

The backend remains the source of truth for task behavior and now exposes bounded private adapter routes under `/internal/mcp/*`.

The remaining runtime decision was whether MCP should be folded into the existing app container/runtime or deployed as a separate service boundary.

## Decision

Lifeline deploys MCP as a separate `lifeline-mcp` container and public hostname.

The accepted production/runtime boundary is:

- public app traffic: `lifeline.a2z-us.com` → Nginx → `127.0.0.1:3020` → `lifeline-app`
- public MCP traffic: `mcp.lifeline.a2z-us.com` → Nginx → `127.0.0.1:3010` → `lifeline-mcp`
- internal MCP task behavior: `lifeline-mcp` → `http://lifeline-app:3000/internal/mcp/*`

The backend internal shared secret remains host-side and env-driven.

`lifeline-mcp` does not connect directly to PostgreSQL and does not reimplement task business rules.

## Consequences

### Positive

- MCP transport, auth, and edge concerns stay isolated from the main browser/API runtime.
- The backend remains the source of truth for task behavior.
- Public traffic still terminates only at Nginx.
- Both Node services stay privately bound on VPS loopback ports.
- Runtime secrets remain on the VPS in `/opt/lifeline/shared/.env.production`.

### Tradeoffs

- Production now has an additional container, loopback port, and Nginx host configuration to operate.
- MCP service health and backend health are related but not identical; operators must verify both.
- Nginx host configuration remains a host-managed step outside the GitHub Actions deploy workflow.

## Related Documentation Updates

- [docs/architecture/runtime-topology.md](../architecture/runtime-topology.md)
- [docs/operations/DEPLOY_BRANCH_CD.md](../operations/DEPLOY_BRANCH_CD.md)
- [docs/operations/production-runtime-and-rollback.md](../operations/production-runtime-and-rollback.md)
- [docs/operations/deployment-verification-and-smoke-checks.md](../operations/deployment-verification-and-smoke-checks.md)