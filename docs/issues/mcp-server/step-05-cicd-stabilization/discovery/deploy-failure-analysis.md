# Step-05 discovery: deploy failure analysis for `lifeline-mcp`

Date: 2026-03-07

## Scope

This discovery note records the bounded root-cause analysis for the post-cutover deployment instability that remained after step-04.

## Known runtime facts

- The production MCP service is healthy when `lifeline-mcp` is recreated on its own.
- The failure surface was localized to `Apply release on VPS`, not to DNS, TLS, the Nginx vhost, or the public MCP contract.
- The app and Postgres services remained recoverable while MCP loopback publication on `127.0.0.1:3030` was the unstable element.

## Strongest grounded explanation

The strongest repo-grounded explanation is that the full-stack compose recreate path can intermittently leave the MCP host-loopback publication unavailable even though the container image and runtime configuration are valid.

The best evidence is operational, not theoretical:

1. a failed automated redeploy left the MCP proxy target unavailable
2. recreating only `lifeline-mcp` from the active release restored the working loopback publication
3. the public MCP endpoint then passed real end-to-end smoke validation

Because the manual MCP-only recreate restored service without any Nginx, DNS, or application contract changes, the smallest safe stabilization is to encode that recovery shape directly into the release helper.

## Bounded stabilization target

Stabilize deployment orchestration without widening scope into unrelated runtime redesign:

- keep the deploy-branch model unchanged
- keep VPS-side secrets unchanged
- keep the MCP service thin and separate
- keep the reserved loopback bind contract unchanged
- add better MCP-specific diagnostics when loopback publication does not appear

## Docs impact identified

Canonical docs impacted by this stabilization:

- `docs/operations/DEPLOY_BRANCH_CD.md`
- `docs/operations/deployment-verification-and-smoke-checks.md`
- `docs/operations/production-runtime-and-rollback.md`

No API, product, or data-model docs were implicated.
