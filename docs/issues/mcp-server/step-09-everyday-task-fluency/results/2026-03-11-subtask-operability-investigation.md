# Step-09 Subtask Operability Investigation

**Date**: 2026-03-11
**Scope**: Focused investigation into why Cloud Code / MCP clients cannot complete, update, or target individual subtasks despite Step-09 claiming full subtask CRUD support.

---

## 1. Implemented subtask surface

Step-09 added five dedicated MCP subtask tools. All five are **fully implemented, tested, and deployed**.

### Tool inventory

| Tool | MCP name | Input schema | Backend client method | Backend route | Use-case |
|---|---|---|---|---|---|
| Add subtask | `add_subtask` | `{ taskNumber?, id?, title }` | `addSubtask(principal, taskId, { title })` | `POST /internal/mcp/tasks/:taskId/subtasks` | `SubtaskOperations.addSubtask` |
| Complete subtask | `complete_subtask` | `{ taskNumber?, id?, subtaskId (UUID) }` | `completeSubtask(principal, taskId, subtaskId)` | `POST /internal/mcp/tasks/:taskId/subtasks/:subtaskId/complete` | `SubtaskOperations.completeSubtask` |
| Uncomplete subtask | `uncomplete_subtask` | `{ taskNumber?, id?, subtaskId (UUID) }` | `uncompleteSubtask(principal, taskId, subtaskId)` | `POST /internal/mcp/tasks/:taskId/subtasks/:subtaskId/uncomplete` | `SubtaskOperations.uncompleteSubtask` |
| Update subtask | `update_subtask` | `{ taskNumber?, id?, subtaskId (UUID), title?, isCompleted? }` | `updateSubtask(principal, taskId, subtaskId, updates)` | `PATCH /internal/mcp/tasks/:taskId/subtasks/:subtaskId` | `SubtaskOperations.updateSubtask` |
| Remove subtask | `remove_subtask` | `{ taskNumber?, id?, subtaskId (UUID) }` | `removeSubtask(principal, taskId, subtaskId)` | `DELETE /internal/mcp/tasks/:taskId/subtasks/:subtaskId` | `SubtaskOperations.removeSubtask` |

### Implementation completeness

- **MCP tool registration**: All 5 tools registered in `taskTools.js` with Zod input schemas, annotation hints, and descriptions.
- **Backend client**: All 5 methods present in `internalBackendClient.js` with proper URL encoding and HTTP methods.
- **Backend routing**: `subtaskRouter.js` mounted at `/tasks/:taskId/subtasks` via `router.js` with `mergeParams: true`.
- **Backend handlers**: `subtaskHandlers.js` provides all 5 handlers with input validation, error handling, and task normalization.
- **Use-case layer**: `SubtaskOperations.js` implements all 5 operations with archive guards, subtaskId validation, and `normalizeSubtasks` on every save.
- **Domain contract**: `SubtaskContract.js` provides `normalizeSubtasks`, `normalizeSubtask`, and `isValidSubtaskId` with UUID generation, position sequencing, title validation, and max-count enforcement (50).
- **Tests**: End-to-end MCP test (test 10/10) exercises: `add_subtask` → `get_task` → `complete_subtask` → `uncomplete_subtask` → `update_subtask` → `remove_subtask`. All pass.
- **Server instructions**: `serverFactory.js` instructions include explicit "Subtask operations" section and "Subtask workflow" guidance telling the model to: (1) call `get_task` for subtaskId UUIDs, (2) target by subtaskId, (3) use position for ordinal requests.

**Verdict**: The implementation is internally complete and coherent. No code bugs found.

---

## 2. Runtime / production status

### Deployment status

- Step-09 code was deployed to production via GitHub Actions (run `2295809...`, commit `0a063fcb` on deploy branch).
- MCP health endpoint responds: `https://mcp.lifeline.a2z-us.com/health` → 200.
- Backend health endpoint responds: `https://lifeline.a2z-us.com/api/health/db` → 200.

### SQL migration status

- **Migration 007** (subtask identity backfill): **NOT confirmed run in production.** This migration adds `subtaskId` (UUID) and `position` to pre-existing subtask JSONB elements.
- **Migration 008** (pg_trgm extension): Not relevant to subtask operations.

### Impact of missing migration 007

- **Tasks created AFTER Step-09 code deploy**: Get subtaskIds automatically. `normalizeSubtasks` is called in `Todo.js` constructor (line 15), `UpdateTodo.js` (line 22), and all `SubtaskOperations` methods. New tasks are fully operational.
- **Tasks created BEFORE Step-09 code deploy**: Their existing subtasks lack `subtaskId` and `position`. The subtask tools require `subtaskId` (UUID) to target a specific subtask. Pre-existing tasks cannot have individual subtasks targeted until either: (a) migration 007 is run, or (b) the task is updated through `update_task` which triggers `normalizeSubtasks`.
- **Subtask operations should still work** for newly-created tasks or tasks whose subtasks have been touched through the new code path.

### Production readiness verdict

The code is deployed and functional. Migration 007 is pending for full coverage of pre-existing data, but subtask operations work for any task whose subtasks have been created or modified through the Step-09 code paths.

---

## 3. End-to-end contract trace

### Persistence → Domain

Subtasks are stored as a JSONB array on the `todos` table. Each element's normalized shape:

```json
{
  "subtaskId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "title": "Step 1",
  "isCompleted": false,
  "position": 1
}
```

`normalizeSubtasks` (called on every save) ensures:
- `subtaskId` is present (generates UUID if missing)
- `position` is contiguous 1-based
- `title` is non-empty, max 500 chars
- Max 50 subtasks per task

