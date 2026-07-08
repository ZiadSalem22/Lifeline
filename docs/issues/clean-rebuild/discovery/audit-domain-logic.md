# Lifeline OLD backend — business/domain logic audit

Scope read: `backend/src/{domain,application,controllers,routes,internal/mcp,middleware,validators,utils,infrastructure,infra,migrations}`. All routes actually served live in `backend/src/index.js` (inline) + `backend/src/internal/mcp/*` (MCP-facing). **Dead code:** `controllers/todoController.js`, `controllers/tagController.js`, `routes/todoRoutes.js`, `routes/tagRoutes.js`, `routes/attachmentRoutes.js`, `validators/index.js` `createTodoSchema`/`createTagSchema`/`uuidParamSchema` (never imported by index.js; only the MCP-api-key schemas there are used).

## 1. Task numbers
- Assignment: `CreateTodo.execute` computes `getMaxTaskNumber(userId)+1` per created row (`application/CreateTodo.js:15-16,55-57,66-67,86-88,112-114,122-123`). Recurrence expansion increments `maxNum` per generated occurrence.
- Safety net: `TypeORMTodoRepository.save` assigns `max+1` if `todo.taskNumber` not an integer and `userId` present (`infrastructure/TypeORMTodoRepository.js:30-33`). MAX query at `:65-72`.
- Uniqueness scope: **per user**, DB-enforced by `ux_todos_user_task_number (user_id, task_number)` (`src/migrations/1764826105992-initial_migration.js:105`); `chk_todos_task_number_positive` (`:98`). Immutable once set (never updated in `UpdateTodo`).
- Race: read-max-then-insert, **no transaction/lock** — concurrent creates can collide on the unique index (500).
- By-number lookup: REST `GET /api/todos/by-number/:taskNumber` (`index.js:816-827`, parseInt, `<1`→400, 404 message `No task found with that number.`); repo `findByTaskNumber(userId, n)` (`TypeORMTodoRepository.js:74-77`). MCP: `GET /tasks/by-number/:taskNumber` (`internal/mcp/taskReadRouter.js:16`), and `resolveTaskForUser` accepts `taskNumber` and/or `id`, erroring if both resolve to different tasks (`taskResolution.js:11-40`).
- Search integration: a pure-numeric `q` (optionally `#`-prefixed) also matches `todo.task_number = :n` OR ILIKE text (`TypeORMTodoRepository.js:117-131`); separate exact `taskNumber` filter (`:133-135`).

## 2. Recurrence engine
Rule shape (stored as `recurrence jsonb`, **shape unvalidated** — Joi allows any object/string/null, `middleware/validateTodo.js:14,46`):
- New modes: `{ mode: 'daily'|'dateRange'|'specificDays', startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD', selectedDays?: ['Monday',...full English names] }`
- Legacy: `{ type: 'daily'|'weekly'|'monthly'|'custom', interval?: number (default 1), endDate?: string, daysOfWeek? }` (`domain/Todo.js:18,33-41`)

**Actual runtime semantics = pre-generate at creation, NOT spawn-on-complete** (`application/CreateTodo.js:40-127`):
- `mode:'daily'` → one todo row per day from `startDate||dueDate` to `endDate||dueDate` inclusive (UTC-anchored `T00:00:00Z`, `:45-51`); each row gets own uuid + own taskNumber, same `recurrence` object copied onto every row; returns first todo only.
- `mode:'dateRange'` → **single** logical todo with `dueDate = startDate||dueDate` (`:63-70`); the span lives only in the recurrence object.
- `mode:'specificDays'` → one row per matching weekday (`getUTCDay` → name via `RecurrenceService.getDayName`, `:71-93`).
- Legacy types → rows stepped by interval (daily/custom: +interval days; weekly: +7*interval; monthly: `setMonth+interval`) from `dueDate` to `recurrence.endDate` (no endDate → just one row) (`:94-119`).
- Unknown shape → fallback single todo (`:120-127`).

