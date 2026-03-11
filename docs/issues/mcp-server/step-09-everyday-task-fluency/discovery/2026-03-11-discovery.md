# Step 09 discovery: everyday task fluency

Date: 2026-03-11

## Scope

This is a bounded discovery artifact for the next Lifeline MCP initiative.

It answers six questions from current repo truth:

1. What the Lifeline MCP server actually exposes today
2. What task and subtask data shapes actually flow through MCP today
3. Which everyday workflows are smooth, awkward, or blocked
4. Where the real bottlenecks are
5. What the next initiative should optimize for
6. What a bounded phased roadmap should look like

The analysis is grounded in current implementation, tests, and repo governance material, not generic MCP theory.

## Governance and sources reviewed

Primary governance:

- `.github/copilot-instructions.md`
- `.github/instructions/backend-engineering-governance.instructions.md`
- `.github/instructions/code-quality-governance.instructions.md`
- `.github/instructions/docs-governance.instructions.md`
- `.github/instructions/frontend-engineering-governance.instructions.md`
- `.github/instructions/refactor-governance.instructions.md`

Repo-native review/routing helpers:

- `.github/agents/documentation-governance-agent.md`
- `.github/teams/documentation-governance-team.md`
- `.github/workflows-governance/documentation-governance-workflow.md`
- `.github/prompts/artifact-routing-non-root.prompt.md`
- `.github/prompts/frontend-review.prompt.md`

Current implementation and behavior sources:

- `services/lifeline-mcp/src/mcp/serverFactory.js`
- `services/lifeline-mcp/src/mcp/taskTools.js`
- `services/lifeline-mcp/src/mcp/toolResults.js`
- `services/lifeline-mcp/src/mcp/taskSelectors.js`
- `services/lifeline-mcp/src/backend/internalBackendClient.js`
- `services/lifeline-mcp/test/mcpService.test.js`
- `backend/src/internal/mcp/router.js`
- `backend/src/internal/mcp/taskReadRouter.js`
- `backend/src/internal/mcp/taskWriteRouter.js`
- `backend/src/internal/mcp/taskReadHandlers.js`
- `backend/src/internal/mcp/taskWriteHandlers.js`
- `backend/src/internal/mcp/taskPayloads.js`
- `backend/src/internal/mcp/taskDateFilters.js`
- `backend/src/internal/mcp/taskResolution.js`
- `backend/src/internal/mcp/tagHandlers.js`
- `backend/src/application/CreateTodoForInternalMcp.js`
- `backend/src/application/CreateTodo.js`
- `backend/src/application/UpdateTodo.js`
- `backend/src/application/SetTodoCompletion.js`
- `backend/src/application/TagUseCases.js`
- `backend/src/domain/Todo.js`
- `backend/src/infrastructure/TypeORMTodoRepository.js`
- `backend/src/middleware/validateTodo.js`
- `backend/src/index.js`

## 1. Current MCP capability inventory

### Server-level discoverability

The MCP server exposes task management only. The server instructions in `services/lifeline-mcp/src/mcp/serverFactory.js` tell the model about:

- search and navigation via `search_tasks`, `list_today`, `list_upcoming`
- deep task inspection via `get_task`
- quick stats via `get_statistics`
- full export via `export_tasks`
- tag management via `list_tags`, `create_tag`, `update_tag`, `delete_tag`
- task mutation via `create_task`, `update_task`
- completion toggles via `complete_task`, `uncomplete_task`
- batch operations via `batch_complete`, `batch_uncomplete`, `batch_archive`
- lifecycle via `delete_task`, explicitly described as archive-only, not permanent delete

What is discoverable from descriptions alone is still uneven:

- good: the model is told to use `get_task` for full detail, and told that `delete_task` archives rather than hard-deletes
- weak: there is no model-facing mention of a generic day query, week/month query, overdue query, recurring query, or subtask-specific operation contract
- weak: recurrence is mentioned, but accepted recurrence shapes are not documented in tool descriptions
- weak: tag filtering in `search_tasks` is described only as `tags`, not as tag ids, names, or objects

### Current tool inventory

The current MCP surface is 18 tools.

