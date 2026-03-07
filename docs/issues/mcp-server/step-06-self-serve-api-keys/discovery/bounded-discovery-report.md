# Step-06 bounded discovery: self-serve MCP API keys in Profile

Date: 2026-03-07

## Scope

This bounded discovery pass only covered the implementation truth needed to add self-serve MCP API key management to the authenticated Profile surface.

## Governance sources actively used

- `.github/instructions/frontend-engineering-governance.instructions.md`
- `.github/instructions/backend-engineering-governance.instructions.md`
- `.github/instructions/code-quality-governance.instructions.md`
- `.github/instructions/docs-governance.instructions.md`
- `.github/instructions/api-docs.instructions.md`
- `.github/instructions/backend-docs.instructions.md`
- `.github/instructions/frontend-docs.instructions.md`
- `.github/instructions/product-docs.instructions.md`
- `.github/instructions/data-model-docs.instructions.md`
- `.github/instructions/refactor-governance.instructions.md`
- `.github/workflows-governance/frontend-engineering-governance-workflow.md`
- `.github/workflows-governance/backend-engineering-governance-workflow.md`
- `.github/workflows-governance/code-quality-governance-workflow.md`
- `.github/workflows-governance/documentation-governance-workflow.md`
- `.github/workflows-governance/refactor-governance-workflow.md`
- builder/reviewer agent guidance under `.github/agents/`

## Repo truth found

### 1. Current Profile page placement and structure

Current Profile route and composition:

- `client/src/pages/ProfilePage.jsx`
- `client/src/components/ProfilePanel.jsx`
- `client/src/pages/ProfilePage.module.css`

Observed shape:

- `ProfilePage` is already the canonical authenticated placement for ongoing profile management.
- `ProfilePanel` is a single loose component under `client/src/components/` rather than an organized profile feature directory.
- `ProfilePanel` currently owns its own fetch/save logic, loading state, success toast state, and inline card/form rendering.
- The page already uses the app shell and `ProtectedRoute`, so adding API key management to Profile matches existing product truth.

Implication:

- The feature should stay on Profile.
- A bounded frontend refactor is justified to split the current loose `ProfilePanel` into profile-focused feature components while preserving the `/profile` route and existing profile-edit behavior.

### 2. Existing frontend UI patterns worth reusing

Relevant surfaces inspected:

- `client/src/components/settings/Settings.jsx`
- `client/src/components/settings/Settings.module.css`
- `client/src/components/settings/ExportDataModal.jsx`
- `client/src/components/common/Modal.jsx`
- `client/src/tests/profileUpdate.test.jsx`
- `client/src/tests/exportDataModal.test.jsx`

Observed patterns:

- small blocking interactions sometimes use the existing shared `Modal`
- destructive confirmation often uses bounded `window.confirm(...)`
- form and panel styling already uses CSS-driven cards/panels in `Settings.module.css`
- frontend tests commonly mock `useApi()` and use Testing Library/Vitest for user flows

Implication:

- v1 API key creation can use a bounded inline form or small modal-equivalent surface
- revoke can use explicit confirmation without inventing a new dialog system
- loading / empty / error / success states must be explicit because governance requires them for all data-dependent views

### 3. Existing backend current-user patterns to reuse

Relevant backend surfaces inspected:

- `backend/src/index.js`
- `backend/src/middleware/auth0.js`
- `backend/src/middleware/attachCurrentUser.js`
- `backend/src/middleware/roles.js`
- `backend/src/middleware/validate.js`
- `backend/src/utils/errors.js`

Observed shape:

- `/api` is globally protected by `checkJwt` + `attachCurrentUser`
- current-user data is already normalized onto `req.currentUser`
- `requireAuth()` is the standard user-gate for authenticated product routes
- legacy backend reality is still a large monolithic `backend/src/index.js`, but governance strongly prefers route/controller/use-case layering for new work

Implication:

- new self-serve routes should be normal authenticated product API routes under `/api`, scoped by `req.currentUser.id`
- new work should avoid adding more inline business logic to `backend/src/index.js`
- the safest bounded approach is: add a dedicated router + controller + use-cases, then mount that router from `backend/src/index.js`

