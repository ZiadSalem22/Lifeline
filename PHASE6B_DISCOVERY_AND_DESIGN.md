# Phase 6B Discovery and Design

## 1. Executive Summary

Phase 6B discovery and design is complete.

The repository is now structurally ready for a proper documentation system, but the actual documentation-system layer is still mostly absent. Phase 6A created the long-term docs hierarchy and cleaned the root, which means Phase 6B can focus on designing the AI-assisted documentation operating model instead of fighting root clutter.

Current readiness is strong in three areas:
- the long-term docs hierarchy now exists and is clean
- there is already one repo-wide Copilot instruction file
- there is already a stable separation between product, feature, frontend, backend, API, data-model, architecture, operations, reference, archive, and issue-history docs locations

Current readiness is weak in the actual documentation-system layer:
- no path-specific instruction files exist yet
- no custom documentation agents exist yet
- no reusable docs prompt library exists yet
- no actual templates exist yet beyond placeholder scaffolding
- no PR or issue workflow currently enforces doc updates
- the current repo-wide Copilot instructions are broad, code-focused, and partly stale for current architecture/runtime reality

The practical conclusion is:
- the repo is ready for direct Phase 6B implementation
- Phase 6B implementation should create the documentation system surfaces first
- Phase 6C can then use that system to produce the real project documentation safely and consistently

## 2. Locked Inputs

The following inputs were treated as fixed during this discovery and design pass:

- Phase 6A is already complete
- the root is intentionally clean and should not revert to report clutter
- the long-term docs hierarchy already exists under `docs/`
- the documentation system must support frontend, backend, API, product/business, architecture, data-model, and operations domains
- this phase is discovery and design only
- this phase should prepare for GitHub Copilot and repo-based AI workflows
- the next phase, Phase 6C, will use the system to write the real documentation bodies

Current docs structure already includes at least:
- `docs/README.md`
- `docs/product/`
- `docs/features/`
- `docs/frontend/`
- `docs/backend/`
- `docs/api/`
- `docs/data-model/`
- `docs/architecture/`
- `docs/operations/`
- `docs/adr/`
- `docs/templates/`
- `docs/issues/`
- `docs/archive/`
- `docs/reference/`

## 3. Current Repo Readiness Findings

### Documentation scaffolding already present

The repo already has the structural documentation surface needed for a mature docs system:
- `docs/README.md` is the central docs entrypoint
- active docs sections already exist for product, features, frontend, backend, API, data-model, architecture, operations, ADRs, templates, issues, archive, and reference
- historical phase material has already been relocated under `docs/issues/...`
- legacy material has already been moved under `docs/archive/...`
- current operational docs already exist under `docs/operations/`

### Documentation content currently present

Current content is uneven but usable as seed material:
- operations content exists in `docs/operations/QUICK_START.md` and `docs/operations/DEPLOY_BRANCH_CD.md`
- retained feature inventory exists in `docs/features/FEATURES.md`
- retained frontend artifact exists in `docs/frontend/ui-wireframe.md`
- retained reference material exists in `docs/reference/TESTING_CHECKLIST.md` and `docs/reference/cosmic-background.html`
- issue-centered historical material exists under `docs/issues/...`
- archive material exists under `docs/archive/...`

### Major readiness gap

Most of the new documentation domains are only scaffolded, not systematized:
- `docs/product/` is only a placeholder
- `docs/backend/` is only a placeholder
- `docs/api/` is only a placeholder
- `docs/data-model/` is only a placeholder
- `docs/architecture/` is only a placeholder
- `docs/adr/` exists but has no actual ADR template or ADR records yet
- `docs/templates/` exists but currently only contains a placeholder `README.md`

### Current conventions already implied by the repo

The repo already implies a useful documentation separation model:
- product/business behavior belongs separately from technical backend/API docs
- operations/deployment material belongs separately from architecture and API docs
- frontend documentation should not be buried inside `client/`
- phase history should stay under `docs/issues/...`, not at root
- stale or superseded docs should go to `docs/archive/...`