**Spawn-on-complete is DEAD CODE**: `CompleteRecurringTodo` is instantiated (`index.js:378`) but never bound to any route; REST toggle uses `ToggleTodo` (plain flip), MCP complete uses `SetTodoCompletion`. Its intended semantics (`application/CompleteRecurringTodo.js`): toggle→ if now completed & recurring & not `dateRange` (dateRange = whole-span single task, `:23-27`), create next occurrence via `RecurrenceService.createNextOccurrence` (`RecurrenceService.js:96-124`): copies title/desc/dueTime/tags/flag/duration/priority, `isCompleted:false`, subtasks copied with `isCompleted:false` and **new `id` but same `subtaskId`** (`:115-119`), `originalId = parent.originalId || parent.id` (`:121`), `nextRecurrenceDue: null`. Next due date (`calculateNextDueDate`, `:8-73`): daily→+1d; dateRange→+1d until > endDate → null (ended); specificDays→scan up to 365 days for a selectedDays weekday; legacy→interval add, null if past endDate. Also note `CompleteRecurringTodo` calls `findById(todoId)` **without userId**.
- `nextRecurrenceDue`/`next_recurrence_due` column: always null in practice (dead field). `originalId` FK `ON DELETE SET NULL` (migration `:95`).
- Timezone: **mixed.** `CreateTodo` daily uses `T00:00:00Z` UTC; specificDays/legacy use bare `new Date(str)` (UTC midnight for date-only strings) with local `setDate`; `RecurrenceService` uses local `T00:00:00` + date-fns local `format`; MCP `today/tomorrow` tokens use local server time (`taskDateFilters.js:12-26`) while natural-language due dates use UTC (`taskDueDate.js:13-63`). `due_date` column is `timestamptz` fed date-only strings.

## 3. Subtasks — stable identity contract
`domain/SubtaskContract.js`:
- Shape: `{ subtaskId: UUID, title, isCompleted: bool, position: 1-based contiguous int, id: legacy alias }`. `subtaskId` kept if present (any non-empty string), else `randomUUID()` (`:20`); `id = raw.id ?? subtaskId` (`:21`). Whole array stored as jsonb on the todo row.
- `normalizeSubtasks`: max **50** (`MAX_SUBTASKS_PER_TASK`, `:38-40`), re-sequences `position = index+1` regardless of client-sent positions (`:41`). Title trimmed, required, ≤ **500** chars (`:15-18`).
- Persistence across updates: `UpdateTodo` replaces the full array via `normalizeSubtasks(updates.subtasks)` (`application/UpdateTodo.js:22`) — clients must echo back `subtaskId` to keep identity; omitted `subtaskId` mints a new one. `isValidSubtaskId` = strict UUID regex (`:47-49`) used only by per-subtask ops.
- Per-subtask ops (`application/SubtaskOperations.js`): add (append, `:17-24`), complete/uncomplete (`_setSubtaskCompletion` by `subtaskId`, `:68-78`), update title/isCompleted (`:34-54`), remove (splice, `:56-66`); all re-normalize then save the whole todo. `_loadTask` rejects archived tasks (`:13`) — **but this guard never fires** (see §5 bug).
- Completion rules: subtask completion is independent; no parent auto-complete, no cascade parent→subtasks.

## 4. Reorder
- `PATCH /api/todos/:id/reorder` body `{ order: integer }` → sets `todo.order = order`, saves single row (`index.js:897-907`). **No validation** of the value (no Joi middleware), no sibling renumbering — the frontend owns assigning consistent values.
- Stored in `"order" integer NOT NULL DEFAULT 0` (migration `:87`). New todos always order 0 (`CreateTodo` passes 0; recurrence next-occurrence too, `CompleteRecurringTodo.js:44`); import forces 0 (`index.js:1566`).
- Used as tiebreaker: list ordering `due_date ASC, order ASC, task_number ASC` (`TypeORMTodoRepository.js:83,160`); MCP upcoming sort effectiveDate→order→taskNumber (`taskDateFilters.js:144-152`).

## 5. Archive / unarchive / flag / batch
- `DELETE /api/todos/:id` is a **soft delete**: repo `delete()` sets `archived=true` AND **clears tag links** (`todo.tags=[]`) (`TypeORMTodoRepository.js:167-173`). `POST /:id/archive` / `/:id/unarchive` set flag only, tags kept (`index.js:1113-1149`; repo `:175-181`). No hard-delete endpoint (hard delete only in reset-account/import-replace).
- Archived excluded from: `findAll` (`:81`), `findByFilters` unless `includeArchived` (`:112-114`), `countByUser` free-tier count (`:184`). Included in: `findByTaskNumber`, `findById`, `findSimilarByTitle`.
- **Confirmed bug (do not replicate):** domain `Todo` has no `archived` field and `_mapRowToDomain` doesn't map it (`TypeORMTodoRepository.js:333-354`), so any task loaded via `findById`/`findByTaskNumber` has `archived === undefined`. Consequences: (a) all "archived" guards in MCP write handlers (`taskWriteHandlers.js:81,121,148`) and `SubtaskOperations._loadTask:13` never fire; (b) MCP `restoreTask`/batch `restore` always take the "already active" branch (`taskWriteHandlers.js:195-201,252-257`) and never actually unarchive; (c) `save()` writes `archived: !!todo.archived` (`:52`) → **any update to an archived task silently unarchives it**.
- Flag: `PATCH /api/todos/:id/flag` toggles `isFlagged` (no body) (`index.js:1057-1066`; `domain/Todo.js:29-31`).
- REST batch: `POST /api/todos/batch` `{ action: 'delete'|'complete'|'uncomplete', ids: UUID[] min 1, **no max** }` (Joi at `middleware/validateTodo.js:86-98`); sequential loop; delete counts blindly even if id didn't exist; returns `{ action, ids, deleted, updated }` (`index.js:849-873`).
- MCP batch: `POST /internal/mcp/tasks/batch` `{ action: 'complete'|'uncomplete'|'delete'|'restore', taskNumbers: 1..50 }`; per-item result statuses `completed|uncompleted|archived|restored|already_active|not_found|error{reason}`; response `{ action, results }` (`taskWriteHandlers.js:214-268`). `delete` = archive (`deleteMode: 'archived'`, `:34-41`).

