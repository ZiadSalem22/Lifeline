# Lifeline MCP Audit — services/lifeline-mcp + backend/src/internal/mcp

## 1. Architecture & Transport

- **Design**: 2-hop. Standalone Node ESM service (`services/lifeline-mcp`, `@modelcontextprotocol/sdk ^1.27.1`, express ^5.1.0, zod ^3.25.76, jose ^5.10.0) → calls backend over HTTP at `/internal/mcp/*` (`backend/src/index.js:127` mounts `createInternalMcpRouter()`).
- **Transport**: Streamable HTTP, **stateless**: `POST /mcp` only; per-request `new McpServer` + `StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`, both closed in `finally` (`services/lifeline-mcp/src/app.js:136-160`). Non-POST on `/mcp` → 405 JSON-RPC error (app.js:162-177). No SSE sessions, no resources/prompts — tools only.
- **Endpoints**: `GET /health` (app.js:118-134, reports `transport:'streamable-http'`, `mode:'stateless'`, auth list), `POST /mcp`, plus SDK `mcpAuthMetadataRouter` well-known OAuth metadata when Auth0 enabled (app.js:106-116).
- **HTTP→JSON-RPC error mapping**: 400→-32602, 401→-32001, 403→-32003, 404→-32004, else -32603 (app.js:16-22).
- **Rate limit**: 120 req/60s in-memory per key (`src/middleware/rateLimiter.js`). **BUG/dead code**: keys off request headers `x-mcp-principal-user-id`/`x-mcp-subject-id` which nothing ever sets → everything shares the `'anonymous'` bucket (rateLimiter.js:18).
- **Error classes** (`src/errors.js`): `LifelineMcpError` base {status,code,details,headers}; `AuthError`(401 `auth_error`), `ScopeError`(403 `scope_denied`), `ToolInputError`(400 `invalid_input`), `BackendAdapterError`(502 `backend_adapter_error`).

## 2. Authentication (2-hop)

**Hop 1 — client → MCP service** (`src/auth/requestAuthenticator.js`):
- `x-api-key` header → API-key path. Else `Authorization: Bearer <tok>`; if it `looksLikeJwt()` AND Auth0 enabled → OAuth path; else API-key path. Missing creds → 401 with `WWW-Authenticate: Bearer ... resource_metadata="..."` when OAuth enabled.
- **API key path** (`apiKeyAuth.js`): forwards raw key to backend `POST /internal/mcp/auth/resolve-api-key` body `{apiKey, clientIp, clientUserAgent}`. Backend (`backend/src/application/ResolveMcpApiKeyPrincipal.js`): key format `<prefix>.<secret>`, lookup by `keyPrefix`, checks revoked(403)/expired(403)/status!=='active'(403), verifies secret hash (`verifyMcpApiKeySecret`, peppered via `MCP_API_KEY_PEPPER`), loads user (404 if gone), best-effort `recordUsage({lastUsedAt,lastUsedIp,lastUsedUserAgent})`. Response: `{principal:{subjectType:'api_key',lifelineUserId,authMethod:'api_key',scopes[],subjectId:<apiKeyId>,displayName}, apiKey:{id,name,keyPrefix,scopes}}`.
- **OAuth path** (`oauthAuth.js` + `auth0TokenVerifier.js`): local JWT verify via jose `createRemoteJWKSet` against Auth0 JWKS (RS256, issuer+audience checked); scopes = union of `scope` (space-split) + `permissions` (comma/array). Then backend `POST /internal/mcp/auth/resolve-oauth-principal` body `{claims, scopes}` → `ResolveMcpOAuthPrincipal` does JIT provisioning `userRepository.ensureUserFromAuth0Claims(claims)` → principal `{subjectType:'oauth_access_token', authMethod:'auth0_oauth', subjectId:<sub>, ...}`.
- Principal frozen/normalized (`src/auth/principal.js:16-39`): `{subjectType, lifelineUserId, authMethod, scopes[], subjectId, displayName|null}` — all 4 ids required else 500 `principal_invalid`.

