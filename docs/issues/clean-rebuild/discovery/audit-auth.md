# Auth/Authz Audit — Lifeline OLD codebase (C:/Users/ziyad/Lifeline)

Repo is NOT a git repo locally — no commit history available; `warmUpAuth` audited from source only.

## 1. Auth0 JWT validation

**File: `backend/src/middleware/auth0.js`** (exports `{ checkJwt, warmUpAuth, getAuthReadiness }`)

| Aspect | Detail | Lines |
|---|---|---|
| Library | `express-oauth2-jwt-bearer` `auth()` | 111, 124–128 |
| Algorithm | `tokenSigningAlg: 'RS256'` only | 127 |
| Issuer | `https://${AUTH0_DOMAIN}`; `AUTH0_DOMAIN` env stripped of `https?://` + trailing `/`; **hardcoded fallback `dev-1b4upl01bjz8l8li.us.auth0.com`** | 75–77 |
| Audience | `AUTH0_AUDIENCE` (CSV) + `AUTH0_AUDIENCE_ALT` (CSV) merged/trimmed; default `'https://lifeline-api'` if unset; passed as string if 1, array if >1 | 113–126 |
| Prod guard | `NODE_ENV==='production'` && no `AUTH_DISABLED` → throws at boot if `AUTH0_DOMAIN` or audience missing | 116–118 |
| Dev bypass | `AUTH_DISABLED==='1'` → `checkJwt` is a no-op passthrough | 107–109 |
| Timeout wrapper | `checkJwtWithTimeout`: full-lifecycle `setTimeout` of `AUTH_TIMEOUT_MS` (env, default 10000 ms); on fire → 503 `{error:'Authentication service temporarily unavailable'}` + `recordAuthFailure('timeout')` | 133–175 |
| Readiness | `authReadiness` state: `jwksWarmedUp`, consecutiveFailures ≥3 → `degraded`; `getAuthReadiness()` returns `{ready, jwksWarmedUp, degraded, consecutiveFailures, lastSuccessAt, lastFailureAt, lastFailureReason}`; when disabled `{ready:true, bypassed:true}` | 9–42 |

**`warmUpAuth()`** (lines 82–103): skips if `AUTH_DISABLED==='1'`; GETs `https://{domain}/.well-known/openid-configuration` then `discovery.jwks_uri`, each via `fetchJsonWithTimeout` (destroy-based timer covering DNS+TCP+TLS+response, lines 47–72); sets `jwksWarmedUp=true` on success, warns and leaves false on failure. Invoked after `app.listen` in **both** `backend/src/index.js:1675–1684` and container entrypoint `backend/scripts/start-container.js:35–42`. `start-container.js` sequence: `waitForPostgres()` → `typeorm migration:run -d ./data-source-migrations.js` → require app → `listen(PORT||3000)` → `warmUpAuth()` (failure is non-fatal). Readiness surfaced at `GET /api/health/ready` (`index.js:224–240`): 200 only if `AppDataSource` query ok AND `authState.ready`; else 503.

**Middleware order** (`index.js:424`): `app.use('/api', checkJwt, attachCurrentUser)`. Public routes registered BEFORE it: `/api/health/db` (185), `/api/health/ready` (224), `/api/health/db/schema` (309), `/api/public/info` (412), `/internal/mcp` (127). Note `/api/reset-account` (138) and `/api/settings` (262) mount `checkJwt, attachCurrentUser, requireAuth()` explicitly. `GET /me` → 301 `/api/me` (427).

**Claims used** (`backend/src/auth/auth0Claims.js` + `attachCurrentUser.js` + `TypeORMUserRepository.ensureUserFromAuth0Claims`):
- `sub` (user id + `auth0_sub` column), `email` (lowercased), `name`, `picture`.
- Role claims: custom namespaces `https://lifeline-api/roles` (primary) and legacy `https://lifeline.app/roles` (`auth0Claims.js:1–3`), both merged/deduped. Primary role precedence: `admin` > `paid` > `free`, default `free` (`auth0Claims.js:18–24`).

