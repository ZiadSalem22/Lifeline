# Auth0 client configuration closeout for real MCP clients

## Scope

This retained note closes the bounded Auth0-only question for Step 07:

- are the Auth0 application registrations correct for real MCP OAuth clients such as VS Code and Claude
- which Auth0 app should be used for MCP clients
- which callback, origin, and logout settings were wrong
- whether production MCP runtime assumptions remain aligned after the Auth0-side fix

This note does not re-open broader MCP runtime design or local VS Code client-state debugging.

## Final answer

Before this fix, the Auth0 client configuration was not correct for real MCP clients.

The concrete failure was an Auth0 callback mismatch for `https://claude.ai/api/mcp/auth_callback`.

After the tenant changes described below, the Auth0 configuration is coherent for the currently tested MCP clients:

- Claude callback accepted by the dedicated MCP public client
- VS Code redirect still accepted by the same dedicated MCP public client
- the Lifeline SPA app is no longer overloaded with MCP-client callback entries
- same Auth0 tenant and same Lifeline user population are preserved

## Audit findings

### Production runtime assumptions

Re-reading `services/lifeline-mcp/src/config.js` confirmed:

- the MCP runtime is keyed to issuer, resource or audience, and supported scopes
- the runtime does not hardcode or require one specific Auth0 application client id
- this bounded problem was therefore an Auth0 application-registration issue rather than a service-runtime code issue

Re-reading `docs/operations/lifeline-mcp-auth0-oauth-runbook.md` confirmed the intended operational pattern:

- keep an MCP-capable Auth0 public client for remote MCP OAuth flows
- use exact client-specific callback URLs
- keep issuer and resource alignment consistent with the production MCP surface

### Relevant Auth0 applications

The relevant Auth0 applications in the tenant were:

- `Lifeline`
  - type: SPA
  - client id: `5THMMyQGm2mIbpLnCVW1RpXGIyd1G9jr`
- `Lifeline - VS Code / MCP`
  - type: Native
  - client id: `VwWIutOvC8xw6fiIDzVCq5rJm2M0LoHR`

### Decisive failure evidence

Auth0 logs proved that the real failing Claude authorize request was using the Native MCP client id `VwWIutOvC8xw6fiIDzVCq5rJm2M0LoHR`.

The failure was:

- `unauthorized_client`
- `Callback URL mismatch. https://claude.ai/api/mcp/auth_callback is not in the list of allowed callback URLs`

At failure time, that Native client allowed:

- `https://vscode.dev/redirect`
- `http://127.0.0.1:33418`
- `https://claude.ai/api/mcp/`

That list was insufficient because Claude was actually using `https://claude.ai/api/mcp/auth_callback`, not `https://claude.ai/api/mcp/`.

The SPA app also still contained a Claude MCP callback entry, which blurred responsibilities between the Lifeline web app and the MCP public client.

## Configuration decision

The correct bounded strategy for the current production shape is:

- keep `Lifeline` as the web-only SPA application
- use one dedicated public Auth0 client for currently tested MCP clients
- keep both applications in the same tenant so the same Lifeline users continue to authenticate against the same identity system

Separate Auth0 apps per MCP client are not required yet for the currently tested VS Code and Claude paths.

One dedicated public MCP client is sufficient as long as:

- the exact redirect URIs used by the supported MCP clients are present
- the client remains a public client using PKCE-capable authorization flows
- the runtime continues to validate the same issuer and resource contract

## Changes applied in Auth0

### Dedicated MCP public client

The Native app `VwWIutOvC8xw6fiIDzVCq5rJm2M0LoHR` was updated and renamed from `Lifeline - VS Code / MCP` to `Lifeline - MCP Clients`.

Configured callback URLs now:

- `https://vscode.dev/redirect`
- `http://127.0.0.1:33418`
- `https://claude.ai/api/mcp/auth_callback`

Configured web origins now:

- `https://vscode.dev`
- `https://claude.ai`

Configured logout URLs now:

- `https://vscode.dev/redirect`
- `https://claude.ai/api/mcp/`

### Lifeline SPA application

The SPA app `5THMMyQGm2mIbpLnCVW1RpXGIyd1G9jr` was cleaned up so it no longer carries Claude MCP callback settings.

The Claude MCP-specific entry was removed from the SPA app so the SPA remains scoped to the Lifeline web application rather than remote MCP OAuth clients.

## Runtime alignment result

No bounded production code or runtime-doc change was required for this fix.

The current runtime assumptions remain aligned:

- issuer: `https://dev-1b4upl01bjz8l8li.us.auth0.com/`
- protected resource: `https://mcp.lifeline.a2z-us.com/mcp`
- supported scopes: `tasks:read`, `tasks:write`

Because the runtime does not hardcode a client id, changing or cleaning up Auth0 application registrations did not require a code change in `services/lifeline-mcp`.

## Validation result

### Configuration-layer validation

Direct Auth0 authorize-endpoint probes were used to distinguish callback mismatch from normal login handoff.

Results:

- Claude redirect `https://claude.ai/api/mcp/auth_callback` now returns a normal `302` to Auth0 login rather than `unauthorized_client`
- VS Code redirect `https://vscode.dev/redirect` also returns a normal `302` to Auth0 login when a PKCE-valid code challenge is supplied

One later failure log remained, but it was not a callback issue. It was a synthetic validation request using a too-short PKCE challenge:

- `Parameter 'code_challenge' must be between 43 and 128 characters long`

That confirms the remaining rejection was caused by the deliberately invalid probe input, not by callback registration.

### Callback mismatch status

Within the reviewed recent Auth0 failure logs, the known callback mismatch entries were historical failures from before the tenant update.

No new post-fix callback mismatch was produced by the validation probes after the dedicated MCP client was updated.

## Outcome

The answer to the original bounded question is now:

- before the fix, the Auth0 client configuration was wrong for real MCP clients
- after the fix, the Auth0 registrations are correct for the currently tested VS Code and Claude MCP flows at the Auth0 configuration layer

This resolves the known Auth0-side callback mismatch blocker.

It does not by itself prove end-to-end success inside every client UI, but it removes the concrete Auth0 registration defect that was blocking real MCP OAuth initiation.

## Exact retained artifact paths

- `docs/issues/mcp-server/step-07-oauth-auth0-support/final/2026-03-08-closeout-status.md`
- `docs/issues/mcp-server/step-07-oauth-auth0-support/final/2026-03-11-auth0-client-configuration-closeout.md`

## Next smallest step

Run one real interactive login from Claude or VS Code against the updated MCP public client and confirm the next blocker, if any, is beyond Auth0 callback registration.