**Hop 2 — MCP service → backend** (`src/backend/internalBackendClient.js`):
- Every request: header `x-lifeline-internal-service-secret: <MCP_INTERNAL_SHARED_SECRET>` + 6 principal headers: `x-lifeline-principal-subject-type|user-id|auth-method|scopes(csv)|subject-id|display-name` (`src/constants.js`, mirrored at `backend/src/internal/mcp/constants.js`).
- Backend `requireInternalServiceAuth()` (`backend/src/middleware/requireInternalServiceAuth.js`): 503 if `MCP_INTERNAL_SHARED_SECRET` unset, 401 missing/mismatch, `crypto.timingSafeEqual` length-guarded. Then per-subrouter `requireInternalMcpPrincipal()` rebuilds principal from headers (401 if no user-id header, 400 if malformed).
- **Scope enforcement lives ONLY in the MCP service** (per-tool `assertPrincipalScopes`); backend never re-checks scopes. Scopes: `tasks:read`, `tasks:write`; wildcards `tasks:*`, `*` honored (`src/auth/principal.js:41-47`).
- Backend client: 5s default timeout (AbortController → 504 `backend_timeout`), network fail → 502 `backend_network_error`; status map 400→`invalid_input`, 401→`unauthorized`, 403→`forbidden`, 404→`not_found`, 5xx→`backend_unavailable`. Arrays in query serialized comma-joined (internalBackendClient.js:28-31).

## 3. Deployment

- **Own container** `lifeline-mcp` in `compose.production.yaml:75-119`; built from `services/lifeline-mcp/Dockerfile` (node:20-alpine, prod deps only, `USER node`, `CMD node src/index.js`, EXPOSE 3030, `MCP_BIND_HOST=0.0.0.0`).
- Port published `127.0.0.1:3030:3030`; mem_limit 512m; `depends_on: lifeline-app: service_healthy`; healthcheck fetch `/health`; `LIFELINE_BACKEND_BASE_URL=http://lifeline-app:3000` (compose network).
- Public: nginx TLS vhost `deploy/nginx/mcp.lifeline.a2z-us.com.conf` → proxy 127.0.0.1:3030, buffering off, read timeout 300s. `MCP_PUBLIC_BASE_URL=https://mcp.lifeline.a2z-us.com`, `MCP_ALLOWED_HOSTS` (SDK host allowlist via `createMcpExpressApp`).
- **Not in dev `compose.yaml`** (no mcp service there). Env template: `services/lifeline-mcp/.env.example`; prod env: `compose.production.env.example` (also `MCP_API_KEY_PEPPER` for backend key hashing).
- Dev CLI client exists: `services/lifeline-mcp/scripts/mcp-client-cli.js` (343 lines). Tests: `test/mcpService.test.js` (node:test + supertest).

## 4. Result shape convention (all tools)

Success (`src/mcp/toolResults.js:14-19`): `{ content:[{type:'text', text:<human preview>}], structuredContent:<backend JSON verbatim> }`. Errors caught per-tool → `{ isError:true, content:[{type:'text',text:'msg (code)'}], structuredContent:{error:{code,status,message,details}} }` — tool errors never throw JSON-RPC errors.

List previews cap at 5 tasks with "Showing N of M" hint; line format `#N | title | active/completed | due D [T] | priority(if !medium) | Xm | tags: a,b | recurs… | flagged` (toolResults.js:25-76). Single-task preview includes subtask checklist with `subtaskId` UUIDs (toolResults.js:78-106).

**Normalized task object** (backend `taskPayloads.js:15-44`, used everywhere): `{id, taskNumber|null, title, description:'', dueDate:'YYYY-MM-DD'|null, dueTime|null, isCompleted:bool, isFlagged:bool, duration:number, priority(default 'medium'), tags:[{id,name,color}], subtasks:[{subtaskId:uuid, title, isCompleted, position:1-based, id}], recurrence|null, nextRecurrenceDue|null, originalId|null, archived:bool, createdAt, updatedAt}`.

**Tag object**: `{id, name, color, userId|null, isDefault:bool}` (`tagHandlers.js:1-10`).

## 5. COMPLETE tool list (28 tools; `src/mcp/taskTools.js`; annotations use readOnlyHint/destructiveHint/openWorldHint:false)

Shared schemas: `selector` = `{taskNumber?: coerce int>0, id?: string min1}` refine ≥1; `tagReference` = `string(min1)` | passthrough obj `{id?: str|num, name?: str, color?: str}` refine id-or-name; `batchTaskNumbers` = `{taskNumbers: coerce int>0 [] .min(1).max(50)}`.