**`attachCurrentUser`** (`backend/src/middleware/attachCurrentUser.js`):
- `AUTH_DISABLED==='1'`: attaches local user `AUTH_LOCAL_USER_ID` (default `'guest-local'`); loads real user/profile/settings from PG if exists; profile fallback `{onboarding_completed:true, start_day_of_week:'Monday'}` (lines 17–53).
- No `Authorization` header → `req.currentUser = null`, no DB touch (lines 57–60).
- Else: **upserts user on every request** via `ensureUserFromAuth0Claims` — overwrites `email/name/picture/role/subscription_status('none')` from claims (`TypeORMUserRepository.js:50–87`). ⚠️ **Auth0 role claims are source of truth; DB `role` is clobbered each request — `promote-admin` DB write is overwritten on next login unless the Auth0 claim carries `admin`.**
- Profile/settings load failures logged but tolerated individually; outer failure → **500** `{error:'Internal Server Error (Profile Load Failed)'}` (117–123, deliberate, not swallowed).

**`GET /api/me`** (`index.js:502–526`) response shape:
```json
{ "id","email","name","picture","role","roles":[], "subscription_status",
  "settings": null|{...},
  "profile": { "first_name","last_name","phone","country","city","timezone",
               "avatar_url":null,"start_day_of_week":null,"onboarding_completed":bool }
}
```
Profile fallback when absent: `{ "onboarding_completed": false }`. `GET /api/me/raw` (706–713) returns `{sub,email,claims:<full JWT payload>}` — behind checkJwt but not requireAuth.

**Onboarding flow**:
- Server `POST /api/profile` (`index.js:555–685`): requires `first_name`+`last_name` (400); accepts `email,phone,country,city,avatar_url,timezone,start_day_of_week,onboarding_completed`; normalizes/validates `start_day_of_week` to capitalized day names (400 otherwise); transaction creates user row if missing (`role:'free'`, `subscription_status:'none'`, `auth0_sub:sub`); email change checked for uniqueness → **409** `{error:'Email already in use by another account'}`; `onboarding_completed` is one-way (only set to true when body sends `true`).
- Client: `AuthProvider.loadIdentity` (`client/src/providers/AuthProvider.jsx:14–62`) — `getAccessTokenSilently` raced against 22s timeout, then `fetchMe` (`/api/me`); `login_required` → `loginWithRedirect`. Redirect to `/onboarding` when `currentUser.profile.onboarding_completed === false` (`client/src/app/App.jsx:62–70`). `OnboardingPage.jsx:42–79` POSTs `${VITE_API_BASE_URL}/profile` with `onboarding_completed:true`, handles 409 email conflict UI, then `refreshIdentity()`. Redirects away if `!isAuthenticated || guestMode` or already completed (30–36).

## 2. Guest mode

**Server-side ("hardened", no server guest):**
- No auth header → `currentUser=null`; `requireAuth()` (`backend/src/middleware/roles.js:5–13`) → 401 `'Please log in to use this feature. Guest mode works only locally.'`
- `GET /api/public/info` (no auth) advertises `guestMode:'local-only'` (`index.js:412–421`).
- `GET /api/tags` has an anonymous branch returning default tags (`index.js:1181–1196`) — **effectively dead in production** because `checkJwt` (authRequired) 401s tokenless requests first; reachable only with `AUTH_DISABLED=1`. Swagger `mode:'guest'` response shapes in JSDoc are legacy/dead.
- Guest role constant `GUEST:'guest'` in `backend/src/constants/roles.js` — unused by middleware (dead).