These conventions are good and should become explicit rules in Phase 6B implementation.

## 4. Copilot / Agent / Prompt-System Findings

### Existing Copilot customization surface

Existing repo-wide Copilot file:
- `.github/copilot-instructions.md`

What it currently does:
- provides project overview and architecture guidance
- describes backend and frontend structure
- lists basic developer workflows
- explains some project conventions

What is good about it:
- it already establishes a repo-wide always-on instruction surface
- it gives useful architectural orientation for general coding work

What is weak about it for the documentation-system goal:
- it is primarily code-oriented, not docs-system-oriented
- it does not define documentation ownership rules
- it does not define when docs must be updated
- it does not split frontend/backend/API/product/ops documentation responsibilities
- parts of it appear stale or development-biased relative to the current repo evolution and deployment state

### Existing path-specific instruction surface

None currently present.

No `.github/instructions/...` hierarchy exists yet.

This means the repo currently has no path-aware guidance for:
- frontend docs generation
- backend docs generation
- API contract documentation
- product/business behavior docs
- architecture/ADR work
- operations/deployment docs

### Existing custom agents

None currently present under `.github/agents/...`.

This is a major gap for the desired future workflow, because the repo will benefit from domain-specific documentation agents instead of relying on one generic behavior.

### Existing non-GitHub agent surface

Existing file:
- `.agent/workflows/create_todo_app.md`

Finding:
- this is a generic scaffold workflow for creating a full-stack todo application
- it does not appear to be part of the actual long-term Lifeline documentation system
- it is not documentation-governance oriented
- it does not overlap strongly with the Phase 6B target system except as evidence that a repo-local agent/workflow concept has been used before

Recommended treatment:
- do not use it as the Phase 6B foundation
- leave it alone unless a later cleanup explicitly targets obsolete `.agent` workflows
- prefer a new GitHub-native `.github/agents/...` documentation agent set for the new system

### Existing prompt / skill / template surface

Current state:
- no prompt library currently exists
- no skill-style reusable docs prompt files currently exist
- `docs/templates/README.md` exists, but templates themselves do not yet exist
- no doc checklists or update-matrix files currently exist

### Existing workflow/governance surface

Current state:
- no pull request template was found
- no issue templates were found
- no docs-impact checklist was found
- no repo-side docs currency enforcement surface currently exists

This means future documentation freshness is currently dependent on memory and manual discipline rather than explicit repo rules.

## 5. Recommended Documentation-System Architecture

The recommended system for this repo should have eight major components.

### Component 1: repo-wide always-on instruction layer

Recommended file:
- `.github/copilot-instructions.md`

Role:
- remain the always-on base layer
- be revised to focus on stable repo-wide facts plus documentation update obligations
- stop trying to carry all domain-specific guidance in one file

Recommended contents:
- repo purpose and high-level architecture
- docs directory map
- rule that documentation lives under `docs/` and not at root
- rule that code changes must evaluate documentation impact
- rule that frontend, backend, API, product, architecture, data-model, and operations docs are distinct domains
- rule that historical reports go under `docs/issues/...` or `docs/archive/...`

### Component 2: path-specific instruction layer

Recommended folder:
- `.github/instructions/`

Recommended instruction files:
- `.github/instructions/frontend-docs.instructions.md`
- `.github/instructions/backend-docs.instructions.md`
- `.github/instructions/api-docs.instructions.md`
- `.github/instructions/product-docs.instructions.md`
- `.github/instructions/architecture-docs.instructions.md`
- `.github/instructions/data-model-docs.instructions.md`
- `.github/instructions/operations-docs.instructions.md`
- `.github/instructions/docs-governance.instructions.md`

Role:
- give domain-specific writing rules and source-of-truth expectations
- keep prompts smaller and cleaner by letting the repo provide localized documentation guidance

### Component 3: custom documentation agents

