All data gathered. Final report follows.

---

# Test Suite Audit — Lifeline OLD codebase

## Test stacks

| Area | Runner | Libs | Mocking approach |
|---|---|---|---|
| `backend/` | Jest 30 (`npx jest`), babel-jest + @babel/preset-env, `testEnvironment: node`, roots `src` + `test` (`backend/jest.config.js`) | supertest 7 for HTTP | No test DB for 44/47 suites: hand-rolled in-memory repo objects or `jest.fn()` repos injected into use-case constructors / `createInternalMcpRouter(deps)`; `jest.mock()` of TypeORM repos + `src/index` app for export tests; env-var save/restore for secrets; `jest.useFakeTimers().setSystemTime()` for date-sensitive routes |
| `client/` | Vitest 2 (`npx vitest run`), jsdom env (`client/vitest.config.ts`) | @testing-library/react 16 + jest-dom | `vi.mock()` of `../providers/AuthProvider.jsx` (canned auth value), `../hooks/useApi` (stable `fetchWithAuth` ref — comment says stability matters), `../utils/api` / `../utils/guestApi` module mocks; `localStorage.clear()` per test |

DB-gated: 3 tag suites run only when `DATABASE_URL` or `PGHOST` set (`RUN_DB ? describe : describe.skip`); currently **skipped** (8 tests) — need real Postgres + migrations.

## RED status (verified by running both suites 2026-07-06)

**Backend: 2 failed / 42 passed / 3 skipped (47 suites, 203 tests)**
- `test/integration/getExportStats.test.js` — stubs `AppDataSource.manager.query`, but repo impl drifted: `TypeORMTodoRepository.getExportStatsForUser` now calls `findAllIncludingArchived` → `this.repo()` → `DataSource.getRepository` → `this.manager.getRepository is not a function`. Test encodes desired stats shape (see below), impl diverged.
- `test/infrastructure/todoRepository.userLimits.test.js` — sets `repo.repo = { count }` (property) but impl changed `repo` to a **method** (`this.repo().count(...)` at `TypeORMTodoRepository.js:184`). Intent: `countByUser` filters `{ user_id, archived: false }` (excludes archived from free-tier cap).

**Client: 4 failed files / 9 passed (13 files, 6 failed tests / 11 passed)**
- `src/tests/profilePanel.test.jsx` — component moved/now uses `useLoading`; test doesn't mock `../context/LoadingContext` → "useLoading must be used within LoadingProvider" (sibling tests profileUpdate/profileApiKeys DO mock it and pass).
- `src/tests/topbar.profile.navigate.test.jsx` — Profile menuitem click no longer invokes `onOpenProfile` (TopBar menu behavior changed; likely navigates instead).
- `tests/auth/onboardingRedirect.test.jsx` — all 3 tests fail (OnboardingPage redirect/render contract drifted).
- `tests/topbar/userIdentity.test.jsx` — "Hello, Guest" banner test fails (guest banner removed/renamed); avatar+name test passes.

Empty dirs `backend/test/concurrency/` and `backend/test/migrations/` exist but contain **no files** (dead placeholders — despite task brief mentioning concurrency tests, none exist).
`backend/test/routes/attachmentRoutes.test.js` is a `expect(true).toBe(true)` placeholder — attachments never implemented.

## Backend test files — coverage + key business rules

