# Step-06 implementation report: self-serve MCP API keys in Profile

Date: 2026-03-07

## Summary

Implemented authenticated self-serve MCP API key management in the existing Profile page with user-scoped list, create, and revoke flows.

## Backend changes

- added self-serve MCP API key application use-cases under `backend/src/application/mcpApiKeys/`
- added `backend/src/controllers/McpApiKeyController.js`
- added `backend/src/routes/mcpApiKeyRoutes.js`
- expanded `backend/src/infrastructure/TypeORMMcpApiKeyRepository.js` with user-scoped list/find/revoke support
- mounted authenticated `/api/mcp-api-keys` routes from `backend/src/index.js`
- added request validation for self-serve create and bounded list query parameters
- reused the existing issuance and resolution pipeline so created keys stay compatible with MCP auth

## Frontend changes

- extracted Profile UI into `client/src/components/profile/`
- added `ProfileDetailsCard.jsx` for profile editing
- added `ApiKeysCard.jsx` for self-serve MCP API key management
- kept `client/src/components/ProfilePanel.jsx` as a compatibility re-export
- extended `client/src/utils/api.js` with profile save and MCP API key helpers

## Hardening applied after review

- added trustworthy load-failure states and retry affordances for profile and API key loading
- separated API key load failures from the empty-state experience
- added explicit labeling/help text for the one-time plaintext secret field
- bounded `GET /api/mcp-api-keys` with validated `limit` support
- added OpenAPI annotations for the new routes
- corrected malformed API documentation structure

## Tests added or updated

Backend:

- `backend/test/application/CreateSelfServeMcpApiKey.test.js`
- `backend/test/application/McpApiKeyManagement.test.js`
- `backend/test/application/SelfServeMcpApiKeyCompatibility.test.js`
- `backend/test/integration/mcpApiKeyRoutes.test.js`

Frontend:

- `client/src/tests/profileApiKeys.test.jsx`
- `client/src/tests/profileUpdate.test.jsx`

## Canonical docs updated

- `docs/api/auth-profile-and-settings-endpoints.md`
- `docs/backend/auth-user-attachment-and-rbac.md`
- `docs/backend/README.md`
- `docs/backend/mcp-api-key-management.md`
- `docs/data-model/README.md`
- `docs/data-model/mcp-api-keys.md`
- `docs/features/FEATURES.md`
- `docs/frontend/profile-and-onboarding-screens.md`
- `docs/product/onboarding-profile-and-preferences.md`

## Validation status

Validated locally with focused backend tests, focused frontend tests, targeted frontend lint for changed files, and a successful frontend production build.