### Read tools (scope `tasks:read`)

| Tool | Input schema (zod) | Backend call | Backend response |
|---|---|---|---|
| `search_tasks` | all optional: `query`:str trim, `q`:str trim, `tags`:str[] (tag IDs per description), `priority`:enum low/medium/high, `status`:enum active/completed, `startDate`/`endDate`:str (YYYY-MM-DD validated backend), `flagged`:bool, `minDuration`/`maxDuration`:coerce int>0, `sortBy`:enum priority/duration/name/date_desc, `page`:coerce int>0, `limit`:coerce int>0 max100, `taskNumber`:coerce int>0 | `GET /tasks/search?...` | `{tasks:[norm], total:num, page, limit}` (default limit 30, max 100; excludes archived by default) |
| `get_task` | `{taskNumber: coerce int>0}` required | `GET /tasks/by-number/:n` | `{task:norm}`; 404 if none. Resolves archived tasks (archived:true in payload) |
| `list_today` | none | `GET /tasks/day/today` | `{dateToken:'today', resolvedDate:'YYYY-MM-DD', tasks:[norm]}` |
| `list_upcoming` | `{fromDate?: str, limit?: coerce int>0 max100}` | `GET /tasks/upcoming?fromDate&limit` | `{fromDate, includesUnscheduled:false, ordering:'effectiveDateAsc,orderAsc,taskNumberAsc', tasks:[norm], count}` (incomplete tasks with span end ≥ fromDate) |
| `get_statistics` | none | `GET /tasks/statistics` | `{total, active, completed, flagged, overdue, totalActiveMinutes}` (flagged = flagged AND !completed; overdue = UTC-today comparison) |
| `list_tasks` | `{window: str min1 (this_week/next_week/this_month/next_month/overdue/YYYY-MM), includeCompleted?: bool}` | `GET /tasks/window/:token?includeCompleted=true` | `{windowToken, resolvedStart, resolvedEnd, tasks:[norm], count}`. overdue = 2000-01-01→yesterday, incomplete only |
| `find_similar_tasks` | `{title: str 1..200, limit?: coerce int>0 max20, threshold?: coerce num 0.1..1.0}` | `GET /tasks/similar?title&limit&threshold` | `{query, tasks:[norm], count}` (backend defaults limit 5, threshold 0.3; `FindSimilarTasks` use-case fuzzy title match) |
| `export_tasks` | `{}` (empty object) | `GET /tasks/export` | `{exported_at: ISO, todos:[norm], stats:{totalTodos, completedCount, completionRate:int%}}` |
| `list_tags` | none | `GET /tags` | `{tags:[{id,name,color,userId,isDefault}]}` |

### Write tools (scope `tasks:write`)

