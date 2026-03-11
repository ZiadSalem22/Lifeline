# Step 09 master implementation plan: everyday task fluency

Date: 2026-03-11
Initiative: `mcp-server/step-09-everyday-task-fluency`
Artifact class: planning
Status: hardened — implementation-ready

---

## Executive summary

Lifeline MCP already exposes 18 tools covering core task CRUD, search, batch operations, tags, statistics, and export. The server is functional and deployed to production.

Real-world usage reveals that broadening tools alone is not enough. The next evolution must make the system feel natural for everyday planning, safe for routine actions, and operable down to the subtask level.

This plan defines the complete implementation path from the current state to an AI-first, enterprise-grade, everyday task fluency system. It covers:

- backend AI-oriented contract redesign
- MCP surface redesign with intent-level tools
- first-class subtask operability
- natural date-window planning queries
- archive-first lifecycle
- history-aware personalization
- enterprise hardening foundations
- phased rollout from implementation to production closeout

The guiding principle is **backend-first AI contracts with a thin MCP edge**. The backend should expose explicit, AI-oriented internal contracts. The MCP layer should remain a thin conversational adapter over those contracts.

---

## 1. Current-state findings

### 1.1 Current MCP inventory

18 tools across 4 surfaces:

| Surface | Tools | Count |
|---|---|---|
| Read | `search_tasks`, `get_task`, `list_today`, `list_upcoming`, `get_statistics`, `export_tasks`, `list_tags` | 7 |
| Write | `create_task`, `update_task`, `complete_task`, `uncomplete_task`, `delete_task` | 5 |
| Tag management | `create_tag`, `update_tag`, `delete_tag` | 3 |
| Batch | `batch_complete`, `batch_uncomplete`, `batch_archive` | 3 |

### 1.2 Current backend internal MCP adapter

Base path: `/internal/mcp` with shared-secret authentication.

Sub-routers:
- `/auth` — API key and OAuth principal resolution
- `/tasks` (read) — search, statistics, export, by-number, day/:dateToken, upcoming
- `/tasks` (write) — create, update, complete, uncomplete, delete, batch
- `/tags` — CRUD

### 1.3 Current task data shape

The normalized MCP task shape from `taskPayloads.js` exposes 17 fields: id, taskNumber, title, description, dueDate, dueTime, isCompleted, isFlagged, duration, priority, tags, subtasks, recurrence, nextRecurrenceDue, originalId, archived.

Not exposed: order, created_at, updated_at.

### 1.4 Current subtask state

Subtasks are JSONB arrays with a documented-by-convention shape of `{id, title, isCompleted}`.

No enforcement exists at any layer:
- Entity: `jsonb, default '[]'::jsonb`
- Joi validation: `Joi.array().items(Joi.object()).optional()`
- Zod validation: `z.array(z.object({}).passthrough()).optional()`
- Domain model: constructor accepts, no shape validation
- Repository: raw JSONB read/write, no normalization

Consequences:
- No guaranteed stable subtask id
- No guaranteed stable position
- No per-subtask inspect/mutate capability
- Only whole-array replacement via `update_task`
- `get_task` content preview shows only subtask count, not details

### 1.5 Current date query behavior

Two separate date semantics exist:
- `list_today` and `list_upcoming` use `taskDateFilters.js` with occurrence-span logic (handles `dateRange` recurrence correctly)
- `search_tasks` delegates to `findByFilters()` which filters only on stored `due_date` column without occurrence-span awareness

Missing query intents:
- tomorrow (backend route exists at `/tasks/day/tomorrow`, no MCP tool)
- this week / this month / arbitrary month (requires model-side date math)
- overdue (no filter or tool)
- recurring in range (no filter)
- archived only (no explicit tool)

### 1.6 Current recurrence behavior

Four creation modes: `daily` (per-day instances), `dateRange` (single spanning task), `specificDays` (per-selected-day instances), legacy `type+interval`.

Recurrence is not mutable post-creation via MCP — excluded from `updateTaskSchema` mutable fields.

Recurrence shapes are under-described in tool text. The model has no clear guidance on what forms are accepted.

### 1.7 Current lifecycle semantics

`delete_task` archives (soft delete). Backend has public `POST /api/todos/:id/archive` and `POST /api/todos/:id/unarchive`. Neither is exposed via MCP.

Archived task visibility is inconsistent:
- Active list flows hide archived tasks
- `get_task` can resolve archived tasks by taskNumber
- `search_tasks` can include archived tasks when `q` or `taskNumber` is provided (repository only forces `archived = false` when neither is set)
- No guard prevents completing or updating an archived task

### 1.8 Current history/personalization

No history-aware retrieval exists. No similarity scoring, no pattern reuse, no prior-task lookup.

The only history-adjacent fields are `originalId` (recurrence lineage) and `nextRecurrenceDue`.

### 1.9 Current deployment model

- `main` branch for development, `deploy` branch triggers VPS deployment via GitHub Actions
- Docker Compose production: postgres → lifeline-app (port 3020 loopback) → lifeline-mcp (port 3030 loopback)
- Nginx reverse proxy: lifeline.a2z-us.com → app, mcp.lifeline.a2z-us.com → mcp
- `apply-release.sh` handles rollback, health checks, release symlinks
- Health checks: `/api/health/db`, `/internal/mcp/health`, `/health` (MCP)

---

## 2. True bottlenecks

### 2.1 Bottleneck map

| Bottleneck | Layer | Severity | Impact |
|---|---|---|---|
| No subtask identity contract | Backend domain + entity | HIGH | Blocks all per-subtask operations |
| No subtask operations | Internal adapter + MCP | HIGH | Model cannot inspect/act on individual subtasks |
| No natural date-window query surface | Internal adapter + MCP | HIGH | Model must do fragile date math for common questions |
| Inconsistent date semantics | Internal adapter (search vs list) | MEDIUM | Range queries miss recurring tasks |
| No archive/restore MCP tools | Internal adapter + MCP | MEDIUM | Lifecycle is safe-ish but awkwardly named |
| No history-aware retrieval | Backend application | MEDIUM | Model cannot reuse user's own patterns |
| No overdue query | Internal adapter + MCP | MEDIUM | Common everyday question has no direct answer |
| Weak subtask preview in content | MCP toolResults | LOW | Model sees count but not details |
| Recurrence shapes under-described | MCP tool descriptions | LOW | Model guesses recurrence input shapes |
| Archived task leaks into search | Repository filter logic | LOW | Safety inconsistency |

### 2.2 Root-cause analysis

The dominant bottleneck is not raw backend capability. The backend already has archive, unarchive, date-token resolution, statistics, and recurrence creation.

The real gaps are:

1. **Subtask identity** — no stable contract exists at any layer
2. **Missing MCP tools** — intent-level tools for everyday planning don't exist
3. **Inconsistent query semantics** — search and list diverge on date logic
4. **History retrieval** — no infrastructure for similarity-based lookup
5. **Lifecycle naming** — `delete_task` does archiving but forces destructive verb

---

## 3. Target-state architecture

### 3.1 Architecture layers

```
┌──────────────────────────────────────────────────────────┐
│  Layer 4: Agent behavior rules (MCP server instructions) │
│  - inspect vs act heuristics                             │
│  - history reuse vs ask vs fresh creation                │
│  - archive-first lifecycle guidance                      │
│  - subtask disambiguation rules                          │
│  - confidence thresholds                                 │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│  Layer 3: MCP tool layer (services/lifeline-mcp)         │
│  - auth + scopes                                         │
│  - Zod input validation                                  │
│  - tool descriptions (model-facing)                      │
│  - content summaries (human-readable)                    │
│  - structuredContent (programmatic)                      │
│  - backend adapter calls                                 │
└──────────────┬───────────────────────────────────────────┘
               │ HTTP: /internal/mcp/*
┌──────────────▼───────────────────────────────────────────┐
│  Layer 2: Internal MCP adapter (backend/src/internal/mcp)│
│  - AI-oriented read/write routes                         │
│  - date-window query handlers                            │
│  - subtask operation handlers                            │
│  - archive/restore handlers                              │
│  - history-aware retrieval handlers                      │
│  - task normalization/payload shaping                     │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│  Layer 1: Backend domain + application + infrastructure  │
│  - Todo domain model (with subtask contract)             │
│  - Use-cases (CRUD, search, subtask ops, similarity)     │
│  - Repository (queries, filters, history lookup)         │
│  - Entity definitions (JSONB discipline)                 │
│  - Migrations (subtask schema evolution)                 │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Design principle enforcement

| Principle | How enforced |
|---|---|
| Backend-first AI contracts | All query semantics, subtask logic, similarity scoring, and lifecycle rules live in backend layers. MCP never implements business logic. |
| Thin MCP edge | MCP tools validate input, call backend, format results. No date math, no subtask manipulation, no similarity scoring in MCP. |
| Subtasks first-class for AI | Backend defines stable subtask identity. Internal adapter exposes subtask operations. MCP provides intent-level subtask tools. |
| Natural planning queries | Backend provides date-window query endpoint with occurrence-aware semantics. MCP maps intent names to backend calls. |
| History-aware personalization | Backend provides similarity search and confidence scoring. MCP exposes retrieval tools. Agent instructions define reuse policy. |
| Archive-first lifecycle | Backend archive/restore exposed as named adapter routes. MCP tools use `archive_task` / `restore_task` naming. `delete_task` demoted. |
| Enterprise safety | Scoped operations, user-isolation, structured errors, audit-ready fields (created_at, updated_at eventually exposed). |

### 3.3 Dependency direction

```
routes → controllers → application → domain ← infrastructure
                                        ↑
internal/mcp adapter ──────────────────┘ (calls use-cases)
                                        ↑