| Surface | Tool | Purpose | Input selectors / arguments | `content` behavior | `structuredContent` behavior |
|---|---|---|---|---|---|
| Read | `search_tasks` | Search/filter tasks | `query` or `q`, `tags`, `priority`, `status`, `startDate`, `endDate`, `flagged`, `minDuration`, `maxDuration`, `sortBy`, `page`, `limit`, `taskNumber` | Compact preview text with up to 5 tasks | Raw backend payload: `{ tasks, total, page, limit }` |
| Read | `get_task` | Canonical deep read for a single task | `taskNumber` only | Single-task preview text | Raw backend payload: `{ task }` |
| Read | `list_today` | Tasks occurring today | none | Compact preview text | Raw backend payload: `{ dateToken?, resolvedDate?, tasks }` from backend route result |
| Read | `list_upcoming` | Upcoming active tasks ordered by effective date | optional `fromDate`, optional `limit` | Compact preview text | Raw backend payload: `{ fromDate, includesUnscheduled, ordering, tasks, count }` |
| Read | `get_statistics` | Global quick stats | none | Plain-text key/value lines | Raw backend payload with totals |
| Organization | `list_tags` | List available tags | none | Plain-text tag list | Raw backend payload: `{ tags }` |
| Organization | `create_tag` | Create a tag | `name`, `color` | One-line success text | Raw backend payload: `{ tag }` |
| Organization | `update_tag` | Update a tag | `id`, `name`, `color` | One-line success text | Raw backend payload: `{ tag }` |
| Organization | `delete_tag` | Delete a tag | `id` | One-line success text | Raw backend payload: `{ deleted, id }` or backend delete result |
| Write | `create_task` | Create a task | `title`, optional `description`, `dueDate`, `dueTime`, `tags`, `isFlagged`, `duration`, `priority`, `subtasks`, `recurrence` | One-line success text | Raw backend payload: `{ task }` |
| Write | `update_task` | Update mutable fields on a task | selector: `taskNumber` or `id`; mutable fields: `title`, `description`, `dueDate`, `dueTime`, `tags`, `isFlagged`, `duration`, `priority`, `subtasks` | One-line success text | Raw backend payload: `{ task }` |
| Write | `complete_task` | Mark task complete | selector: `taskNumber` or `id` | One-line success text | Raw backend payload: `{ task, completed: true }` |
| Write | `uncomplete_task` | Reopen task | selector: `taskNumber` or `id` | One-line success text | Raw backend payload: `{ task, completed: false }` |
| Lifecycle | `delete_task` | Archive a task from active set | selector: `taskNumber` or `id` | One-line success text that says archived, not permanently deleted | Raw backend payload: `{ id, taskNumber, deleted: true, deleteMode: 'archived' }` |
| Read/export | `export_tasks` | Full JSON export of all tasks | empty object | One-line export summary | Raw backend payload: `{ exported_at, todos, stats }` |
| Batch | `batch_complete` | Complete multiple tasks | `taskNumbers` array, 1-50 | Summary text per task result | Raw backend payload: `{ action, results }` |
| Batch | `batch_uncomplete` | Reopen multiple tasks | `taskNumbers` array, 1-50 | Summary text per task result | Raw backend payload: `{ action, results }` |
| Batch | `batch_archive` | Archive multiple tasks | `taskNumbers` array, 1-50 | Summary text per task result | Raw backend payload: `{ action, results }` |

### Read vs write vs batch vs organizational surfaces

Read surfaces:

- `search_tasks`
- `get_task`
- `list_today`
- `list_upcoming`
- `get_statistics`
- `export_tasks`
- `list_tags`

Write surfaces:

- `create_task`
- `update_task`
- `complete_task`
- `uncomplete_task`
- `delete_task`
- `create_tag`
- `update_tag`
- `delete_tag`

Batch surfaces:

- `batch_complete`
- `batch_uncomplete`
- `batch_archive`

Organizational surfaces:

- tags are first-class enough to create, update, delete, and list
- there is no first-class project, list, folder, archive view, or subtask surface

### Actual result contract patterns

Success shape from `services/lifeline-mcp/src/mcp/toolResults.js`:

- `content` is always one text block
- `structuredContent` is always the raw payload object returned by the backend or synthesized success payload

Error shape:

- `isError: true`
- `content` is one text block with `message (code)`
- `structuredContent.error` contains `{ code, status, message, details }`

This means the server is consistently structured for clients that honor `structuredContent`, but the human-readable `content` summaries are what a model sees first in many clients.

## 2. Current data-shape inventory

### Task fields available through MCP today

The normalized MCP task shape from `backend/src/internal/mcp/taskPayloads.js` currently exposes:

| Field | Available | Notes |
|---|---|---|
| `id` | yes | Backend UUID/string id |
| `taskNumber` | yes | User-scoped sequential number |
| `title` | yes | Primary human selector |
| `description` | yes | Normalized to empty string when absent |
| `dueDate` | yes | Normalized to `YYYY-MM-DD` when possible |
| `dueTime` | yes | Time string or `null` |
| `isCompleted` | yes | Boolean |
| `isFlagged` | yes | Boolean |
| `duration` | yes | Integer minutes |
| `priority` | yes | `high`, `medium`, or `low` |
| `tags` | yes | Array of `{ id, name, color }` |
| `subtasks` | yes | Raw array, not normalized beyond pass-through |
| `recurrence` | yes | Raw recurrence object or string |
| `nextRecurrenceDue` | yes | Exposed when present |
| `originalId` | yes | Exposed when present |
| `archived` | yes | Boolean |