Recommended folder:
- `.github/agents/`

Recommended agents:
- `frontend-docs-agent.md`
  - responsible for UI structure, flows, route behavior, components, state, and user-visible behavior
- `backend-docs-agent.md`
  - responsible for services, use cases, repositories, middleware, validation, and persistence behavior
- `api-docs-agent.md`
  - responsible for endpoint contracts, request/response shapes, auth expectations, error behavior, and examples
- `product-docs-agent.md`
  - responsible for business rules, product flows, concepts, and user-facing behavior descriptions
- `architecture-docs-agent.md`
  - responsible for system boundaries, topology, cross-cutting concerns, and ADR triggering
- `operations-docs-agent.md`
  - responsible for deployment, environments, CI/CD, runbooks, rollback, and operational checks
- `docs-governance-agent.md`
  - responsible for change-impact analysis, doc routing, and completeness checks across domains

### Component 4: reusable prompt library

Recommended folder:
- `.github/prompts/`

Recommended prompt files:
- `map-doc-impact.prompt.md`
- `document-frontend-surface.prompt.md`
- `document-backend-surface.prompt.md`
- `document-api-contracts.prompt.md`
- `document-product-behavior.prompt.md`
- `document-architecture.prompt.md`
- `document-data-model.prompt.md`
- `document-operations.prompt.md`
- `write-adr.prompt.md`
- `refresh-docs-after-change.prompt.md`

Role:
- provide reusable prompt entrypoints for consistent AI-assisted documentation work
- separate reusable task prompts from always-on instructions

### Component 5: documentation templates and checklists

Recommended folder:
- `docs/templates/`

Recommended templates:
- `feature-doc.template.md`
- `frontend-page-or-flow.template.md`
- `frontend-component.template.md`
- `backend-module.template.md`
- `api-endpoint.template.md`
- `product-behavior.template.md`
- `architecture-overview.template.md`
- `operations-runbook.template.md`
- `adr.template.md`
- `data-model-entity.template.md`

Recommended checklist files:
- `docs-update-checklist.md`
- `change-impact-matrix.md`

### Component 6: lightweight governance through pull requests

Recommended files:
- `.github/pull_request_template.md`
- optionally `.github/ISSUE_TEMPLATE/documentation-gap.yml`
- optionally `.github/ISSUE_TEMPLATE/doc-request.yml`

Role:
- ensure future code changes explicitly declare which docs domains were affected
- provide a standard place to confirm docs were updated or intentionally deferred

### Component 7: documentation ownership matrix

Recommended file:
- `docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md`

Role:
- state which docs domain must change when each code/domain surface changes
- make future AI-assisted and human-assisted updates deterministic instead of opinion-based

### Component 8: Phase 6C execution map

Recommended file:
- `docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md`

Role:
- define the actual documentation writing backlog that Phase 6C will execute
- prevent Phase 6C from becoming a vague “document everything” effort

## 6. Recommended File and Folder Plan

Recommended Phase 6B implementation plan should create the following concrete structure.

### GitHub / Copilot system files

- `.github/copilot-instructions.md`
- `.github/instructions/docs-governance.instructions.md`
- `.github/instructions/frontend-docs.instructions.md`
- `.github/instructions/backend-docs.instructions.md`
- `.github/instructions/api-docs.instructions.md`
- `.github/instructions/product-docs.instructions.md`
- `.github/instructions/architecture-docs.instructions.md`
- `.github/instructions/data-model-docs.instructions.md`
- `.github/instructions/operations-docs.instructions.md`

### Custom agents

- `.github/agents/docs-governance-agent.md`
- `.github/agents/frontend-docs-agent.md`
- `.github/agents/backend-docs-agent.md`
- `.github/agents/api-docs-agent.md`
- `.github/agents/product-docs-agent.md`
- `.github/agents/architecture-docs-agent.md`
- `.github/agents/operations-docs-agent.md`

### Reusable prompts

