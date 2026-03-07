# Lifeline MCP v1 Implementation Phases

## Purpose

This artifact breaks the planned Lifeline MCP v1 delivery into bounded implementation slices that a later implementation agent can execute without inventing architecture during coding.

It assumes the planning decisions in:

- `docs/issues/mcp-server/step-02-planning/planning/lifeline-mcp-v1-planning-report.md`

---

# Phase 0 — Implementation guardrails

## Goal

Lock the implementation boundary before code changes begin.

## Main surfaces likely touched

- planning docs only at kickoff
- implementation checklist artifacts under this initiative path if needed

## Prerequisites

- planning report accepted as baseline

## Acceptance criteria

- implementation prompt/slice explicitly references the planning report
- v1 scope is fixed to planned tool set
- deferred/out-of-scope features are explicitly excluded

## Risk notes

- biggest risk is scope creep into OAuth, similarity, tags, or public API redesign

---

# Phase 1 — Backend prep and auth foundation

## Goal

Prepare the existing Lifeline backend for safe MCP reuse without changing product behavior broadly.

## Main files/surfaces likely touched

- `backend/src/index.js`
- new backend middleware file(s) for internal adapter auth
- possibly new backend route/helper files under `backend/src/`
- backend data model/entity/migration surfaces for API keys
- backend repository/service surfaces for API key persistence and lookup
- `backend/src/middleware/attachCurrentUser.js` and/or auth-related repository code if role-claim drift is cleaned here

## Planned work

1. add private `/internal/mcp/*` route group
2. add service-to-service auth middleware for that route group
3. define internal request contract for explicit Lifeline user context
4. scaffold API key persistence model
5. implement key lookup and hash verification support
6. fix known unsafe archive/unarchive user-scoping defect
7. clean up Auth0 role-claim namespace inconsistency

## Prerequisites

- planning report approved

## Acceptance criteria

- internal routes are protected by service auth and are not usable without the shared secret
- backend can resolve API keys to Lifeline users through a bounded persistence surface
- every internal route executes against explicit `userId`
- known archive/unarchive scoping gap is corrected
- no existing public todo behavior regresses

## Risk notes

- avoid mixing public Auth0 route concerns into internal service auth more than necessary
- avoid turning this into a full auth rewrite

---

# Phase 2 — Internal adapter read surfaces

## Goal

Deliver the minimum backend adapter endpoints needed for MCP read tools.

## Main files/surfaces likely touched

- `/internal/mcp/*` route registration in backend
- backend helper/controller-like modules for internal read operations
- existing use case/repository code only where small helper extraction is needed

## Planned work

1. add search adapter endpoint
2. add get-by-task-number adapter endpoint
3. add day-list adapter endpoint with `dateRange` parity behavior
4. add upcoming-list adapter endpoint
5. add handle-resolution helper path if needed

## Prerequisites

- Phase 1 complete

## Acceptance criteria

- internal search returns user-scoped, paginated results
- internal get-task returns a single user-scoped task by `taskNumber`
- internal day-list reproduces current app day semantics for `today`, `tomorrow`, and explicit date tokens
- internal upcoming-list returns a stable user-scoped upcoming set with documented ordering

## Risk notes

- `dateRange` parity is the main semantic risk in this phase
- avoid adding a broad generalized calendar API unless needed

---

# Phase 3 — Internal adapter write surfaces

## Goal

Deliver safe write-oriented backend adapter routes with explicit semantics.

## Main files/surfaces likely touched

- backend internal MCP route group
- existing use cases: `CreateTodo`, `UpdateTodo`, `DeleteTodo`
- small new write helpers where explicit complete/uncomplete semantics are needed
- validation surfaces for internal payload sanity where appropriate

## Planned work

1. add create adapter endpoint
2. add update adapter endpoint
3. add explicit complete adapter endpoint
4. add explicit uncomplete adapter endpoint
5. add delete adapter endpoint
6. add safe task-handle resolution for write operations

## Prerequisites

- Phase 2 complete or enough read/lookup support to resolve handles safely

## Acceptance criteria

- create reuses existing Lifeline task behavior, including recurrence and task numbering
- update reuses existing mutable-field behavior safely
- complete/uncomplete are idempotent at the adapter contract level
- delete preserves current archive-oriented behavior and returns a clear result contract
- no write action occurs without explicit user-scoped task resolution

## Risk notes

- do not expose raw toggle as the external MCP write contract
- be careful not to accidentally broaden mutable fields without documenting it

---

# Phase 4 — `lifeline-mcp` service scaffold

## Goal

Create the separate MCP service with transport, auth, principal normalization, and backend adapter client wiring.

## Main files/surfaces likely touched

- new service directory for `lifeline-mcp` (path to be chosen during implementation)
- service package manifest
- service entrypoint
- transport layer modules
- auth modules
- backend adapter client modules
- shared config/env loading
- Docker build surface for the new service

## Planned work

1. scaffold Node service structure
2. implement remote HTTP MCP server transport
3. add API key auth validation
4. implement normalized principal layer
5. implement backend client with service-auth secret support
6. add logging and error normalization

## Prerequisites

- Phases 1–3 sufficiently complete to provide backend adapter surfaces