### application/
| File | Covers | Key rules asserted |
|---|---|---|
| `RecurrenceBehavior.test.js` | CreateTodo recurrence expansion ("desired specs") | `daily`: creates one todo **per day** in `[startDate..endDate]` inclusive at creation time. `specificDays`: creates todos only on `selectedDays` (full weekday names `'Monday'...`) within range. `dateRange`: creates exactly **1 logical todo**, `dueDate = startDate`, `recurrence` stored verbatim; `CompleteRecurringTodo.execute(id)` marks it completed and creates **no** next occurrence. CreateTodo positional signature: `(userId, title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence)` |
| `RecurrenceService.test.js` | `calculateNextDueDate`, `createNextOccurrence`, `getRecurrenceText` | daily advances +1 day; dateRange returns next date until endDate then `null` (on endDate → null); specificDays finds next selected weekday (Mon→Wed); specificDays with empty `selectedDays` → `null`. `createNextOccurrence`: new id, `originalId = parent.id`, propagates title/tags/flag/duration/priority/dueTime, resets `isCompleted=false`, **subtasks copied with NEW ids and isCompleted=false**; returns `null` when recurrence ended. Text: `'Daily'`; dateRange text includes dates; specificDays lists short names (Mon/Wed/Fri) |
| `SubtaskOperations.test.js` | `SubtaskOperations` use case (add/complete/uncomplete/update/remove) | Ctor throws `'todoRepository is required'`. add: appends, normalizes, `position = n+1`; **rejects when task archived** (`/archived/`); rejects task not found. complete/uncomplete: by `subtaskId` (UUID); `'Invalid subtaskId.'` for non-UUID; `/Subtask not found/` for unknown UUID. update: rename, set isCompleted; empty title → `/Subtask title cannot be empty/`. remove: deletes and **re-sequences positions from 1** |
| `CreateTodo.test.js` | CreateTodo basics | Returns `Todo` instance; subtasks given as `{title}` only get generated UUID `subtaskId`, and `id === subtaskId`, unique per subtask |
| `UseCases.test.js` | ListTodos/ToggleTodo/DeleteTodo | Plain delegation over in-memory repo; toggle flips isCompleted |
| `FindSimilarTasks.test.js` | FindSimilarTasks use case | title required (empty/null/missing reject); `limit` bounds 1–20 (0 and 21 reject); `threshold` bounds 0.1–1 (0.05 & 1.5 reject); trims title; defaults `{limit: 5, threshold: 0.3}`; delegates to `repo.findSimilarByTitle(userId, title, opts)` |
| `IssueMcpApiKey.test.js` | Admin/base key issuance | Plaintext = `` `${keyPrefix}.${secret}` `` returned once; persisted record has `keyHash` only (never contains prefix.plaintext); default scopes `['tasks:read','tasks:write']`; status `'active'`; rejects unsupported scope (`admin:all`); rejects unknown userId (`/User not found for MCP API key issuance/`). Injectable: `now, generateId, generateKeyPrefix, generateSecret, hashSecret` |
| `CreateSelfServeMcpApiKey.test.js` | Self-serve preset mapping | `scopePreset 'read_write'` → `['tasks:read','tasks:write']`; `expiryPreset '30_days'` → now+30d ISO; response `{plaintextKey, apiKey:{id,keyPrefix,name,scopes,status:'active',createdAt,expiresAt,lastUsedAt:null,revokedAt:null}}`; invalid presets (`'admin'`, `'custom'`) → 400 `statusCode` |
| `McpApiKeyManagement.test.js` | List + revoke self-serve | List: `listByUserId(userId,{limit:25})`; status **derived**: `expiresAt` in past ⇒ `'expired'` even if stored `'active'`. Revoke: ownership enforced via `findByIdForUser`; `revokeByIdForUser(id,userId,{revokedAt,revocationReason:'user_self_service'})`; other-user key → 404 |
| `SelfServeMcpApiKeyCompatibility.test.js` | End-to-end wiring: create → resolve → revoke | Resolved principal `{lifelineUserId, authMethod:'api_key', apiKeyId, scopes}`; resolution records `lastUsedAt`; post-revocation resolution → 403. Contains reusable in-memory McpApiKey repo fixture |

### domain/
| File | Covers | Key rules |
|---|---|---|
| `SubtaskContract.test.js` | `normalizeSubtask/normalizeSubtasks/isValidSubtaskId`, `MAX_SUBTASKS_PER_TASK`, `MAX_TITLE_LENGTH` | Generates UUID `subtaskId` if missing, preserves existing; **legacy `id` field preserved if present, else `id = subtaskId`** (dual-identity contract); trims title; `isCompleted` defaults false; non-object → `'Each subtask must be an object.'`; empty/whitespace/too-long title → `/Subtask title is required/`; exact max length OK; `normalizeSubtasks`: non-array → `[]`, re-sequences positions 1..n, unique ids, > MAX → `/at most/`, exactly MAX OK; UUID validation case-insensitive, rejects non-strings |
| `Todo.test.js` | Todo entity | Ctor `(id, title, isCompleted, dueDate, tags, isFlagged)`; `toggle()` flips; empty title → `'Title cannot be empty'` |

