# Step-06 bounded plan: self-serve MCP API keys in Profile

Date: 2026-03-07

## Objective

Deliver authenticated self-serve MCP API key management for normal Lifeline users from the existing Profile page.

## Builder-guided design choices

### Frontend builder guidance applied

Using the frontend governance workflow:

- keep `/profile` as the route-level entry point
- treat the API key surface as a dedicated feature section inside Profile, not a new standalone route
- avoid a multi-step developer-portal flow
- provide explicit loading, empty, error, success, and irreversible-action feedback
- use an inline or tightly bounded card flow instead of introducing a large new navigation concept

### Backend builder guidance applied

Using the backend governance workflow:

- mount a dedicated authenticated router from `backend/src/index.js`
- keep route files thin
- keep controller methods thin
- place product logic in use-cases
- expand the MCP API key repository with user-scoped domain operations instead of ad-hoc inline queries
- enforce user scoping with `req.currentUser.id`

### Code-quality and refactor guidance applied

- use a bounded preparatory refactor on the Profile frontend only where needed to avoid turning `ProfilePanel` into a god component
- preserve current profile-edit behavior while extracting API key concerns into focused feature files
- reuse existing MCP issuance logic rather than duplicating secret-generation behavior

## Chosen v1 design

## 1. UI placement and interaction model

Chosen placement:

- existing `/profile` page
- dedicated `API Keys` card/section beneath the profile details form

Chosen interaction model:

- key list shown directly in the Profile surface
- `Create API key` action opens a bounded inline create form inside the card
- form fields:
  - key label/name
  - access preset (`Read only` or `Read and write`)
  - expiry preset (`1 day`, `7 days`, `30 days`, `90 days`, `Never`)
- successful creation reveals the plaintext key in a one-time reveal panel inside the same card with copy affordance and strong warning text
- revoke uses explicit confirmation and then refreshes the list

Reasoning:

- this preserves Profile as the single account-management surface
- it keeps the flow frictionless and v1-sized
- it avoids inventing a new product area

## 2. Backend/API contract

### `GET /api/mcp-api-keys`

Purpose:

- list the authenticated user's own MCP API keys by metadata only

Response shape:

```json
{
  "apiKeys": [
    {
      "id": "uuid",
      "name": "Desktop CLI",
      "keyPrefix": "lk_abcd1234",
      "scopes": ["tasks:read", "tasks:write"],
      "status": "active",
      "createdAt": "2026-03-07T12:00:00.000Z",
      "expiresAt": "2026-04-06T12:00:00.000Z",
      "lastUsedAt": null,
      "revokedAt": null
    }
  ]
}
```

Rules:

- metadata only
- newest first
- user-scoped only
- no plaintext secret ever returned
- expired keys should surface as `status: expired` even if the persisted row is still marked `active`

### `POST /api/mcp-api-keys`

Purpose:

- create a new MCP API key for the authenticated user

Request shape:

```json
{
  "name": "Desktop CLI",
  "scopePreset": "read_write",
  "expiryPreset": "30_days"
}
```

Accepted `scopePreset` values:

- `read_only`
- `read_write`

Accepted `expiryPreset` values:

- `1_day`
- `7_days`
- `30_days`
- `90_days`
- `never`

Response shape:

```json
{
  "apiKey": {
    "id": "uuid",
    "name": "Desktop CLI",
    "keyPrefix": "lk_abcd1234",
    "scopes": ["tasks:read", "tasks:write"],
    "status": "active",
    "createdAt": "2026-03-07T12:00:00.000Z",
    "expiresAt": "2026-04-06T12:00:00.000Z",
    "lastUsedAt": null,
    "revokedAt": null
  },
  "plaintextKey": "lk_abcd1234.secret-value"
}
```

Rules:

- plaintext key returned only once on create
- self-serve endpoint must reject operator-only scopes
- expiry is derived from presets server-side

### `POST /api/mcp-api-keys/:id/revoke`

Purpose:

- revoke one of the authenticated user's own keys

Response shape:

```json
{
  "apiKey": {
    "id": "uuid",
    "name": "Desktop CLI",
    "keyPrefix": "lk_abcd1234",
    "scopes": ["tasks:read", "tasks:write"],
    "status": "revoked",
    "createdAt": "2026-03-07T12:00:00.000Z",
    "expiresAt": "2026-04-06T12:00:00.000Z",
    "lastUsedAt": null,
    "revokedAt": "2026-03-07T12:30:00.000Z"
  }
}
```

Rules:

- must be user-scoped
- should behave idempotently for already revoked keys
- should not leak whether another user's key exists

## 3. Security behavior

- user id always comes from `req.currentUser.id`
- create/list/revoke operate only on the current user's records
- self-serve creation is limited to bounded scope presets only
- expiry is constrained to safe server-side presets only
- list and revoke return metadata only
- create returns plaintext once and only once
- no secret material should be logged or retained in docs/artifacts

## 4. Data model / migration expectation

Current expectation:

- no schema change is needed for v1
- existing `mcp_api_keys` columns already cover list/create/revoke/usage metadata

Repository expansion expected:

- list keys by user
- find key by id + user
- revoke key by id + user

## 5. Acceptance criteria

Backend:

- authenticated user can list only their own keys
- authenticated user can create a key with bounded scope + expiry presets
- plaintext key is returned once on create only
- authenticated user can revoke their own key
- invalid scope preset is rejected
- invalid expiry preset is rejected
- attempts to touch another user's key are blocked

Frontend:

- Profile page shows an `API Keys` section
- create flow works end to end
- one-time reveal warning and copy affordance work
- revoke flow works with confirmation
- loading / empty / error / success states are present

Compatibility:

- a newly created self-serve key resolves through the existing MCP API-key auth path

## 6. Validation plan

Automated:

- backend use-case tests for create/list/revoke rules
- backend route/controller integration tests for user scoping and validation
- frontend Vitest tests for render/create/reveal/revoke states

Runtime:

- local or production-shaped validation that a newly created self-serve key can authenticate through the MCP path
- standard app regression validation for Profile save behavior
- deploy-path production validation if implementation is clean

## 7. Deployment plan

If implementation and validation are clean:

1. commit the feature on `main`
2. merge or cherry-pick to `deploy` using the existing deploy-branch model
3. push `deploy`
4. watch `Deploy Lifeline Production`
5. validate production app + MCP health and the feature as far as practical without weakening auth boundaries

## 8. Documentation plan

Canonical docs expected to update:

- `docs/frontend/profile-and-onboarding-screens.md`
- `docs/product/onboarding-profile-and-preferences.md`
- `docs/features/FEATURES.md`
- `docs/api/auth-profile-and-settings-endpoints.md`
- `docs/backend/auth-user-attachment-and-rbac.md`
- `docs/data-model/` coverage for `mcp_api_keys`

Retained issue-history artifacts for this phase:

- `docs/issues/mcp-server/step-06-self-serve-api-keys/discovery/`
- `docs/issues/mcp-server/step-06-self-serve-api-keys/planning/`
- `docs/issues/mcp-server/step-06-self-serve-api-keys/implementation/`
- `docs/issues/mcp-server/step-06-self-serve-api-keys/final/`
