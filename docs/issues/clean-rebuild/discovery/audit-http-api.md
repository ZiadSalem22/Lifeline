# Lifeline OLD Backend — Complete HTTP API Surface Audit

Entry: `backend/src/index.js` (Express app, exported at :1687; listens at :1674 when main). All paths below are under `C:/Users/ziyad/Lifeline/backend/src/`.

## 1. Middleware chain (registration order in index.js)

| # | Line | Middleware / mount |
|---|------|--------------------|
| 1 | 110 | `cors({origin: whitelist fn, credentials: true})` |
| 2 | 125 | `bodyParser.json()` (default 100kb limit; no urlencoded) |
| 3 | 127 | `app.use('/internal/mcp', createInternalMcpRouter())` — shared-secret auth, NOT JWT |
| 4 | 138–330 | Inline routes registered BEFORE global JWT gate: `/api/reset-account` (own checkJwt), `/api/health/db`, `/api/health/ready`, `/api/settings` (own checkJwt), `/api/health/db/schema` |
| 5 | 334 | `require('./swagger')(app)` → `/swagger-ui` static, `GET /api-docs/swagger.json`, `/api-docs` UI (all **public**) |
| 6 | 412 | `GET /api/public/info` (public) |
| 7 | 424 | `app.use('/api', checkJwt, attachCurrentUser)` — global JWT gate for everything /api registered after this line |
| 8 | 427–431 | Public 301 redirects: `GET /me` → `/api/me`; `GET /notifications/(.*)` → `/api/notifications/$1` |
| 9 | 450–451 | `app.use('/api/todos', todosLimiter)`; `app.use('/api/ai', aiLimiter)` |
| 10 | 468 | `app.use('/api/mcp-api-keys', requireAuth(), mcpApiKeyRoutes)` |
| 11 | 502–1149 | /api/me, /api/profile, /api/me/raw, /api/notifications/pending, todos routes |
| 12 | 1151 | `app.use('/api/admin', requireRole('admin'))` — **no routes behind it** |
| 13 | 1153 | `app.use('/api/ai', requirePaid())` — **no routes behind it** |
| 14 | 1181–1662 | tags, stats, export, import, notifications-disabled routes |
| 15 | 1667 | `registerFrontendServing(app)` — static `client/dist` + SPA fallback GET regex excluding `/api`, `/api-docs`, `/swagger-ui`, `/swagger.json`, `/internal` (index.js:50–90) |
| 16 | 1670–1671 | `notFoundHandler`, `errorHandler` |

## 2. Auth mechanisms

- **JWT (checkJwt)** — `middleware/auth0.js:106-178`. `express-oauth2-jwt-bearer` `auth()`, issuer `https://${AUTH0_DOMAIN}` (default `dev-1b4upl01bjz8l8li.us.auth0.com`), audience `AUTH0_AUDIENCE` (default `https://lifeline-api`) + `AUTH0_AUDIENCE_ALT` (comma lists), RS256. Wrapped in `AUTH_TIMEOUT_MS` (default 10 000 ms) timeout → `503 {error:'Authentication service temporarily unavailable'}`. `AUTH_DISABLED=1` bypasses entirely.
- **attachCurrentUser** — `middleware/attachCurrentUser.js:13-124`. `AUTH_DISABLED=1` → deterministic local user (`AUTH_LOCAL_USER_ID` || `'guest-local'`). No `Authorization` header → `req.currentUser=null` (no DB touch). Otherwise upserts user from claims (`ensureUserFromAuth0Claims`), loads profile+settings, roles from claim namespaces `https://lifeline-api/roles` + legacy `https://lifeline.app/roles` (`auth/auth0Claims.js:1-3`); primary role precedence admin>paid>free (default free). DB failure → 500 `{error:'Internal Server Error (Profile Load Failed)'}`.
- **requireAuth()** (`middleware/roles.js:5`) → 401 `"Please log in to use this feature. Guest mode works only locally."` if no `currentUser.id`. **requireRole(r)/requireRoleIn/requirePaid** → 403 `"Forbidden"` (requirePaid passes `paid` OR `admin`).
- **Internal service shared secret** — `middleware/requireInternalServiceAuth.js:19-44`: header `x-lifeline-internal-service-secret` timing-safe-compared vs env `MCP_INTERNAL_SHARED_SECRET`; missing config → 503, missing/wrong header → 401. Applied to ALL `/internal/mcp/*`.
- **MCP principal headers** — `internal/mcp/principalMiddleware.js` + `constants.js:5-12`: `x-lifeline-principal-user-id` (required; missing → 401 "Missing internal principal context."), `-subject-type` (default `api_key`), `-auth-method` (default `api_key`), `-scopes` (comma list), `-subject-id`, `-display-name`. Applied to `/internal/mcp/tasks|tags` subrouters, NOT `/health` or `/auth/*`.