| Tool | Input schema | Backend call | Backend response |
|---|---|---|---|
| `create_task` | `title`:str trim 1..200 **required**; `description?`:str≤2000 nullable; `dueDate?`:str nullable; `dueTime?`:str nullable; `tags?`:tagReference[]; `isFlagged?`:bool; `duration?`:coerce int 0..1440; `priority?`:enum high/medium/low; `subtasks?`:passthrough obj[] (backend Joi: `{title req 1..500, subtaskId? uuid, isCompleted?, position?, id?}` max 50); `recurrence?`:obj\|str\|null (shapes per description: `{mode:'daily'\|'dateRange'\|'specificDays', startDate, endDate, days?[]}`) | `POST /tasks` | 201 `{task:norm}`. Free-tier cap 200 tasks → 403 (`CreateTodoForInternalMcp.js:3,16-21`). Missing/empty dueDate defaults to **today** (create only) |
| `update_task` | selector fields + same optionals as create **minus recurrence**; superRefine: needs selector AND ≥1 of title/description/dueDate/dueTime/tags/isFlagged/duration/priority/subtasks | `PATCH /tasks/:id` (id resolved first, see below) | `{task:norm}`. 404; 409 if archived; 409 `code:'STALE_UPDATE'` if `If-Match`/`expectedUpdatedAt` mismatch (never sent by MCP tool — dead path from MCP side); 400 `Unsupported update fields: …` for anything outside the 9 mutable fields (recurrence immutable via MCP). `subtasks` = whole-array replacement |
| `complete_task` | selector | `POST /tasks/:id/complete` | `{task:norm, completed:true}`; 409 archived |
| `uncomplete_task` | selector | `POST /tasks/:id/uncomplete` | `{task:norm, completed:false}`; 409 archived |
| `delete_task` (described "Deprecated — use archive_task") | selector | `DELETE /tasks/:id` | `{id, taskNumber, deleted:true, deleteMode:'archived'}`; MCP throws 502 `delete_not_confirmed` if `!result.deleted` |
| `archive_task` | selector | `DELETE /tasks/:id` (same endpoint) | same as above |
| `restore_task` | selector | `POST /tasks/:id/restore` | `{task:norm, restored:true, note?:'Task was already active.'}` |
| `batch_complete` | batchTaskNumbers | `POST /tasks/batch {action:'complete', taskNumbers}` | `{action, results:[{taskNumber, status, reason?}]}`; status ∈ completed/uncompleted/archived/restored/already_active/not_found/error. Sequential per-item, archived items → status error |
| `batch_uncomplete` | batchTaskNumbers | same, `action:'uncomplete'` | same |
| `batch_archive` | batchTaskNumbers | same, `action:'delete'` | same |
| `batch_restore` | batchTaskNumbers | same, `action:'restore'` | same |
| `create_tag` | `{name: str trim 1..100, color: str trim 1..30}` both required | `POST /tags` | 201 `{tag}`; 400 on "Tag limit" |
| `update_tag` | `{id: str\|coerce num, name: 1..100, color: 1..30}` all required | `PATCH /tags/:id` | `{tag}`; 404 not found; 403 default/forbidden |
| `delete_tag` | `{id: str\|coerce num}` | `DELETE /tags/:id` | `{deleted:true, id}`; 403 default tags |

### Subtask tools (scope `tasks:write`; all return updated parent task)

| Tool | Input schema | Backend call | Response |
|---|---|---|---|
| `add_subtask` | `{taskNumber?\|id? (≥1), title: str trim 1..500}` | `POST /tasks/:id/subtasks {title}` | 201 `{task:norm}` |
| `complete_subtask` | `{taskNumber?\|id? (≥1), subtaskId: uuid}` | `POST /tasks/:id/subtasks/:sid/complete` | `{task:norm}` |
| `uncomplete_subtask` | same | `POST .../:sid/uncomplete` | `{task:norm}` |
| `update_subtask` | `{taskNumber?\|id?, subtaskId: uuid, title?: 1..500, isCompleted?: bool}` (≥1 of title/isCompleted) | `PATCH .../:sid {title?, isCompleted?}` | `{task:norm}`; 400 empty title |
| `remove_subtask` | `{taskNumber?\|id?, subtaskId: uuid}` | `DELETE .../:sid` | `{task:norm, removed:true}` (permanent) |

Subtask ops on archived task → 400 "Cannot modify subtasks on an archived task. Restore it first." (`SubtaskOperations.js:13`). Positions re-sequenced 1-based on every write (`SubtaskContract.normalizeSubtasks`).

**Mutation id resolution** (`src/mcp/taskSelectors.js`): id alone → used directly; taskNumber → extra `GET /tasks/by-number/:n` round-trip to get UUID; both → cross-checked, mismatch → 400. Backend `taskResolution.js:35-37` re-checks consistency server-side.

## 6. Server instructions (serverFactory.js:14-81)

Long `instructions` string embedded in every McpServer: tool quick reference, planning-window guidance, subtask workflow (get_task first → target by subtaskId UUID; ordinal requests resolved via position), history-aware creation policy (similarity ≥0.8 reuse structure / 0.5–0.79 ask / else create), lifecycle rules (archive-first; archived tasks immutable until restored; search excludes archived; get_task resolves archived), safety (get_task before destructive ops; batch ≤50; user-scoped).

## 7. Recent fixes (verified in git)

