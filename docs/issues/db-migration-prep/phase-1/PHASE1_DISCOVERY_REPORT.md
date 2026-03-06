# Phase 1 Discovery Report

## 1. Executive Summary
Lifeline is a single product split into two main runtime parts inside one repository: a React/Vite frontend in [client](client) and a Node.js/Express backend in [backend](backend). The repository also contains a large amount of non-runtime material: checked-in build output, old/stale docs, scratch artifacts, legacy SQLite files, a temporary deployment folder, and an abandoned-looking [frontend_old](frontend_old) directory.

The strongest evidence for the current intended backend runtime is MSSQL via TypeORM, using environment-driven connection settings from [backend/.env.example](backend/.env.example), [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js), and [backend/data-source-migrations.js](backend/data-source-migrations.js). However, the backend startup path in [backend/src/index.js](backend/src/index.js) explicitly falls back to a local SQLite database at [db/dev.sqlite](db/dev.sqlite) when MSSQL initialization fails. That means actual runtime can diverge between environments.

The strongest evidence for the current intended frontend runtime is a standalone Vite app with Auth0 and an external API base URL from `VITE_API_BASE_URL`. The frontend is not currently served by the backend. Current deployment clues point to a separate frontend hosting model, specifically Azure Static Web Apps-style config in [client/staticwebapp.config.json](client/staticwebapp.config.json) plus a separate Azure App Service deployment workflow for the backend in [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml).

A major caution for planning: the main frontend entry imports [client/src/app/App.jsx](client/src/app/App.jsx), and that file currently has compile errors according to workspace diagnostics. Also, repository documentation is inconsistent: some docs still describe SQLite and older local-only behavior, while current code is oriented around MSSQL plus Azure-hosted frontend/backend separation.

## 2. Repository Structure
- Top-level layout
  - Main application folders: [client](client), [backend](backend)
  - Extra/non-runtime folders: [frontend_old](frontend_old), [backend-deploy-temp](backend-deploy-temp), [db](db), [ISSUES](ISSUES), [.github](.github), [.agent](.agent)
  - Many top-level docs and artifacts: [README.md](README.md), [START_HERE.md](START_HERE.md), [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md), [STATUS_REPORT.md](STATUS_REPORT.md), multiple `.diff` files, scratch `.txt` files, and helper/scratch scripts like [patch_app.py](patch_app.py) and [repro_crash.js](repro_crash.js)
- Key directories
  - Frontend source: [client/src](client/src)
  - Frontend build output: [client/dist](client/dist)
  - Backend source: [backend/src](backend/src)
  - Backend migrations: [backend/migrations](backend/migrations), [backend/src/migrations](backend/src/migrations)
  - Backend DB/bootstrap SQL: [backend/db](backend/db)
  - Local SQLite artifacts: [db](db), [backend/todos_v4.db](backend/todos_v4.db)
  - Deployment/config: [.github/workflows](.github/workflows), [client/staticwebapp.config.json](client/staticwebapp.config.json), [client/swa-cli.config.json](client/swa-cli.config.json), [backend/.deployment](backend/.deployment)
- Key files
  - Frontend package/scripts: [client/package.json](client/package.json)
  - Frontend entry: [client/src/app/main.jsx](client/src/app/main.jsx)
  - Frontend app root: [client/src/app/App.jsx](client/src/app/App.jsx)
  - Backend package/scripts: [backend/package.json](backend/package.json)
  - Backend entry: [backend/src/index.js](backend/src/index.js)
  - Backend MSSQL datasource: [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js)
  - TypeORM migrations datasource: [backend/data-source-migrations.js](backend/data-source-migrations.js)
- Observations
  - This is not a multi-service monorepo in the sense of many active apps. It appears to be one app with one frontend and one backend.
  - There are multiple stale/legacy structures that look disconnected from current runtime, including [frontend_old](frontend_old), [backend/src/controllers](backend/src/controllers), [backend/src/routes](backend/src/routes), and many top-level integration writeups.
  - Checked-in `node_modules` and checked-in frontend build output indicate the repo contains local/deployment artifacts in addition to source.