**Client-side:**
- `AuthProvider` (`AuthProvider.jsx`): `!isAuthenticated` → `guestMode=true, currentUser=null`.
- Storage: localStorage keys **`guest_todos`**, **`guest_tags`** (`client/src/hooks/useGuestStorage.js:20–21`); tags auto-seeded/merged with 10 defaults mirroring backend seed (ids `tag-work`…`tag-misc` with hex colors, lines 7–18).
- API surface (`client/src/utils/guestApi.js`), drop-in async parity chosen per-call in `TodoProvider.jsx` (`guestMode ? guestApi.X : apiX(fetchWithAuth)`): `fetchTodos, createTodo` (client-side recurrence expansion mirroring backend: modes `daily|dateRange|specificDays`, types `daily|weekly|monthly|custom`+interval; assigns `taskNumber = max+1`), `updateTodo, deleteTodo, toggleTodo` (spawns next recurrence occurrence on completion), `toggleFlag, fetchTags, createTag, updateTag, deleteTag`. **No guest equivalents** for search endpoint/stats/export/import/profile/mcp-keys — AdvancedSearch is fed `guestTodos/guestTags` props for client-side filtering (`App.jsx:758–772`).
- 401 fallback: `TodoProvider` flips to guest mode once (ref-guarded) on `status 401 | /Missing Refresh Token/ | /login_required/` with error `'Session expired. Using guest mode.'` (TodoProvider.jsx:56–66, 87–97).
- **Upgrade path: none — guest data is deleted on login.** `AuthProvider.jsx:67–75` removes `guest_todos`/`guest_tags` when `isAuthenticated` becomes true. No merge/import of guest data into the account.
- Dev-compose variant: `VITE_AUTH_DISABLED='1'` → `LocalAuthProvider` fake adapter (`AuthAdapterProvider.jsx:13–27`): `isAuthenticated:true`, `user.sub = VITE_AUTH_LOCAL_SUB || 'local-dev-user'`, token `'local-compose-token'`; pairs with server `AUTH_DISABLED=1` + `AUTH_LOCAL_USER_ID`.
- Dead code: `client/src/components/auth/Auth.jsx`, `SignInForm.jsx`, `SignUpForm.jsx` — not imported anywhere outside themselves. `AuthPage.jsx` just triggers `loginWithRedirect` (Universal Login; no local forms).

## 3. Roles / admin

- Role storage: `users.role` text NOT NULL default `'free'`; `users.subscription_status` default `'none'` (`backend/src/infra/db/entities/UserEntity.js:41–50`). Runtime authz uses `req.currentUser.roles` derived from **Auth0 claims** (see §1 caveat).
- Constants: `{GUEST:'guest', FREE:'free', PAID:'paid', ADMIN:'admin'}` (`backend/src/constants/roles.js`).
- Middleware (`backend/src/middleware/roles.js`): `requireAuth()`, `requireRole(role)` (403 `'Forbidden'`), `requireRoleIn([roles])`, `requirePaid()` (paid OR admin).
- Promote script: **`backend/src/scripts/promote-admin.js`** — `node src/scripts/promote-admin.js <user_id>`; sets `user.role='admin'` via TypeORM `User` repo; exit codes: 1 usage, 2 user-not-found, 3 error; exports `promoteAdmin` for tests (test at `backend/test/scripts/promoteAdmin.test.js`).
- Admin-only routes: `app.use('/api/admin', requireRole('admin'))` (`index.js:1151`) — **no `/api/admin/*` endpoints exist; gate is dead**. `app.use('/api/ai', requirePaid())` (1153) — no `/api/ai` endpoints either; `aiLimiter` (10/min) exempts admins (439–444).
- Role-based quotas (in-route): `free` → max 200 todos (`index.js:797–801`, 403 `'Free tier max tasks reached.'`); `free` → max 50 custom tags (1221–1225, `'Free tier max tags reached.'`).

## 4. MCP API keys

**Format & hashing** (`backend/src/application/IssueMcpApiKey.js`, `backend/src/utils/mcpApiKeys.js`):
- Plaintext key = `` `${keyPrefix}.${secret}` ``; `keyPrefix = 'lk_' + crypto.randomBytes(4).hex` (e.g. `lk_a1b2c3d4`, unique-checked, 5 attempts); `secret = crypto.randomBytes(24).base64url`.
- Hash stored: `HMAC-SHA256(secret, key = MCP_API_KEY_PEPPER)` hex (`mcpApiKeys.js:7–16`; pepper defaults to `''` if env unset — no error). Verify via `crypto.timingSafeEqual` (18–26).
- Allowed scopes: `tasks:read`, `tasks:write`, `tasks:*`, `*`; default `['tasks:read','tasks:write']` (`IssueMcpApiKey.js:7–13`).