### internal/ (MCP-facing HTTP layer — supertest against `createInternalMcpRouter(deps)`)
Shared fixtures in each file: `createTask()` full-shape factory (`{id,taskNumber,title,description,dueDate,dueTime,isCompleted,isFlagged,duration,priority,tags,subtasks,order,recurrence,nextRecurrenceDue,originalId,archived}`), `createTag()`, `withInternalAuth(req)` (sets `INTERNAL_MCP_SHARED_SECRET_HEADER` + `MCP_PRINCIPAL_HEADERS.lifelineUserId/subjectId`), env save/restore of `MCP_INTERNAL_SHARED_SECRET`.

| File | Covers | Key rules |
|---|---|---|
| `internalMcpRoutes.test.js` | Auth foundation, `/internal/mcp/health` | Missing secret → 401 `/Missing internal service authentication/`; wrong secret → 401 `/Invalid internal service authentication/`; principal headers alone insufficient; valid → `{status:'ok', authenticatedService:'lifeline-mcp'}` |
| `internalMcpTaskWriteRoutes.test.js` (536 ln) | POST/PATCH/DELETE tasks, complete/uncomplete | Missing principal → 401 `/Missing internal principal context/`. Create: 201, free-tier cap `countByUser >= 200` → 403 `/Free tier max tasks reached/` (paid bypass); recurrence input preserved; **create defaults dueDate to today** (frozen clock, `formatDateOnly`) with defaults `(tags:[], isFlagged:undef, duration:undef, priority:'medium', dueTime:null, subtasks:[], description:'', recurrence:null)`. Update: PATCH only touches sent fields — **omitted dueDate never injected**, existing dueDate kept; `recurrence` in PATCH → 400 `/Unsupported update fields: recurrence/`; ownership via `findById(id,userId)`, cross-user → 404; **tag names resolved via listTags before validation** (`['Personal', {name:'Health'}]` → full tag objects), unknown name → 400 `/Tag "X" was not found/`. Complete/uncomplete: **idempotent — `save` NOT called when already in state**; response `{completed, task}`. Delete: response `{id, taskNumber, deleted:true, deleteMode:'archived'}` (delete = archive semantics) |
| `internalMcpTaskReadRoutes.test.js` | search, by-number, day-listing | Search query-param mapping: `tags` CSV→array, `flagged:'true'`→bool, page/limit→numbers, `offset = (page-1)*limit`, `includeArchived:false` always, `taskNumber` numeric. `by-number/:n`: scoped `findByTaskNumber(userId,n)`, 404 when none. `/tasks/day/today`: resolves token → `{dateToken, resolvedDate, tasks}`; **dateRange recurrence tasks included on every day within range**; null-dueDate excluded; invalid token → 400. `/tasks/upcoming?fromDate&limit`: excludes completed and unscheduled; `includesUnscheduled:false`; `ordering:'effectiveDateAsc,orderAsc,taskNumberAsc'` (in-progress dateRange task sorts by effective date = fromDate); returns `count` |
| `taskDateFilters.test.js` | `resolveWindowToken`, `doesTaskOccurInRange` (pure) | Tokens: `this_week`/`next_week` (opt `startDayOfWeek`), `this_month`/`next_month` (exact YYYY-MM-DD bounds), `overdue` → `{start:'2000-01-01', end: yesterday}`, `YYYY-MM` literal months; invalid → throw `/Invalid window token/`. Range check: inclusive boundaries; dateRange recurrence overlaps count; null dueDate + no recurrence → false |
| `windowAndSimilarRoutes.test.js` | `/tasks/window/:token`, `/tasks/similar` | Window: response `{windowToken, resolvedStart, resolvedEnd, tasks, count}`; **completed excluded by default**, `?includeCompleted=true` includes; invalid token → 400; this_week Mon-start (2026-03-10 Tue ⇒ Mon 03-09–Sun 03-15). Similar: `?title` required → 400; response `{query, tasks, count}`; optional `limit`/`threshold` passed through as numbers |
| `subtaskRoutes.test.js` | 5 subtask HTTP routes | POST `/tasks/:id/subtasks` → 201 `{task}`, missing title → 400; parent not found → 404; complete/uncomplete POST → 200; PATCH with empty body → 400 `/at least one field/`; DELETE → 200 `{removed:true}`. All delegate `subtaskOperations.method(userId, taskId, ...)` |
| `archiveLifecycle.test.js` | Archived-task guards + restore | PATCH/complete/uncomplete on `archived:true` → **409** `/archived/`; active task passes. POST `/tasks/:id/restore`: archived → 200 + `repo.unarchive` called; already active → 200 **without** unarchive call (idempotent); missing → 404 |
| `internalMcpAuthResolveRoutes.test.js` | `/auth/resolve-api-key`, `/auth/resolve-oauth-principal` | API key: split `prefix.secret`, lookup by prefix, verify against peppered hash (`MCP_API_KEY_PEPPER`); success → `{principal:{subjectType:'api_key',lifelineUserId,authMethod:'api_key',scopes,subjectId:keyId,displayName:user.name}}`; usage recorded with **server-observed** `x-forwarded-for` IP + `User-Agent` (client-supplied body values ignored/spoofing-proof); **usage-record failure does not block resolution**; wrong secret → 401 `/Invalid API key/` (no usage recorded); revoked → 403 `/API key revoked/`. OAuth: `ensureUserFromAuth0Claims(claims)` → principal `{subjectType:'oauth_access_token', authMethod:'auth0_oauth', subjectId:sub}`; missing `sub` → 400 `/OAuth token subject is required/` without ensure call |
| `mcpPrincipal.test.js` | Principal build + header round-trip | `MCP_SUBJECT_TYPES.API_KEY='api_key'`, `OAUTH_ACCESS_TOKEN='oauth_access_token'`; scopes header CSV-parsed; no lifelineUserId header → `null` |
| `mcpApiKeyScaffold.test.js` | DataSource entity registration + hash utils | `McpApiKey` entity in `buildAppDataSourceOptions().entities`; `hashMcpApiKeySecret(secret, pepper)` / `verifyMcpApiKeySecret` round-trip, wrong secret false |