Not exposed through MCP task payloads:

- `order`
- `created_at`
- `updated_at`
- any audit/history record beyond `originalId` and `nextRecurrenceDue`

### Subtask structure today

Current repo truth does not define a strict subtask schema.

Evidence:

- `backend/src/domain/Todo.js` documents subtasks only as "Array of `{id, title, isCompleted}`"
- `backend/src/middleware/validateTodo.js` accepts `subtasks: Joi.array().items(Joi.object()).optional()`
- `services/lifeline-mcp/src/mcp/taskTools.js` accepts `subtasks: z.array(z.object({}).passthrough()).optional()` for create and update
- `backend/src/infrastructure/TypeORMTodoRepository.js` stores subtasks as raw JSONB arrays with no normalization or shape enforcement

Current subtask facts:

| Question | Current answer |
|---|---|
| Stable subtask id guaranteed? | no backend guarantee |
| Stable 1-based position guaranteed? | no explicit contract |
| Stable display title/name guaranteed? | only by convention |
| Completion state supported? | yes by convention via `isCompleted` if present |
| Editable fields defined? | no explicit contract |
| Per-subtask update surface exists? | no |
| Per-subtask inspect surface exists? | no |

### Can the MCP server inspect one subtask cleanly today?

Only partially.

- `get_task.structuredContent.task.subtasks` returns the raw subtasks array
- `get_task.content` does not enumerate subtasks; it only says `Subtasks: {count}`
- no tool allows `get_subtask`, `complete_subtask`, `rename_subtask`, `add_subtasks`, or `remove_subtask`
- `update_task` can only replace the entire `subtasks` array

So the server can technically transport subtask data, but not as a stable, model-operable contract.

### Recurrence structure today

Recurrence is also loosely typed from the MCP point of view.

Accepted by create path in practice:

- new mode objects: `daily`, `dateRange`, `specificDays`
- legacy recurrence objects: `type: daily|weekly|monthly|custom` with `interval` and optional `endDate`
- tool layer also allows arbitrary strings, though descriptions do not explain what string forms mean

Important consequence:

- recurrence exists and is persisted
- creation supports it
- update through MCP does not support mutating recurrence after creation
- model-facing recurrence ergonomics are weak because accepted shapes are under-described

## 3. Workflow friction map

### Query workflows

| Workflow | Current status | Why |
|---|---|---|
| What do I have today? | already smooth | `list_today` exists and is purpose-built |
| What do I have tomorrow? | possible but awkward | backend supports `/tasks/day/tomorrow`, but MCP has no `list_tomorrow` or generic date-token tool |
| What do I have this week? | possible but awkward | can be approximated by `search_tasks(startDate,endDate)` if the model computes the range, but there is no intent-level week tool |
| What do I have this month / in March? | possible but awkward | same as week; requires model date math and manual range construction |
| Show done tasks | already smooth | `search_tasks` supports `status: completed` |
| Show undone tasks | already smooth | `search_tasks` supports `status: active` |
| Show flagged tasks | already smooth | `search_tasks` supports `flagged: true` |
| Show tagged / project-like slice | technically available but poorly exposed | `search_tasks.tags` exists, but contract does not say whether tags are ids or names; backend filter uses tag ids |
| Show overdue tasks | possible but awkward | no overdue tool or filter; model must compute a past `endDate` and combine with `status: active` |
| Show recurring tasks | blocked by missing capability | no recurrence filter in MCP search surface |
| Show recurring tasks in a time range | blocked by missing capability | no recurrence filter and no range-aware recurring tool |
| Show archived tasks | technically available but poorly exposed | `get_task` and some `search_tasks` paths can surface archived tasks, but there is no archive view tool |

### Action workflows

