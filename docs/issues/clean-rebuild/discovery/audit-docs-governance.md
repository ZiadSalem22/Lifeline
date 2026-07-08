# Lifeline OLD repo — Docs & Governance Audit

## 1. docs/ tree (13 sections, ~100 canonical + ~130 issue-history files)

**Universal pattern:** nearly every canonical doc opens with `## Purpose` then `## Canonical sources used for this document` containing relative markdown links into `../../backend/src/...`, `../../client/src/...`, `../../services/lifeline-mcp/...`. **All of these links break after the backend/→codebase/ swap** — the final docs rewrite must regenerate every "Canonical sources" block.

`docs/README.md` — section index + report-hygiene rules (root is not a report drop-zone; artifact routing `docs/issues/<initiative>/<step>/<artifact-class>/`). Accurate.

### docs/api/ (canonical, refreshed through MCP step-09, 2026-03-11 — accurate to old code, all source links will break)
| Doc | One line | Status |
|---|---|---|
| README.md | index of 9 API docs; "route code/middleware/validators are source of truth ahead of swagger.json" | accurate |
| public-and-health-endpoints.md | `GET /api/public/info`, `GET /api/health/db`, `GET /api/health/db/schema` | accurate |
| auth-profile-and-settings-endpoints.md | `GET /api/me`, `POST /api/profile`, `POST /api/settings`, `GET/POST /api/mcp-api-keys` | accurate |
| todo-endpoints.md | full `/api/todos` group incl. search, batch ops, task-number lookup, complete, archive, delete | accurate |
| tag-endpoints.md | `/api/tags` GET/POST/PATCH/DELETE incl. default-tag fallback branch caveats | accurate |
| stats-endpoints.md | `GET /api/stats` | accurate |
| export-import-endpoints.md | `GET /api/export` (JSON/CSV), `POST /api/import` (merge/replace) | accurate |
| internal-mcp-task-endpoints.md | internal backend endpoints consumed by MCP service (dual auth: `requireInternalServiceAuth()` + `requireInternalMcpPrincipal()`, `req.mcpPrincipal.userId`) | accurate |
| mcp-server-endpoints-and-auth.md | public MCP HTTP surface, `GET /health`, OAuth metadata endpoints; sources under `services/lifeline-mcp/src/` | accurate |
| validation-auth-and-error-behavior.md | global `/api` chain `checkJwt` → `attachCurrentUser`, Joi validation, OAuth errors, disabled notification endpoints | accurate |

### docs/architecture/
| Doc | One line | Status |
|---|---|---|
| README.md | index (3 docs) | accurate |
| system-overview.md | four structural layers: React/Vite `client/`, Express `backend/`, MCP service, Postgres | accurate for old repo; layer/paths stale post-swap |
| runtime-topology.md | local/compose/production topology; nginx confs `deploy/nginx/lifeline.a2z-us.com.conf` + `mcp.lifeline.a2z-us.com.conf`, `apply-release.sh`, VPS | accurate |
| frontend-backend-data-boundaries.md | frontend vs backend vs persistence ownership incl. guest-mode localStorage boundary | accurate |

### docs/backend/ (8 docs + README — all describe the JS Express implementation)
| Doc | One line | Status |
|---|---|---|
| runtime-composition.md | single entry point `backend/src/index.js`, TypeORM data-source, repo wiring, swagger | accurate |
| auth-user-attachment-and-rbac.md | `checkJwt`/`attachCurrentUser`/`roles.js` chain on `/api` prefix | accurate |
| mcp-api-key-management.md | self-serve `/api/mcp-api-keys` lifecycle, use-cases under `application/mcpApiKeys/` | accurate |
| mcp-authentication-and-principal-resolution.md | dual auth (API key + Auth0 OAuth) terminating at lifeline-mcp, normalized principal | accurate |
| todo-services-and-use-cases.md | CreateTodo/ListTodos/UpdateTodo/ToggleTodo/DeleteTodo/CompleteRecurringTodo/RecurrenceService | accurate |
| tag-search-stats-and-data-transfer-services.md | TagUseCases (CreateTag/ListTags/DeleteTag/UpdateTag), SearchTodos, GetStatistics, NotificationService(disabled) | accurate |
| subtask-operations.md | subtask identity contract (JSONB in `todos.subtasks`), SubtaskContract.js + SubtaskOperations.js | accurate |
| similarity-search.md | pg_trgm trigram search, GiST index on `todos.title`, migration `008_enable_pg_trgm_similarity.sql` | accurate |

