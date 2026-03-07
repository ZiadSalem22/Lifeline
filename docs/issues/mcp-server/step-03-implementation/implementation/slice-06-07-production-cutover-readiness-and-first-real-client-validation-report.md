# Lifeline MCP Step-03 Implementation — Combined Slice 06 and Slice 07 Report

## Slice

`step-03 implementation, combined slice-06 and slice-07: production cutover readiness + first real MCP client validation`

## Scope completed

This combined slice made the existing MCP runtime operator-ready for first production cutover and validated the real MCP path with a live official-SDK client against the running service in a production-shaped local stack.

Implemented scope:

- bounded backend use-case support for one-time MCP API-key issuance
- operator/dev CLI support to issue a real MCP API key for a specific Lifeline user
- repo-local official MCP SDK client CLI for repeatable real-client-equivalent validation
- canonical first-cutover runbook for operators
- concrete operations-doc updates pointing to the new cutover flow
- real end-to-end validation through the running MCP service in a production-shaped local stack using issued API keys
- runtime-truth-based adjustment of smoke validation and docs for current archive-style delete behavior

Out of scope and intentionally not implemented here:

- OAuth/Auth0 support for MCP clients
- public ChatGPT app publication or distribution flow
- MCP admin UI or self-serve key-management UX
- archive/unarchive MCP tools
- broader auth or runtime redesign

---

## Code and doc changes made

## 1. One-time MCP API-key issuance support

Added a bounded backend use case:

- `backend/src/application/IssueMcpApiKey.js`

Behavior:

- validates the target Lifeline user exists
- issues a unique `lk_<prefix>` API key prefix
- generates a plaintext secret once
- stores only prefix plus hashed secret
- validates the bounded v1 scope set
- supports optional expiry

The current bounded v1 issuance scopes are:

- `tasks:read`
- `tasks:write`
- `tasks:*`
- `*`

Current v1 scope note:

- `tasks:write` covers create, update, complete, uncomplete, and delete behavior in the current implementation
- there is no separate `tasks:delete` issuance scope in this bounded v1 slice

## 2. Operator/dev issuance CLI

Added:

- `backend/src/scripts/issue-mcp-api-key.js`

Behavior:

- selects a user by `--user-id` or `--email`
- can create a local/dev validation user only when `--create-user-if-missing` is explicitly requested
- supports `--name`, `--scopes`, `--expires-at`, and `--json`
- prints the plaintext key once
- returns machine-readable JSON cleanly for automation when `--json` is used

This slice also fixed a real operator automation defect discovered during live validation: bootstrap logging from env loading originally polluted JSON output, so the script now suppresses bootstrap `console.log` output during `--json` mode.

## 3. Focused issuance coverage

Added:

- `backend/test/application/IssueMcpApiKey.test.js`

Covered behavior:

- successful issuance returns plaintext once while persisting only hashed material
- unsupported scopes fail clearly
- missing target user fails clearly

Also updated:

- `backend/package.json`

with the new operator script entry:

- `mcp:issue-key`

## 4. Official-SDK MCP client CLI

Added:

- `services/lifeline-mcp/scripts/mcp-client-cli.js`

Behavior:

- connects through `StreamableHTTPClientTransport`
- authenticates with `Authorization: Bearer <apiKey>`
- supports `list-tools`
- supports arbitrary `call-tool`
- provides bounded `smoke-rw` and `smoke-ro` flows against the live MCP surface
- supports an optional absent-query cross-user sentinel check

Also updated:

- `services/lifeline-mcp/package.json`

with the new script entry:

- `client`

## 5. Runtime packaging support for real-client validation

Updated:

- `services/lifeline-mcp/Dockerfile`

so the repo-local MCP client CLI is copied into the runtime image and can be executed inside the running `lifeline-mcp` container during real validation.

## 6. Runtime-truth alignment for delete behavior

Real end-to-end validation showed that current Lifeline delete behavior remains archive-style.

Because of that, the new MCP smoke client was adjusted to validate delete success via the returned delete payload:

- `deleted: true`
- `deleteMode: "archived"`

instead of incorrectly asserting immediate disappearance from search results.

This preserved alignment with current backend/runtime truth rather than introducing a stronger delete claim than the system actually provides.

## 7. Canonical first-cutover operator runbook