| Workflow | Current status | Why |
|---|---|---|
| Create a task | already smooth | `create_task` is direct |
| Create a task with subtasks | possible but awkward | `create_task` accepts a raw `subtasks` array, but no subtask schema is documented |
| Create recurring tasks | technically available but poorly exposed | `create_task` accepts `recurrence`, but accepted shapes are not clearly described for the model |
| Update task details | already smooth for core fields | `update_task` supports title, description, due date/time, tags, flag, duration, priority |
| Mark one task complete | already smooth | `complete_task` |
| Undo completion | already smooth | `uncomplete_task` |
| Mark one subtask complete | blocked by missing capability | no subtask selector or subtask mutation tool |
| Add subtasks after creation | possible but awkward | requires replacing full `subtasks` array via `update_task` |
| Remove or update one subtask | blocked by weak ergonomics | only whole-array replacement; no stable subtask target contract |
| Rename the second subtask | blocked by weak ergonomics | same reason: no stable subtask positions or ids in the contract |
| Archive a task safely | possible but semantically awkward | `delete_task` actually archives, but the normal AI verb is still `delete` |
| Restore / unarchive a task | blocked by missing MCP tool | backend has public unarchive capability, MCP does not expose it |
| Batch actions | already smooth | three explicit batch tools exist |
| Export | already smooth | `export_tasks` exists |

### Important hidden inconsistency: date semantics are not uniform

`list_today` and `list_upcoming` use `backend/src/internal/mcp/taskDateFilters.js`, which is range-aware for `dateRange` recurrence.

`search_tasks` does not use those range helpers. It delegates to repository search that filters only by stored `due_date`.

Result:

- a logical date-range task can appear correctly in `list_today` or `list_upcoming`
- the same logical task can be missing or misleading in `search_tasks(startDate,endDate)` because search uses the start `due_date`, not occurrence-span semantics

That makes month/week/range planning queries feel unreliable even before new tools are added.

### Important hidden inconsistency: archived lifecycle is not cleanly separated

Current behavior is mixed:

- active list flows hide archived tasks
- `delete_task` archives rather than permanently deleting
- `get_task` can still resolve an archived task by `taskNumber`
- `search_tasks` can include archived tasks when `query` or `taskNumber` is used because repository search only forces `archived = false` when neither `q` nor `taskNumber` is provided
- update and completion paths resolve by id or task number without an explicit archived guard

So the user-facing lifecycle is safe-ish, but not cleanly modeled.

## 4. Root-cause analysis

### A. Missing backend capability

This is not the main bottleneck.

Backend capability already exists for:

- archive and unarchive on the standard API
- date-range and period statistics on the standard API
- user-scoped task search, tags, completion, archive, export
- recurrence creation and lineage-ish fields (`originalId`, `nextRecurrenceDue`)

Backend capability that is genuinely thin today:

- no dedicated subtask domain model or subtask use-case layer
- no stable backend contract for subtask ids, positions, and per-subtask operations

### B. Missing internal MCP adapter routes

Some gaps are at the internal route layer, but fewer than the tool-layer gaps.

What exists internally already:

- `/tasks/day/:dateToken` with `today`, `tomorrow`, or exact date token support
- `/tasks/upcoming`
- `/tasks/search`
- `/tasks/export`
- `/tasks/statistics`
- `/tasks/batch`

What does not exist internally today but would matter:

- archive/unarchive route pair inside the internal MCP adapter
- a range-oriented read route for week/month/March-style task listing if that should be server-side intent rather than model-computed date math
- subtask-specific read/write routes if subtasks become first-class

### C. Missing MCP tools

This is one of the biggest real bottlenecks.

Missing intent-level tools include:

- generic `list_by_day` or `list_day_tasks` accepting `today`, `tomorrow`, or explicit date
- week / month / arbitrary range planning read tool
- overdue read tool
- recurrence-focused read tool
- archive / unarchive lifecycle tool pair
- subtask inspect / mutate tools or a dedicated subtask operation contract

### D. Poor model-facing ergonomics

This is the other biggest bottleneck.

Examples:

- `get_task.content` only shows subtask count, not the subtask list
- recurrence creation is available, but accepted shapes are not well described in tool text
- tag filtering is available, but the tool text does not tell the model whether to supply tag ids or names
- natural date range intents require the model to translate user language into date math and search parameters
- the tool surface is still organized partly around backend parity and raw CRUD, not around everyday planning questions

### E. Lack of stable subtask targeting

This is the most important gap for subtask usability.

Today:

- subtasks are opaque JSON arrays
- no stable backend contract guarantees an id
- no stable MCP contract guarantees current position
- no dedicated selector supports ordinal or semantic targeting

So commands like these are not cleanly solvable:

- "mark the first subtask done"
- "rename the second subtask"
- "mark renaming all models done"
- "add 3 subtasks"

### F. Ambiguous lifecycle semantics

The user wants archive-first normal behavior.

Current surface says:

- use `delete_task`
- but that tool actually archives
- there is no `unarchive_task`
- some read paths still reveal archived tasks implicitly

That makes the lifecycle safer than hard-delete, but not natural.