## 3. Frontend Discovery
- Framework/tooling
  - React 19 + Vite 7 in [client/package.json](client/package.json)
  - Routing via `react-router-dom` and Auth0 via `@auth0/auth0-react`
  - Test tooling via Vitest in [client/package.json](client/package.json)
- Entry points
  - HTML entry: [client/index.html](client/index.html)
  - React bootstrap: [client/src/app/main.jsx](client/src/app/main.jsx)
  - Main app import target: [client/src/app/App.jsx](client/src/app/App.jsx)
- Commands
  - Dev: `npm run dev` from [client/package.json](client/package.json)
  - Build: `npm run build`
  - Preview: `npm run preview`
  - Test: `npm run test` / `npm run test:run`
  - Post-build copies Static Web Apps config into `dist` via [client/scripts/copy-swa-config.js](client/scripts/copy-swa-config.js)
- Env/config
  - Example envs in [client/.env.example](client/.env.example)
  - Actual env files present: [client/.env](client/.env), [client/.env.local](client/.env.local)
  - Frontend code expects:
    - `VITE_API_BASE_URL`
    - `VITE_AUTH0_DOMAIN`
    - `VITE_AUTH0_CLIENT_ID`
    - `VITE_AUTH0_AUDIENCE`
    - `VITE_AUTH0_SCOPE`
  - `VITE_API_BASE_URL` is treated as mandatory in [client/src/utils/api.js](client/src/utils/api.js), [client/src/hooks/useApi.js](client/src/hooks/useApi.js), and [client/src/utils/apiClient.js](client/src/utils/apiClient.js)
- Runtime observations
  - The frontend is built separately from the backend; no evidence shows backend serving `client/dist`.
  - Dev server config in [client/vite.config.js](client/vite.config.js) proxies `/api` to an Azure backend host, not local backend by default.
  - Static Web Apps-style routing exists in [client/staticwebapp.config.json](client/staticwebapp.config.json), also rewriting `/api/*` to an external backend.
  - Auth0 is wired at bootstrap in [client/src/app/main.jsx](client/src/app/main.jsx); this is token-based auth, not cookie/session-based auth.
  - Guest/local-only behavior exists through [client/src/utils/guestApi.js](client/src/utils/guestApi.js) and [client/src/hooks/useGuestStorage.js](client/src/hooks/useGuestStorage.js), with `localStorage` used for guest todos/tags, theme/font, and Auth0 token cache.
  - Download/export behavior is browser-side only; files are generated as blobs and downloaded client-side in [client/src/utils/api.js](client/src/utils/api.js) and [client/src/components/settings/ExportDataModal.jsx](client/src/components/settings/ExportDataModal.jsx).
  - Current workspace diagnostics report compile errors in [client/src/app/App.jsx](client/src/app/App.jsx). That means the nominal frontend entrypoint is presently broken in the checked-out state.
  - Additional page-based structure exists under [client/src/pages](client/src/pages), but direct usage could not be confirmed as the primary runtime path because `App.jsx` is the imported root and is currently invalid.
- Unknowns / uncertainties
  - Uncertain whether [client/src/app/App.jsx](client/src/app/App.jsx) is the intended current source of truth or whether a partial refactor toward page-based composition under [client/src/pages](client/src/pages) was underway.
  - Uncertain whether [client/dist](client/dist) reflects the current source tree or is an older successful build artifact.
  - Uncertain whether local development is expected to use local backend or the currently hard-coded Azure backend proxy/settings.

## 4. Backend Discovery
- Framework/tooling
  - Express 5 backend in [backend/package.json](backend/package.json)
  - TypeORM for primary DB access, `mssql` driver for SQL Server, `sqlite3` retained for fallback/legacy paths
  - Auth via `express-oauth2-jwt-bearer`
  - Tests via Jest + Supertest
- Entry points
  - Main entry: [backend/src/index.js](backend/src/index.js)
  - Package main: [backend/package.json](backend/package.json)
- Commands
  - Start: `npm start`
  - Dev: `npm run dev`
  - Test: `npm test`
  - Migration scripts: `migration:generate`, `migration:run`, `migration:revert`
  - Admin/reset scripts: `promote-admin`, `reset-db`, `soft-reset-db`