**DB** (`backend/src/migrations/1772862400000-add-mcp-api-keys.js`, entity `McpApiKeyEntity.js`): table `mcp_api_keys` — `id text PK, user_id text FK→users ON DELETE CASCADE, name, key_prefix, key_hash, scopes jsonb default '[]' (CHECK array), status text default 'active' CHECK IN ('active','revoked','expired'), expires_at/last_used_at/revoked_at timestamptz NULL, last_used_ip, last_used_user_agent, revocation_reason, created_at, updated_at`; `UNIQUE INDEX ux_mcp_api_keys_prefix(key_prefix)`, `ix (user_id,status)`, partial ix on `expires_at`, `last_used_at`.

**Self-serve lifecycle** (mounted `index.js:468–470`: `/api/mcp-api-keys` behind `requireAuth()` + write limiter 10/min/user):
| Route | Validation (Joi, `backend/src/validators/index.js:77–132`) | Response |
|---|---|---|
| `GET /api/mcp-api-keys?limit=` | limit int 1–50 default 25 | `{apiKeys:[metadata], limit}` |
| `POST /api/mcp-api-keys` | `{name: 1–100 chars, scopePreset: 'read_only'\|'read_write', expiryPreset: '1_day'\|'7_days'\|'30_days'\|'90_days'\|'never'}` all required | 201 `{apiKey: metadata, plaintextKey}` (plaintext once) |
| `POST /api/mcp-api-keys/:id/revoke` | `:id` uuid | `{apiKey: metadata}`; idempotent; `revocation_reason:'user_self_service'` |

Presets (`selfServePresets.js`): `read_only→['tasks:read']`, `read_write→['tasks:read','tasks:write']`; expiry = now + days×24h, `never→null`. Metadata shape (`metadata.js:30–42`): `{id,name,keyPrefix,scopes,status(derived: revoked > expired(by expires_at≤now) > active),createdAt,expiresAt,lastUsedAt,revokedAt}` (ISO strings).

**CLI issuance** (arbitrary scopes/expiry): `backend/src/scripts/issue-mcp-api-key.js` — `--user-id|--email --name [--scopes csv] [--expires-at iso] [--create-user-if-missing --user-name] [--json]`.