## 3. Error format(s) — inconsistent, 3 shapes

1. **Central** `middleware/errorHandler.js:35-67`: `{status:'error', message, [stack in dev]}`. OAuth lib errors mapped → 401 with friendly messages (errorHandler.js:13-25). 404 fallback: `{status:'error', message:'Route <url> not found'}`.
2. **Inline handlers** in index.js often bypass with `res.status(500).json({error: err.message})` (reset-account, settings, tags create/update/delete, stats, export, import, health).
3. **Internal MCP handlers**: `{status:'error', message, [code]}` (e.g. `code:'STALE_UPDATE'`).

**⚠ Latent bug**: index.js:9 imports `AppError` from `./middleware/errorHandler`, which does **not** export it (only utils/errors.js does). So `AppError === undefined` in index.js and every `new AppError(...)` there throws `TypeError: AppError is not a constructor` → caught → 500 instead of intended status. Affected: POST /api/todos free-tier 403 (:800), reorder 404 (:902), toggle 404 (:1039), flag 404 (:1061), POST /api/tags free-tier 403 (:1224), PATCH /api/tags/:id 404/403 (:1267-1269). Rebuild should implement intended codes.

## 4. Rate limiting (`middleware/rateLimit.js` — custom in-memory Map, per-process, never pruned)

| Limiter | Mount | Window | Max | Key | Notes |
|---|---|---|---|---|---|
| todosLimiter | `/api/todos*` (index.js:450) | 60 s | 60 | userId else IP | |
| aiLimiter | `/api/ai*` (index.js:451) | 60 s | 10 | userId else IP | exempt if roles include `admin` |
| mcpApiKeyWriteLimiter | POST `/api/mcp-api-keys`, POST `.../:id/revoke` (index.js:445, routes/mcpApiKeyRoutes.js:17-20) | 60 s | 10 | userId else IP | GET list not limited |

Headers always set: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (unix sec). Exceeded → 429 `{status:'error', message:'Rate limit exceeded'}`.

## 5. CORS (index.js:92-123)

Whitelist: `http(s)://localhost:${PORT}`, `http(s)://127.0.0.1:${PORT}`, `http://localhost:3020`, `https://lifeline.a2z-us.com`, `http(s)://localhost:5173`, `https://192.168.1.153:5173`, `https://172.26.176.1:5173`, plus comma-split env `APP_ORIGIN`, `FRONTEND_URL`, `WEB_CLIENT_URL`, `CORS_ORIGIN`, `FRONTEND_ORIGIN`. No-Origin requests (curl/Postman) allowed. `credentials:true`. Blocked origin → `Error('Not allowed by CORS')` → 500 via errorHandler.

## 6. Public HTTP API (`/api/*`)

Todo JSON shape (domain `Todo`, domain/Todo.js:4-23; serialized as-is): `{id(uuid), title, isCompleted, dueDate, tags:[{id,name,color,userId,isDefault}], isFlagged, duration(min), priority('high'|'medium'|'low'), dueTime('HH:mm'|null), subtasks:[{subtaskId,title,isCompleted,position}], order, description, recurrence({type,interval,endDate,daysOfWeek?}|null), nextRecurrenceDue, originalId, taskNumber(int per-user), userId}`.