### docs/data-model/ (7 docs + README)
| Doc | One line | Status |
|---|---|---|
| overview-and-current-source-of-truth.md | source of truth = TypeORM EntitySchemas in `backend/src/infra/db/entities/` + migration `1764826105992-initial_migration.js` | accurate for old repo; **the "TypeORM entities are truth" claim dies in rebuild** |
| users-profiles-and-settings.md | `users`, `user_profiles`, `user_settings` tables + Auth0 subject mapping | accurate |
| todos-tags-and-relationships.md | `todos`, `tags`, todo↔tag join, ownership rules, `defaultTags.js` seeding | accurate |
| recurrence-subtasks-and-task-numbering.md | `recurrence` jsonb column, embedded subtasks, per-user task numbering | accurate |
| subtask-contract.md | JSONB shape evolution: legacy `{id,title,isCompleted}` → identity contract; backfill migration 007 | accurate |
| mcp-api-keys.md | `mcp_api_keys` table, FK `user_id -> users.id`, migration `1772862400000-add-mcp-api-keys.js` | accurate |
| migrations-and-historical-schema-context.md | which migrations are live vs historical (archived TypeORM, raw SQL `backend/migrations/`, `backend/db/mssql-init.sql`) | accurate; MSSQL/SQLite context historical by design |

### docs/features/, docs/product/, docs/frontend/
- `features/FEATURES.md` — canonical implementation-verified feature inventory ("Feature Canon"). Accurate.
- `product/` (7 docs + README): core-product-concepts, identity-and-access-modes (guest vs authenticated), task-lifecycle, recurrence-behavior, onboarding-profile-and-preferences, subtask-behavior (max 50 subtasks, 500-char titles), planning-queries (MCP window tokens `this_week`/`next_week`/`this_month`/`next_month`, week-start preference). All accurate; product-level content is the most reusable for rebuild.
- `frontend/` (8 docs + README): routes-and-pages (canonical route inventory), dashboard-and-day-routing (`/day/:day`), layout-navigation-and-responsive-behavior, advanced-search-flow (preview vs live, batch ops), profile-and-onboarding-screens, settings-statistics-and-data-management, recurrence-ui (overlay modal), ui-wireframe.md (**self-declared non-canonical** "companion design-support material"). All accurate to old JSX client; source links break post-swap.

### docs/operations/ (7 docs + README)
| Doc | One line | Status |
|---|---|---|
| QUICK_START.md | `cd backend && npm run dev` / `cd client && npm run dev` split workflow | accurate old-layout; **stale post-swap** |
| DEPLOY_BRANCH_CD.md | deploy-branch CD model: push to `deploy` → `.github/workflows/deploy-production.yml` | accurate; survives swap conceptually |
| local-development-and-runtime-setup.md | local dev + compose paths; sources `backend/package.json`, `client/vite.config.js` | accurate old-layout |
| production-runtime-and-rollback.md | VPS runtime shape, `/opt/lifeline`, rollback via previous release compose | accurate |
| deployment-verification-and-smoke-checks.md | smoke scripts `backend/scripts/verify-*.js`, `client/scripts/ui-smoke.js` | accurate old-layout |
| lifeline-mcp-first-cutover-runbook.md | first MCP release + first-client validation runbook | accurate, historical-operator |
| lifeline-mcp-auth0-oauth-runbook.md | enable/validate Auth0 OAuth on public MCP | accurate, historical-operator |

### docs/adr/ (4 ADRs, all Accepted — decisions carry into rebuild)
- 0001 (2026-03-07) separate lifeline-mcp runtime boundary — **rebuild plan (embedded MCP module) supersedes this; new ADR needed**
- 0002 (2026-03-08) dual-auth MCP with Auth0 OAuth at MCP edge
- 0003 (2026-03-11) subtask identity contract
- 0004 (2026-03-11) archive-first lifecycle for MCP task removal (restore path; mutation guards on archived tasks)

### docs/reference/
- DOCUMENTATION_OWNERSHIP_MATRIX.md — change-surface → docs-owner table. Active/accurate.
- REPORT_OUTPUT_POLICY.md — root-is-not-a-drop-zone policy. Active/accurate.
- ENGINEERING_SKILLS/AGENTS/TEAMS/WORKFLOWS.md — describe the 4-layer `.github/` governance system (skills→agents→teams→workflows). Accurate to `.github/` contents.
- PHASE6C_SOURCE_OF_TRUTH_MAP.md, PHASE6C_DOCUMENTATION_BACKLOG.md — historical Phase-6C planning artifacts.
- TESTING_CHECKLIST.md — **explicitly marked "Historical reference only"** (SQLite-era, port 5174).
- cosmic-background.html — retained HTML asset, dead weight.