**Auth for API-key requests** (dual-auth, ADR `docs/adr/0002-lifeline-mcp-dual-auth-with-auth0.md`):
1. Client → `POST /mcp` on `services/lifeline-mcp`. `requestAuthenticator.js`: `x-api-key` header ⇒ API-key path; else Bearer token: if `looksLikeJwt` && Auth0 enabled ⇒ OAuth path; else API-key path; missing ⇒ 401 (with `WWW-Authenticate` + `resource_metadata` when OAuth enabled).
2. API-key path: MCP calls backend `POST /internal/mcp/auth/resolve-api-key` with body `{apiKey, clientIp, clientUserAgent}`. All `/internal/mcp/*` requires header `x-lifeline-internal-service-secret` == `MCP_INTERNAL_SHARED_SECRET` (timing-safe, 503 if unconfigured, 401 if missing/wrong — `requireInternalServiceAuth.js`).
3. Backend `ResolveMcpApiKeyPrincipal.js`: parse at first `.`; prefix lookup; checks — unknown prefix→401 `'Invalid API key.'`, revoked→403, expired (by `expires_at` or status)→403, not-active→403, HMAC mismatch→401, user missing→404; best-effort `recordUsage` (`last_used_at/ip/user_agent`). Returns `{principal:{subjectType:'api_key',lifelineUserId,authMethod:'api_key',scopes,subjectId:<apiKeyId>,displayName}, apiKey:{id,name,keyPrefix,scopes}}`.
4. OAuth path: MCP verifies JWT locally (`auth0TokenVerifier.js`: `jose` remote JWKS at `{issuer}/.well-known/jwks.json`, checks `issuer`, `audience` (config.auth0.audiences), RS256; scopes = `scope`(space-split) ∪ `permissions`(array/comma)); then backend `POST /internal/mcp/auth/resolve-oauth-principal {claims,scopes}` upserts user from claims → principal `subjectType:'oauth_access_token'`, `authMethod:'auth0_oauth'`.
5. Principal forwarded to backend internal task/tag routes as headers `x-lifeline-principal-{subject-type,user-id,auth-method,scopes(csv),subject-id,display-name}` (`constants.js`); backend `requireInternalMcpPrincipal()` only requires `user-id` presence — **scope enforcement happens solely in the MCP tool layer** (`taskTools.js`: read tools assert `tasks:read`, write tools `tasks:write`; `tasks:*` and `*` wildcard-match — `services/lifeline-mcp/src/auth/principal.js:41–47`). Backend does not re-check scopes; trust boundary = shared secret.
- MCP serves OAuth protected-resource metadata via SDK `mcpAuthMetadataRouter` when Auth0 enabled (`app.js:106–116`); `/health` reports `auth: ['api-key','auth0-oauth']|['api-key']`.
- Frontend UI: `client/src/components/profile/ApiKeysCard.jsx` (list/create/revoke, defaults `scopePreset:'read_write'`, `expiryPreset:'30_days'`, plaintext shown once) via `client/src/utils/api.js:320–348`.

## 5. All auth-related env vars