| Method+Path | Auth | Request | Response / codes | Impl |
|---|---|---|---|---|
| POST `/api/reset-account` | JWT+requireAuth (own chain) | none | 200 `{success:true, message:'Account data reset: todos, tags, and theme deleted.'}`; 401; 500 `{error}` . Hard-deletes user's todos, non-default tags, settings | index.js:138-151 |
| GET `/api/health/db` | **none** | — | 200 `{db:'ok'}`; 500 `{db:'error', message}` (runs `SELECT 1`, lazily inits DataSource) | index.js:185-209 |
| GET `/api/health/ready` | **none** | — | 200/503 `{ready:bool, db:'ok'|'error', auth:{ready,jwksWarmedUp,degraded,consecutiveFailures,lastSuccessAt,lastFailureAt,lastFailureReason}}` (or `{ready:true,bypassed:true}` if AUTH_DISABLED) | index.js:224-240 |
| GET `/api/health/db/schema` | **none** ⚠ public schema leak | — | 200 `{todos:[{column_name,data_type}...], tags:[...], todo_tags:[...], users:[...]}`; 500 `{error}` | index.js:309-330 |
| POST `/api/settings` | JWT+requireAuth (own chain) | `{theme?, locale?, layout?(object)}` (all default null) | 200 saved settings record; 500 `{error}` | index.js:262-276 |
| GET `/api/public/info` | **none** | — | 200 `{name:'Lifeline API', version, guestMode:'local-only', message, time}` | index.js:412-421 |
| GET `/api/me` | JWT+requireAuth | — | 200 `{id,email,name,picture,role,roles[],subscription_status,settings|null,profile:{first_name,last_name,phone,country,city,timezone,avatar_url,start_day_of_week,onboarding_completed}|{onboarding_completed:false}}` | index.js:502-526 |
| POST `/api/profile` | JWT+requireAuth | `{first_name*, last_name*, email?, phone?, country?, city?, avatar_url?, timezone?, start_day_of_week?(day name, case-normalized), onboarding_completed?}` | 200 echo of saved fields (start_day_of_week defaults 'Monday'); 400 missing names / bad day; 409 `{error:'Email already in use by another account'}`; 500. Creates user row if absent (role 'free', subscription 'none') | index.js:555-685 |
| GET `/api/me/raw` | JWT (no requireAuth) | — | 200 `{sub, email, claims:<full JWT payload>}` | index.js:706-713 |
| GET `/api/notifications/pending` | JWT (no requireAuth) | — | 200 `[]` always | index.js:731-733 |
| GET `/api/todos` | JWT+requireAuth | — | 200 `Todo[]` (excludes archived; ordered due_date ASC, order ASC, task_number ASC) | index.js:756-761; repo findAll TypeORMTodoRepository.js:79 |
| POST `/api/todos` | JWT+requireAuth + Joi `validateTodoCreate` | `{title*(1-200), description?(≤2000), dueDate?(YYYY-MM-DD|ISO|null|''), recurrence?(obj|string|null), tags?[{id*,name*,color*,...}], isFlagged?, duration?(0-1440 int), priority?('high'|'medium'|'low'), dueTime?, subtasks?[{title*(1-500),subtaskId?,isCompleted?,position?}]≤50}` | 201 Todo; 400 Joi msgs; intended 403 free-tier ≥200 tasks (**actually 500 via AppError bug**) | index.js:793-807; middleware/validateTodo.js:4-35 |
| GET `/api/todos/by-number/:taskNumber` | JWT+requireAuth | path int ≥1 | 200 Todo; 400 `{error:'Invalid task number'}`; 404 `{error:'No task found with that number.'}` | index.js:816-827 |
| POST `/api/todos/batch` | JWT+requireAuth + Joi | `{action:'delete'|'complete'|'uncomplete', ids:[uuid,...]≥1}` (no max) | 200 `{action, ids, deleted, updated}`; 400 Joi. 'delete' = soft archive (repo.delete sets archived=true, clears tags). Sequential loop, per-id | index.js:849-873; validateTodo.js:86-100 |
| PATCH `/api/todos/:id/reorder` | JWT+requireAuth | `{order:int}` | 200 Todo; not-found intended 404 (**500 via bug**) | index.js:897-907 |
| PATCH `/api/todos/:id` | JWT+requireAuth + Joi `validateTodoUpdate` (same fields as create, all optional) | partial Todo | 200 Todo; 404-ish: UpdateTodo throws `Error('Todo not found')` → 500 via errorHandler (statusCode undefined→500) | index.js:929-936; application/UpdateTodo.js |
| GET `/api/todos/search` | JWT+requireAuth | query: `q, tags(csv or repeat)|tag, priority, status('active'|'completed'), startDate|dueDateFrom, endDate|dueDateTo (inclusive), minDuration, maxDuration, flagged('1'|'true'), sortBy('priority'|'duration'|'name'|'date_desc'), taskNumber, page(def 1), limit|pageSize(def 30, no max)` | 200 `{todos:Todo[], total, page, limit}` | index.js:993-1020; repo findByFilters TypeORMTodoRepository.js:88-165 — ILIKE on title/description/CAST(subtasks AS text); `q` of form `#N` or `N` also matches task_number; NO pg_trgm here |
| PATCH `/api/todos/:id/toggle` | JWT+requireAuth | — | 200 Todo; not-found → intended 404 (**500 via bug**) | index.js:1035-1042 |
| PATCH `/api/todos/:id/flag` | JWT+requireAuth | — | 200 Todo (flag toggled); not-found intended 404 (**500 via bug**) | index.js:1057-1066 |
| DELETE `/api/todos/:id` | JWT+requireAuth | — | 204 empty (soft archive, idempotent — missing id is a no-op) | index.js:1081-1088 |
| POST `/api/todos/:id/archive` | JWT+requireAuth | — | 200 `{id, archived:true}` (no existence check) | index.js:1113-1119 |
| POST `/api/todos/:id/unarchive` | JWT+requireAuth | — | 200 `{id, archived:false}` | index.js:1143-1149 |
| GET `/api/tags` | JWT (handler has anonymous branch but checkJwt at :424 blocks it → **anonymous branch is dead code** unless AUTH_DISABLED=1) | — | 200 `Tag[]` `{id,name,color,userId,isDefault}` (defaults + user's custom); 500 `{error}` | index.js:1181-1196 |
| POST `/api/tags` | JWT+requireAuth | `{name, color}` (NO Joi here — validation inside CreateTag use case) | 201 Tag; 400 `{error}`; intended 403 free-tier ≥50 custom tags (**500 via bug**, though CreateTag also enforces maxTags→400) | index.js:1217-1234 |
| PATCH `/api/tags/:id` | JWT+requireAuth | `{name, color}` | 200 Tag; intended 404 not found / 403 default-tag / 403 not-owner (**500 via bug**); 500 `{error}` | index.js:1261-1275 |
| DELETE `/api/tags/:id` | JWT+requireAuth | — | 204; errors → 500 `{error}` (incl. "Default tags cannot be deleted") | index.js:1292-1300 |
| GET `/api/stats` | JWT+requireAuth | query `period('day'|'week'|'month'|'year')` OR `startDate`+`endDate` (YYYY-MM-DD) | 200 `{periodTotals:{totalTodos,completedCount,completionRate,avgDuration,timeSpentTotal}, topTagsInPeriod:[{id,name,color,count}]≤10, groups:[{period,date,count}]}` (range version returns per-day groups incl. zeros); 500 `{error}` | index.js:1312-1356; repo :192-231 |
| GET `/api/export` | JWT+requireAuth | query `format='json'(def)|'csv'` | 200 attachment. JSON: `{exported_at, user:{id,email,profile,settings}, todos:[{id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags:[{id,name,color}],subtasks,recurrence,originalId}], tags:[{id,name,color,isDefault}], stats:{totalTodos,completedCount,completionRate,avgDuration,timeSpentTotal,topTags,tasksPerDay}}` filename `todos_export.json`; CSV columns `id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags(;-joined names),subtasks("title(done|pending)";…),recurrence` filename `todos_export.csv` | index.js:1372-1444 |
| POST `/api/import` | JWT+requireAuth | `{data:<JSON string of export payload>, mode:'merge'(def)|'replace'}` | 200 `{success:true, message:'Successfully imported N todos', importedCount}`; 400 `{error:'No data provided'|'Invalid JSON format'|'Invalid import format: missing todos array'}`; 500. replace = tx delete user's todo_tags/todos/custom tags. Tags remapped by lowercase name (defaults matched, customs created). Todos keep provided id or new uuid | index.js:1474-1587 |
| POST `/api/notifications/schedule` | JWT (no requireAuth) | `{todoId, minutesBefore}` (ignored) | **410** `{disabled:true, reason:'Notifications are not supported in the PostgreSQL-only local runtime.'}` | index.js:1622-1624; NotificationService.js:10-12 |
| PATCH `/api/notifications/:id/sent` | JWT | — | 410 same | index.js:1641-1643 |
| DELETE `/api/notifications/:id` | JWT | — | 410 same | index.js:1660-1662 |
| GET `/me`, GET `/notifications/*` | none | — | 301 redirect to `/api/...` | index.js:427-431 |
| GET `/api-docs`, `/api-docs/swagger.json`, `/swagger-ui/*` | **none** | — | Swagger UI (dark CSS, persists Bearer in localStorage `lifeline_api_token`), merged spec from `backend/swagger.json` + JSDoc `@openapi` | swagger.js:7-83 |

### MCP API key endpoints (`/api/mcp-api-keys`, JWT+requireAuth, index.js:468; routes/mcpApiKeyRoutes.js)

| Method+Path | Request | Response |
|---|---|---|
| GET `/` | query `limit` 1-50 def 25 (Joi, `stripUnknown`) | 200 `{apiKeys:[{id,name,keyPrefix,scopes[],status:'active'|'expired'|'revoked'(derived),createdAt,expiresAt,lastUsedAt,revokedAt}], limit}` |
| POST `/` (rate-limited 10/min) | `{name*(1-100), scopePreset*:'read_only'('tasks:read')|'read_write'('tasks:read','tasks:write'), expiryPreset*:'1_day'|'7_days'|'30_days'|'90_days'|'never'}` | 201 `{apiKey:<metadata as above>, plaintextKey:'lk_<8hex>.<base64url 24B secret>'}` (shown once) |
| POST `/:id/revoke` (rate-limited) | uuid param (Joi) | 200 `{apiKey:<metadata>}`; 404 `API key not found.`; idempotent if already revoked |

Key format: `lk_xxxxxxxx.SECRET`, prefix looked up, secret hash-verified (`application/IssueMcpApiKey.js:15-21,151`).

## 7. `/api/ai` and `/api/admin` — verdict: **RESERVED NAMESPACES, NO ROUTES (dead code)**

- `/api/ai`: only `aiLimiter` (index.js:451) + `requirePaid()` (index.js:1153). Grep over whole `backend/src` finds no route registered under it. Effective behavior: JWT → attach → 10/min limiter (admin exempt) → 403 for non-paid/non-admin → 404 `{status:'error', message:'Route /api/ai/... not found'}` for paid/admin. No AI feature exists server-side.
- `/api/admin`: only `requireRole('admin')` (index.js:1151). No routes. Non-admin → 403; admin → 404. Admin promotion is done via CLI script `scripts/promote-admin.js`, not HTTP.

## 8. Internal MCP HTTP API (`/internal/mcp/*`, mounted index.js:127; `internal/mcp/router.js:25-95`)

All routes require shared-secret header (§2). Task/tag routes additionally require principal headers; user identity = `x-lifeline-principal-user-id`. Task payloads normalized by `normalizeTaskForInternalMcp` (taskPayloads.js:15-44): `{id,taskNumber,title,description,dueDate(YYYY-MM-DD),dueTime,isCompleted,isFlagged,duration,priority,tags:[{id,name,color}],subtasks,recurrence,nextRecurrenceDue,originalId,archived,createdAt,updatedAt}`.

| Method+Path | Request | Response / codes | Impl |
|---|---|---|---|
| GET `/health` | — | 200 `{status:'ok', service:'internal-mcp', authenticatedService:'lifeline-mcp'}` | router.js:51-57 |
| POST `/auth/resolve-api-key` | body `{apiKey}` or `Authorization`/`x-api-key` header | 200 `{principal:{subjectType,lifelineUserId,authMethod,scopes[],subjectId,displayName}, apiKey:{id,name,keyPrefix,scopes}}`; 401 Missing/Invalid API key; 403 revoked/expired/not-active; 404 user gone. Records lastUsed{At,Ip,UserAgent} best-effort | authHandlers.js:22-54; ResolveMcpApiKeyPrincipal.js:54-106 |
| POST `/auth/resolve-oauth-principal` | `{claims:{sub*,...}, scopes[]}` | 200 `{principal}` (subjectType `oauth_access_token`, authMethod `auth0_oauth`); 400 missing claims/sub. Upserts user from claims | authHandlers.js:56-67 |
| GET `/tasks/search` | same filters as public search + `includeArchived`, `query` alias for `q`; limit capped at 100; validation errors → 400 | 200 `{tasks[], total, page, limit}` | taskReadHandlers.js:146-161, parseSearchFilters :51-105 |
| GET `/tasks/statistics` | — | 200 `{total, active, completed, flagged, overdue, totalActiveMinutes}` | taskReadHandlers.js:113-144 |
| GET `/tasks/export` | — | 200 `{exported_at, todos[], stats:{totalTodos,completedCount,completionRate}}` | taskReadHandlers.js:234-252 |
| GET `/tasks/similar?title=&limit=&threshold=` | title required | 200 `{query, tasks[], count}`; 400 no title. **Uses pg_trgm `similarity()`** (threshold def 0.3, limit def 5) — the ONLY pg_trgm usage; requires `pg_trgm` extension | taskReadHandlers.js:283-305; TypeORMTodoRepository.js:356-367 |
| GET `/tasks/window/:windowToken?includeCompleted=true` | tokens: `this_week, next_week, this_month, next_month, overdue, YYYY-MM` (weekStartsOn hardcoded 0) | 200 `{windowToken, resolvedStart, resolvedEnd, tasks[], count}`; 400 bad token. Handles `recurrence.mode==='dateRange'` spans | taskReadHandlers.js:254-281; taskDateFilters.js:36-86 |
| GET `/tasks/by-number/:taskNumber` | int ≥1 | 200 `{task}`; 404 `Task not found.`; 400 invalid | taskReadHandlers.js:163-181 |
| GET `/tasks/day/:dateToken` | `today|tomorrow|YYYY-MM-DD` | 200 `{dateToken, resolvedDate, tasks[]}` | taskReadHandlers.js:183-197 |
| GET `/tasks/upcoming?fromDate=&limit=` | fromDate def today | 200 `{fromDate, includesUnscheduled:false, ordering:'effectiveDateAsc,orderAsc,taskNumberAsc', tasks[], count}` (active tasks only) | taskReadHandlers.js:199-232 |
| POST `/tasks` | Todo create body; NL dueDate resolved (`today/tomorrow/yesterday/in N days/next <weekday>`; empty→today); tag names/ids resolved via `resolveMcpTaskTags`; then Joi validateTodoCreate | 201 `{task}`; 403 free-tier ≥200 (works here — correct AppError import) | taskWriteRouter.js:59; taskWriteHandlers.js:55-66; taskDueDate.js |
| POST `/tasks/batch` | `{action:'complete'|'uncomplete'|'delete'|'restore', taskNumbers:[1-50 items]}` | 200 `{action, results:[{taskNumber, status:'completed'|'uncompleted'|'archived'|'restored'|'already_active'|'not_found'|'error', reason?}]}`; 400 bad action/array | taskWriteHandlers.js:214-268 |
| PATCH `/tasks/:id` | mutable fields only: title,description,dueDate,dueTime,tags,isFlagged,duration,priority,subtasks (+`expectedUpdatedAt` or `If-Match` header for optimistic concurrency) | 200 `{task}`; 404; 409 archived (`Cannot update an archived task...`); 409 `code:'STALE_UPDATE'`; 400 unsupported fields | taskWriteHandlers.js:68-106 |
| POST `/tasks/:id/complete` / `/uncomplete` | — | 200 `{task, completed:true|false}`; 404; 409 archived | taskWriteHandlers.js:108-160 |
| POST `/tasks/:id/restore` | — | 200 `{task, restored:true, note?:'Task was already active.'}`; 404 | taskWriteHandlers.js:182-212 |
| DELETE `/tasks/:id` | — | 200 `{id, taskNumber, deleted:true, deleteMode:'archived'}`; 404 | taskWriteHandlers.js:162-180 |
| POST `/tasks/:taskId/subtasks` | `{title*}` | 201 `{task}`; 400/404 | subtaskHandlers.js:11-29 |
| POST `/tasks/:taskId/subtasks/:subtaskId/complete` / `/uncomplete` | — | 200 `{task}`; 404 | subtaskHandlers.js:31-59 |
| PATCH `/tasks/:taskId/subtasks/:subtaskId` | `{title? and/or isCompleted?}` (≥1 required) | 200 `{task}`; 400 | subtaskHandlers.js:61-82 |
| DELETE `/tasks/:taskId/subtasks/:subtaskId` | — | 200 `{task, removed:true}` | subtaskHandlers.js:84-97 |
| GET `/tags` | — | 200 `{tags:[{id,name,color,userId,isDefault}]}` | tagHandlers.js:18-28 |
| POST `/tags` | `{name*, color*}` | 201 `{tag}`; 400 missing/limit | tagHandlers.js:30-45 |
| PATCH `/tags/:id` | `{name*, color*}` (both required) | 200 `{tag}`; 404; 403 default/not-owner | tagHandlers.js:47-69 |
| DELETE `/tags/:id` | — | 200 `{deleted:true, id}`; 403 default/not-owner | tagHandlers.js:71-86 |

Task resolution helper (`taskResolution.js:11-40`): resolves by id and/or taskNumber; mismatch → 400 "Provided task selectors do not resolve to the same task."

## 9. Pagination conventions

Only search endpoints paginate: `page` (1-based) + `limit` (default 30; public search uncapped, internal MCP capped 100; alias `pageSize`), response `{todos|tasks, total, page, limit}`; repo uses `skip/take` with `getManyAndCount`. All other list endpoints return full arrays.

## 10. Dead code / quirks inventory

| Item | Location | Verdict |
|---|---|---|
| `/api/ai/*` router | none | Dead — middleware-only namespace (rate limit + requirePaid), zero routes, no AI feature |
| `/api/admin/*` router | none | Dead — requireRole('admin') only, zero routes |
| `routes/todoRoutes.js`, `routes/tagRoutes.js`, `controllers/todoController.js`, `controllers/tagController.js` | files exist, never imported by index.js | Dead (legacy "/api/v1" factory style) |
| `routes/attachmentRoutes.js` | 0 bytes | Dead/empty — no attachments feature |
| `middleware/requestLogger.js` | never mounted | Dead |
| `application/GetStatistics.js` | instantiated index.js:383, never called (stats route uses repo directly) | Dead |
| `application/CompleteRecurringTodo.js` | instantiated index.js:378, never routed | Dead at HTTP layer (recurrence completion handled client-side / not at all) |
| `NotificationService` | all methods return null/[] | Stub; endpoints return 410/`[]` — notifications intentionally disabled ("PostgreSQL-only Phase 3 runtime") |
| Anonymous default-tags branch in GET /api/tags | index.js:1189-1192 | Unreachable behind checkJwt (except AUTH_DISABLED=1, where currentUser is always set anyway) |
| `AppError` import bug | index.js:9 | All intended 403/404 via AppError in index.js are actually 500 `{status:'error',message:'AppError is not a constructor'}` |
| `ToggleTodo` duplicate `execute` | application/ToggleTodo.js:6-22 | First definition shadowed by second (2-arg); harmless |
| GET /api/health/db/schema | index.js:309 | Real but unauthenticated schema introspection (information_schema dump) — security smell |
| DELETE semantics | repo delete = archive (`archived=true`, tags cleared); `/archive` keeps tags; batch delete also archives | No hard-delete of todos except reset-account/import-replace |
| Search vs similar | `/api/todos/search` = ILIKE substring; pg_trgm only via internal MCP `/tasks/similar` — no public similar-tasks HTTP endpoint |
| Free-tier limits | 200 active todos (index.js:799, CreateTodoForInternalMcp.js:3), 50 custom tags (index.js:1223) |