Added:

- `docs/operations/lifeline-mcp-first-cutover-runbook.md`

This runbook now covers:

- first-cutover preconditions
- required host-side env and secret expectations
- Nginx sync, config test, and reload steps
- deploy-branch cutover sequence
- app/MCP health and bind verification
- MCP-to-backend adapter verification
- one-time API-key issuance
- official-SDK tool discovery and smoke validation
- optional read-only scope denial validation
- optional cross-user scoping validation
- minimal client-facing connection instructions
- rollback awareness
- troubleshooting grounded in actual runtime behavior

This slice also tightened the runbook after review to require:

- a dedicated smoke user for production validation
- short-lived validation keys via `--expires-at`
- explicit note that `--create-user-if-missing` is for non-production validation only
- explicit note that current v1 delete capability is included under `tasks:write`

## 8. Operations documentation refresh

Updated:

- `docs/operations/README.md`
- `docs/operations/DEPLOY_BRANCH_CD.md`
- `docs/operations/deployment-verification-and-smoke-checks.md`
- `docs/operations/production-runtime-and-rollback.md`

These updates now route readers to the canonical first-cutover runbook and, after final doc tightening, make it explicit that production MCP smoke validation should use a dedicated smoke user and temporary validation keys rather than a normal user's long-lived key.

---

## Important files touched

### Backend code

- `backend/src/application/IssueMcpApiKey.js`
- `backend/src/scripts/issue-mcp-api-key.js`
- `backend/package.json`

### Backend tests

- `backend/test/application/IssueMcpApiKey.test.js`

### MCP service and client tooling

- `services/lifeline-mcp/scripts/mcp-client-cli.js`
- `services/lifeline-mcp/package.json`
- `services/lifeline-mcp/Dockerfile`

### Canonical operations docs

- `docs/operations/lifeline-mcp-first-cutover-runbook.md`
- `docs/operations/README.md`
- `docs/operations/DEPLOY_BRANCH_CD.md`
- `docs/operations/deployment-verification-and-smoke-checks.md`
- `docs/operations/production-runtime-and-rollback.md`

---

## Validation performed

## 1. Edited-file diagnostics

Checked the changed backend, service, and documentation files for editor diagnostics.

Result:

- no file-level diagnostics remained in the edited slice files

## 2. Focused backend regression run

Executed from `backend/`:

`npx jest test/application/IssueMcpApiKey.test.js test/internal/internalMcpAuthResolveRoutes.test.js test/internal/internalMcpTaskReadRoutes.test.js test/internal/internalMcpTaskWriteRoutes.test.js`

Result:

- **4/4 suites passed**
- **26/26 tests passed**

Covered behavior:

- one-time key issuance
- internal API-key resolution
- internal MCP read routes
- internal MCP write routes

## 3. MCP service regression run

Executed from `services/lifeline-mcp/`:

`npm test`

Result:

- **5/5 tests passed**

Covered behavior:

- service health
- missing API-key rejection
- representative end-to-end tool flow through the internal backend adapter
- scope denial for write tools with a read-only key
- conflicting selector rejection on mutations

## 4. Production-shaped local runtime validation

Executed from repo root:

- `docker compose --env-file compose.production.env.example -f compose.production.yaml down -v`
- `docker compose --env-file compose.production.env.example -f compose.production.yaml up -d --build lifeline-postgres lifeline-app lifeline-mcp`

Result:

- production-shaped local stack rebuilt and started successfully
- `lifeline-postgres` reached healthy status
- `lifeline-app` reached healthy status
- `lifeline-mcp` started successfully

## 5. Loopback and health verification

Captured runtime evidence:

- app host bind: `127.0.0.1:3020`
- MCP host bind: `127.0.0.1:3010`
- MCP health response:
	- `status: "ok"`
	- `service: "lifeline-mcp"`
	- `publicBaseUrl: "https://mcp.lifeline.a2z-us.com"`
	- `transport: "streamable-http"`
	- `auth: "api-key"`
	- `mode: "stateless"`

## 6. MCP-to-backend adapter reachability verification

Executed an in-container fetch from `lifeline-mcp` to the backend internal adapter health route with the shared-secret header.

Result:

- HTTP `200`
- payload included:
	- `status: "ok"`
	- `service: "internal-mcp"`
	- `authenticatedService: "lifeline-mcp"`