### 4. Existing MCP API key data model and issuance logic

Relevant MCP key surfaces inspected:

- `backend/src/infra/db/entities/McpApiKeyEntity.js`
- `backend/src/migrations/1772862400000-add-mcp-api-keys.js`
- `backend/src/infrastructure/TypeORMMcpApiKeyRepository.js`
- `backend/src/application/IssueMcpApiKey.js`
- `backend/src/application/ResolveMcpApiKeyPrincipal.js`
- `backend/src/utils/mcpApiKeys.js`
- `backend/src/scripts/issue-mcp-api-key.js`
- `backend/src/internal/mcp/authHandlers.js`
- `services/lifeline-mcp/src/auth/apiKeyAuth.js`
- `services/lifeline-mcp/src/backend/internalBackendClient.js`

Observed shape:

- `mcp_api_keys` already exists with user ownership, prefix, hash, scopes, status, expiry, usage, and revoke fields
- plaintext secrets are not stored; only hashed secret material is persisted
- `IssueMcpApiKey` already generates the prefix + secret, hashes the secret, persists the record, and returns the plaintext once
- `ResolveMcpApiKeyPrincipal` already validates presented API keys, blocks revoked/expired keys, and records usage
- the current operator path is the script `backend/src/scripts/issue-mcp-api-key.js`
- repository support is incomplete for self-serve product usage: it currently supports find/save/recordUsage but not user-scoped list or revoke helpers

Implication:

- existing issuance logic should be reused, not duplicated
- self-serve create should wrap `IssueMcpApiKey` with narrower product-safe scope and expiry rules
- repository expansion is needed for list + revoke
- no secret-boundary redesign is needed

### 5. Scope and security implications

Current truth:

- generic issuance logic currently allows `tasks:read`, `tasks:write`, `tasks:*`, and `*`
- current MCP auth already trusts the persisted scopes array
- `tasks:write` already implies delete behavior in the bounded MCP implementation

Implication:

- the self-serve product endpoint must not expose the broader operator scopes
- user-facing scope input should be narrowed to two presets only:
  - read only -> `tasks:read`
  - read/write -> `tasks:read`, `tasks:write`
- expiry should be preset-driven rather than arbitrary freeform timestamps for v1
- plaintext key must only be returned from create and never from list/revoke

### 6. Likely touched implementation surfaces

Frontend:

- `client/src/components/ProfilePanel.jsx`
- new profile feature components under `client/src/components/profile/`
- `client/src/utils/api.js`
- frontend tests under `client/src/tests/`

Backend:

- `backend/src/index.js` for bounded router mount / limiter hookup
- `backend/src/infrastructure/TypeORMMcpApiKeyRepository.js`
- new controller / route / application files for list/create/revoke
- `backend/src/validators/`
- backend tests under `backend/test/`

Docs likely impacted:

- `docs/frontend/profile-and-onboarding-screens.md`
- `docs/product/onboarding-profile-and-preferences.md`
- `docs/features/FEATURES.md`
- `docs/api/auth-profile-and-settings-endpoints.md`
- `docs/backend/auth-user-attachment-and-rbac.md`
- likely a new `docs/data-model/` doc for `mcp_api_keys`

Deployment/runtime:

- no material deployment-model change is required
- expected release impact is application code + docs only
- CI/CD governance still applies at deploy time because the feature is expected to go through the existing `deploy` branch production workflow

## Discovery conclusion

The smallest safe product-complete implementation is:

1. keep the feature on Profile
2. add a dedicated API Keys card/section inside the Profile surface
3. reuse `IssueMcpApiKey` for creation behind a new self-serve wrapper use-case
4. add user-scoped list + revoke backend use-cases and repository helpers
5. keep self-serve scope and expiry choices intentionally narrow
6. return plaintext only on creation
7. avoid schema changes unless implementation reveals a real gap
8. deploy through the existing `deploy` branch production path once validation is clean