## 6. Similar tasks (pg_trgm)
- Use case `FindSimilarTasks` (`application/FindSimilarTasks.js:9-21`): defaults `limit=5`, `threshold=0.3`; bounds `limit 1..20`, `threshold 0.1..1.0`; title required non-empty (trimmed).
- Query (`TypeORMTodoRepository.js:356-367`): `WHERE user_id=:userId AND similarity(todo.title, :title) > :threshold ORDER BY similarity(...) DESC LIMIT :limit`, tags joined; **no archived filter** (archived flag included in result via spread `:366`).
- Infra: `backend/migrations/008_enable_pg_trgm_similarity.sql` — `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + `CREATE INDEX idx_todos_title_trgm ON todos USING gist (title gist_trgm_ops)`. (Raw SQL dir, not in the TypeORM `src/migrations` chain — the current initial migration does NOT create it; flag for rebuild.)
- Exposure: MCP only — `GET /internal/mcp/tasks/similar?title=&limit=&threshold=` (`taskReadHandlers.js:283-305`), response `{ query, tasks[], count }`. No REST endpoint.

## 7. Search / advanced search
REST `GET /api/todos/search` (`index.js:993-1020`) → `SearchTodos` → `findByFilters` (`TypeORMTodoRepository.js:88-165`):
- Filters: `q` (ILIKE `%q%` over title, COALESCE(description,''), `CAST(subtasks AS text)`; pure-number q also matches task_number, `#` stripped); `tags`/`tag` (comma or array of tag **ids**, `tag.id IN`), `priority`, `status` (`completed`/`active`), `startDate`/`endDate` (aliases `dueDateFrom`/`dueDateTo`; endDate made exclusive next-day UTC, `:142-146`), `minDuration`/`maxDuration`, `flagged` (`'1'|'true'`), `taskNumber` exact, `sortBy`, `page`/`limit` (default 30, alias `pageSize`), `includeArchived` (only reachable via MCP; REST always excludes archived).
- Sorts: `priority` (CASE high3/med2/low1 DESC), `duration` DESC, `name` ASC, `date_desc` (due_date DESC NULLS LAST), default `due_date ASC NULLS LAST, order ASC, task_number ASC` (`:151-161`).
- Returns `{ todos, total }` via `getManyAndCount` + skip/take; REST wraps `{ todos, total, page, limit }`.
- MCP `GET /tasks/search` adds strict validation (`taskReadHandlers.js:51-105`): priority/status/sortBy whitelists, limit cap **100**, min≤max duration, dates must match `YYYY-MM-DD`, `query` alias for `q`.
- MCP-only read extras: `/tasks/day/:dateToken` (`today|tomorrow|YYYY-MM-DD`), `/tasks/window/:windowToken` (`this_week|next_week|this_month|next_month|overdue|YYYY-MM`; overdue = `2000-01-01`..yesterday, active only; `includeCompleted=true` opt-in), `/tasks/upcoming?fromDate&limit` (active, span-aware via dateRange recurrence, sort effectiveDate/order/taskNumber, `includesUnscheduled:false`) — all computed in-memory over `listTodos` (`taskReadHandlers.js:183-281`, `taskDateFilters.js:92-152`).