- Env/config
  - Actual env files present: [backend/.env](backend/.env), [backend/.env.local](backend/.env.local), [backend/.env.local.bak](backend/.env.local.bak)
  - Example env in [backend/.env.example](backend/.env.example)
  - Startup in [backend/src/index.js](backend/src/index.js) loads `.env.local` in development and `.env` otherwise
  - Backend code uses env vars for:
    - `PORT`, `NODE_ENV`
    - `MSSQL_SERVER`, `MSSQL_PORT`, `MSSQL_INSTANCE`, `MSSQL_USERNAME`, `MSSQL_PASSWORD`, `MSSQL_DATABASE`
    - `FRONTEND_URL`, `WEB_CLIENT_URL`, `CORS_ORIGIN`, `FRONTEND_ORIGIN`
    - `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_AUDIENCE_ALT`, `AUTH0_DEBUG`, `AUTH_DISABLED`
    - `LOG_LEVEL`
- API/runtime observations
  - API routes are defined inline in [backend/src/index.js](backend/src/index.js), not primarily through [backend/src/routes](backend/src/routes).
  - Current API shape is `/api/...` rather than the older `/api/v1/...` style shown in [backend/src/routes/todoRoutes.js](backend/src/routes/todoRoutes.js) and [backend/src/routes/tagRoutes.js](backend/src/routes/tagRoutes.js).
  - Auth is bearer-token/JWT based via Auth0 in [backend/src/middleware/auth0.js](backend/src/middleware/auth0.js).
  - Current-user hydration is done in [backend/src/middleware/attachCurrentUser.js](backend/src/middleware/attachCurrentUser.js), which upserts/loads user/profile/settings from TypeORM repositories.
  - No evidence of Express sessions, Redis sessions, or cookie-based session storage was found.
  - Swagger docs are served from backend endpoints through [backend/src/swagger.js](backend/src/swagger.js).
  - The backend does not appear to serve the frontend bundle in production. The only static serving found is Swagger UI assets in [backend/src/swagger.js](backend/src/swagger.js).
- Background processing observations
  - No cron library, worker queue, or standalone background worker was found.
  - Notification behavior exists, but it is not a server scheduler/daemon. [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js) stores and queries notification records only when SQLite is available.
  - The frontend appears to poll `/api/notifications/pending`; backend-side notifications are effectively disabled when running MSSQL-only because `NotificationService` becomes a no-op without SQLite.
- Unknowns / uncertainties
  - Uncertain whether inline route definitions in [backend/src/index.js](backend/src/index.js) are intentionally permanent or a temporary consolidation.
  - Uncertain whether the older controller/router abstraction under [backend/src/controllers](backend/src/controllers) and [backend/src/routes](backend/src/routes) is fully abandoned or just not yet reconnected.
  - Uncertain whether notifications are still considered a supported feature in MSSQL-backed environments, because current implementation degrades to empty/no-op behavior there.

## 5. Database Discovery
- Providers found
  - SQL Server / MSSQL: primary provider in [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js), [backend/data-source-migrations.js](backend/data-source-migrations.js), [backend/.env.example](backend/.env.example), [backend/db/mssql-init.sql](backend/db/mssql-init.sql), and [backend/migrations](backend/migrations)
  - SQLite: fallback/legacy provider in [backend/src/index.js](backend/src/index.js), [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js), [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js), [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js), [db/dev.sqlite](db/dev.sqlite), and [backend/todos_v4.db](backend/todos_v4.db)
- Current likely source of truth
  - Current intended production source of truth appears to be MSSQL via TypeORM.
  - Evidence: backend startup tries TypeORM first; env examples are MSSQL-focused; migrations datasource is MSSQL-only; deployment docs and Azure backend references align with SQL Server/Azure-style settings.
  - However, actual local runtime may silently switch to SQLite if MSSQL initialization fails.