## Acceptance criteria

- `lifeline-mcp` starts locally and can authenticate a valid API key
- service can call backend internal routes over Docker/internal HTTP
- tool handlers can receive a normalized principal without caring whether auth came from API key or a future OAuth method

## Risk notes

- keep the service thin; avoid reimplementing task business logic here
- avoid coupling transport details deeply into tool handlers

---

# Phase 5 — MCP v1 read tools

## Goal

Implement the first MCP tool handlers for non-mutating task operations.

## Main files/surfaces likely touched

- `lifeline-mcp` tool registry/handler modules
- `lifeline-mcp` response normalization modules
- backend adapter client calls

## Planned work

1. implement `search_tasks`
2. implement `get_task`
3. implement `list_today`
4. implement `list_upcoming`
5. standardize output contract shape

## Prerequisites

- Phase 4 complete

## Acceptance criteria

- all read tools return only user-scoped tasks
- `taskNumber` is accepted as the primary external handle where planned
- outputs include both `taskNumber` and UUID `id`
- day/upcoming behavior matches planned semantics

## Risk notes

- avoid adding `find_similar_past_tasks` opportunistically in this phase

---

# Phase 6 — MCP v1 write tools

## Goal

Implement mutating MCP task tools with conservative semantics.

## Main files/surfaces likely touched

- `lifeline-mcp` tool handlers
- handle resolution helper
- backend adapter client

## Planned work

1. implement `create_task`
2. implement `update_task`
3. implement `complete_task`
4. implement `uncomplete_task`
5. implement `delete_task`
6. enforce scope checks (`tasks:write`, `tasks:delete`)

## Prerequisites

- Phase 5 complete or at minimum read/lookup support available

## Acceptance criteria

- mutating tools enforce scopes before backend calls
- write actions do not guess task identity
- complete/uncomplete are explicit and predictable
- delete is described and returned as active-set removal backed by archive behavior

## Risk notes

- user confirmation/ambiguity handling must be clear at the contract level for destructive operations

---

# Phase 7 — Deployment wiring

## Goal

Fit `lifeline-mcp` into the existing production VPS/Docker/Nginx model.

## Main files/surfaces likely touched

- `compose.production.yaml`
- `compose.production.env.example`
- `deploy/nginx/` new MCP host config
- `deploy/scripts/apply-release.sh`
- possibly `.github/workflows/deploy-production.yml` for richer diagnostics
- Docker build surfaces for MCP

## Planned work

1. add `lifeline-mcp` service to production compose
2. bind MCP service to loopback-only host port
3. add Nginx proxy config for MCP hostname
4. add required production env vars and secrets documentation
5. extend deploy verification for MCP health if appropriate

## Prerequisites

- Phases 1–6 complete enough to run service end-to-end

## Acceptance criteria

- `lifeline-mcp` can be started with the production compose stack
- MCP public host routes through Nginx successfully
- internal MCP-to-backend calls work over Docker networking
- deployment retains rollback compatibility with current release model

## Risk notes

- avoid weakening the current loopback-only edge pattern
- keep MCP routing isolated from the main SPA host

---

# Phase 8 — Documentation and operational updates

## Goal

Bring canonical docs in line with implemented behavior.

## Main files/surfaces likely touched

- `docs/architecture/`
- `docs/operations/`
- `docs/backend/`
- possibly `docs/api/` if any public API changed
- possibly `docs/adr/`

## Planned work

1. update runtime topology docs
2. update production runtime/deploy docs
3. document backend internal adapter/auth behavior where appropriate
4. document MCP service env and operational expectations
5. add ADR if implementation creates a durable new auth/deployment boundary decision

## Prerequisites

- deployed implementation shape is known

## Acceptance criteria

- canonical docs match implemented runtime
- no critical operational assumption remains undocumented

## Risk notes

- avoid documenting speculative future OAuth behavior as already implemented

---

# Phase 9 — Validation and release readiness

## Goal

Validate that MCP v1 is safe, bounded, and deployable.

## Main files/surfaces likely touched

- test surfaces in backend and MCP service
- verification docs/checklists
- possibly deploy verification scripts

## Planned work

1. add backend adapter tests
2. add MCP auth and tool handler tests
3. validate per-user isolation on reads and writes
4. validate recurrence/day parity for `dateRange`
5. validate scope enforcement
6. validate production startup and proxy behavior

## Prerequisites

- previous phases complete

## Acceptance criteria

- cross-user access attempts fail
- invalid API keys fail cleanly
- destructive and mutating actions obey scope and handle resolution rules
- deployment smoke checks pass

## Risk notes

- per-user isolation and explicit write semantics are the most important release gates

---

# Recommended implementation start slice

## Start with

**Phase 1 — Backend prep and auth foundation**

## Why this is the best first slice

It unlocks every later workstream while reducing the highest known risks early:

- internal adapter boundary
- service-to-service auth
- API key model scaffolding
- archive/unarchive scoping fix
- auth namespace cleanup

## Smallest practical first implementation sub-slice

1. internal service-auth middleware
2. `/internal/mcp` route mount
3. API key entity/schema + migration scaffold
4. one internal `get by taskNumber` route for proof of path
5. tests for service auth and user scoping