### middleware/, auth/, routes/, integration/, others
| File | Covers | Key rules |
|---|---|---|
| `middleware/roles.test.js` | `requireAuth/requireRole/requireRoleIn/requirePaid` | Unauthenticated → 401 body `{status:'error', message:/Guest mode works only locally/}`; wrong role → 403; `requirePaid` allows paid **and admin**, blocks free |
| `middleware/attachCurrentUser.test.js` | attachCurrentUser | Reads `req.auth.payload`, `'https://lifeline-api/roles'` claim; `role` = highest (admin > paid); no roles → `role:'free'`, `roles:[]`; mocks `TypeORMUserRepository.ensureUserFromAuth0Claims` + `TypeORMUserProfileRepository.findByUserId` |
| `middleware/auth0.test.js` | AUTH_DISABLED bypass + readiness | `AUTH_DISABLED=1` → no-op checkJwt, readiness `{ready:true, bypassed:true}`; active mode starts `{jwksWarmedUp:false, ready:false, degraded:false, consecutiveFailures:0}` (module-level state; `jest.isolateModules`) |
| `middleware/validateTodo.test.js` | Joi create/update validation | Create: title required, max 200 (201 rejects), `dueDate:null` OK; update: no title required, description max 2000, date-only `YYYY-MM-DD` dueDate accepted |
| `middleware/rateLimit.test.js` | `createRateLimiter` | Per-key (userId) window; N allowed, N+1 → 429 |
| `auth/auth0Claims.test.js` | Role claim namespaces | Canonical `AUTH0_ROLE_CLAIM_NAMESPACE` + `LEGACY_AUTH0_ROLE_CLAIM_NAMESPACE` both read, deduped in order; primary role precedence admin > paid > free |
| `routes/guestAccessDenied.test.js` | requireAuth blocks repo access | 401 before repo call (asserts `list` not called) |
| `routes/perUserLimits.test.js` | Free-tier caps (route sim) | tasks cap **200**, tags cap **50**; at-limit → 403 `Free tier max tasks/tags reached.` |
| `routes/publicInfo.test.js` | `GET /api/public/info` | Unauthed JSON: `{name:'Lifeline API', version, guestMode:'local-only', message, time}` |
| `routes/todosByNumber.test.js` | `GET /api/todos/by-number/:n` | n<1/NaN → 400; not found → 404; scoped by userId |
| `routes/archive_unarchive.test.js` | POST archive/unarchive | Passes `(id, userId)` to repo; returns `{id, archived:bool}` |
| `routes/attachmentRoutes.test.js` | placeholder | Dead — "marked for future implementation" |
| `integration/protectedRoutes.test.js` | roles on /me, /admin/secret, /ai/feature | free blocked from admin (403) and paid features |
| `integration/mcpApiKeyRoutes.test.js` | `/api/mcp-api-keys` REST | GET → `{apiKeys, limit:25}`; POST empty name → 400 `/API key name cannot be empty/`; POST valid → 201 `{plaintextKey,...}`; POST `/:uuid/revoke` → 200 `{apiKey}`; unauth → 401 `/Please log in/` |
| `export/export.auth.test.js` | `GET /api/export` (full app via `require('../../src/index')` + heavy jest.mock) | JSON: Content-Disposition `todos_export.json`, body `{user:{id}, todos[], tags[]}`; `?format=csv` → text/csv, `todos_export.csv`, header row `title,description,dueDate` |
| `export/export.guest.test.js` | export unauthenticated | 401 `{error}` |
| `integration/exportSettings.test.js` | export includes settings | `payload.user.settings.theme` present; payload has `todos, tags, stats` |
| `integration/getExportStats.test.js` **RED** | `getExportStatsForUser` shape | Intent: `{totalTodos, completedCount, avgDuration, topTags[], tasksPerDay}` with `tasksPerDay.length === 30` (30-day series). Raw-SQL stubbing is brittle (even contains a SQL-Server-ism `convert(varchar(10), due_date` match) |
| `infrastructure/todoRepository.userLimits.test.js` **RED** | countByUser | Excludes archived: `count({where:{user_id, archived:false}})` (test stubs `archived===0`, impl drift) |
| `me/meProfile.test.js` | /api/me + profile | Missing profile ⇒ `profile.onboarding_completed === false` default; POST /api/profile sets it true |
| `profile/updateProfile.test.js` | POST /api/profile | `first_name` + `last_name` required (400 on empty); guest → 401/403 |
| `scripts/promoteAdmin.test.js` | promote-admin script | Sets `role:'admin'`; unknown user rejects `'User not found'`; `{exitOnFinish:false}` option for testability |
| `tags/defaultTags.test.js` (DB-gated) | Default global tags | `findAllForUser` returns ≥10 `isDefault` tags for any user; save/delete of default → throws `/Default tags cannot be modified|deleted/` |
| `tags/perUserTags.test.js` (DB-gated) | Tag limits | `CreateTag.execute(userId, name, color, {maxTags:50})` → 51st throws `/Tag limit reached/`; no limits obj = unlimited (paid/admin) |
| `tags/security.test.js` (DB-gated) | Tag cross-user security | Other user update/delete → `/Forbidden/`; **is_default spoofing blocked at repository.save** |