## 8. Tags
- Default tag seeding: **once globally, in the initial migration** (not per-user, not at signup) — 10 tags inserted with `user_id NULL, is_default true`, name-idempotent (`src/migrations/...initial_migration.js:147-158`). Fixed ids/colors (`infra/db/defaultTags.js`): `default-work` Work `#3B82F6`, `default-personal` Personal `#10B981`, `default-health` Health `#EF4444`, `default-finance` Finance `#F59E0B`, `default-study` Study `#6366F1`, `default-family` Family `#EC4899`, `default-errands` Errands `#6B7280`, `default-ideas` Ideas `#8B5CF6`, `default-important` Important `#DC2626`, `default-misc` Misc `#9CA3AF`.
- Constraints (migration `:114-133`): `chk_tags_default_ownership` (default⇒user_id NULL; custom⇒user_id NOT NULL); unique `lower(name)` among defaults; unique `(user_id, lower(name))` among a user's custom tags; name/color non-blank.
- Listing: defaults + own custom, ordered defaults first then `LOWER(name)` ASC (`TypeORMTagRepository.js:59-66`). Anonymous `GET /api/tags` returns defaults only (`index.js:1181-1196`).
- Create: uuid, forced `is_default=false` (`TagUseCases.js:17`; repo save refuses isDefault, `TypeORMTagRepository.js:30-33`). Free tier cap **50 custom** tags (`index.js:1222-1225` + double-check in `CreateTag:11-16`). **No hex-color/name-length validation on the wired route** (Joi `createTagSchema` `#RRGGBB`/50-char rules are dead code).
- Update/delete: defaults immutable/undeletable (403), ownership required (`index.js:1266-1270`, `TagUseCases.js:49-53`, `TypeORMTagRepository.js:36-46`). Delete of nonexistent tag is silent no-op.
- Task↔tag: join table `todo_tags` (CASCADE both ways); repo save resolves incoming tag ids against tags table (`TypeORMTodoRepository.js:22-23`) — unknown ids silently dropped. MCP accepts tag refs as string-name, `{id}`, `{name}`, or canonical object; resolves case-insensitively against user's visible tags, dedupes, 404-style ValidationError if unresolvable (`internal/mcp/taskTags.js:65-126`).

## 9. Statistics
REST `GET /api/stats?period=day|week|month|year` OR `?startDate&endDate` (`index.js:1312-1356`):
- Range branch → `getStatisticsForUserInRange` (`TypeORMTodoRepository.js:192-215`): non-archived todos with dueDate in `[start, end+1d)` UTC; returns `{ periodTotals: { totalTodos, completedCount, completionRate (int %, rounded), avgDuration (mean of >0 durations, rounded), timeSpentTotal (sum all durations) }, topTagsInPeriod: [{id,name,color,count}] top 10 by count, groups: [{period:'YYYY-MM-DD', date, count}] one entry per day inclusive }`.
- Period branch → `getStatisticsAggregated` (`:217-231`): all non-archived todos (no date cut!), groups keyed `YYYY` / `YYYY-MM` / `YYYY-Wnn` (Jan-1-based week calc, `:308-331`) / `YYYY-MM-DD` (default), only keys with data, sorted lexically.
- All aggregation is **in-memory** over `findAllIncludingArchived` (no SQL GROUP BY). Counts are by dueDate presence; todos without dueDate excluded from groups but included in totals.
- `_buildStatsFromTodos` (`:242-268`) also computes `tasksPerDay` = last-30-days `[{day, count}]` (zero-filled) — surfaced only through export stats.
- MCP `GET /tasks/statistics` (different, `taskReadHandlers.js:113-144`): `{ total, active, completed, flagged (active only), overdue (active, dueDate < today UTC), totalActiveMinutes (sum duration of active with duration>0) }` over non-archived todos.

## 10. Export / import / reset
Export `GET /api/export?format=json|csv` (`index.js:1372-1444`) — **non-archived todos only** (via `listTodos`):
- JSON: `{ exported_at: ISO, user: { id, email, profile, settings }, todos: [{ id, title, description, dueDate, dueTime, isCompleted, isFlagged, priority, duration, tags:[{id,name,color}], subtasks:[raw jsonb], recurrence, originalId }], tags: [{id,name,color,isDefault}], stats }` where `stats` = `getExportStatsForUser` → `{ totalTodos, completedCount, completionRate, avgDuration, timeSpentTotal, topTags(10), tasksPerDay(30) }` (archived excluded inside). Sent as attachment `todos_export.json`, pretty-printed.
- CSV: header `id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags,subtasks,recurrence`; tags = `;`-joined names; subtasks = `Title(done|pending);...`; recurrence = JSON with `"`→`\"`; booleans as 1/0. Attachment `todos_export.csv`.
- MCP `GET /tasks/export` (`taskReadHandlers.js:234-252`): `{ exported_at, todos: normalized[], stats: {totalTodos, completedCount, completionRate} }` only.