| Var | Consumer (file) | Purpose / default |
|---|---|---|
| `AUTH0_DOMAIN` | backend `middleware/auth0.js:75`; mcp `config.js:76` (fallback) | Auth0 tenant domain → issuer `https://{domain}`; **backend fallback `dev-1b4upl01bjz8l8li.us.auth0.com`** |
| `AUTH0_AUDIENCE` | backend `auth0.js:113`; mcp `config.js:81` (fallback) | Expected JWT `aud` (CSV); backend default `https://lifeline-api` |
| `AUTH0_AUDIENCE_ALT` | backend `auth0.js:114`; mcp `config.js:82` | Extra accepted audiences (CSV) |
| `AUTH0_ISSUER` | mcp `config.js:84` only (backend ignores it despite `.env.example`) | Explicit issuer URL override for MCP |
| `AUTH_DISABLED` | backend `auth0.js:29,83,107`, `attachCurrentUser.js:17` | `'1'` = bypass JWT + attach local user (dev/compose verification) |
| `AUTH_LOCAL_USER_ID` | `attachCurrentUser.js:18` | User id attached when AUTH_DISABLED=1; default `guest-local` |
| `AUTH_TIMEOUT_MS` | `auth0.js:6` | Auth middleware + JWKS warm-up full-lifecycle timeout; default 10000 |
| `MCP_API_KEY_PEPPER` | backend `utils/mcpApiKeys.js:4`; compose.production.yaml:65 | HMAC key for API-key secret hashing; **defaults to `''` silently** |
| `MCP_INTERNAL_SHARED_SECRET` | backend `internal/mcp/constants.js:3`→`requireInternalServiceAuth`; mcp `config.js:100` | Shared secret for `/internal/mcp/*` header `x-lifeline-internal-service-secret` |
| `MCP_AUTH0_DOMAIN` / `MCP_AUTH0_AUDIENCE` / `MCP_AUTH0_AUDIENCE_ALT` / `MCP_AUTH0_ISSUER` | mcp `config.js:76–84` | MCP-specific Auth0 tenant/audience overrides (fall back to shared `AUTH0_*`); OAuth enabled iff issuer AND ≥1 audience |
| `MCP_AUTH0_SUPPORTED_SCOPES` | mcp `config.js:85` | Advertised scopes in OAuth metadata; default `tasks:read,tasks:write` |
| `MCP_AUTH0_REGISTRATION_ENDPOINT` / `MCP_AUTH0_REVOCATION_ENDPOINT` | mcp `config.js:86–89` | Optional DCR/revocation endpoints (revocation defaults `{issuer}/oauth/revoke`) |
| `MCP_AUTH0_RESOURCE_NAME` | mcp `config.js:112` | Resource name in protected-resource metadata; default `Lifeline MCP` |
| `MCP_AUTH0_SERVICE_DOCUMENTATION_URL` | mcp `config.js:87` | Optional docs URL in metadata |
| `MCP_PUBLIC_BASE_URL` / `MCP_ALLOWED_HOSTS` / `MCP_BIND_HOST` / `MCP_PORT` (`PORT` fallback) | mcp `config.js:74–98` | Resource URL for OAuth metadata / host allowlist / bind / port (3030) |
| `LIFELINE_BACKEND_BASE_URL` | mcp `config.js:99` | Backend base for internal calls; default `http://127.0.0.1:3000` |
| `MCP_REQUEST_TIMEOUT_MS` | mcp `config.js:101` (also JWKS fetch timeout floor 1000) | Backend/JWKS request timeout; default 5000 |
| `VITE_AUTH_DISABLED` | client `AuthAdapterProvider.jsx:5`, `apiBase.js:33` | `'1'` = fake local auth adapter (compose build arg `BUILD_LOCAL_MODE`) |
| `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` | `AuthAdapterProvider.jsx:34–35` | Auth0Provider SPA config; both required unless disabled (throws) |
| `VITE_AUTH0_AUDIENCE` | `AuthAdapterProvider.jsx:36`, `useApi.js:9` | Audience in authorizationParams; warns if unset |
| `VITE_AUTH0_SCOPE` | `AuthAdapterProvider.jsx:37`, `useApi.js:10` | Default `openid profile email offline_access`; SPA uses `cacheLocation='localstorage'`, `useRefreshTokens=true` |
| `VITE_AUTH_LOCAL_SUB` | `AuthAdapterProvider.jsx:18` | Fake user sub in disabled mode; default `local-dev-user` |
| `VITE_API_BASE_URL` | `apiBase.js:4`, OnboardingPage | API base (`/` same-origin prod; `http://localhost:3000` dev) |
| CORS: `APP_ORIGIN`, `FRONTEND_URL`, `WEB_CLIENT_URL`, `CORS_ORIGIN`, `FRONTEND_ORIGIN` | `index.js:103–107` (all CSV) | Extra allowed CORS origins (credentials:true; no-origin requests allowed) |
| `NODE_ENV` | `auth0.js:3`, `index.js:2` (`development`→`.env.local` else `.env`), scripts test guards | Env selection + prod config guard |
| Dead/legacy | `CORS_ORIGINS` (`src/config/index.js:20` — module only used by logger for log level), `MSSQL_*` (backend/.env, pre-Postgres), `client-next/.env.example` `NEXT_PUBLIC_AUTH0_*` (commented placeholders, Phase-2 stub) | not part of live auth |

## Notable gotchas for rebuild
1. **Role claim clobber**: `ensureUserFromAuth0Claims` overwrites DB `role` from JWT claims on every request; `promote-admin` is ineffective without matching Auth0 role claim (`https://lifeline-api/roles`).
2. Hardcoded Auth0 domain fallback + default audience `https://lifeline-api` in `auth0.js:76,120`.
3. `MCP_API_KEY_PEPPER` silently defaults to empty string → unkeyed HMAC.
4. `/api/admin` and `/api/ai` gates exist with zero routes behind them (dead).
5. Anonymous default-tags branch of `GET /api/tags` unreachable in production (checkJwt 401s first).
6. Guest→account upgrade intentionally absent: guest localStorage wiped on login.
7. Backend internal MCP routes trust principal headers (no scope re-check); enforcement lives in the MCP tool layer only.
8. `backend/src/routes/{todoRoutes,tagRoutes,attachmentRoutes}.js` are not mounted by `index.js` (routes are inline in `index.js`); test-only/dead wiring.