- SQLite findings
  - SQLite fallback DB path is explicitly created at [db/dev.sqlite](db/dev.sqlite) from [backend/src/index.js](backend/src/index.js).
  - Notification persistence depends on SQLite and creates a `notifications` table only there in [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js).
  - Legacy SQLite repository implementations remain large and test-covered.
  - [backend/todos_v4.db](backend/todos_v4.db) is present but current startup path does not point to it.
  - [backend/src/config/index.js](backend/src/config/index.js) still exposes `DB_PATH` defaulting to `./data/todos_v4.db`, but that config is only consumed by [backend/src/config/logger.js](backend/src/config/logger.js), not by the actual startup database selection path. This looks stale/inconsistent.
- SQL Server findings
  - TypeORM datasource is hard-coded for `type: 'mssql'` in [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js).
  - Raw SQL in code and migrations includes clear SQL Server specifics: `NVARCHAR`, `DATETIME`, `BIT`, `UNIQUEIDENTIFIER`, `GETDATE()`, `NEWID()`, `NEWSEQUENTIALID()`, `ISNULL`, `sys.indexes`, `INFORMATION_SCHEMA`, and `dbo.` table naming.
  - Example provider-specific SQL files: [backend/db/mssql-init.sql](backend/db/mssql-init.sql), [backend/migrations/001_initial_migration.sql](backend/migrations/001_initial_migration.sql), [backend/src/migrations/1764826105992-initial_migration.js](backend/src/migrations/1764826105992-initial_migration.js)
- ORM/migrations/raw SQL findings
  - ORM: TypeORM is used for MSSQL repositories and entity mappings.
  - Entities exist in [backend/src/infra/db/entities](backend/src/infra/db/entities).
  - TypeORM repository implementations exist for todos, tags, users, profiles, and settings.
  - Raw SQL is still used heavily even alongside TypeORM, especially for aggregates, admin/reset operations, health/schema inspection, and migrations.
  - Two migration systems exist:
    - Raw `.sql` files in [backend/migrations](backend/migrations)
    - TypeORM JS migrations in [backend/src/migrations](backend/src/migrations) plus archived older migrations in [backend/src/migrations/archived](backend/src/migrations/archived)
- PostgreSQL migration complexity indicators
  - High complexity indicators present:
    - SQL Server-specific data types and functions throughout migrations and raw queries
    - SQL Server parameter placeholder style (`@0`) used in raw query calls
    - Mixed ORM + raw SQL approach means migration cannot rely on ORM abstraction alone
    - Current notification/storage path still depends on SQLite behavior
    - Potential schema drift across raw SQL migrations, TypeORM migrations, fallback SQLite schema creation, and legacy docs
  - There is no evidence of current PostgreSQL support in code or config.
- Unknowns / uncertainties
  - Uncertain whether the live production schema currently matches the checked-in TypeORM entities, raw SQL migrations, or both.
  - Uncertain whether [backend/todos_v4.db](backend/todos_v4.db) contains any still-relevant historical data.
  - Uncertain whether some tests or scripts still assume SQLite-first behavior even though code intent shifted to MSSQL-first.

## 6. Storage and Filesystem Discovery
- Uploads/files/local persistence findings
  - No active upload pipeline or attachment storage implementation was found.
  - [backend/src/routes/attachmentRoutes.js](backend/src/routes/attachmentRoutes.js) exists but is empty.
  - [backend/scripts/inspect_attachments_schema.js](backend/scripts/inspect_attachments_schema.js) exists but is empty.
  - No backend code writes user-uploaded files to disk; filesystem writes found were limited to creating the SQLite DB directory/file and production log files.
  - Frontend guest mode persists app data in browser `localStorage` via [client/src/utils/guestApi.js](client/src/utils/guestApi.js) and [client/src/hooks/useGuestStorage.js](client/src/hooks/useGuestStorage.js).
  - Auth0 token cache is also stored in browser `localStorage` via [client/src/app/main.jsx](client/src/app/main.jsx).
- Generated artifacts
  - Frontend build output exists in [client/dist](client/dist)
  - Frontend zip artifact exists as [client/dist.zip](client/dist.zip)
  - Frontend smoke/debug artifacts exist in [client/scripts/ui-smoke-debug.html](client/scripts/ui-smoke-debug.html) and [client/scripts/ui-smoke-debug.png](client/scripts/ui-smoke-debug.png)
  - Backend runtime logs exist in [backend/logs](backend/logs)
  - Local SQLite files exist in [db/dev.sqlite](db/dev.sqlite) and [backend/todos_v4.db](backend/todos_v4.db)