lifeline-mcp service ──────────────────┘ (calls adapter via HTTP)
```

No layer inversion. MCP service depends on adapter. Adapter depends on application. Application depends on domain. Infrastructure implements domain interfaces.

---

## 4. Design decisions

### 4.1 Subtask identity and contract

#### Decision: stable subtask ids with explicit positions

**Minimum subtask shape:**

```javascript
{
  subtaskId: string,     // UUID, assigned by backend on creation
  position: number,      // 1-based, maintained by backend
  title: string,         // required, 1-200 chars
  isCompleted: boolean   // default false
}
```

**Deferred fields** (not in Phase 2, may add later):
- `description` / `notes`
- `dueDate`
- `metadata`
- `createdAt` / `updatedAt`

#### Schema evolution strategy

This is a JSONB shape change. Per data-model governance, it requires:

1. **Migration**: Add `subtaskId` and `position` to existing subtask objects in JSONB
2. **Backfill**: Generate UUIDs for existing subtask items, assign positions from array index + 1
3. **Validation**: Application-layer validation of subtask shape on read and write
4. **Rollback**: Backfill is additive (new keys), no data loss. Down migration strips added keys.

**Column operation**: Non-destructive (adding keys to existing JSONB objects). Single migration sufficient without blue-green phases.

#### Migration safety hardening

The subtask JSONB column holds user data with no schema enforcement today. The migration must handle every shape that could exist in production.

**Malformed JSONB handling**:

| Scenario | Prevalence | Migration behavior |
|---|---|---|
| `null` column value | Possible (nullable JSONB) | Normalize to `'[]'::jsonb`. Log warning with task id. |
| Empty array `[]` | Common (default) | No-op. |
| Array of well-formed `{id, title, isCompleted}` objects | Common | Add `subtaskId` (UUID), `position` (index+1). Preserve existing `id` key as-is (do not collide with `subtaskId`). |
| Array of objects missing `title` | Edge case | Set `title` to `'Untitled'`. Log warning with task id. |
| Array of objects missing `isCompleted` | Edge case | Set `isCompleted` to `false`. |
| Array of objects with extra unexpected keys | Possible | Preserve extra keys. Migration is additive only. |
| Non-array value (string, number, object) | Unlikely but possible | Normalize to `'[]'::jsonb`. Log warning with task id. |
| Array containing non-object items (strings, nulls) | Unlikely | Filter out non-object items. Log warning with task id. |

**Duplicate and blank title handling**:
- Migration does NOT deduplicate titles. Two subtasks with the same title both receive unique `subtaskId` values and sequential `position` values.
- Blank titles (`''` or whitespace-only) are normalized to `'Untitled'` during migration.
- Post-migration, the `SubtaskContract.js` validation layer rejects blank titles on new writes. Existing blank titles are tolerated for reads.

**Ordering guarantees**:
- `position` is assigned from array index + 1, preserving the original array order.
- The migration must process subtask arrays in a single pass per task. No concurrent modification during migration.
- Migration uses `UPDATE ... SET subtasks = (backfilled_array) WHERE id = task_id` per row, wrapped in a single transaction.

**Production-like validation requirements** (Phase 1a exit gate):
- Migration tested against a snapshot of production data (anonymized if needed) BEFORE deploying.
- Migration tested against: empty database, database with zero subtasks, database with 1000+ subtask-bearing tasks, database with deliberately malformed JSONB (inject test rows with null, non-array, mixed types).
- Post-migration assertion: every non-null `subtasks` column is a JSON array where every element has `subtaskId` (string, unique within array), `position` (integer ≥ 1, unique within array), `title` (non-empty string), and `isCompleted` (boolean).

**Transition-window behavior**:
- Between migration deployment and MCP tool deployment, the backend serves tasks with the new subtask shape (subtaskId + position) but no MCP tools target them yet. This is safe: `get_task` already returns the subtasks array, and the new keys are additive.
- The existing `update_task` whole-array replacement path must be updated in Phase 1a to preserve `subtaskId` and `position` if the caller omits them. A write that sends `[{title: "X", isCompleted: false}]` must NOT strip `subtaskId`/`position` from the stored copy. The normalization layer (`SubtaskContract.js`) assigns these on write if missing.

**Rollback safety**:
- Down migration: `UPDATE todos SET subtasks = (select jsonb_agg(elem - 'subtaskId' - 'position') from jsonb_array_elements(subtasks) as elem) WHERE subtasks != '[]'::jsonb AND subtasks IS NOT NULL;`
- Down migration is data-preserving: only strips the two added keys.
- If down migration runs and old MCP tools are redeployed, behavior returns to pre-initiative state with no data loss.

#### Subtask targeting rules

The MCP surface should support three targeting modes:

| Mode | Input | Resolution |
|---|---|---|
| By subtaskId | `subtaskId: "uuid"` | Exact match in parent task's subtasks array |
| By position | `position: 3` | 1-based index lookup |
| By title | `title: "Buy groceries"` | Exact case-insensitive title match; reject if ambiguous (0 or 2+ matches) |

**Ambiguity handling**: If title matches 0 or 2+ subtasks, return a structured error listing all subtasks with positions and ids so the model can retry with a precise selector.

#### Subtask operations

| Operation | Internal adapter route | MCP tool |
|---|---|---|
| Add subtasks | `POST /tasks/:id/subtasks` | `add_subtasks` |
| Complete subtask | `POST /tasks/:id/subtasks/:subtaskId/complete` | `complete_subtask` |
| Uncomplete subtask | `POST /tasks/:id/subtasks/:subtaskId/uncomplete` | `uncomplete_subtask` |
| Update subtask | `PATCH /tasks/:id/subtasks/:subtaskId` | `update_subtask` |
| Remove subtask | `DELETE /tasks/:id/subtasks/:subtaskId` | `remove_subtask` |
| Reorder subtasks | `POST /tasks/:id/subtasks/reorder` | Deferred to Phase 4+ |

**Where logic lives**: All subtask manipulation (id assignment, position maintenance, deduplication, validation) lives in a backend use-case layer (`SubtaskOperations.js` or similar). The internal adapter routes call use-cases. MCP tools call adapter routes.

### 4.2 Natural planning query contract

#### Decision: single flexible window endpoint with occurrence-aware semantics

**Internal adapter route**: `GET /internal/mcp/tasks/window`

**Query parameters**:

| Parameter | Type | Examples | Notes |
|---|---|---|---|
| `window` | string | `today`, `tomorrow`, `this_week`, `this_month`, `overdue` | Named time windows |
| `month` | string | `2026-03`, `march`, `march_2026` | Calendar month shorthand |
| `startDate` | YYYY-MM-DD | `2026-03-01` | Explicit range start |
| `endDate` | YYYY-MM-DD | `2026-03-31` | Explicit range end |
| `includeOverdue` | boolean | `true` | Append overdue tasks to results |
| `includeRecurring` | boolean | `true` | Include recurring occurrences in range |
| `status` | string | `active`, `completed`, `archived`, `all` | Lifecycle filter |
| `tags` | string[] | tag ids | Tag filter |
| `priority` | string | `high`, `medium`, `low` | Priority filter |
| `flagged` | boolean | `true` | Flag filter |

**Resolution precedence**:
1. If `window` is provided, resolve to concrete `startDate`/`endDate` on the server side
2. If `month` is provided, resolve to first/last day of that month
3. If explicit `startDate`/`endDate` are provided, use directly
4. `window` and explicit dates are mutually exclusive — return validation error if both provided

**Window token resolution** (backend-side, not model-side):

| Token | Start | End |
|---|---|---|
| `today` | today 00:00 | today 23:59 |
| `tomorrow` | tomorrow 00:00 | tomorrow 23:59 |
| `this_week` | Monday of current week | Sunday of current week (respects user's `start_day_of_week` from profile) |
| `this_month` | 1st of current month | last day of current month |
| `overdue` | tasks where dueDate < today AND isCompleted = false AND archived = false | — |

**User start-day-of-week support**: The `this_week` window uses the user's `start_day_of_week` setting from `UserProfileEntity` (column added in migration `005_add_start_day_to_user_profiles.sql`). This is real personalization grounded in existing backend data.

#### Canonical window semantics (locked)

The following definitions are canonical for this initiative. All implementations must conform exactly.

**Timezone rule**: All window token resolution uses the server's wall-clock date (the backend runs in a single timezone context). No per-user timezone support in this initiative. If the user's profile gains a timezone field in the future, the window resolver must be updated — but that is out of scope here.

**Window token definitions**:

| Token | Start (inclusive) | End (inclusive) | Status filter | Recurring inclusion | Notes |
|---|---|---|---|---|---|
| `today` | Today 00:00:00 | Today 23:59:59.999 | `active` (default) | Yes — include `dateRange` tasks whose span covers today; include `daily`/`specificDays` instances due today | Same semantics as existing `list_today` |
| `tomorrow` | Tomorrow 00:00:00 | Tomorrow 23:59:59.999 | `active` (default) | Yes — same occurrence-span logic as today | Matches existing backend route `/tasks/day/tomorrow` |
| `this_week` | Start-of-week 00:00:00 | End-of-week 23:59:59.999 | `active` (default) | Yes — all occurrences within the week range | Week boundaries use user's `start_day_of_week` (default: Monday if unset) |
| `this_month` | 1st of current month 00:00:00 | Last day of current month 23:59:59.999 | `active` (default) | Yes — all occurrences within the month range | Calendar month, not rolling 30 days |
| `overdue` | Beginning of time | Yesterday 23:59:59.999 | `active` AND `isCompleted = false` | Yes — recurring tasks with missed due dates within the overdue window | Never includes completed or archived tasks regardless of status param |
| `month` param (e.g., `2026-03`) | 1st of specified month 00:00:00 | Last day of specified month 23:59:59.999 | `active` (default) | Yes | Same behavior as `this_month` but for any month |

**Completed-task interaction**:

| Window | `status: active` (default) | `status: completed` | `status: all` |
|---|---|---|---|
| `today` | Active incomplete + active completed-today tasks with due_date today | Only completed tasks with due_date today | Both |
| `tomorrow` | Active tasks due tomorrow | Completed tasks due tomorrow | Both |
| `this_week` | Active tasks due this week | Completed tasks due this week | Both |
| `overdue` | **Only incomplete active tasks** | N/A — completed tasks cannot be overdue | N/A — overdue is definitionally incomplete |

Clarification: `status: active` includes both completed and incomplete tasks that are not archived. The `overdue` window additionally filters to `isCompleted = false` regardless of the status parameter.

**Archived-task interaction**: Archived tasks are excluded from all window queries unless `status: archived` or `status: all` is explicitly provided. This is enforced by the query layer, not by the window resolver.

**Occurrence-span semantics**: The window endpoint MUST use the occurrence-span logic from `taskDateFilters.js` for all date matching. Specifically:
- `dateRange` recurrence: a task appears in a window if the task's date span overlaps with the window range.
- `daily` recurrence: a task appears if any generated instance falls within the window range.
- `specificDays` recurrence: a task appears if any selected-day instance falls within the window range.
- Non-recurring tasks: simple `due_date` within range check.

**`start_day_of_week` handling**: If the user's profile has no `start_day_of_week` value (null or missing), default to `monday`. The `this_week` token resolution must read the user profile to determine week boundaries. This is a single DB read, cacheable per request.

**Occurrence-aware semantics**: The window endpoint must use `taskDateFilters.js` occurrence-span logic for date matching, not raw `due_date` column comparison. This ensures `dateRange` recurrence tasks appear correctly in the window.

#### MCP tool mapping

| MCP tool | Backend call | Model-facing name |
|---|---|---|
| `list_tasks` | `GET /tasks/window?window=...` | Generic intent-level query tool replacing fragmented reads |
| `list_today` | Preserved as-is (calls existing route) | Backward compatible |
| `list_upcoming` | Preserved as-is | Backward compatible |

**Design choice**: Add `list_tasks` as the new primary planning tool. Keep `list_today` and `list_upcoming` for backward compatibility. Model instructions should prefer `list_tasks` for flexibility.

### 4.3 History-aware personalization

#### Decision: backend-first similarity with three-tier confidence policy

**Where logic lives**: Backend application layer. A new use-case `FindSimilarTasks.js` performs similarity lookup. The internal adapter exposes it. MCP provides a retrieval tool.

#### Similarity signals

| Signal | Weight | Method |
|---|---|---|
| Title similarity | 0.4 | Trigram similarity (`pg_trgm` extension, `similarity()` function) |
| Tag overlap | 0.25 | Jaccard coefficient on tag sets |
| Subtask pattern similarity | 0.15 | Title-set Jaccard on subtask titles |
| Recurrence similarity | 0.1 | Exact match on recurrence type/mode |
| Recency | 0.1 | Decay function on created_at (more recent = higher weight) |

**Composite score**: Weighted sum normalized to 0.0–1.0.

#### Confidence tiers

| Tier | Score range | Behavior |
|---|---|---|
| High confidence | ≥ 0.80 | Auto-reuse prior structure (subtasks, tags, duration, priority, recurrence) |
| Medium confidence | 0.50–0.79 | Return match details; agent should ask user for confirmation |
| Low confidence | < 0.50 | No match returned; agent creates from best judgment |

#### Internal adapter route

`GET /internal/mcp/tasks/similar`

**Query parameters**:
- `title` (required) — title of proposed task
- `tags` (optional) — proposed tag ids
- `limit` (optional, default 3) — max similar tasks to return
- `minScore` (optional, default 0.5) — minimum similarity threshold

**Response shape**:
```javascript
{
  matches: [
    {
      task: normalizedTaskShape,
      similarityScore: 0.85,
      confidenceTier: "high",
      matchedSignals: {
        titleSimilarity: 0.92,
        tagOverlap: 0.75,
        subtaskSimilarity: 0.80,
        recurrenceSimilarity: 1.0,
        recencyScore: 0.70
      }
    }
  ]
}
```

#### MCP tool

`find_similar_tasks` — read-only, returns similar tasks with confidence scoring.

**Safety invariants for history-aware retrieval**:

1. **Read-only first**: `find_similar_tasks` is a pure read operation. It never mutates state, creates tasks, or auto-applies patterns. It returns data; the agent (or user) decides what to do with it.
2. **No silent coupling**: The backend NEVER auto-reuses a prior task's structure during `create_task`. There is no hidden "if similar task found, copy its fields" logic in any backend layer. The confidence tiers below are guidance for the **agent's behavior** (Layer 4 instructions), not backend enforcement.
3. **Confidence policy is agent guidance, not backend logic**: The backend returns a similarity score and a confidence tier label. It does not act on the tier. The agent instructions (Phase 4) define what the agent should do at each tier. A different agent or client could ignore the tiers entirely.
4. **Graceful degradation is testable**: The `FindSimilarTasks` use-case must be testable in two modes: (a) with `pg_trgm` available (full scoring), and (b) without `pg_trgm` (ILIKE fallback with reduced accuracy). Tests must cover both paths. The `SIMILARITY_UNAVAILABLE` error code is returned when the extension is absent AND the ILIKE fallback also fails — but the normal case is that ILIKE fallback succeeds silently.
5. **Agent can skip**: The agent is never required to call `find_similar_tasks` before `create_task`. The tool is opportunistic. Agent instructions should suggest checking history for repeated-looking tasks, not mandate it.

**Agent instructions** (Layer 4) define the reuse policy:
- High confidence: "When creating a task similar to a past task with high confidence, reuse the prior structure (subtasks, tags, duration, priority). Tell the user what you're reusing."
- Medium confidence: "When similarity is medium, show the user the match and ask: 'I found a similar past task. Should I use its structure?'"
- Low confidence / no match: "Create the task using your best judgment about appropriate structure."

#### Infrastructure requirements

**PostgreSQL `pg_trgm` extension**: Required for trigram similarity on title text. This is a CREATE EXTENSION operation — needs migration.

**Migration safety**: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` is non-destructive and idempotent. Single migration, no blue-green needed. Extension ships with standard PostgreSQL.