- `.github/prompts/map-doc-impact.prompt.md`
- `.github/prompts/refresh-docs-after-change.prompt.md`
- `.github/prompts/document-frontend-surface.prompt.md`
- `.github/prompts/document-backend-surface.prompt.md`
- `.github/prompts/document-api-contracts.prompt.md`
- `.github/prompts/document-product-behavior.prompt.md`
- `.github/prompts/document-architecture.prompt.md`
- `.github/prompts/document-data-model.prompt.md`
- `.github/prompts/document-operations.prompt.md`
- `.github/prompts/write-adr.prompt.md`

### Docs templates

- `docs/templates/feature-doc.template.md`
- `docs/templates/frontend-page-or-flow.template.md`
- `docs/templates/frontend-component.template.md`
- `docs/templates/backend-module.template.md`
- `docs/templates/api-endpoint.template.md`
- `docs/templates/product-behavior.template.md`
- `docs/templates/architecture-overview.template.md`
- `docs/templates/data-model-entity.template.md`
- `docs/templates/operations-runbook.template.md`
- `docs/templates/adr.template.md`
- `docs/templates/docs-update-checklist.md`
- `docs/templates/change-impact-matrix.md`

### Governance support files

- `.github/pull_request_template.md`
- optionally `.github/ISSUE_TEMPLATE/documentation-gap.yml`
- optionally `.github/ISSUE_TEMPLATE/doc-request.yml`
- `docs/reference/DOCUMENTATION_OWNERSHIP_MATRIX.md`
- `docs/reference/PHASE6C_DOCUMENTATION_BACKLOG.md`

### Domain responsibilities by location

- `docs/product/`
  - product concepts, user journeys, business rules, task lifecycle, recurrence behavior from a business perspective
- `docs/features/`
  - feature inventory and feature-specific summary docs
- `docs/frontend/`
  - pages, flows, layouts, state, interactions, auth UI behavior, responsive behavior
- `docs/backend/`
  - use cases, repositories, middleware, services, validation, persistence behavior
- `docs/api/`
  - endpoints, auth requirements, contracts, examples, error behavior
- `docs/data-model/`
  - entities, tables, relationships, migration notes, identity mapping
- `docs/architecture/`
  - overall system structure, boundaries, runtime topology, integration points
- `docs/operations/`
  - local setup, deployment, CI/CD, monitoring, rollback, production runbooks
- `docs/adr/`
  - durable decision records only

## 7. Documentation Ownership and Update Rules

The future system should make documentation ownership explicit.

### Rule 1: every change must evaluate doc impact

Any non-trivial code or runtime change should answer:
- which docs domain changed
- which file should be updated
- whether the change is product, frontend, backend, API, data-model, architecture, or operations impact

### Rule 2: feature behavior and business behavior are not the same as API docs

Recommended separation:
- product docs describe user-facing concepts and business rules
- feature docs summarize feature scope and user-visible capability
- API docs describe contracts and transport behavior only

Example:
- recurrence business rules belong in `docs/product/` and `docs/features/`
- recurrence endpoint details belong in `docs/api/`
- recurrence backend processing belongs in `docs/backend/`

### Rule 3: frontend behavior and backend behavior must be documented separately

Frontend docs should cover:
- routes
- screens
- layout behavior
- state and interactions
- auth UI behavior
- responsive/mobile behavior

Backend docs should cover:
- use cases
- repositories
- middleware
- validation
- side effects
- persistence behavior

### Rule 4: operations docs are separate from architecture docs

Operations docs should cover:
- deploy flow
- environments
- secrets model
- CI/CD
- verification steps
- rollback

Architecture docs should cover:
- system structure
- service boundaries
- runtime topology
- integration patterns
- why the system is shaped the way it is

### Rule 5: ADRs are required for durable design decisions

An ADR should be updated or added when changes materially affect:
- deployment model
- auth model
- persistence model
- domain boundaries
- frontend/backend responsibilities
- documentation system governance itself

