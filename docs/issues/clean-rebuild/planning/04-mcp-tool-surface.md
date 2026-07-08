# MCP tool surface (embedded module)

Normative detail: `../discovery/audit-mcp.md` §4–6. Contract: **all 28 tool names, input schemas, result
shapes, annotations, and server instructions are preserved verbatim** so existing configured clients
(Claude Desktop etc.) keep working after the swap. Only the plumbing changes.

## Tools (unchanged surface)

- Read (`tasks:read`): `search_tasks, get_task, list_today, list_upcoming, get_statistics, list_tasks,
  find_similar_tasks, export_tasks, list_tags`
- Write (`tasks:write`): `create_task, update_task, complete_task, uncomplete_task, delete_task(deprecated),
  archive_task, restore_task, batch_complete, batch_uncomplete, batch_archive, batch_restore,
  create_tag, update_tag, delete_tag`
- Subtasks (`tasks:write`): `add_subtask, complete_subtask, uncomplete_subtask, update_subtask, remove_subtask`

Result convention: `{content:[{type:'text', text:<preview>}], structuredContent:<data>}`; tool errors return
`isError:true` + `structuredContent.error{code,status,message}`, never JSON-RPC errors. List previews cap at 5
with "Showing N of M"; single-task previews include the subtask checklist with subtaskId UUIDs.

## Architecture changes

| Old (2-hop) | New (embedded) |
| --- | --- |
| `services/lifeline-mcp` container → HTTP `/internal/mcp/*` on backend | `apps/server/src/mcp/` module; tools call use-cases in-process |
| Shared secret + 6 principal headers | principal object passed directly |
| `MCP_INTERNAL_SHARED_SECRET`, `LIFELINE_BACKEND_BASE_URL`, `MCP_BIND_HOST`, `MCP_PORT` | deleted |
| nginx mcp vhost → :3030 | same vhost → main app `/mcp` (path proxy) |
| rate limit keyed on never-set headers (global bucket) | per-principal 120/min |
| week windows hardcoded Sunday | user `startDayOfWeek` honored |

Kept: stateless streamable HTTP (`POST /mcp`, per-request server+transport, JSON responses), dual auth
(`x-api-key`/non-JWT Bearer → key path; JWT Bearer → jose JWKS verify → OAuth path), principal shape
`{subjectType, lifelineUserId, authMethod, scopes, subjectId, displayName}`, scope wildcards `tasks:*`/`*`,
OAuth protected-resource metadata router, natural-language dueDate resolution (`today/tomorrow/yesterday/
in N days/next <weekday>`, create defaults empty dueDate to today), tag reference resolution
(string | {id} | {name} | canonical, case-insensitive, 400 on miss), selector `{taskNumber?, id?}`
cross-check, archive-first lifecycle with restore.

SDK: `@modelcontextprotocol/sdk` ^1.29 high-level `McpServer.registerTool`. If its zod peer conflicts with
zod 4, fall back to the low-level `Server` API with JSON Schemas from `z.toJSONSchema()` — surface identical.