- Unknowns / uncertainties
  - Uncertain whether [client/dist](client/dist) and [client/dist.zip](client/dist.zip) are intentionally versioned deployment artifacts or just leftovers from manual packaging.
  - Uncertain whether [backend/logs](backend/logs) should be treated as operational artifacts or temporary local logs only.

## 7. Documentation and Artifact Classification
### 7.1 Active / important docs
- [README.md](README.md) — important, but partially stale; still the broadest repo overview
- [client/README.md](client/README.md) — important for current frontend intent
- [backend/.env.example](backend/.env.example) and [client/.env.example](client/.env.example) — important configuration references
- [ISSUES/2025-11-routing.md](ISSUES/2025-11-routing.md) and [ISSUES/2025-11-fix-sidebar-drawer.md](ISSUES/2025-11-fix-sidebar-drawer.md) — likely relevant issue history for recent frontend behavior
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — important for repo conventions, but it still contains SQLite-era statements that no longer fully match code

### 7.2 Likely stale docs
- [START_HERE.md](START_HERE.md)
- [QUICK_START.md](QUICK_START.md)
- [README_INTEGRATION.md](README_INTEGRATION.md)
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- [INTEGRATION_COMPLETE.md](INTEGRATION_COMPLETE.md)
- [STATUS_REPORT.md](STATUS_REPORT.md)
- [FILES_MODIFIED_CREATED.md](FILES_MODIFIED_CREATED.md)
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)
- Reasons these look stale:
  - They heavily describe a SQLite-centered integration phase
  - Several claim feature completion and file counts that do not cleanly match current repo state
  - Some still reference old ports, old UI states, or old deployment assumptions
  - [README.md](README.md) references workflows that are not present in [.github/workflows](.github/workflows)

### 7.3 AI-generated or scratch artifacts
- Top-level patch/diff/scratch files:
  - [AdvancedSearch.diff](AdvancedSearch.diff)
  - [App.diff](App.diff)
  - [App_main.diff](App_main.diff)
  - [ExportImport.diff](ExportImport.diff)
  - [Settings.diff](Settings.diff)
  - [Statistics.diff](Statistics.diff)
  - [app_base.jsx](app_base.jsx)
  - [oldApp.txt](oldApp.txt)
  - [todo_list_draft.txt](todo_list_draft.txt)
  - [empty.md](empty.md)
  - [patch_app.py](patch_app.py)
  - [repro_crash.js](repro_crash.js)
  - [COMPLETION_CERTIFICATE.txt](COMPLETION_CERTIFICATE.txt)
- These appear to be generated notes, patch outputs, or debugging residue rather than runtime source-of-truth.