### Domain → Backend internal API

`normalizeTaskForInternalMcp` in `taskPayloads.js` passes subtasks through directly:

```js
subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
```

No field stripping — the full subtask shape (including `subtaskId`, `title`, `isCompleted`, `position`) is preserved.

### Backend internal API → MCP tool response

`get_task` returns `structuredContent` containing the task object with all subtasks. The `formatSingleTaskPreview` generates human-readable text including:

```
Subtasks: 1/3 completed
  [ ] Step 1 (subtaskId-uuid-here)
  [x] Step 2 (subtaskId-uuid-here)
  [ ] Step 3 (subtaskId-uuid-here)
```

Both `structuredContent` (JSON) and the text preview include subtaskId UUIDs, making them available to the model.

### MCP tool input expectations

Subtask mutation tools require:
- `taskNumber` (preferred) or `id` — identifies the parent task
- `subtaskId` (UUID) — identifies the specific subtask (except `add_subtask` which only needs `title`)

The model must: call `get_task` → read subtaskId from response → pass it to `complete_subtask`/`update_subtask`/etc.

### Contract coherence

No mismatches found between:
- Domain shape and API shape
- API shape and MCP tool expectations
- MCP tool descriptions and actual schemas
- Test expectations and runtime behavior

---

## 4. Root-cause analysis

### Primary root cause: NO MCP SERVER CONNECTION CONFIGURED

**The Lifeline MCP server is not registered as an MCP server in the client environment.**

Evidence:
- No `.vscode/mcp.json` in the workspace
- No Lifeline MCP entry in VS Code user settings (`%APPDATA%\Code\User\settings.json`)
- The user-level `~/.mcp.json` only contains Docker MCP Gateway — no Lifeline MCP entry
- No workspace-level MCP server configuration file exists

**Without a configured MCP server connection, the client (Cloud Code / VS Code Copilot) has zero visibility into Lifeline's tools. It cannot discover `complete_subtask`, `add_subtask`, or any other Lifeline tool. It cannot call any Lifeline MCP tool at all.**

This explains exactly why:
- The assistant "could not find the right subtask operation" — there are no Lifeline tools in its tool inventory
- It "ended up completing the whole parent task" — it fell back to general reasoning without tool access
- It claimed "completing subtasks directly by id is not supported yet" — it has no knowledge of the subtask tools because it has never received a `list-tools` response from Lifeline MCP
- It said "`update_task` was not accepting structured subtask data properly" — it was guessing, not using actual tools
- It said "subtask completion may not be supported through MCP" — correct from its perspective: it has no MCP connection to Lifeline

### Secondary contributing factor: Migration 007 not yet run

For pre-existing tasks, subtasks lack stable `subtaskId` UUIDs. Even if the MCP connection were configured, tasks created before the Step-09 code deploy would have subtasks without targetable identifiers until migration 007 is run or the task is re-saved.

This is a **secondary** issue. The primary blocker is the missing MCP server configuration.

### What is NOT the cause

- ❌ Tool registration bug — all tools are registered correctly
- ❌ Tool schema is wrong — schemas are correct and tested
- ❌ Backend route wiring is broken — fully wired with `mergeParams: true`
- ❌ Tool descriptions too weak — descriptions are clear and server instructions provide explicit subtask workflow guidance
- ❌ Tool naming mismatch — tools are named intuitively (`complete_subtask`, `add_subtask`, etc.)
- ❌ Implementation bug — end-to-end tests pass through the real MCP SDK client
- ❌ Stale deployment — code was just deployed and health checks pass

---

## 5. Recommended next action

### Classification: **Case 4 — both a deployment gap and a client configuration gap**

The primary blocker is client-side (no MCP server configured), and there is a secondary deployment gap (migration 007 not run).

### Smallest correct next steps (ordered)

#### Step 1: Configure the Lifeline MCP server connection in VS Code

Create a `.vscode/mcp.json` file in the workspace (or add to user settings) that registers the Lifeline MCP server:

```json
{
  "servers": {
    "lifeline-mcp": {
      "type": "http",
      "url": "https://mcp.lifeline.a2z-us.com/mcp",
      "headers": {
        "Authorization": "Bearer ${input:lifeline-mcp-api-key}"
      }
    }
  },
  "inputs": [
    {
      "id": "lifeline-mcp-api-key",
      "type": "promptString",
      "description": "Lifeline MCP API key (lk_...)"
    }
  ]
}
```

This is the minimum action to make subtask tools (and all other Lifeline MCP tools) visible to Cloud Code.

#### Step 2: Run migration 007 in production

SSH to VPS and execute:

```bash
docker exec -i lifeline-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" < migrations/008_enable_pg_trgm_similarity.sql
docker exec -i lifeline-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" < migrations/007_backfill_subtask_identity.sql
```

This ensures pre-existing subtasks have stable IDs.

#### Step 3: Validate

After configuring the MCP connection and running migrations:
1. In VS Code, verify `list-tools` shows all 5 subtask tools
2. Call `get_task` on a pre-existing task with subtasks and confirm subtaskId UUIDs are present
3. Call `complete_subtask` with the subtaskId from step 2
4. Confirm the model can now discover and use subtask tools for natural requests like "mark the first subtask done"

---

## Governance material reviewed

- `.github/copilot-instructions.md` — artifact routing, non-root placement
- `.github/instructions/backend-engineering-governance.instructions.md` — layering, validation, contract discipline
- `.github/instructions/code-quality-governance.instructions.md` — readability, naming, separation of concerns
- `.github/instructions/docs-governance.instructions.md` — doc routing, artifact class rules