**Index**: GiST index on `todos.title` using `gist_trgm_ops` for fast similarity search. Only justified once similarity queries are active — add in the same migration.

**Query scope**: Similar-task search only within the same user's tasks. User-scoping is mandatory per backend governance.

### 4.4 Lifecycle redesign

#### Decision: archive-first naming with delete demotion

**New MCP tools**:

| Tool | Maps to | Notes |
|---|---|---|
| `archive_task` | `DELETE /tasks/:id` (existing archive behavior) | Primary AI lifecycle action |
| `restore_task` | New: `POST /tasks/:id/restore` | New internal adapter route, calls existing `repository.unarchive()` |
| `batch_archive` | Existing `batch_archive` | Already exists |
| `batch_restore` | New: batch unarchive | New batch operation |

**Deprecation of `delete_task`**: `delete_task` will remain registered for backward compatibility in Phase 3 but with updated description text that says "Use archive_task instead for normal use. This tool archives the task (no permanent deletion)." Model instructions should direct agents to `archive_task`.

**Backward-compatibility contract for `delete_task` deprecation**:
- `delete_task` continues to accept the same input schema (taskNumber or id).
- `delete_task` continues to call the same backend route (`DELETE /internal/mcp/tasks/:id`) which performs archive, not hard delete.
- `delete_task` continues to return the same response shape.
- The ONLY change is the description text and the server instruction guidance. No behavioral change.
- `delete_task` is NOT removed. Removal would be a breaking change for any client that calls it by name.

**Hard delete handling**: Hard delete is permanently excluded from the MCP tool surface for this initiative and beyond. If hard delete is ever needed, it must be:
- A separate admin-only surface (not MCP)
- Gated by elevated permissions
- Audit-logged
- Not discoverable by the conversational agent
- Approved via a new ADR

**Archived state guards — release-blocking designation**:

Archived-state mutation guards are **release-blocking for Slice 1**. No new MCP tools may ship to production until the following guards are verified:

| Handler | Guard behavior | Test required |
|---|---|---|
| `updateTask` | Rejects with `TASK_ARCHIVED` if `task.archived === true` | Yes — unit + integration |
| `completeTask` | Rejects with `TASK_ARCHIVED` if `task.archived === true` | Yes — unit + integration |
| `uncompleteTask` | Rejects with `TASK_ARCHIVED` if `task.archived === true` | Yes — unit + integration |
| `add_subtasks` (via adapter) | Rejects with `TASK_ARCHIVED` if parent task is archived | Yes — unit + integration |
| `complete_subtask` | Rejects with `TASK_ARCHIVED` if parent task is archived | Yes — unit + integration |
| `uncomplete_subtask` | Rejects with `TASK_ARCHIVED` if parent task is archived | Yes — unit + integration |
| `update_subtask` | Rejects with `TASK_ARCHIVED` if parent task is archived | Yes — unit + integration |
| `remove_subtask` | Rejects with `TASK_ARCHIVED` if parent task is archived | Yes — unit + integration |

All guards return the same structured error shape: `{ code: 'TASK_ARCHIVED', status: 422, message: 'Task is archived. Restore it first with restore_task.' }`.

**Restore flow — precise definition**:

1. Agent (or user) calls `restore_task(taskNumber: N)`.
2. MCP tool resolves taskNumber to task id via `get_task` or direct lookup.
3. MCP tool calls `POST /internal/mcp/tasks/:id/restore`.
4. Internal adapter handler calls `repository.unarchive(id, userId)`.
5. Repository sets `archived = false`, `updated_at = now()` on the task row.
6. Handler returns the normalized task shape (same as `get_task` response).
7. MCP tool returns success content: "Task #N restored to active tasks."
8. If the task is already active (not archived), return a non-error informational response: "Task #N is already active."
9. If the task does not exist, return `TASK_NOT_FOUND`.
10. If the task belongs to a different user, return `TASK_NOT_FOUND` (do not leak existence).