Import `POST /api/import` body `{ data: <stringified export JSON>, mode: 'merge'(default)|'replace' }` (`index.js:1474-1587`):
- Validation: `data` must be string → JSON.parse (400 `Invalid JSON format`), `todos` must be array (400 `Invalid import format: missing todos array`). No per-todo schema validation; only `Todo` constructor title check. **No free-tier 200-task cap check.**
- `replace`: single transaction deletes user's todo_tags → todos → custom tags (`:1497-1506`); defaults untouched.
- Tag merging (`:1508-1542`): match by `lower(name)`; `isDefault:true` entries map to existing default (else dropped); custom map to user's existing custom by name, else created via `createTag` (creation errors swallowed → tag silently dropped). Builds `tagIdMap` old→new.
- Todos (`:1544-1577`): keep incoming `id` else new uuid (merge-mode id collision = **overwrite/upsert** since repo save upserts by id); tags remapped, unmapped dropped; `order` forced 0; `taskNumber` kept if present (can violate unique index → 500) else repo assigns; `userId` forced to current user. **Loop not transactional** — partial imports possible. Response `{ success, message: 'Successfully imported N todos', importedCount }`.

Account reset `POST /api/reset-account` (`index.js:138-151`): hard-deletes user's `Todo` rows (todo_tags cascade), custom tags (`is_default:false`), and `UserSettings` row. Keeps user + profile + MCP keys. Response `{ success: true, message: 'Account data reset: todos, tags, and theme deleted.' }`.

## 11. Validation rules (wired)
`middleware/validateTodo.js` (used by REST create/update AND MCP create/update):
| Field | Rule |
|---|---|
| title | string, trim, 1..**200** (create required; update optional) — note domain/DB tolerate 500; dead `validators/index.js:16-25` said 500 |
| description | ≤2000, allow ''/null |
| dueDate | `YYYY-MM-DD` OR full ISO datetime OR null OR '' |
| recurrence | object OR string OR null — **shape unvalidated** |
| tags | array of `{ id: str\|num req, name: str req, color: str req (no hex check), userId?, isDefault? }` `.unknown(true)` |
| isFlagged | boolean |
| duration | int 0..**1440** |
| priority | `high\|medium\|low` (repo coerces invalid→`medium`, `TypeORMTodoRepository.js:46`) |
| dueTime | string, allow ''/null — **no HH:mm format check** |
| subtasks | array ≤50 of `{ subtaskId?: uuid, title: 1..500 req, isCompleted?, position?: positive int (ignored/re-sequenced), id? }` |
| batch (REST) | `action ∈ delete\|complete\|uncomplete`, `ids`: uuid[] min 1, no max |

Other wired validation: profile `start_day_of_week` normalized/whitelisted to capitalized day names, `first_name`+`last_name` required (`index.js:583-598`); MCP api-key schemas (`validators/index.js:77-119`): name 1..100, `scopePreset ∈ read_only|read_write`, `expiryPreset ∈ 1_day|7_days|30_days|90_days|never`, list limit 1..50 default 25. Errors: `AppError(status)`, `NotFoundError` 404, `ValidationError` 400 (`utils/errors.js`).

## Cross-cutting quirks worth carrying into rebuild decisions
- `ToggleTodo` defines `execute` twice; only the `(userId, id)` version survives (`application/ToggleTodo.js:6-22`).
- Free tier: 200 active (non-archived) tasks (`index.js:797-801`; MCP `CreateTodoForInternalMcp.js:16-21`), 50 custom tags.
- Guest mode: server stores nothing; `/api/public/info` advertises `guestMode: 'local-only'` (`index.js:412-421`).
- Notifications: all endpoints return 410/disabled stubs (`NotificationService.js`, `index.js:1622-1662`).
- REST todo endpoints return bare domain objects/arrays (camelCase, tags as `{id,name,color,userId,isDefault}`); MCP wraps in `{ task }`/`{ tasks, ... }` with `normalizeTaskForInternalMcp` (date-only dueDate, adds `taskNumber`, `archived`, `createdAt/updatedAt` — which are always null since domain never maps them, `taskPayloads.js:41-42`).
- MCP optimistic concurrency: `If-Match`/`expectedUpdatedAt` → 409 `STALE_UPDATE` — ineffective because `updated_at` never reaches the domain object (`taskWriteHandlers.js:85-91`).
- MCP create defaults missing/empty dueDate to **today** (`taskDueDate.js:65-78`) and resolves natural language (`today/tomorrow/yesterday/in N days/next <weekday>`, UTC).
- Rate limits: todos 60/min/user, ai 10/min (admin exempt), mcp-key writes 10/min (`index.js:434-449`).
