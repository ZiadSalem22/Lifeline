## Plan: MCP Task Usability And Parity

This planning pass defines an issue-ready initiative for improving Lifeline MCP task behavior in chat without jumping into implementation. The initiative should be treated as a new scoped step under the existing `mcp-server` issue history, not as an extension of Step 07 OAuth work. Recommended issue-history target: `docs/issues/mcp-server/step-08-model-usable-task-parity/planning/2026-03-11-initiative-plan.md`.

**Problem statement**
The current Lifeline MCP task surface is richer than the observed chat behavior suggests, but the model-facing experience is weak. Read tools often return text summaries like `N task(s) returned` even when `structuredContent` contains useful task data. This causes clients that lean on text content to underperform, makes the model appear unaware of task detail, and hides existing backend capability. At the same time, the MCP tool surface still trails the broader task API in several important areas such as tags, batch operations, statistics, archive and restore behavior, ordering, export and import, and richer recurrence control.

**Current findings**
1. The immediate usability problem is presentation and discoverability, not only missing tools.
2. The MCP layer already carries rich task data through the backend internal adapter, including description, priority, duration, tags, subtasks, recurrence, next recurrence due, original recurrence lineage, and archive state.
3. True audit history does not currently exist as a dedicated backend feature. First-pass history must stay bounded to existing timestamps if available, archived state, and recurrence lineage.
4. The current MCP server descriptions do not teach models how to use list versus detail tools, what filters exist, or how mutation tools behave.
5. The broader direction is near-parity with task API capabilities, but this should be phased instead of attempted as one large MCP rewrite.

**Goals**
- Make MCP read results legible and actionable to chat models even when the client only surfaces text content.
- Establish `get_task` as the canonical deep-read tool for full inspection of a single task.
- Improve tool descriptions so models can discover filtering, mutation, and selection behavior without guessing.
- Expand MCP toward near-parity with existing task-management capabilities in safe phases.
- Preserve the current thin-adapter architecture by reusing backend use-cases and internal MCP routes.
- Keep first-pass history bounded to existing data rather than inventing a new audit system.

**Non-goals**
- Do not build a full audit/event history system in this initiative.
- Do not bypass backend use-cases by adding business logic directly in `services/lifeline-mcp`.
- Do not attempt a giant all-at-once parity dump with no phased safety model.
- Do not mix OAuth/auth work, deployment work, or unrelated MCP auth concerns into this initiative.

**Scope boundaries**
Included:
- model-facing preview formatting
- explicit deep-read contract for full task inspection
- richer tool descriptions and discoverability
- phased MCP task-surface expansion using existing backend capabilities
- bounded history exposure using existing fields only
- documentation planning for MCP/API/backend/data-model impacts

Excluded for this initiative unless separately approved:
- true audit-log history
- cross-domain product redesign of task semantics
- generic agent prompting work outside the MCP server and its documentation
- deployment-model changes

**Governance framing**
- Documentation governance: the plan should produce a non-root retained planning artifact under `docs/issues/mcp-server/step-08-model-usable-task-parity/planning/` and later map canonical doc updates across API, backend, data-model, and possibly features domains.
- Backend engineering governance: new capabilities should reuse existing application and repository behavior through the backend internal MCP adapter rather than embedding business rules in the MCP service.
- Code quality governance: the work should prefer bounded, comprehensible slices over a monolithic MCP expansion.
- Refactor governance: treat the first slice as a preparatory and comprehension refactor that preserves current behavior while improving model usability. Preserved behavior statement for first implementation slice: `Preserved behavior: existing task queries and mutations continue to return the same underlying structured payloads and enforce the same scopes while the text summaries and tool guidance become more model-usable.`
- Frontend and UX governance: although this is not a frontend change, model usability should be treated like a UX quality problem. The plan therefore includes explicit readability, discoverability, and trustworthy-feedback requirements for tool responses.

**Impacted docs domains**
- api: `docs/api/mcp-server-endpoints-and-auth.md`
- backend: `docs/backend/todo-services-and-use-cases.md` and possibly a backend MCP surface doc refresh
- data-model: `docs/data-model/recurrence-subtasks-and-task-numbering.md` if history and lineage exposure change materially
- features: optional if a feature-level MCP capability inventory is added later
- issues history: new planning artifact under the proposed Step 08 path