**Archive visibility rules**:

| Operation | Sees archived tasks? | Behavior |
|---|---|---|
| `list_tasks(status: 'active')` or default | No | Archived excluded |
| `list_tasks(status: 'archived')` | Yes — archived only | Active excluded |
| `list_tasks(status: 'all')` | Yes — both | All tasks returned |
| `list_tasks(status: 'completed')` | No | Completed non-archived only |
| `list_today` / `list_upcoming` | No | Existing behavior preserved |
| `search_tasks(q: ...)` | No (hardened in Phase 3b) | Archived excluded unless status filter provided |
| `search_tasks(taskNumber: N)` | **Yes** | Direct lookup by number always resolves (user may need to find archived tasks) |
| `get_task(taskNumber: N)` | **Yes** | Direct lookup always resolves; response includes `archived: true/false` |
| `archive_task` | N/A (write) | Archives the task |
| `restore_task` | N/A (write) | Requires task to be archived |
| `batch_archive` | N/A (write) | Skips already-archived tasks silently |
| `batch_restore` | N/A (write) | Skips already-active tasks silently |

#### Internal adapter changes

| Route | Method | Handler | Status |
|---|---|---|---|
| `POST /tasks/:id/restore` | POST | New handler calling `repository.unarchive()` | New |
| `POST /tasks/batch` with `action: restore` | POST | Extend existing batch handler | New action |

### 4.5 Recurrence semantics clarification

#### Decision: clarify but do not redesign recurrence in this initiative

Recurrence is functional. The four creation modes work. The main issues are:

1. **Under-described in tool text** — fix with better descriptions
2. **Not mutable post-creation** — acceptable for now; recurrence mutation is complex and deferred
3. **Occurrence semantics inconsistent** — fix by using window endpoint with occurrence-aware logic

**What changes in this initiative**:
- Better tool descriptions for `create_task` recurrence parameter
- `list_tasks` window endpoint uses occurrence-span semantics consistently
- Existing `list_today` and `list_upcoming` remain unchanged (already use occurrence-span logic)

**What is explicitly deferred**:
- Recurrence mutation after creation
- Automatic recurrence instance generation (cron/timer)
- Recurrence series management (edit all future, edit this instance)

**Recurrence mutation deferral commitment**:

Recurrence mutation (changing a task's recurrence pattern after creation) is **deferred with prejudice** for this initiative. This is not a "nice-to-have we'll get to later" — it is an intentional exclusion based on the following evidence:

1. **Current repo truth**: `MUTABLE_UPDATE_FIELDS` in `taskWriteHandlers.js` already excludes recurrence. This is not an oversight; it is the existing safety posture. The step-09 initiative does not weaken it.
2. **Complexity**: Recurrence mutation requires answering "edit this instance only, this and future, or all instances" — a multi-branch UX and data model problem that is orthogonal to everyday task fluency.
3. **Risk**: Exposing recurrence mutation without series-management infrastructure could corrupt recurrence lineage (`originalId`, `nextRecurrenceDue`) in ways that are hard to recover from.
4. **User pain**: The discovery pass did not surface recurrence mutation as a friction point. The friction was in querying recurring tasks (addressed by window semantics) and under-described input shapes (addressed by better tool descriptions).

**Conditions for revisiting** (all must be true):
- A future discovery pass identifies recurrence mutation as a top-3 user friction point
- The backend has a series-management model (edit-this-instance vs edit-all)
- An ADR documents the mutation contract including rollback safety
- The work is scoped as a separate initiative, not bolted onto step-09

### 4.6 Safety model

#### Scoped action discipline

| Action type | Safety | Guard |
|---|---|---|
| Read operations | Safe | User-scoped only |
| Single-task mutation | Safe | User-scoped, task existence check |
| Subtask mutation | Safe | User-scoped, parent task + subtask existence check |
| Archive | Safe-reversible | Soft delete, restorable |
| Restore | Safe-reversible | Returns to active set |
| Batch operations | Bounded-safe | Max 50 items per batch |
| Hard delete | Not exposed | Excluded from MCP surface |
| Account reset | Not exposed via MCP | Exists only on public API with auth |

#### Error discipline

All errors return structured shape:
```javascript
{
  isError: true,
  content: [{ type: 'text', text: 'Human-readable message (ERROR_CODE)' }],
  structuredContent: {
    error: { code: 'ERROR_CODE', status: 4xx, message: '...', details: null|object }
  }
}
```

New error codes for this initiative:
- `TASK_ARCHIVED` — mutation attempted on archived task
- `SUBTASK_NOT_FOUND` — subtask id/position/title did not resolve
- `SUBTASK_AMBIGUOUS` — title matched multiple subtasks (details includes full subtask list)
- `INVALID_WINDOW` — unrecognized window token
- `SIMILARITY_UNAVAILABLE` — pg_trgm extension not available (graceful degradation)

---

## 5. Multi-phase implementation roadmap

### Phase 0: Architecture lock and preparation

**Objective**: Lock initiative scope, verify discovery findings, prepare migration strategy.

**Scope**:
- Verify discovery artifact findings against current main branch state
- Lock the architecture described in this plan
- Identify exact files to be created/modified per phase
- Prepare ADR for subtask identity contract decision
- Prepare ADR for archive-first lifecycle decision

**Likely files/surfaces**:
- `docs/adr/0002-subtask-identity-contract.md` (new)
- `docs/adr/0003-archive-first-lifecycle.md` (new)
- This planning artifact (already created)

**Validation**:
- Discovery artifact and plan reviewed
- ADRs written and approved

**Risks**:
- Scope creep during architecture lock — mitigate by treating this phase as purely documentary

**Deferred**: All implementation work.

---

### Phase 1: Backend AI-oriented task contracts

**Objective**: Build the backend foundation for natural planning, subtask operations, lifecycle, and history retrieval.

**Scope**:

#### 1a. Subtask identity contract (backend domain + entity + migration)

**Files to create/modify**:
- `backend/src/infra/db/entities/TodoEntity.js` — document JSONB subtask shape in comments
- `backend/src/migrations/TIMESTAMP_add_subtask_identity.js` — backfill subtask ids and positions
- `backend/src/domain/Todo.js` — add subtask shape validation in constructor
- `backend/src/domain/SubtaskContract.js` (new) — subtask shape definition, validation helpers, id generation
- `backend/src/application/SubtaskOperations.js` (new) — use-case for add/complete/update/remove subtasks
- `backend/src/infrastructure/TypeORMTodoRepository.js` — add subtask-aware query methods if needed
- `backend/src/middleware/validateSubtask.js` (new) — Joi schemas for subtask operation requests

**Migration details**:
- Generate UUIDs for existing subtask items using `uuid` package
- Assign `position` from array index + 1
- Wrap in transaction
- Down migration: strip `subtaskId` and `position` keys from JSONB arrays

**Preserved behavior**: All existing task CRUD continues to work. Subtask arrays gain additional keys but lose no existing data. `update_task` with whole-array replacement still works.

#### 1b. Date-window query handler (internal adapter)

**Files to create/modify**:
- `backend/src/internal/mcp/taskReadRouter.js` — add `GET /tasks/window` route
- `backend/src/internal/mcp/taskReadHandlers.js` — add `listTasksByWindow` handler
- `backend/src/internal/mcp/taskDateFilters.js` — add window-token resolution, week/month calculation
- `backend/src/internal/mcp/taskPayloads.js` — no changes expected (already normalizes)

**Window handler logic**:
1. Resolve window token to startDate/endDate range (server-side)
2. Fetch user profile for `start_day_of_week` (for `this_week` token)
3. Query tasks using occurrence-span logic from `taskDateFilters.js`
4. Apply additional filters (status, tags, priority, flagged)
5. Return normalized task list with metadata (resolvedWindow, startDate, endDate, count)

**Overdue handler**: `window=overdue` queries for tasks where effective due date < today AND not completed AND not archived.

#### 1c. Archive/restore routes (internal adapter)

**Files to create/modify**:
- `backend/src/internal/mcp/taskWriteRouter.js` — add `POST /tasks/:id/restore` route
- `backend/src/internal/mcp/taskWriteHandlers.js` — add `restoreTask` handler, add archived-state guards to existing mutation handlers
- `backend/src/internal/mcp/taskReadHandlers.js` — extend batch handler to support `action: restore`

**Archived state guards**: Add to `updateTask`, `completeTask`, `uncompleteTask` handlers:
```javascript
if (task.archived) {
  throw new ValidationError('Task is archived. Restore it first.', 'TASK_ARCHIVED');
}
```

#### 1d. Subtask operation routes (internal adapter)

**Files to create/modify**:
- `backend/src/internal/mcp/subtaskRouter.js` (new) — subtask operation routes under `/tasks/:id/subtasks`
- `backend/src/internal/mcp/subtaskHandlers.js` (new) — handlers calling `SubtaskOperations` use-case
- `backend/src/internal/mcp/router.js` — mount subtask sub-router

**Routes**:
- `POST /tasks/:id/subtasks` — add subtasks (body: `{ subtasks: [{title}] }`)
- `POST /tasks/:id/subtasks/:subtaskId/complete` — complete one subtask
- `POST /tasks/:id/subtasks/:subtaskId/uncomplete` — uncomplete one subtask
- `PATCH /tasks/:id/subtasks/:subtaskId` — update subtask (title rename)
- `DELETE /tasks/:id/subtasks/:subtaskId` — remove one subtask

**Subtask resolution middleware**: For routes that accept `:subtaskId`, support three resolution modes:
- If `:subtaskId` is a valid UUID, match by `subtaskId`
- If `:subtaskId` is a numeric string, match by `position`
- Else, attempt exact title match (reject if ambiguous)

#### 1e. History-aware similarity (backend application + infrastructure)

**Files to create/modify**:
- `backend/src/migrations/TIMESTAMP_add_pg_trgm_extension.js` (new) — `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- `backend/src/migrations/TIMESTAMP_add_title_trigram_index.js` (new) — GiST index on todos.title
- `backend/src/application/FindSimilarTasks.js` (new) — similarity use-case
- `backend/src/infrastructure/TypeORMTodoRepository.js` — add `findSimilarByTitle(userId, title, options)` method
- `backend/src/internal/mcp/taskReadRouter.js` — add `GET /tasks/similar` route
- `backend/src/internal/mcp/taskReadHandlers.js` — add `findSimilarTasks` handler

**Graceful degradation**: If `pg_trgm` is not available (e.g., test environment), fall back to ILIKE-based title matching with reduced scoring accuracy. The use-case should catch extension-not-found errors and degrade, not crash.

**Validation expectations**:
- Unit tests for `SubtaskContract.js` shape validation and id generation
- Unit tests for `SubtaskOperations.js` use-case
- Unit tests for window token resolution logic
- Unit tests for `FindSimilarTasks.js` scoring
- Integration tests for subtask migration (backfill verifiable)
- Integration tests for archived-state guards

**Risks**:
- Subtask migration on large JSONB arrays could be slow — mitigate by batching in migration
- `pg_trgm` extension may not be pre-installed in all environments — mitigate with graceful degradation
- Window endpoint scope could expand — mitigate by deferring complex recurrence-series visibility

**Deferred**:
- MCP tool registration (Phase 2)
- Agent behavior rules (Phase 4)
- Recurrence mutation post-creation
- Subtask reorder operation

---

### Phase 2: MCP surface redesign

**Objective**: Add thin MCP tools over the new backend contracts. Improve existing tool ergonomics.

**Scope**:

#### 2a. New planning query tool

**Files to create/modify**:
- `services/lifeline-mcp/src/mcp/taskTools.js` — add `list_tasks` tool registration
- `services/lifeline-mcp/src/backend/internalBackendClient.js` — add `listTasksByWindow(params)` method
- `services/lifeline-mcp/src/mcp/toolResults.js` — add window-result formatting

**`list_tasks` tool**:
```javascript
server.tool('list_tasks', {
  description: 'List tasks by time window, date range, or status. ' +
    'Use for natural planning: today, tomorrow, this_week, this_month, overdue. ' +
    'Also supports explicit date ranges and status filtering (active, completed, archived). ' +
    'Use get_task for full detail on a specific task.',
  inputSchema: z.object({
    window: z.enum(['today', 'tomorrow', 'this_week', 'this_month', 'overdue']).optional(),
    month: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    includeOverdue: z.boolean().optional(),
    includeRecurring: z.boolean().optional(),
    status: z.enum(['active', 'completed', 'archived', 'all']).optional(),
    tags: z.array(z.union([z.string(), z.number()])).optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    flagged: z.boolean().optional()
  }).refine(/* window and explicit dates mutually exclusive */)
})
```

#### 2b. Subtask tools

**Files to create/modify**:
- `services/lifeline-mcp/src/mcp/taskTools.js` — add subtask tool registrations
- `services/lifeline-mcp/src/backend/internalBackendClient.js` — add subtask adapter methods
- `services/lifeline-mcp/src/mcp/toolResults.js` — add subtask-result formatting

**New tools**:

| Tool | Input | Description |
|---|---|---|
| `add_subtasks` | `taskNumber`, `subtasks: [{title}]` | Add one or more subtasks to a task |
| `complete_subtask` | `taskNumber`, `selector: {subtaskId \| position \| title}` | Mark a specific subtask complete |
| `uncomplete_subtask` | `taskNumber`, `selector: {subtaskId \| position \| title}` | Reopen a specific subtask |
| `update_subtask` | `taskNumber`, `selector`, `updates: {title}` | Rename a subtask |
| `remove_subtask` | `taskNumber`, `selector` | Remove a subtask from the task |

**Subtask selector schema**:
```javascript
const subtaskSelectorSchema = z.object({
  subtaskId: z.string().optional(),
  position: z.number().int().min(1).optional(),
  title: z.string().optional()
}).refine(
  d => [d.subtaskId, d.position, d.title].filter(Boolean).length === 1,
  { message: 'Provide exactly one of subtaskId, position, or title' }
);
```

#### 2c. Archive/restore tools

**Files to create/modify**:
- `services/lifeline-mcp/src/mcp/taskTools.js` — add `archive_task`, `restore_task`, `batch_restore`
- `services/lifeline-mcp/src/backend/internalBackendClient.js` — add restore adapter methods

**New tools**:

| Tool | Input | Notes |
|---|---|---|
| `archive_task` | `taskNumber` or `id` | Maps to existing delete (archive) route |
| `restore_task` | `taskNumber` or `id` | Maps to new restore route |
| `batch_restore` | `taskNumbers[]` | Maps to batch action: restore |

#### 2d. History/similarity tool

**Files to create/modify**:
- `services/lifeline-mcp/src/mcp/taskTools.js` — add `find_similar_tasks` tool
- `services/lifeline-mcp/src/backend/internalBackendClient.js` — add similarity adapter method

**`find_similar_tasks` tool**:
- Input: `title` (required), `tags` (optional), `limit` (optional)
- Output: similar tasks with confidence scoring
- Read-only, non-destructive

#### 2e. Improved get_task content formatting

**Files to modify**:
- `services/lifeline-mcp/src/mcp/toolResults.js` — enhance `formatSingleTaskPreview` to enumerate subtasks

**Change**: Instead of `Subtasks: 3`, show:
```
Subtasks:
  1. [x] Buy groceries (id: abc123)
  2. [ ] Clean kitchen (id: def456)
  3. [ ] Take out trash (id: ghi789)
```

#### 2f. Improved tool descriptions

**Files to modify**:
- `services/lifeline-mcp/src/mcp/taskTools.js` — enhance descriptions for `create_task` (recurrence shapes), `search_tasks` (tag filtering clarification)
- `services/lifeline-mcp/src/mcp/serverFactory.js` — update server instructions to mention new tools

**Validation expectations**:
- End-to-end MCP tests for each new tool (extend `mcpService.test.js`)
- Test subtask selector resolution (by id, position, title, ambiguity)
- Test window token resolution through MCP
- Test archive/restore through MCP
- Test similarity retrieval through MCP
- Test that existing tools continue to work unchanged

**Risks**:
- Tool count expansion (from 18 to ~28) could make discovery harder — mitigate with clear tool descriptions and server instructions
- Subtask selector ambiguity — mitigate with explicit error responses
- Backward compatibility — mitigate by keeping existing tools unchanged

**Deferred**:
- Agent behavior rules (Phase 4)
- Recurrence mutation tools
- Subtask reorder tool
- Advanced search improvements

---

### Phase 3: Integration and lifecycle hardening

**Objective**: Ensure consistent behavior across all tools, harden lifecycle semantics, and fix known inconsistencies.

**Scope**:

#### 3a. Consistent date semantics across search and list

**Files to modify**:
- `backend/src/infrastructure/TypeORMTodoRepository.js` — update `findByFilters()` to use occurrence-span logic when date range filters are provided

**Change**: When `startDate` and/or `endDate` are provided to `findByFilters()`, use the same occurrence-span logic from `taskDateFilters.js` instead of raw `due_date` column comparison. This ensures `search_tasks` and `list_tasks` return consistent results for recurring tasks.

**Preserved behavior**: All existing search behavior for non-recurring tasks is identical. Only tasks with `dateRange` recurrence mode are affected.

#### 3b. Archived-task visibility cleanup

**Files to modify**:
- `backend/src/infrastructure/TypeORMTodoRepository.js` — enforce `archived = false` consistently in `findByFilters()` unless `status: archived` or `status: all` is explicitly requested

**Change**: Remove the current conditional that only applies `archived = false` when neither `q` nor `taskNumber` is present. Instead, always apply the archived filter unless the caller explicitly opts in.

#### 3c. delete_task deprecation

**Files to modify**:
- `services/lifeline-mcp/src/mcp/taskTools.js` — update `delete_task` description to say "Deprecated: use archive_task instead."
- `services/lifeline-mcp/src/mcp/serverFactory.js` — update server instructions to direct models to archive_task

**Preserved behavior**: `delete_task` continues to work identically. Only the description text changes.

#### 3d. Archived-state mutation guards

Verify that all mutation handlers (update, complete, uncomplete) reject operations on archived tasks:
- `backend/src/internal/mcp/taskWriteHandlers.js` — already added in Phase 1c, verify coverage here
- Add test coverage for each guard

**Validation expectations**:
- Integration tests verifying date-semantic consistency between search and list for dateRange recurrence tasks
- Integration tests verifying archived-task visibility rules
- Regression tests for existing search behavior
- Tests for delete_task backward compatibility

**Risks**:
- Changing repository filter logic could affect existing behavior — mitigate with comprehensive regression tests
- Archived visibility change could break assumptions in other consumers — audit all `findByFilters` callers

**Deferred**:
- Agent behavior rules (Phase 4)
- Hard delete capability (intentionally excluded from AI path)

---

### Phase 4: Agent behavior rules and ergonomics

**Objective**: Define model-facing guidance rules, improve tool descriptions, and establish the three-tier personalization policy.

**Scope**:

#### 4a. Server instructions update

**Files to modify**:
- `services/lifeline-mcp/src/mcp/serverFactory.js` — comprehensive instructions update

**New instruction content**:

```
Planning queries:
- Use list_tasks with window tokens for natural date queries
- Use list_tasks(window: 'overdue') for overdue tasks
- Use list_tasks(status: 'archived') to browse archived tasks
- Use get_task for full detail on any specific task

Subtask operations:
- Use get_task first to see subtask details (ids, positions, titles)
- Target subtasks by position for ordinal requests ("the first subtask")
- Target subtasks by title for named requests ("Buy groceries")
- If a title is ambiguous, the error will list all subtasks for disambiguation

Task creation with history:
- Before creating a task, optionally use find_similar_tasks to check for patterns
- High confidence match (≥0.80): reuse prior structure, tell user what you're reusing
- Medium confidence (0.50-0.79): show match, ask user for confirmation
- Low confidence (<0.50) or no match: create using best judgment
- History reuse is optional — skip for simple or unique tasks

Lifecycle:
- Use archive_task for normal task removal (safe, reversible)
- Use restore_task to bring back archived tasks
- Use batch_archive and batch_restore for bulk lifecycle actions
- delete_task is deprecated; use archive_task instead

Safety rules:
- Always use get_task before destructive operations when context is unclear
- Archived tasks cannot be modified — restore first
- Batch operations are limited to 50 items
```

#### 4b. Tool description improvements

**Files to modify**:
- `services/lifeline-mcp/src/mcp/taskTools.js` — refine descriptions for all tools

Key description improvements:
- `search_tasks`: clarify that `tags` accepts tag id strings, not tag names
- `create_task`: describe accepted recurrence shapes explicitly
- `create_task`: describe subtask shape (title required, id/position auto-assigned)
- `update_task`: note that recurrence cannot be modified post-creation
- `list_tasks`: clear guidance on window tokens vs explicit dates

#### 4c. Result formatting improvements

**Files to modify**:
- `services/lifeline-mcp/src/mcp/toolResults.js` — improve compact preview formatting

Changes:
- Task previews include subtask completion summary: `Subtasks: 2/3 done`
- Similarity results include confidence tier in preview text
- Window results include resolved date range in preview header

**Validation expectations**:
- Manual testing with real MCP clients (ChatGPT, Claude, etc.)
- Verify that model behavior improves with updated instructions
- Test that history-reuse flow works end-to-end

**Risks**:
- Instruction quality is hard to validate automatically — mitigate with manual testing
- Too many instructions could confuse models — mitigate by keeping instructions concise and organized

**Deferred**:
- Advanced disambiguation heuristics
- Multi-turn subtask workflows
- Recurrence mutation guidance (no backend support yet)

---

### Phase 5: Enterprise hardening foundations

**Objective**: Lay groundwork for enterprise-grade safety, auditing, and operational robustness.

**Scope**:

#### 5a. Expose created_at and updated_at in task payload

**Files to modify**:
- `backend/src/internal/mcp/taskPayloads.js` — add `createdAt` and `updatedAt` to normalized shape

**Why**: Enables audit awareness, freshness checking, and conflict detection foundation.

#### 5b. Optimistic concurrency foundation

**Files to modify / create**:
- `backend/src/internal/mcp/taskWriteHandlers.js` — accept optional `expectedUpdatedAt` parameter
- Internal adapter validates `If-Match` / `expectedUpdatedAt` against current `updated_at`
- Returns `409 Conflict` if stale

**Why**: Prevents lost-update scenarios when multiple clients modify the same task.

**Scope**: Foundation only. Not enforced by default. MCP tools accept but do not require the parameter.

#### 5c. Structured logging with correlation IDs

**Files to modify**:
- `services/lifeline-mcp/src/app.js` — add correlation ID middleware (generate UUID per request, pass as header)
- `backend/src/internal/mcp/router.js` — propagate correlation ID from MCP service to backend
- Backend logger: include correlation ID in log entries

**Why**: Enables request tracing across MCP service → backend boundary for debugging and auditing.

#### 5d. Rate limiting awareness

**Files to modify**:
- `services/lifeline-mcp/src/app.js` — add basic rate limiting for write operations (per-principal, per-window)
- Return `429 Too Many Requests` with `Retry-After` header

**Why**: Prevents abuse and resource exhaustion.

**Validation expectations**:
- Unit tests for concurrency guard
- Verify correlation IDs appear in both MCP and backend logs
- Load test basic rate limiting behavior

**Risks**:
- Optimistic concurrency adds complexity — mitigate by making it opt-in, not required
- Rate limiting thresholds need tuning — start conservative, adjust based on real usage

**Deferred**:
- Full audit log system
- Action attribution (who changed what when)
- Advanced lifecycle (admin-only operations)
- Multi-tenant isolation boundaries

---

### Phase 6: Test coverage and validation

**Objective**: Comprehensive test coverage for all new capabilities.

**Scope**:

#### 6a. Backend unit tests

**Files to create**:
- `backend/test/domain/SubtaskContract.test.js` — subtask shape validation, id generation
- `backend/test/application/SubtaskOperations.test.js` — use-case tests
- `backend/test/application/FindSimilarTasks.test.js` — similarity scoring
- `backend/test/internal/mcp/taskDateFilters.test.js` — window token resolution, week/month calculation
- `backend/test/internal/mcp/taskWriteHandlers.test.js` — archived-state guards

#### 6b. Backend integration tests

**Files to create/modify**:
- `backend/test/integration/subtask-migration.test.js` — verify migration backfill
- `backend/test/integration/window-queries.test.js` — verify occurrence-aware window queries
- `backend/test/integration/archive-lifecycle.test.js` — verify archive/restore/guard behavior
- `backend/test/integration/similar-tasks.test.js` — verify similarity search with pg_trgm

#### 6c. MCP end-to-end tests

**Files to modify**:
- `services/lifeline-mcp/test/mcpService.test.js` — add test blocks for:
  - `list_tasks` with various window tokens
  - Subtask tools (add, complete, update, remove)
  - `archive_task` and `restore_task`
  - `find_similar_tasks`
  - `batch_restore`
  - Archived-state rejection through MCP
  - Subtask ambiguity error handling

#### 6d. Regression tests

- Verify all 18 existing tools continue working identically
- Verify existing search behavior unchanged for non-recurring tasks
- Verify existing batch operations unchanged
- Verify existing tag operations unchanged

**Validation expectations**:
- All tests pass in CI environment
- No regression in existing functionality
- Backend lint clean: `npm run lint` from `backend/`
- MCP lint clean (if applicable)

**Risks**:
- In-memory test store may not capture JSONB behavior — supplement with real PostgreSQL tests
- pg_trgm tests need real PostgreSQL instance — use test database, not in-memory

---

### Phase 7: Documentation

**Objective**: Update all impacted documentation domains.

**Scope**:

#### 7a. API documentation

**Files to create/modify**:
- `docs/api/internal-mcp-task-endpoints.md` (new or update existing) — document new window, subtask, restore, and similarity routes
- `docs/api/README.md` — update endpoint inventory

**Domain**: `docs/api/`

#### 7b. Backend documentation

**Files to create/modify**:
- `docs/backend/subtask-operations.md` (new) — subtask contract, operations, validation
- `docs/backend/similarity-search.md` (new) — history-aware retrieval, scoring, confidence tiers
- `docs/backend/README.md` — update use-case inventory

**Domain**: `docs/backend/`

#### 7c. Data model documentation

**Files to create/modify**:
- `docs/data-model/subtask-contract.md` (new) — subtask JSONB shape, migration history
- `docs/data-model/README.md` — update entity inventory if needed

**Domain**: `docs/data-model/`

#### 7d. Architecture documentation

**Files to create/modify**:
- `docs/architecture/mcp-architecture.md` (update) — add Layer 4 agent behavior, update layer diagram
- `docs/adr/0002-subtask-identity-contract.md` (new) — decision record
- `docs/adr/0003-archive-first-lifecycle.md` (new) — decision record

**Domain**: `docs/architecture/`, `docs/adr/`

#### 7e. Product documentation

**Files to create/modify**:
- `docs/product/subtask-behavior.md` (new or update) — user-facing subtask capability
- `docs/product/archive-lifecycle.md` (new or update) — archive-first behavior description
- `docs/product/planning-queries.md` (new or update) — what time-based queries users can ask

**Domain**: `docs/product/`

#### 7f. Operations documentation

**Files to create/modify**:
- `docs/operations/deployment-verification-and-smoke-checks.md` (update) — add MCP tool smoke checks for new tools

**Domain**: `docs/operations/`

#### 7g. Feature documentation

**Files to create/modify**:
- `docs/features/README.md` or inventory — update feature list with new capabilities

**Domain**: `docs/features/`

---

### Phase 8: Release and production validation

**Objective**: Safely release to production with rollback readiness.

**Scope**:

#### 8a. Pre-release checklist

- [ ] All Phase 1-6 tests pass on main branch
- [ ] Backend lint clean
- [ ] Migration tested against clean database
- [ ] Migration tested against production-like database with existing data
- [ ] All documentation from Phase 7 committed
- [ ] ADRs reviewed and committed
- [ ] No new lint warnings introduced
- [ ] Server instructions reviewed for clarity

#### 8b. Staged migration strategy

**Order of operations**:
1. Apply `pg_trgm` extension migration (non-destructive)
2. Apply subtask identity backfill migration (non-destructive, additive JSONB keys)
3. Apply title trigram index migration (non-destructive)
4. Deploy updated backend with new internal adapter routes
5. Deploy updated MCP service with new tools
6. Verify health checks pass
7. Run MCP smoke tests against production

#### 8c. Smoke test plan

**Production smoke tests** (post-deploy):
- `GET /api/health/db` returns 200
- `GET /internal/mcp/health` returns 200
- `GET /health` (MCP) returns 200
- MCP `list_tasks(window: 'today')` returns valid response
- MCP `get_task` returns subtask details with ids and positions
- MCP `archive_task` + `restore_task` round-trip works
- MCP `find_similar_tasks` returns results (or graceful degradation)
- All 18 existing tools respond correctly

#### 8d. Rollback plan

**If backend migration fails**:
- Transaction-wrapped migrations auto-rollback on failure
- `pg_trgm` extension creation is idempotent — no rollback needed
- Subtask backfill down migration: strip added keys from JSONB

**If new backend routes fail**:
- New routes are additive — do not break existing routes
- Rollback: redeploy previous release via `apply-release.sh` (automatic)

**If MCP service fails**:
- New tools are additive — do not break existing tools
- Rollback: redeploy previous release

**Rollback trigger criteria**:
- Health check failures on any service
- Error rate spike above 5% on existing tools
- Data integrity issues in subtask JSONB

#### 8e. Deploy sequence

1. Commit all changes to `main`
2. Verify CI passes (tests, lint)
3. Push to `deploy` branch to trigger GitHub Actions workflow
4. GitHub Actions: build artifact → SSH to VPS → apply-release.sh
5. apply-release.sh: postgres → lifeline-app (health) → lifeline-mcp (health)
6. Post-deploy smoke tests
7. Monitor for 24 hours before declaring stable

---

### Phase 9: Production closeout

**Objective**: Document production validation results, archive planning artifacts, update initiative status.

**Scope**:
- Create results artifact: `docs/issues/mcp-server/step-09-everyday-task-fluency/results/YYYY-MM-DD-production-validation.md`
- Create final closeout artifact: `docs/issues/mcp-server/step-09-everyday-task-fluency/final/YYYY-MM-DD-closeout.md`
- Update any affected docs that diverged during implementation
- Clean up any temporary artifacts

---

## 6. Documentation and governance plan

### Documentation domains impacted

| Domain | Files impacted | Trigger |
|---|---|---|
| `docs/api/` | Internal MCP endpoints, new routes | New adapter routes |
| `docs/backend/` | Subtask operations, similarity search | New use-cases and services |
| `docs/data-model/` | Subtask JSONB contract | Schema evolution |
| `docs/architecture/` | Layer diagram, MCP architecture | Architecture evolution |
| `docs/adr/` | Subtask identity, archive-first lifecycle | Durable design decisions |
| `docs/product/` | Subtask behavior, archive lifecycle, planning queries | User-facing capability changes |
| `docs/operations/` | Smoke checks | Deployment verification changes |
| `docs/features/` | Feature inventory | New capabilities |

### Governance rule compliance

| Governance | How applied |
|---|---|
| Backend engineering | Layer boundaries respected (routes → controllers → use-cases → domain); validation in middleware; use-cases own business logic; repos encapsulate data access |
| Code quality | Naming conventions, focused files, lint clean, dead code removed |
| Data model | Migration discipline (transaction-wrapped, down method, JSONB shape documented); entity as schema source of truth; no modification of applied migrations |
| Refactor | Behavior-preserving changes marked; incremental commits; preserved-behavior statements; scope controlled |
| Documentation | Impacted domains identified; artifact-routing followed; no root-level artifacts |
| CI/CD | Deploy-branch model preserved; health checks maintained; rollback path documented |
| Frontend | Not directly impacted in this initiative (MCP is the client, not the web UI); any future frontend subtask UI work would follow frontend governance |

### Issue artifact routing

All artifacts for this initiative follow the pattern:
```
docs/issues/mcp-server/step-09-everyday-task-fluency/<artifact-class>/YYYY-MM-DD-<name>.md
```

| Artifact class | Content |
|---|---|
| `discovery/` | 2026-03-11-discovery.md (already created) |
| `planning/` | 2026-03-11-master-implementation-plan.md (this document) |
| `implementation/` | Phase completion reports |
| `results/` | Production validation results |
| `final/` | Initiative closeout |

---

## 7. Release strategy

### Commit discipline

Each phase should produce focused commits with clear preserved-behavior statements:

- Phase 0: `docs(adr): add subtask identity and archive-first lifecycle decisions`
- Phase 1a: `feat(backend): add subtask identity contract and migration`
- Phase 1b: `feat(backend): add date-window query handler`
- Phase 1c: `feat(backend): add archive/restore internal routes and mutation guards`
- Phase 1d: `feat(backend): add subtask operation routes`
- Phase 1e: `feat(backend): add history-aware similarity search`
- Phase 2a: `feat(mcp): add list_tasks planning query tool`
- Phase 2b: `feat(mcp): add subtask operation tools`
- Phase 2c: `feat(mcp): add archive_task and restore_task tools`
- Phase 2d: `feat(mcp): add find_similar_tasks tool`
- Phase 2e-f: `fix(mcp): improve task preview formatting and tool descriptions`
- Phase 3: `fix(backend): consistent date semantics and archived visibility`
- Phase 4: `feat(mcp): update server instructions and agent behavior rules`
- Phase 5: `feat(backend): enterprise hardening foundations`
- Phase 6: `test: comprehensive coverage for step-09 capabilities`
- Phase 7: `docs: update all impacted documentation domains`

### Review process

- Each phase commit reviewed before merge to main
- Backend changes reviewed with backend-review-agent mindset
- MCP changes reviewed with code-quality-review-agent mindset
- Data model changes reviewed with data-model-review-agent mindset
- Documentation changes reviewed with documentation-governance-agent mindset

### Deploy cadence

**Decision: phased release in 3 slices.**

The single-release option (Option A below) is rejected. While the changes are interdependent, the risk of deploying everything at once exceeds the risk of phased exposure. Phased release allows validation of each capability in production before building the next layer on top.

#### Slice definitions

**Slice 1 — Core fluency (Phases 0 + 1a–1d + 2a–2c + 3a–3d)**

What ships together:
- ADRs (Phase 0)
- Subtask identity contract + migration (Phase 1a)
- Date-window query handler (Phase 1b)
- Archive/restore internal routes + mutation guards (Phase 1c)
- Subtask operation routes (Phase 1d)
- `list_tasks` tool (Phase 2a)
- Subtask tools — all 5 (Phase 2b)
- `archive_task`, `restore_task`, `batch_restore` tools (Phase 2c)
- Consistent date semantics (Phase 3a)
- Archived visibility cleanup (Phase 3b)
- `delete_task` deprecation text (Phase 3c)
- Archived-state guard verification (Phase 3d)

Why these must ship together:
- Subtask tools require subtask identity (Phase 1a) — cannot ship tools without the contract.
- Archive tools require mutation guards (Phase 1c) — cannot ship `archive_task` without guards being release-blocking verified.
- `list_tasks` requires the window handler (Phase 1b) — tool is useless without backend.
- Date consistency (Phase 3a) must arrive with `list_tasks` to avoid shipping inconsistent query results.

**Slice 1 release gates**:
- [ ] All archived-state mutation guard tests pass (unit + integration)
- [ ] Subtask migration verified against production-like data
- [ ] All 18 existing tools pass regression tests
- [ ] All new tools pass end-to-end MCP tests
- [ ] `list_tasks` window token resolution matches canonical definitions exactly
- [ ] Backend lint clean, MCP lint clean
- [ ] Health checks pass post-deploy
- [ ] Smoke tests pass (Section 8c)

**Slice 1 rollback expectation**: If any gate fails post-deploy, redeploy previous release via `apply-release.sh`. Subtask migration down-path strips added JSONB keys. No data loss. All existing tools continue to work on rollback.

---

**Slice 2 — History-aware personalization (Phase 1e + 2d)**

What ships:
- pg_trgm extension migration
- Title trigram index migration
- `FindSimilarTasks` use-case + internal route
- `find_similar_tasks` MCP tool

Why separate:
- Read-only capability. No mutations, no lifecycle impact, no guard dependencies.
- pg_trgm extension is an infrastructure dependency that should be validated independently.
- Can ship after Slice 1 is stable in production (minimum 48-hour soak).

**Slice 2 release gates**:
- [ ] pg_trgm extension confirmed available in production PostgreSQL
- [ ] Similarity scoring unit tests pass
- [ ] Graceful degradation test passes (ILIKE fallback)
- [ ] `find_similar_tasks` end-to-end MCP test passes
- [ ] No regression in Slice 1 capabilities
- [ ] 48-hour soak after Slice 1 with no issues

**Slice 2 rollback expectation**: Tool is read-only. Rollback = remove tool registration and redeploy. pg_trgm extension and index can remain (non-destructive). No data loss.

---

**Slice 3 — Polish and enterprise foundations (Phases 4 + 5 + 6 + 7 + 8 + 9)**

What ships:
- Agent behavior rules and server instruction updates (Phase 4)
- Enterprise hardening foundations: timestamps, optimistic concurrency, correlation IDs, rate limiting (Phase 5)
- Comprehensive test coverage expansion (Phase 6)
- Documentation updates across all domains (Phase 7)
- Production closeout (Phases 8–9)

Why separate:
- Agent instructions and enterprise hardening do not change data contracts or tool shapes.
- Can be refined based on real-world Slice 1 + 2 usage observations.
- Documentation should reflect actual shipped behavior, not planned behavior.

**Slice 3 release gates**:
- [ ] Server instructions reviewed with real model testing
- [ ] Optimistic concurrency opt-in verified (no forced behavior change)
- [ ] Correlation IDs verified in logs
- [ ] All Phase 6 tests pass
- [ ] All documentation domains updated per governance
- [ ] No regression in Slice 1 or 2 capabilities

**Slice 3 rollback expectation**: Low-risk. Instructions and description text changes. Enterprise foundations are opt-in. Rollback = redeploy previous release.

---

#### Rejected alternative: single release (Option A)

Deploying all 9 phases at once maximizes blast radius. A single migration + route + tool + instruction change has too many failure modes to debug simultaneously. The phased approach adds minimal overhead (3 deploy cycles vs 1) but dramatically improves observability and rollback granularity.

#### Rejected alternative: per-phase releases

Too many deploy cycles (10+). Most phases are not independently useful. Subtask tools without subtask identity is broken. Window tools without window handler is broken. Slicing by capability boundary is the right granularity.

---

## 8. New tool inventory (target state)

After this initiative, the MCP surface grows from 18 to approximately 28 tools:

| Surface | Existing tools | New tools | Total |
|---|---|---|---|
| Read/query | search_tasks, get_task, list_today, list_upcoming, get_statistics, export_tasks, list_tags | **list_tasks**, **find_similar_tasks** | 9 |
| Write | create_task, update_task, complete_task, uncomplete_task | — | 4 |
| Subtask | — | **add_subtasks**, **complete_subtask**, **uncomplete_subtask**, **update_subtask**, **remove_subtask** | 5 |
| Lifecycle | delete_task (deprecated) | **archive_task**, **restore_task** | 3 |
| Tag management | create_tag, update_tag, delete_tag | — | 3 |
| Batch | batch_complete, batch_uncomplete, batch_archive | **batch_restore** | 4 |
| **Total** | **18** | **~10** | **~28** |

### 8.1 Tool-surface discipline

28 tools is manageable but must be justified. Every tool on the surface adds discovery cost for the model and maintenance cost for the team. The following discipline applies:

#### Absorption evaluation

| Question | Decision | Rationale |
|---|---|---|
| Should `list_tasks` absorb `list_today`? | **No — keep both.** | `list_today` is zero-parameter, maximally discoverable, already deployed, and the most common single intent. `list_tasks` adds flexibility; it does not replace discoverability. |
| Should `list_tasks` absorb `list_upcoming`? | **No — keep both.** | Same reasoning. `list_upcoming` is a single-intent shortcut. Both are thin wrappers; removal saves nothing and loses backward compatibility. |
| Should `list_tasks` absorb `search_tasks`? | **No.** | `search_tasks` is text-query oriented (`q` param, tag filter, status). `list_tasks` is date-window oriented. Overlapping them would create a god-tool with too many optional params. Keep separated by intent. |

#### Subtask tool grouping evaluation

| Option | Verdict | Rationale |
|---|---|---|
| 5 separate tools (as planned) | **Accepted.** | Each subtask operation maps to a distinct user intent ("add a step", "mark step done", "remove that step"). Models perform better with explicit intent-named tools than with a multi-action dispatch tool. |
| Single `manage_subtask` with action enum | Rejected. | Forces the model to populate an action discriminator plus action-specific fields. Zod refinements become complex. Description text must cover all actions. Net: worse discoverability, harder validation. |
| Group into 3 (add, toggle, modify) | Rejected. | Marginal reduction (5→3 tools) does not justify semantic overloading. `complete_subtask` vs `uncomplete_subtask` is clearer than `toggle_subtask(done: bool)`. |

#### Deferral classification

| Tool | Ship in | Deferral justification |
|---|---|---|
| `list_tasks` | Phase 2a (Slice 1) | Highest everyday impact; no dependencies beyond Phase 1b backend. |
| Subtask tools (5) | Phase 2b (Slice 1) | Blocked on Phase 1a subtask identity. Ship together — partial subtask surface is worse than none. |
| `archive_task`, `restore_task` | Phase 2c (Slice 1) | Archive guards are release-blocking; tools must arrive with guards. |
| `batch_restore` | Phase 2c (Slice 1) | Trivial extension of existing batch pattern; ships with lifecycle tools. |
| `find_similar_tasks` | Phase 2d (Slice 2) | Read-only, non-blocking. Can ship independently after pg_trgm migration. |
| `batch_archive` updates | N/A — already exists | No change required. |

#### Surface count budget

The 28-tool ceiling is a **hard cap for this initiative**. Any tool addition must be justified by removing or merging an existing tool, or must be deferred to a future initiative. This prevents tool sprawl during implementation.

---

## 9. Key design decisions summary

| Decision | Choice | Rationale |
|---|---|---|
| Subtask identity | Stable UUID `subtaskId` + 1-based `position` | Both needed: id for durable mutation, position for natural ordinal commands |
| Subtask targeting | Three modes: by id, by position, by exact title | Covers all natural command shapes; ambiguity returns full list for disambiguation |
| Date-window queries | Single flexible endpoint with named tokens | Avoids tool proliferation; backend resolves tokens to avoid fragile model-side date math |
| Week start day | Uses user's `start_day_of_week` from profile | Real personalization grounded in existing data |
| History-aware retrieval | Backend-first with pg_trgm similarity scoring | Keeps business logic in backend; graceful degradation when extension unavailable |
| Confidence tiers | High (≥0.80) auto-reuse, Medium (0.50-0.79) ask, Low (<0.50) fresh | Clear thresholds with escalation policy |
| Lifecycle naming | archive_task / restore_task as primary; delete_task deprecated | Matches safe-by-default AI behavior; no hard delete in MCP path |
| Recurrence mutation | Deferred | Functional but complex; not the current user pain point |
| Subtask reorder | Deferred | Nice-to-have; not needed for initial operability |
| Optimistic concurrency | Foundation only (opt-in) | Avoid mandatory complexity; enable for future multi-client scenarios |

---

## 10. Recommendation: first implementation slice

**Start with Slice 1 backend foundation: Phase 0 (ADRs) + Phase 1a (subtask identity) + Phase 1b (date-window handler)**

Rationale:
1. Subtask identity is a prerequisite for all subtask operability — it must come first
2. Date-window queries deliver immediate value for the most common everyday planning pain
3. Both are backend-only changes — zero MCP regression risk
4. Both can be tested in isolation before any MCP tool changes
5. Combined, they unblock the rest of Slice 1

**Implementation order within Slice 1**:
1. Phase 0: ADRs (lock decisions before code)
2. Phase 1a: Subtask identity contract + migration + domain validation
3. Phase 1b: Date-window query handler + window token resolution
4. Phase 1c: Archive/restore routes + mutation guards (release-blocking tests here)
5. Phase 1d: Subtask operation routes
6. Phase 2a: `list_tasks` MCP tool
7. Phase 2b: Subtask MCP tools (all 5)
8. Phase 2c: `archive_task`, `restore_task`, `batch_restore` MCP tools
9. Phase 3a–3d: Consistency fixes, visibility cleanup, deprecation text, guard verification
10. Slice 1 release gate check → deploy to production

**What must NOT start before Slice 1 is stable in production**: Slice 2 (history-aware personalization) requires a 48-hour production soak of Slice 1. Slice 3 (polish + enterprise) requires Slice 2 to be stable.

**Estimated new tool value delivery order** (unchanged):
1. `list_tasks` (Phase 2a) — highest everyday impact
2. Subtask tools (Phase 2b) — second highest impact (blocked on Phase 1a)
3. `archive_task` / `restore_task` (Phase 2c) — lifecycle safety
4. `find_similar_tasks` (Phase 2d) — personalization (Slice 2)
5. Agent behavior rules (Phase 4) — ergonomic polish (Slice 3)

---

## Appendix A: Hardening pass record

**Date**: 2026-03-11
**Pass type**: Bounded hardening / refinement
**Artifact**: This planning document
**Trigger**: Plan approved as working baseline; hardening pass applied before implementation begins

### Changes applied

| # | Area | Section(s) modified | What changed |
|---|---|---|---|
| 1 | Tool-surface discipline | §8 (new §8.1) | Added absorption evaluation (list_tasks vs list_today/upcoming/search), subtask tool grouping evaluation (5 separate vs single dispatch — kept 5), deferral classification per tool and slice, 28-tool hard cap. |
| 2 | Subtask migration safety | §4.1 (new subsection after column operation) | Added malformed JSONB scenario table (null, non-array, missing keys, extra keys, non-object items). Added duplicate/blank title handling. Added ordering guarantees. Added production-like validation requirements as Phase 1a exit gate. Added transition-window behavior (update_task must preserve subtaskId/position). Added precise rollback SQL. |
| 3 | History-aware retrieval safety | §4.3 (new safety invariants block) | Added 5 explicit safety invariants: read-only-first, no silent coupling, confidence-as-agent-guidance-not-backend-logic, testable graceful degradation, agent-can-skip. |
| 4 | Archived-state safety | §4.4 (expanded) | Added backward-compatibility contract for delete_task deprecation. Added permanent hard-delete exclusion with re-entry conditions. Added release-blocking guard table (8 handlers). Added precise 10-step restore flow. Added archive visibility rules table (12 operations). |
| 5 | Canonical window semantics | §4.2 (new subsection after start-day-of-week) | Locked exact window token definitions (today, tomorrow, this_week, this_month, overdue, month). Added timezone rule (server wall-clock, no per-user TZ). Added completed-task interaction table. Added archived-task exclusion rule. Added occurrence-span semantics requirement. Added start_day_of_week default (monday). |
| 6 | Release strategy | §7 deploy cadence (rewritten) | Replaced single-release recommendation with 3-slice phased release. Defined Slice 1 (core fluency), Slice 2 (history), Slice 3 (polish+enterprise). Added release gates per slice (checkboxes). Added rollback expectations per slice. Added rejected-alternative rationale. Updated §10 first-slice recommendation to align. |
| 7 | Recurrence mutation deferral | §4.5 (expanded) | Added deferral commitment with 4-point evidence basis. Added 4 conditions for revisiting (all must be true). |

### Plan status after hardening

- **Status**: Implementation-ready
- **Tool surface**: 28 tools (hard cap), justified and classified by slice
- **Release model**: 3-slice phased release with explicit gates per slice
- **Safety**: Archived-state guards release-blocking; migration validated against production-like data; history retrieval read-only-first with no silent coupling
- **Deferral**: Recurrence mutation, subtask reorder, hard delete — all deferred with explicit re-entry conditions
- **Next action**: Begin Phase 0 (ADRs) of Slice 1