### Rule 6: docs should be routed by source-of-truth ownership

Recommended update routing:
- frontend code changes → `docs/frontend/` and possibly `docs/features/`
- backend business logic changes → `docs/backend/`, possibly `docs/product/`, and maybe `docs/api/`
- endpoint changes → `docs/api/` and possibly `docs/backend/`
- schema/entity changes → `docs/data-model/` and possibly `docs/architecture/`
- deploy/runtime changes → `docs/operations/` and possibly `docs/architecture/`
- user-facing workflow changes → `docs/product/`, `docs/features/`, and possibly `docs/frontend/`

### Rule 7: historical reporting stays out of the root

Future discovery, plan, and implementation artifacts should be routed into:
- `docs/issues/...` for active issue/phase history
- `docs/archive/...` for stale retained artifacts

not left at the repository root.

## 8. Phase 6C Readiness Plan

Phase 6C should start only after the Phase 6B system implementation creates the instruction, agent, prompt, template, and governance surfaces.

Recommended Phase 6C execution sequence:

1. Use the docs governance agent and impact prompt to map documentation targets.
2. Build or refresh the ownership matrix and documentation backlog.
3. Document product concepts and business rules.
4. Document frontend flows and UI behavior.
5. Document backend modules and business processing behavior.
6. Document API contracts.
7. Document data model and identity mapping.
8. Document architecture and write ADRs where needed.
9. Refresh operations docs and runbooks.
10. Run a final docs completeness pass using the governance agent.

Recommended Phase 6C documentation targets include:
- product concepts
- business rules
- recurrence logic
- task lifecycle
- frontend behavior
- backend behavior
- API contracts
- data model
- architecture
- operations

The key readiness judgment is:
- the repo is structurally ready for Phase 6B implementation now
- once Phase 6B implementation lands, Phase 6C can begin immediately

## 9. Risks and Safeguards

### Risk: too much logic stays in one giant Copilot instruction file

Safeguard:
- keep `.github/copilot-instructions.md` short and stable
- move domain-specific writing guidance into `.github/instructions/...`

### Risk: agents overlap and duplicate responsibilities

Safeguard:
- define each agent by docs domain, not by generic “write docs” scope
- add a governance agent that routes work rather than duplicating domain agents

### Risk: product/business docs get collapsed into backend or API docs

Safeguard:
- explicitly separate product, backend, and API ownership in the ownership matrix and templates

### Risk: frontend docs get under-served because backend artifacts are easier to inspect

Safeguard:
- include dedicated frontend instructions, prompts, templates, and an explicit frontend docs agent

### Risk: documentation freshness still depends on memory

Safeguard:
- add PR template doc-impact checks
- add docs-update checklist and change-impact matrix

### Risk: old `.agent` workflow concepts confuse the new GitHub-native system

Safeguard:
- treat `.github/agents/...` as the source of truth for the new documentation system
- avoid reusing the generic `.agent/workflows/create_todo_app.md` as a foundation

## 10. Recommendation for the Phase 6B Implementation Prompt

The Phase 6B implementation prompt should instruct the implementation pass to:
- revise `.github/copilot-instructions.md` into a lean always-on repo instruction layer
- create `.github/instructions/...` files for frontend, backend, API, product, architecture, data-model, operations, and docs governance
- create `.github/agents/...` files for the recommended documentation agents
- create `.github/prompts/...` files for reusable documentation tasks
- create actual templates and checklist files under `docs/templates/`
- create governance support files such as `.github/pull_request_template.md` and the documentation ownership matrix
- avoid writing the full project documentation bodies yet
- avoid broad unrelated repo refactors
- make the system practical for direct use in Phase 6C

The implementation prompt should also require the implementation pass to state clearly:
- which instruction files were created
- which custom agents were created and what domain each owns
- which reusable prompts were created
- which templates/checklists were created
- what PR or issue workflow support was added
- how the ownership matrix routes frontend, backend, API, product, architecture, data-model, and operations updates