**Issue recommendation**
Recommended initiative title: `MCP model-usable task parity`
Recommended issue statement: `Improve Lifeline MCP so task tools behave fluently in chat and expand the task tool surface toward safe near-parity with the existing task API.`
Recommended issue-history path: `docs/issues/mcp-server/step-08-model-usable-task-parity/`
Recommended planning artifact path: `docs/issues/mcp-server/step-08-model-usable-task-parity/planning/2026-03-11-initiative-plan.md`

**Phased implementation strategy**
### Phase 1. Model-facing read usability
Purpose: fix the observed chat-quality failure before expanding the tool surface.

Scope:
- strengthen preview text for `search_tasks`, `list_today`, and `list_upcoming`
- make `get_task` the explicit full-detail inspection tool
- improve tool descriptions and server-level guidance
- preserve current structured payloads and scope enforcement

#### Locked preview strategy
List and search tools should return both:
- `structuredContent` containing the existing full result payload
- `content` text containing a compact human-model-readable preview

Preview text requirements:
- first line: overall result summary with total count and current page or limit when relevant
- next lines: up to 5 task previews by default
- if more than 5 tasks exist, include a final truncation line such as `Showing 5 of 17 tasks. Use get_task for full inspection or refine filters.`
- preserve readability over exhaustiveness
- avoid token bloat by not expanding full descriptions or subtasks in list previews unless specifically requested through `get_task`

Each preview row should include, in this order when available:
- task number
- title
- completion state
- due date and optional time
- priority
- duration
- tag names
- recurrence hint such as `recurs daily` or `recurs on Mon/Wed`
- flagged state only when true

Recommended preview format:
- `#42 Finish tax filing | active | due 2026-03-15 09:00 | high | 60m | tags: admin, finance | recurs daily`
- `#17 Review sprint notes | completed | due 2026-03-11 | medium | tags: work`

Readability rules:
- use one task per line
- omit empty fields rather than printing placeholders
- keep ordering stable across similar list tools
- keep previews concise enough that 5 tasks remain scannable in chat

#### `get_task` deep-read contract
Define `get_task` as the canonical full-detail inspection tool.

Behavior contract:
- list and search tools are for discovery and navigation
- `get_task` is for full inspection and should be called when the model needs exact field values, recurrence details, subtasks, tags, or bounded history fields
- tool descriptions for list and search should explicitly say: `Use get_task with taskNumber for full detail on a specific task.`
- `get_task` should expose every currently available normalized task field, including at minimum:
  - id
  - taskNumber
  - title
  - description
  - dueDate
  - dueTime
  - isCompleted
  - isFlagged
  - duration
  - priority
  - tags
  - subtasks
  - recurrence
  - nextRecurrenceDue
  - originalId
  - archived
- if existing timestamp fields are already available from the backend or can be safely added from the internal payload without inventing new semantics, include created and updated timestamps here rather than in list previews

### Phase 2. Safe task control expansion
Purpose: improve day-to-day task control while keeping mutation safety high.

Recommended scope:
- richer recurrence-safe mutation behavior
- tag management tools
- archive and restore operations
- reorder operations where existing backend support is already clear

Rationale:
- these are common management operations that improve usefulness without immediately introducing high-risk bulk or data-portability workflows
- they can still follow the current thin-adapter architecture through backend internal routes and use-cases

Mutation-safety expectations for Phase 2:
- destructive or high-impact tools need explicit descriptions that state what they do
- archive and restore must use unambiguous names and must not masquerade as hard delete
- reorder should clearly describe whether it affects UI ordering only
- recurrence mutation should be introduced only when the backend semantics are explicit enough not to surprise users

### Phase 3. Organizational and batch parity
Purpose: expose existing backend capabilities that improve power-user control and reduce repetitive tool calls.

Recommended scope:
- batch complete or uncomplete
- batch archive or delete where backend behavior is already established
- task statistics surfaces
- broader organizational task filters and sort controls if still missing after Phase 1