### docs/templates/ (active, reuse for rebuild docs)
adr, api-endpoint, architecture-overview, backend-module, data-model-entity, feature-doc, frontend-component, frontend-page-or-flow, operations-runbook, product-behavior `.template.md` + `docs-update-checklist.md` + `change-impact-matrix.md`.

### docs/archive/ — explicitly stale by design
DOCUMENTATION_INDEX, FILES_MODIFIED_CREATED, IMPLEMENTATION_SUMMARY, INTEGRATION_COMPLETE, LEGACY_QUICK_START, README_INTEGRATION, START_HERE, STATUS_REPORT. Keep as-is.

## 2. .github/ hardcoded paths/claims that break at backend/→codebase/ swap

Layout: `copilot-instructions.md` (always-on) + `instructions/` (14) + `skills/` (7+README) + `agents/` (20+README) + `teams/` (7+README) + `workflows-governance/` (7+README) + `prompts/` (16) + `pull_request_template.md` + `ISSUE_TEMPLATE/` (2) + `workflows/deploy-production.yml` (only real CI workflow).

Breaking claims (file:line — quote):
- `copilot-instructions.md:8-9` — "backend code in \`backend/\`" / "frontend code in \`client/\`"; `:11` "deployment automation in \`.github/workflows/\` and \`deploy/\`"
- `instructions/api-docs.instructions.md:7-10` — `backend/src/routes/`, `backend/src/controllers/`, `backend/src/validators/`, `backend/swagger.json`
- `instructions/backend-docs.instructions.md:7-13` — `backend/src/application/`, `domain/`, `infrastructure/`, `infra/`, `middleware/`, `routes/`, `controllers/`
- `instructions/frontend-docs.instructions.md:7-13` — `client/src/app|pages|components|hooks|providers|context|styles/`
- `instructions/architecture-docs.instructions.md:7` — "system structure across \`client/\`, \`backend/\`, deployment files"
- `instructions/data-model-docs.instructions.md:8-9` — "migrations under \`backend/migrations/\` and \`backend/src/migrations/\`"; "\`database/\` and \`db/\` artifacts when still relevant"
- `instructions/data-model-governance.instructions.md:16` — "TypeORM EntitySchema definitions in \`backend/src/infra/db/entities/\` are the primary schema source of truth"; `:17` `backend/src/domain/`; `:23` "All entities live in \`backend/src/infra/db/entities/\` using the \`EntitySchema\` pattern"; `:46-47` TypeORM JS migrations `backend/src/migrations/`, raw SQL `backend/migrations/`; `:104` "\`database/phase3/\` and \`backend/database/phase3/\` contain phase-specific historical artifacts"; `:122` "default tags loaded via \`infra/db/defaultTags.js\`"; `:143` "Creating entities outside \`infra/db/entities/\`"
- `instructions/backend-engineering-governance.instructions.md:3` — "backend code in the Lifeline \`backend/\` directory"; `:112` "infra/db/ → Data-source config and entity definitions"
- `instructions/frontend-engineering-governance.instructions.md:3` — "\`client/\` directory"; `:31` providers in `client/src/providers/`; `:37` hooks in `client/src/hooks/`; `:134-144` full `client/src/*` layout map
- `instructions/code-quality-governance.instructions.md:27` — "check \`client/src/utils/\` and \`backend/src/utils/\`"; `:62-63` "\`npm run lint\` (ESLint) from \`backend/\` / \`client/\`"
- `instructions/operations-docs.instructions.md:8-11` — `deploy/`, `compose.yaml`, `compose.production.yaml`, `Dockerfile`
- `skills/backend-engineering-governance.md:45-52` — `backend/src/routes|controllers|application|domain|infrastructure|infra/db|middleware|validators/`
- `skills/frontend-engineering-governance.md:5,43-48` — `client/` + `client/src/components|pages|hooks|providers|context|styles/`
- `skills/data-model-governance.md:43-50` — entity/migration/data-source paths; `:74-79` entity filenames `UserEntity.js` … `TodoTagEntity.js`; `:82-83` "TypeORM JS: \`backend/src/migrations/\` (timestamp-based)" / "Raw SQL: \`backend/migrations/\` (sequential numbering, gap at 003)"
- `skills/code-quality-governance.md:42-43,113-114`; `skills/refactor-governance.md:50-52`; `skills/documentation-governance.md:50-51` — `client/src/`, `backend/src/`, `backend/src/infra/db/entities/`
- `agents/backend-builder-agent.md:5,33`; `agents/frontend-builder-agent.md:5,34`; `agents/code-quality-builder-agent.md:33,84-85`; `agents/refactor-builder-agent.md:34`; `agents/data-model-builder-agent.md:33-34,54,69`; `agents/data-model-review-agent.md:32-33,130` (example path `backend/src/migrations/1234567890-AddStatusColumn.js`); `agents/documentation-governance-agent.md:44-45`; `agents/code-quality-review-agent.md:133` (example `backend/src/application/todo/GetTodosUseCase.js`); `agents/refactor-review-agent.md:130` (example `client/src/components/TodoList.jsx`)
- `prompts/backend-review.prompt.md:10-11`, `prompts/frontend-review.prompt.md:10-11`, `prompts/code-quality-review.prompt.md:11`, `prompts/schema-change-review.prompt.md:11` — changed files in `backend/src/`/`client/src/`, lint from `backend/`/`client/`
- `workflows-governance/backend-engineering-governance-workflow.md:20,42`; `frontend...:20,40`; `code-quality...:37-38`; `data-model...:70` — same path/lint claims
- `workflows/deploy-production.yml` — no `backend/`/`client/` refs (ships repo-root release archive; `RELEASES_ROOT=/opt/lifeline/releases`, `SHARED_ENV_FILE=/opt/lifeline/shared/.env.production`); swap-sensitive indirectly via `Dockerfile:12-45` (`COPY client/...`, `COPY backend/...`) and `compose.production.yaml:78` (`context: ./services/lifeline-mcp`)