## Client test files (vitest + RTL, jsdom)

| File | Status | Covers + key behaviors |
|---|---|---|
| `src/tests/todoProvider.integration.test.jsx` | GREEN | Guest-mode TodoProvider: starts empty, `createTodo({title,dueDate,tags,isFlagged,duration,priority,dueTime,subtasks,description,recurrence})`, `filteredTodos` respects `handleSelectDate('today')`, `toggleFlag` flips. Wrapper = ThemeProvider→TodoProvider; guest data in localStorage |
| `src/tests/todoProvider.auth.integration.test.jsx` | GREEN | Authed TodoProvider loads server todos+tags via `utils/api` (fetchTodos/fetchTags/createTodo/updateTodo/toggleTodo/deleteTodo/toggleFlag); full CRUD reflected in state; updateTodo priority change propagates |
| `src/tests/todoProvider.dueDateNormalization.test.jsx` | GREEN | **Server ISO datetime dueDate normalized to `YYYY-MM-DD`** so today-filter matches (timezone bug guard) |
| `src/tests/theme.export.integration.test.jsx` | GREEN | `changeTheme('sunset')` for authed user POSTs `/api/settings` with `{theme, layout.font}`; `api.exportTodos('json', fetchWithAuth)` payload contains `user.settings.theme` |
| `src/tests/exportDataModal.test.jsx` | GREEN | Authed: preview loaded from `/api/export`, "Download JSON" → `URL.createObjectURL` + toast via `window.dispatchEvent` |
| `src/tests/exportDataModal.guest.test.jsx` | GREEN | Guest: export JSON built client-side from `utils/guestApi` + localStorage prefs (`theme/locale/showSidebar`); no server call |
| `src/tests/profileApiKeys.test.jsx` | GREEN | ProfilePanel API-keys section: list keys; create flow (name + access select `read_write` + expiry select `never`) calls `createMcpApiKey({name,scopePreset,expiryPreset}, fetchWithAuth)`; **plaintext shown once in an input** (`findByDisplayValue`), "Copy key" → clipboard; revoke (with `confirm()`) → toast `/API key revoked/`; key cards are `<article>` |
| `src/tests/profilePanel.test.jsx` | **RED** | Render + save → "Profile updated successfully!"; fails: no LoadingContext mock (component now requires it) |
| `src/tests/profileUpdate.test.jsx` | GREEN | Save payload auto-includes `timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `src/tests/topbar.profile.navigate.test.jsx` | **RED** | Chevron button (aria "open profile menu") → menuitem "Profile" → `onOpenProfile` callback; behavior drifted |
| `src/tests/topbar.responsive.test.jsx` | GREEN | Search pill placeholder present; **no standalone settings button** in TopBar |
| `tests/auth/onboardingRedirect.test.jsx` | **RED** (3/3) | Intent: incomplete onboarding shows form ("Continue" btn, **no Timezone field** — timezone is auto-detected); guest at `/onboarding` → redirect home; completed onboarding → Navigate home |
| `tests/topbar/userIdentity.test.jsx` | **RED** (1/2) | "Hello, Guest" banner when guestMode (fails — UI changed); avatar `alt` + name when authed (passes) |

## Helpers/fixtures worth re-creating in the rebuild

1. **`createTask()` full-shape task factory** — canonical task JSON `{id, taskNumber, title, description, dueDate, dueTime, isCompleted, isFlagged, duration, priority, tags, subtasks, order, recurrence, nextRecurrenceDue, originalId, archived}` — duplicated in 5 internal test files; make it a shared fixture.
2. **`withInternalAuth(req, userId)`** — supertest helper setting internal shared-secret header + principal headers (`lifelineUserId`, `subjectId`).
3. **`makeApp(depsOverrides)`** — express app with router + `errorHandler`, all deps as `jest.fn()` defaults, per-test override injection (dependency-injected router is the pattern that made this codebase testable without a DB).
4. **In-memory MockTodoRepository** (`save` upsert by id, `findById`, `findAll`, `delete`) and **in-memory McpApiKey repository** (`listByUserId/findByIdForUser/findByKeyPrefix/save/recordUsage/revokeByIdForUser` — in `SelfServeMcpApiKeyCompatibility.test.js`).
5. **Env save/restore blocks** for `MCP_INTERNAL_SHARED_SECRET`, `MCP_API_KEY_PEPPER`; **frozen clock** (`jest.useFakeTimers().setSystemTime` or injected `now()`/`getNow()` — the code prefers injectable clocks; keep that).
6. **Client `Providers` wrapper** (ThemeProvider→TodoProvider) + canned AuthProvider mock values (guest vs authed: `{isAuthenticated, authLoading, guestMode, currentUser, checkedIdentity, logout}`) + **stable-reference `fetchWithAuth` mock** (comments stress reference stability to avoid effect re-runs) + stateful `utils/api` mock closure (`todosState`).
7. Date helpers `rangeDates(start,end)` / `countMatchingWeekdays(start,end,days)` from RecurrenceBehavior.

## Notable cross-cutting business rules the suites encode

- Free-tier caps: **200 tasks** (archived excluded from count), **50 custom tags**; paid/admin exempt; enforced pre-create with 403.
- Subtask dual identity: `subtaskId` (UUID, canonical) + legacy `id` mirror; positions always 1..n resequenced.
- MCP delete = archive (`deleteMode:'archived'`); archived tasks are read-only (mutations → 409); restore idempotent.
- Recurrence: `daily` / `specificDays` (weekday names) expand into concrete todos at creation; `dateRange` is a single logical task spanning days (included in every day-listing within range) and completes as a whole.
- Completion set idempotently (no save when no-op) — distinct from toggle.
- API keys: `prefix.secret` format, hash+pepper storage, plaintext shown exactly once, derived `expired` status, self-serve limited to presets (`read_only|read_write` × `30_days|90_days|never`), revocation reason `user_self_service`, spoof-resistant usage logging from observed request metadata.
- Auth: Auth0 claim namespace `https://lifeline-api/roles` (+ legacy namespace merged), role precedence admin>paid>free, guest = local-only (server 401 message "Guest mode works only locally").
- Export: JSON/CSV with Content-Disposition filenames; guest export assembled fully client-side; stats shape `{totalTodos, completedCount, avgDuration, topTags, tasksPerDay(30)}`.