Safety planning:
- batch operations are high-impact and should likely be deferred until after single-task tools are highly legible and discoverable
- batch tools should be explicit in name and scope, and their descriptions should warn that multiple tasks may be affected
- results should summarize exactly how many tasks were changed and, where practical, which task numbers were targeted

### Phase 4. Advanced parity
Purpose: approach near-parity with the full task API where it is safe and useful.

Recommended scope:
- export surfaces
- import surfaces if truly needed through MCP
- richer recurrence-management parity if still not covered
- any remaining task-adjacent control surfaces that fit the MCP model cleanly

Safety planning:
- export and import are high-impact and should be late-phase work
- import should be treated as especially risky because it can create or reshape large sets of tasks; if exposed at all, it should be explicit, strongly described, and possibly gated to a later issue if the backend contracts are too broad for a first parity pass

**History boundary**
Keep history explicitly bounded in this initiative:
- expose existing timestamps only if already available or safely added from current backend data
- expose archived state where relevant
- expose recurrence lineage via `originalId`, `nextRecurrenceDue`, and recurrence metadata
- defer true audit trail, edit history, and event logs to a future backend feature and separate issue

**Builder and reviewer checkpoints for future implementation**
Pre-implementation builder checkpoints:
1. confirm sibling patterns in `services/lifeline-mcp/src/mcp/` and `backend/src/internal/mcp/`
2. confirm whether the next slice is presentation-only, adapter expansion, or new backend capability exposure
3. confirm API contract implications for each new MCP tool
4. confirm scope requirements and mutation-risk wording per tool

Reviewer checkpoints:
1. did previews become more model-usable without hiding structured payloads
2. does `get_task` now read as the canonical full-detail tool
3. did the slice preserve existing backend semantics and scopes
4. were high-impact tools deferred or clearly safety-described
5. were docs updated in the correct canonical domains

**Recommended first implementation slice**
Recommended first slice: `Phase 1A, model-usable read surface`

This slice should include:
- preview-text redesign for `search_tasks`, `list_today`, and `list_upcoming`
- `get_task` positioning as the deep-read contract
- richer tool descriptions for discovery and full-detail behavior
- tests proving the text layer is now informative while `structuredContent` remains intact

Why this first:
- it directly targets the failure the user observed in real chat
- it is low-risk compared with adding new mutation tools
- it preserves backend behavior and mainly improves presentation and guidance
- it gives a measurable improvement before the larger parity work begins

**Validation expectations**
1. MCP tests should assert that list and search tools now emit meaningful preview text rather than count-only summaries.
2. MCP tests should assert that `get_task` returns full detail and that tool descriptions direct models toward it.
3. Real client validation should confirm that a model can list tasks, mention useful details from the preview, then inspect one task in full.
4. Later phases should add one bounded test per new capability, especially for recurrence, archive or restore, reorder, tags, stats, batch actions, export, and import.
5. High-impact tool introductions should include explicit negative-path or safety-behavior tests where appropriate.

**Risks and safety concerns**
- Risk: over-expanding the MCP surface too early will create a large, hard-to-review change. Mitigation: phase the work and keep the first slice presentation-focused.
- Risk: mutation tools may become confusing or destructive in chat. Mitigation: explicit tool names, descriptions, and later-phase scheduling for batch and import/export.
- Risk: implementation may blur the boundary between existing timestamps and true history. Mitigation: keep the history boundary explicit in issue scope and docs.
- Risk: presentation improvements could create token bloat. Mitigation: cap previews at 5 tasks, keep one-line summaries, and push deep detail to `get_task`.

**Docs and governance implications**
If implementation proceeds, the following should be planned for canonical updates:
- `docs/api/mcp-server-endpoints-and-auth.md` for MCP capability and tool-surface updates
- `docs/backend/todo-services-and-use-cases.md` if internal MCP reuse or backend-exposed capability mapping needs clearer coverage
- `docs/data-model/recurrence-subtasks-and-task-numbering.md` if bounded history and lineage exposure become part of the explicit contract
- optional feature-level or backend surface docs if the MCP capability inventory grows enough to justify them

**Handoff recommendation**
Open a new initiative under `mcp-server` as Step 08 with the title `MCP model-usable task parity`, and begin implementation with Phase 1A only. Do not combine Phase 1A with tag management, batch operations, or export/import in the same change.