Also **stack claims** that break: TypeORM/EntitySchema-as-truth, ESLint-only lint gates, `.js`/`.jsx` example filenames, "JS migrations" — all assume the JS stack.

## 3. docs/issues/ conventions

- Canonical routing rule (stated in `docs/README.md`, `docs/issues/README.md`, `copilot-instructions.md`, `reference/REPORT_OUTPUT_POLICY.md`): `docs/issues/<initiative>/<step>/<artifact-class>/<doc>.md` with artifact classes **discovery/ planning/ implementation/ results/ final/**. Fallback only: `docs/issues/report-history/unscoped/`.
- Initiatives present: `db-migration-prep`, `deployment-prep`, `governance`, `mcp-server`, `production-incidents`, `repo-history`, `repo-hygiene`, `report-history`, and **`clean-rebuild/planning/` — exists and is EMPTY (created 2026-07-06; intended landing spot for the rebuild's planning docs)**.
- Two naming generations: older = `phase-N/PHASEN_PLAN.md` SCREAMING_SNAKE directly in phase dir (no artifact-class subdir, e.g. `db-migration-prep/phase-1/PHASE1_PLAN.md`); newer = `step-0N-<kebab-name>/<artifact-class>/<kebab or date-prefixed>.md` (e.g. `mcp-server/step-07-oauth-auth0-support/planning/2026-03-08-plan.md`). New docs should follow the newer form.
- Initiative-level `README.md` index optional (deployment-prep and governance have one; mcp-server does not).
- Internal doc shapes: **plans** = numbered H2s (`## 1. Objective`, `## 2. Locked Inputs`, `## N. Workstreams`, execution order, recommendation); **discovery reports** = `## Scope`, `## Governance sources actively used`, `## Repo truth found` (numbered H3 findings), `## Discovery conclusion`; **closeouts/final** = `## Initiative / Status / Date / Summary / Phases completed / Key capabilities / Test results / Documentation delivered / Next steps / Artifacts`; **implementation reports** = executive summary + per-workstream sections + files-produced + remaining risks + completion status.

## 4. README.md structure (root, 20KB / 425 lines — needs full rewrite)

Sections in order: stray `—` separator lines 1–3 → `# Lifeline – Modern Full-Stack Task Manager` → 🚀 Overview → 🌟 Features → 🔥 Recent Major Updates (2025-11) → 🏗️ Architecture (backend hexagonal layout) → 🔄 Data Flow → 🎨 UI/UX Highlights → 📂 Key Files & Directories → 🛠️ Developer Workflows (+ subpath/basename deployment, hardened guest mode, Production Deploy Branch) → 📖 Documentation (links to docs/) → 📄 License → duplicate "Architecture & Implementation Notes" → Run locally → Tests → Backend Test Coverage (2025-11) → Continuous Integration → Deployment (Azure) → GitHub Pages deploy → CV/Interview talking points → LICENSE (duplicated) → Contact → 🧩 Additional Technical Highlights.

Stale content: references workflows `ci.yml` (line 292), `azure-deploy-frontend.yml`/`azure-deploy-backend.yml` (line 301), `deploy-frontend.yml` (line 370) — **none exist; only `.github/workflows/deploy-production.yml` exists**; "SQLite by default in development" (line 63) contradicts canonical Postgres/TypeORM docs; whole Azure section (lines 296–364) and GitHub Pages section are dead; duplicated License/architecture sections; hardcoded `backend/`, `client/` paths throughout (lines 55, 100–111, 214–237, 292, 308–309, 408–413). Accurate parts: deploy-branch CD section (160–170), docs links (174–182), guest-mode 401 JSON `{"status":"error","message":"Please log in to use this feature. Guest mode works only locally."}` (line 155).

## 5. Root inventory — swap-deletion candidates confirmed

| Path | What it is | Verdict |
|---|---|---|
| `backend/` | old Express JS backend: `src/`, `migrations/` (raw SQL 000–008, gap at 003), `src/migrations/` (TypeORM), `test/`, `swagger.json`, `scripts/`, plus junk: `todos_v4.db` (SQLite), `logs/`, `migration_log.txt`, `migration-artifacts/runs/` (3 runs), `database/phase3/runs/` (empty), `db/mssql-init.sql` | replaced by `codebase/` |
| `client/` | old React/Vite JSX frontend: `src/`, `dist/` build output, `tests/`, `dev.crt`/`dev.key` local TLS, `staticwebapp.config.json`, `swa-cli.config.json` (Azure SWA-era) | replaced |
| `client-next/` | **DEAD** — only `.env.example`, `.next/` build output, `node_modules/`; no package.json, no src. Abandoned Next.js experiment | delete |
| `services/` | `services/lifeline-mcp/` standalone MCP HTTP service (Express + `@modelcontextprotocol` + `@hono` deps; Dockerfile, src, test, scripts; committed-ish `logs/combined.log`, `logs/error.log`) | replaced by embedded MCP module |
| `db/` | single file `dev.sqlite` (local dev artifact) | delete |
| `database/` | `README.md` ("reserved for intentional repo-level database assets") + `phase3/runs/2026-03-06T11-29-47-387Z/` MSSQL→Postgres migration snapshots: `extract-manifest.json`, `import-report.json`, `mssql-snapshot.json`, `transform-report.json`, `transformed-snapshot.json`, `validation-report.json` | historical migration evidence; delete or archive |
| `tmp_deploy_run_22798089623.log`, `tmp_deploy_run_22798152528.log`, `tmp_deploy_run_22798181671.log`, `tmp_deploy_run_22798181671_attempt2.log`, `tmp_deploy_run_22798291109.log`, `tmp_deploy_run_22798318492.log`, `tmp_step06_deploy_run_22807666834.log` | 7 GitHub Actions deploy-run logs (2026-03-07), root clutter violating the repo's own REPORT_OUTPUT_POLICY | delete |
| `.venv/` | Python virtualenv at repo root (2026-03-06) — unrelated junk | delete |
| `.claude/` | empty dir | delete |
| `.agent/workflows/create_todo_app.md` | original scaffold workflow ("Scaffolds a full-stack Node.js and React Todo application") — historical origin artifact | delete or archive |
| `.config/auth0` | local Auth0 CLI config dir | delete (local-only) |
| Rewrite-not-delete at swap | `Dockerfile` (multi-stage, `COPY client/`+`COPY backend/` lines 12–45), `compose.yaml` (`context: .`), `compose.production.yaml` (line 78 `context: ./services/lifeline-mcp`), `compose.env.example`, `compose.production.env.example`, `.dockerignore`, `deploy/nginx/*.conf` + `deploy/scripts/apply-release.sh` (live prod infra: releases at `/opt/lifeline/releases`, health-gates MCP→backend path), `.github/workflows/deploy-production.yml`, `.gitignore`, `.gitattributes`, `README.md`, `LICENSE` (keep) | keep+update |