### G. Export/batch emphasis versus everyday fluency

The current surface has explicit export and batch tools, which are useful, but everyday planning is still missing natural query affordances.

This means the server is broader than before, but not yet optimized around the most common human planning intents.

## 5. Recommended next initiative direction

### Recommended initiative name

`step-09-everyday-task-fluency`

This is the right framing because the dominant gap is not raw backend parity anymore. It is the difference between:

- a task API that can technically carry more fields
- and a model-facing task experience that feels natural in daily use

### What the next initiative should optimize for first

Priority order:

1. everyday planning fluency
2. safe actionability
3. subtask operability
4. model usability
5. backend parity

`export_tasks` and batch tools are useful, but they are not the main user pain. The next issue should optimize for the everyday loop:

- ask what is due in a natural time frame
- inspect the right task cleanly
- act safely
- operate subtasks directly
- stay oriented without the model improvising around missing surface area

### Explicit answers to the design questions

#### 1. Should subtasks get stable ids, stable 1-based positions, both, or another contract?

Recommendation: both.

- stable subtask id is necessary for durable mutation after inspection
- stable 1-based position is necessary for natural commands like "the first subtask"
- current position should be returned explicitly, not inferred by the model from array order alone

Minimum clean subtask contract should include:

- `subtaskId`
- `position`
- `title`
- `isCompleted`

Optional but useful:

- `notes` or `description`
- `createdAt` / `updatedAt` if later needed

#### 2. How should an agent cleanly do common subtask operations?

Recommendation: a dedicated subtask inspect/update contract is needed.

The MCP surface should let the model do all of these without replacing the entire array:

- mark the first subtask done
- mark `renaming all models` done
- add 3 subtasks
- rename the second subtask

The cleanest shape is not "opaque `subtasks` array in `update_task`".

At discovery level, the contract should support:

- target task by `taskNumber`
- target subtask by `subtaskId`, `position`, or an exact title match when safe
- dedicated operations for complete, uncomplete, rename, add, remove, reorder if needed later

#### 3. How should date queries work for natural language planning?

Recommendation: the MCP surface needs intent-level date query affordances, not only generic search filters.

The model should be able to answer naturally for:

- today
- tomorrow
- this week
- this month
- March
- overdue
- upcoming
- recurring in a time range

That implies two things:

- at least one generic date/range listing contract with explicit occurrence semantics
- consistent date-span logic across list tools and filtered search tools, especially for `dateRange` recurrence

#### 4. Should delete be demoted in normal AI usage?

Recommendation: yes.

Normal AI lifecycle should be:

- archive
- unarchive / restore

not:

- delete as the normal everyday verb

Current `delete_task` already archives. The surface should stop forcing the model to say "delete" when the intended safe action is archive.

#### 5. What should the MCP surface optimize for first?

Recommendation: everyday planning fluency and safe actionability first, then subtask operability, then broader parity.

Reason:

- the current server already has tags, batch operations, export, stats, and core CRUD
- the real user friction is still about natural daily use, not missing bulk utilities

## 6. Candidate phased roadmap

This is intentionally discovery-level, not implementation planning.

### Phase 1: planning-query fluency

Goal:

- make natural time-based reads feel direct and reliable

Focus:

- generic day query surface
- week/month/range planning query surface
- overdue query surface
- consistent occurrence semantics for range reads

### Phase 2: subtask-operable task detail

Goal:

- let the model inspect and act on one subtask without rewriting the whole task

Focus:

- stable subtask ids and positions
- richer subtask detail in task inspection
- dedicated subtask mutate surface

### Phase 3: safe lifecycle cleanup

Goal:

- make archive-first behavior explicit and reversible

Focus:

- archive naming instead of delete naming in normal AI flows
- unarchive / restore surface
- clearer archived-state visibility rules across reads and mutations

### Phase 4: secondary parity and refinements

Goal:

- strengthen power-user and maintenance flows after daily fluency is solved

Focus:

- refine recurrence creation/update ergonomics
- decide whether export/batch need further shaping
- add any secondary lifecycle or organization helpers still justified by real use

## Final discovery recommendation

The next initiative should be **everyday task fluency**, not a generic parity pass.

The evidence points to four concrete truths:

1. the server already exposes a broader task surface than before
2. everyday planning queries still require too much model-side reasoning and date math
3. subtasks are visible but not truly operable
4. lifecycle is safer than it used to be, but still named and surfaced awkwardly for normal AI use

That makes the best next issue:

- **Step 09: Everyday task fluency**

And the best optimization target:

- **make the MCP task experience feel natural for everyday planning and safe action, with subtask operability as a first-class follow-on inside the same initiative family**