### 7.4 Duplicate/overlapping docs
- The following appear to cover overlapping feature-integration narratives:
  - [START_HERE.md](START_HERE.md)
  - [QUICK_START.md](QUICK_START.md)
  - [README_INTEGRATION.md](README_INTEGRATION.md)
  - [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
  - [INTEGRATION_COMPLETE.md](INTEGRATION_COMPLETE.md)
  - [STATUS_REPORT.md](STATUS_REPORT.md)
  - [FILES_MODIFIED_CREATED.md](FILES_MODIFIED_CREATED.md)
  - [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
  - [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)
- [README.md](README.md) also overlaps with portions of these files while contradicting some current repo facts.

## 8. Cleanup Candidate Classification
### 8.1 Safe cleanup candidates
These appear likely removable without affecting runtime behavior, based on repo evidence only.
- Checked-in frontend build artifacts
  - [client/dist](client/dist)
  - [client/dist.zip](client/dist.zip)
- Old frontend sandbox directory
  - [frontend_old](frontend_old)
- Top-level patch/scratch artifacts
  - [AdvancedSearch.diff](AdvancedSearch.diff)
  - [App.diff](App.diff)
  - [App_main.diff](App_main.diff)
  - [ExportImport.diff](ExportImport.diff)
  - [Settings.diff](Settings.diff)
  - [Statistics.diff](Statistics.diff)
  - [app_base.jsx](app_base.jsx)
  - [oldApp.txt](oldApp.txt)
  - [todo_list_draft.txt](todo_list_draft.txt)
  - [empty.md](empty.md)
  - [patch_app.py](patch_app.py)
  - [repro_crash.js](repro_crash.js)
  - [COMPLETION_CERTIFICATE.txt](COMPLETION_CERTIFICATE.txt)
- Frontend smoke/debug artifacts
  - [client/scripts/ui-smoke-debug.html](client/scripts/ui-smoke-debug.html)
  - [client/scripts/ui-smoke-debug.png](client/scripts/ui-smoke-debug.png)
- Why safe
  - No runtime imports/usages were found
  - Names/content strongly suggest generated, debug, or historical material
  - Removing them should not change live application code paths

### 8.2 Risky cleanup candidates
These may be stale, but removing them could affect deployment, local debugging, migration history, or future understanding.
- Environment files and backups
  - [client/.env](client/.env)
  - [client/.env.local](client/.env.local)
  - [backend/.env](backend/.env)
  - [backend/.env.local](backend/.env.local)
  - [backend/.env.local.bak](backend/.env.local.bak)
- Database artifacts and migration history
  - [db/dev.sqlite](db/dev.sqlite)
  - [backend/todos_v4.db](backend/todos_v4.db)
  - [backend/migrations](backend/migrations)
  - [backend/src/migrations](backend/src/migrations)
  - [backend/db/mssql-init.sql](backend/db/mssql-init.sql)
- Deployment/config artifacts
  - [backend/.deployment](backend/.deployment)
  - [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)
  - [client/staticwebapp.config.json](client/staticwebapp.config.json)
  - [client/swa-cli.config.json](client/swa-cli.config.json)
  - [backend-deploy-temp](backend-deploy-temp)
- Legacy code structures that look unused but may still be reference material
  - [backend/src/controllers](backend/src/controllers)
  - [backend/src/routes](backend/src/routes)
  - [backend/src/config/index.js](backend/src/config/index.js)
- Documentation set
  - The large integration doc set looks stale, but deleting it could remove historical deployment/testing context
- Why risky
  - Some are inconsistent with current code, but still may be used manually or operationally
  - Some hold migration history or deployment settings
  - Some may be the only record of prior database/storage behavior

## 9. Deployment Discovery
- Current apparent runtime/deployment model
  - Current repo evidence points to split deployment, not combined app service hosting:
    - Frontend built separately from [client](client)
    - Backend deployed separately from [backend](backend)
  - The frontend is configured like a Static Web Apps-style site with API rewrite to an external backend in [client/staticwebapp.config.json](client/staticwebapp.config.json)
  - The backend has its own Azure App Service deployment workflow in [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)
- Existing deployment artifacts
  - Backend Azure workflow: [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)
  - Backend Azure build hint: [backend/.deployment](backend/.deployment)
  - Frontend SWA config: [client/staticwebapp.config.json](client/staticwebapp.config.json)
  - Frontend SWA CLI config: [client/swa-cli.config.json](client/swa-cli.config.json)
  - Checked-in frontend build output: [client/dist](client/dist)
- Existing Docker/process-manager clues
  - No `Dockerfile`, no compose file, no `.dockerignore`, no PM2 ecosystem file, no `Procfile`, and no Nginx config were found.
  - No evidence of PM2, Forever, Supervisor, or similar process-manager assumptions was found.
- Unknowns / uncertainties
  - Uncertain whether the current live frontend is deployed via Azure Static Web Apps, Azure App Service static hosting, or both at different times.
  - Uncertain whether [backend/.deployment](backend/.deployment) is still used by the current backend deployment path.
  - Uncertain whether the checked-in [client/dist](client/dist) is part of current deployment or just a leftover artifact.

## 10. Risks and Watchouts
- `App.jsx` currently has compile errors, so planning should not assume the frontend is in a clean runnable state.
- Backend runtime can silently change database engines depending on whether MSSQL connects successfully.
- Notification behavior is tied to SQLite and may not function meaningfully in MSSQL-backed environments.
- Database logic is mixed across TypeORM, raw SQL files, raw SQL queries, and SQLite fallback schema creation.
- SQL is strongly SQL Server-specific, so PostgreSQL migration will likely require deliberate query/schema rewrites rather than simple connection-string substitution.
- Documentation is noisy and contradictory; planning should rely on code/config first, docs second.
- Legacy directories/files may be tempting cleanup targets, but some may still carry migration/deployment context.
- Current deployment model is split frontend/backend, while future target expects a single app service containing both; planning must account for that architectural change explicitly.

## 11. Recommended Inputs for Phase 1 Planning
State what the planning phase should focus on next based on your findings.
- Confirm the intended database source of truth before any container/deployment planning:
  - Is MSSQL still authoritative, or is SQLite fallback still operationally important?
  - Which schema/migration path is canonical: raw SQL, TypeORM JS migrations, or both?
- Decide whether the broken [client/src/app/App.jsx](client/src/app/App.jsx) is the real app root to preserve, or whether a newer page-based structure should be treated as canonical.
- Define the desired local/runtime behavior once containers exist:
  - Should local development still allow DB fallback?
  - Or should startup fail fast if the target DB is unavailable?
- Inventory all environment variables actually required for a combined frontend+backend app service deployment.
- Decide what to do with split-deployment artifacts (SWA config, Azure backend workflow) when moving to one combined app service.
- Identify which stale docs/artifacts should be archived versus deleted after planning is complete.
- Confirm whether guest mode and Auth0 remain first-class requirements for the combined deployment.

## 12. Appendix
Include useful inventories if helpful:

- env files
  - [client/.env](client/.env)
  - [client/.env.example](client/.env.example)
  - [client/.env.local](client/.env.local)
  - [backend/.env](backend/.env)
  - [backend/.env.example](backend/.env.example)
  - [backend/.env.local](backend/.env.local)
  - [backend/.env.local.bak](backend/.env.local.bak)
  - [backend-deploy-temp/.env.example](backend-deploy-temp/.env.example)

- database-related files
  - [backend/src/infra/db/data-source.js](backend/src/infra/db/data-source.js)
  - [backend/data-source-migrations.js](backend/data-source-migrations.js)
  - [backend/db/mssql-init.sql](backend/db/mssql-init.sql)
  - [backend/todos_v4.db](backend/todos_v4.db)
  - [db/dev.sqlite](db/dev.sqlite)
  - [backend/src/infrastructure/SQLiteTodoRepository.js](backend/src/infrastructure/SQLiteTodoRepository.js)
  - [backend/src/infrastructure/SQLiteTagRepository.js](backend/src/infrastructure/SQLiteTagRepository.js)
  - [backend/src/infrastructure/TypeORMTodoRepository.js](backend/src/infrastructure/TypeORMTodoRepository.js)
  - [backend/src/infrastructure/TypeORMTagRepository.js](backend/src/infrastructure/TypeORMTagRepository.js)
  - [backend/src/application/NotificationService.js](backend/src/application/NotificationService.js)

- migration files
  - Raw SQL migrations: [backend/migrations](backend/migrations)
  - TypeORM migrations: [backend/src/migrations](backend/src/migrations)
  - Archived migrations: [backend/src/migrations/archived](backend/src/migrations/archived)

- scripts
  - Backend scripts: [backend/scripts](backend/scripts), [backend/src/scripts](backend/src/scripts)
  - Frontend scripts: [client/scripts](client/scripts)

- deployment files
  - [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)
  - [backend/.deployment](backend/.deployment)
  - [client/staticwebapp.config.json](client/staticwebapp.config.json)
  - [client/swa-cli.config.json](client/swa-cli.config.json)

- doc files
  - Primary repo docs: [README.md](README.md), [FEATURES.md](FEATURES.md)
  - Integration/status docs: [START_HERE.md](START_HERE.md), [QUICK_START.md](QUICK_START.md), [README_INTEGRATION.md](README_INTEGRATION.md), [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md), [INTEGRATION_COMPLETE.md](INTEGRATION_COMPLETE.md), [STATUS_REPORT.md](STATUS_REPORT.md), [FILES_MODIFIED_CREATED.md](FILES_MODIFIED_CREATED.md), [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md), [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)
  - Issue notes: [ISSUES](ISSUES)