- **3c58273d** `fix(mcp): preserve due dates and resolve task tags` — added `taskDueDate.js` (natural-language dueDate resolution server-side: `today`/`tomorrow`/`yesterday`/`in N days`/`next <weekday>` → YYYY-MM-DD, UTC-based; create defaults missing/empty dueDate to today) and `taskTags.js` (`resolveMcpTaskTags`: accepts strings, `{id}`, `{name}`, or canonical `{id,name,color}` objects; resolves against user's tags via `ListTags` case-insensitively; 400 `Tag "X" was not found for the current user.` on miss; dedupes by id). Wired as middleware BEFORE Joi validation (`taskWriteRouter.js:59,61`) because `validateTodo.js` Joi requires canonical tag objects (id+name+color all required). MCP-side `tagReferenceSchema` widened to accept strings.
- **9633bd3e** `fix(mcp): preserve patch semantics and stable subtask ids` — (1) `normalizeMcpUpdateDueDate` no longer injects `dueDate` into PATCH payloads when absent (true patch semantics; previously omitted dueDate was overwritten with existing-or-today); explicit `''` now clears to `null` instead of resurrecting old date. (2) `SubtaskContract.normalizeSubtask` now always emits `id` (defaults `id = subtaskId`) so subtask identity survives whole-array replacement in `update_task`.

## 8. Ambiguities / bugs / dead code (explicit)

1. **Rate limiter is effectively global**: keys on never-set inbound headers (`rateLimiter.js:18`) — all traffic in one `anonymous` bucket.
2. **`list_tasks` week-start claim false**: instructions say weeks "respect user's start-day-of-week setting", but `listTasksByWindow` never passes `startDayOfWeek`; `resolveWindowToken` hardcodes `weekStartsOn=0` (Sunday) (`taskDateFilters.js:36-37`, `taskReadHandlers.js:258`).
3. **Optimistic concurrency dead from MCP**: backend honors `If-Match`/`expectedUpdatedAt` → 409 STALE_UPDATE (`taskWriteHandlers.js:85-91`) but no MCP tool exposes it.
4. **`includeArchived` search filter** parsed backend-side (`taskReadHandlers.js:96`) but not exposed in the MCP `search_tasks` schema.
5. **Redundant filter**: `windowToken==='overdue'` re-filters `!isCompleted` after `includeCompleted` already did (`taskReadHandlers.js:266-269`).
6. **Timezone-naive**: statistics/overdue/date math all UTC (`toISOString`, `getUTC*`); no user-timezone handling anywhere in the MCP path.
7. **Recurrence asymmetry**: Joi update schema allows `recurrence` but MCP write handler 400s it (`taskWriteHandlers.js:6-23`) — immutable-after-create is enforced only in the internal MCP layer.
8. **`search_tasks` `tags` semantics ambiguous**: tool description says "tag ID strings"; backend just splits/trims and delegates to `SearchTodos` — actual match-by-id vs name lives in that use-case (outside this module).
9. `displayName` forwarded as a raw HTTP header value hop-2 (no encoding); non-latin names could produce invalid header — unverified, flag for rebuild (embedded module eliminates hop-2 anyway).
10. `logs/combined.log`, `logs/error.log` in service dir are stale artifacts; no logger module exists in src (console.* only).

Key files: `services/lifeline-mcp/src/{app,config,constants,errors,index}.js`, `src/mcp/{serverFactory,taskTools,taskSelectors,toolResults}.js`, `src/auth/{requestAuthenticator,apiKeyAuth,oauthAuth,auth0TokenVerifier,principal}.js`, `src/backend/internalBackendClient.js`, `src/middleware/rateLimiter.js`; `backend/src/internal/mcp/{router,constants,principal,principalMiddleware,authRouter,authHandlers,taskReadRouter,taskReadHandlers,taskWriteRouter,taskWriteHandlers,subtaskRouter,subtaskHandlers,tagRouter,tagHandlers,taskPayloads,taskDueDate,taskTags,taskResolution,taskDateFilters}.js`; `backend/src/middleware/{requireInternalServiceAuth,validateTodo}.js`; `backend/src/application/{CreateTodoForInternalMcp,ResolveMcpApiKeyPrincipal,ResolveMcpOAuthPrincipal,SubtaskOperations}.js`; `backend/src/domain/SubtaskContract.js`; `compose.production.yaml:75-119`; `deploy/nginx/mcp.lifeline.a2z-us.com.conf`.