## 7. Real tool discovery through the running MCP service

Issued real MCP API keys using the new backend script and connected to the running MCP service path with the official-SDK CLI in the production-shaped local stack.

Observed tool discovery included 9 tools:

- `search_tasks`
- `get_task`
- `list_today`
- `list_upcoming`
- `create_task`
- `update_task`
- `complete_task`
- `uncomplete_task`
- `delete_task`

## 8. Real read/write smoke flow through the running MCP service

Validated with the official-SDK CLI against `http://127.0.0.1:3010/mcp` in the production-shaped local stack.

Successful `smoke-rw` evidence included:

- required tools were advertised
- optional absent-query cross-user sentinel check returned total `0`
- `create_task` created a new task and returned `taskNumber`
- `list_today` included the created task
- `search_tasks` returned the created task
- `complete_task` returned `completed: true`
- `delete_task` returned:
	- `deleted: true`
	- `deleteMode: "archived"`

## 9. Real read-only scope denial validation

Validated with a read-only key using the running MCP service in the production-shaped local stack.

Successful `smoke-ro` evidence included:

- `search_tasks` succeeded
- `create_task` failed with `scope_denied`

## 10. Real cross-user isolation validation

Validated by:

1. issuing a key for a second user
2. creating a sentinel task with that second key
3. running the first user's smoke flow with `--assert-query-absent <sentinel-title>`
4. deleting the sentinel task with the second user's key

Result:

- the first user's query could not see the second user's sentinel task
- cross-user task isolation remained intact through the running MCP path in the production-shaped local stack

## 11. Runtime-truth defect discovery and closure

This slice surfaced and fixed two real runtime/operator defects during live validation:

### JSON issuance contamination

Problem discovered:

- JSON output from the issuance script was polluted by bootstrap logging, breaking machine parsing

Fix applied:

- suppress bootstrap `console.log` output during `--json` mode in `backend/src/scripts/issue-mcp-api-key.js`

### Delete-smoke mismatch with actual Lifeline semantics

Problem discovered:

- the first smoke client assumed a deleted task would disappear from search immediately

Observed runtime truth:

- current delete behavior is archive-style and confirms success via returned delete payload

Fix applied:

- updated `services/lifeline-mcp/scripts/mcp-client-cli.js`
- updated `docs/operations/lifeline-mcp-first-cutover-runbook.md`

---

## Governance usage note

This combined slice was implemented through the repo-native governance stack.

Materially used governance layers:

- **backend engineering governance**
	- kept key issuance in the application layer
	- preserved the backend as the source of truth for key persistence and user targeting

- **code-quality governance**
	- kept the official-SDK client CLI bounded to operator validation, not product behavior
	- preserved small focused responsibilities across issuance, validation, and docs

- **documentation governance**
	- routed the retained artifact into the scoped non-root issue-history path
	- updated the correct canonical operations surfaces instead of leaving phase guidance only in scratch notes

- **operations documentation governance**
	- grounded the runbook in actual deploy-branch, VPS, Nginx, Compose, and loopback-runtime truth
	- tightened production instructions toward dedicated smoke users and temporary credentials

- **refactor governance (bounded only)**
	- avoided scope expansion into OAuth, admin UX, or broader service redesign while still fixing real operator/runtime defects discovered during validation

Post-implementation review outcome after final doc tightening:

- **Approve for closure**

---

## Slice result

This combined slice completed the first operator-ready and real-client-ready MCP validation layer on top of the already implemented service/runtime foundation.

The repo now has:

- a bounded way to issue real MCP API keys for a specific Lifeline user
- an official-SDK-based repo-local MCP client for repeatable live validation
- a canonical first-cutover runbook for operators
- operations docs that point to the right first-release flow
- real validation evidence from a production-shaped local stack that the running MCP service can authenticate, advertise tools, enforce scopes, preserve user isolation, and execute representative task flows end to end

---

## Recommended next step

The bounded step-03 implementation scope for the planned MCP v1 slices is now complete.

The most appropriate next step is not more feature work inside this implementation phase, but controlled production cutover using the documented runbook and any follow-on backlog selection for:

- OAuth/Auth0 support
- key revocation/management tooling
- additional MCP tools only if separately approved
