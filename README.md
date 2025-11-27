—
—
—

# Lifeline – Modern Full-Stack Task Manager

---

## 🚀 Overview

Lifeline is a full-stack productivity app with a modern React/Vite frontend and a robust Node.js/Express backend. It features recurring tasks, browser notifications, export/import, RBAC with Auth0, and a clean, testable architecture. Designed for maximum clarity, maintainability, and resume impact.

---

## 🌟 Features

- **Todos:** Create, update, complete, and delete tasks
- **Tagging:** Many-to-many tags for organization
- **Recurring Tasks:** Flexible recurrence (daily, weekly, monthly, custom)
- **Reminders & Notifications:** Browser notifications for upcoming tasks
- **Export/Import:** Backup and restore data (JSON/CSV, merge/replace)
- **User Accounts:** Auth0 login, user upsert, and profile management
- **RBAC:** Role-based access (admin, paid, free) enforced via Auth0 and backend middleware
- **Admin Tools:** CLI script to promote users to admin
- **Mobile-First UI:** Responsive, Apple-style design
- **Themes:** Light/dark mode, theme toggle, and CSS variables
- **Animations:** Framer Motion for smooth UI transitions
- **Comprehensive Tests:** Jest + Supertest for backend, with full RBAC and business logic coverage (in-memory/mocked DB)
- **CI/CD:** Automated tests and builds via GitHub Actions

---

## 🏗️ Architecture

### Backend (`backend/`)

- **Clean/Hexagonal Architecture:**
  - `src/application/`: Use cases (business logic, e.g., CreateTodo, RecurrenceService, NotificationService)
  - `src/domain/`: Entities (Todo, Tag, User) and repository interfaces
  - `src/infrastructure/`: Data persistence (TypeORM, SQLite, User/Tag repositories)
  - `src/middleware/`: Auth0 JWT validation, attachCurrentUser, RBAC roles, error handling, logging, validation
  - `src/routes/`: API endpoints for todos, tags, attachments, etc.
  - **Database:** SQLite (default, with TypeORM for extensibility)
  - **Auth0 Integration:**
    - JWT validation via `express-oauth2-jwt-bearer`
    - User upsert/profile on every request (`attachCurrentUser`)
    - Roles extracted from custom Auth0 claims
    - RBAC enforced in middleware and routes
  - **Testing:** Jest + Supertest, with all DB operations mocked or in-memory for speed and reliability
  - **Logging:** Winston for error/activity logging
  - **Validation:** Joi for robust input validation

### Frontend (`client/`)

- **React + Vite:**
  - `src/app/App.jsx`: Global state, API calls, and UI orchestration
  - `src/utils/api.js`: Centralized backend API communication
  - `src/components/`: Modular UI (Sidebar, TopBar, RecurrenceSelector, ExportImport, etc.)
  - **Styling:** Global CSS + inline styles, Framer Motion for animation, theme variables, and responsive design
  - **Auth0 Integration:**
    - Auth0 SPA SDK for login/logout
    - Access tokens sent with API requests
    - Role-based UI (admin/paid/free features)
  - **Mobile-First:** Responsive layout, touch-friendly controls
  - **Themes:** Light/dark mode, theme toggle, and CSS variables

---

## 🔐 Auth0 Integration

- **Backend:**
  - Validates JWTs for all protected routes
  - Extracts user info and roles from Auth0 claims
  - Upserts user and loads profile on every request
  - Enforces RBAC (admin, paid, free) in middleware

- **Frontend:**
  - Uses Auth0 SPA SDK for authentication
  - Stores and sends access tokens with API requests
  - UI adapts based on user role (admin features, paid features, etc.)

---

## 🧪 Testing & Quality

- **Backend:**
  - Jest + Supertest for all business logic, middleware, and API endpoints
  - In-memory/mocked DB for all tests (no real DB required)
  - Full coverage for RBAC, user upsert, recurrence, notifications, and error handling
  - No console logs or unhandled errors in test output

- **Frontend:**
  - Manual and automated UI testing (unit and integration tests recommended)
  - Responsive and theme switching tested across devices

- **CI/CD:**
  - GitHub Actions for automated backend tests and frontend builds
  - Linting and build checks on every push/PR

---

## 🔄 Data Flow & API

- **Frontend → Backend:**
  - All actions go through `api.js` to `/api/todos`, `/api/tags`, etc.
- **Backend:**
  - Express routes → Use cases → Repositories → SQLite DB
  - Auth0 JWT required for all protected endpoints

---

## 🎨 UI/UX Highlights

- **Apple-style UI:** Translucent search pill, sidebar, and quick actions
- **Mobile-First:** Responsive layout, touch-friendly controls
- **Themes:** Light/dark mode, theme toggle, and CSS variables
- **Animations:** Framer Motion for smooth transitions
- **Accessibility:** Keyboard navigation and ARIA labels

---

## 📂 Key Files & Directories

- `backend/src/index.js`: Backend entry point, routing, middleware, DB setup
- `backend/src/application/`: Backend business logic (use cases)
- `backend/src/domain/`: Backend domain entities and interfaces
- `backend/src/infrastructure/`: Backend data persistence implementations
- `client/src/app/App.jsx`: Main frontend component, state management
- `client/src/utils/api.js`: Centralized frontend API calls
- `client/src/styles/base.css`: Consolidated global frontend styles

---

## 🛠️ Developer Workflows

- **Backend:**
  - `npm install`, `npm run dev`, `npm test`
- **Frontend:**
  - `npm install`, `npm run dev`, `npm run build`
- **Testing:**
  - `npm test` (backend, with full coverage for RBAC, todos, recurrence, etc.)

---

## 📖 Documentation

- See `README.md`, `IMPLEMENTATION_SUMMARY.md`, `INTEGRATION_COMPLETE.md`, and `TESTING_CHECKLIST.md` for full details on features, architecture, and test coverage.

---

## 📄 License

MIT License. See `LICENSE` for details.

—

## Architecture & Implementation Notes

- Backend follows a Clean / Hexagonal architecture:
	- `application/` contains use-case classes (CreateTodo, ListTodos, ToggleTodo, etc.)
	- `domain/` declares entities (`Todo`, `Tag`) and repository interfaces (`ITodoRepository`)
	- `infrastructure/` contains SQLite concrete repository implementations
	- `controllers/` wire Express routes to application use-cases

- Frontend is a Vite React app:
	- `src/App.jsx` is the main orchestrator (state for todos, tags, search)
	- `TopBar.jsx`, `Sidebar.jsx`, and modular components implement responsive UI
	- `src/api.js` centralizes backend communication (fetch + error handling)

—

## Run locally (development)

Prerequisites: Node.js 18+, npm

1. Install dependencies

```powershell
cd backend
npm install

cd ..\client
npm install
```

2. Run backend

```powershell
cd backend
npm run dev
# backend listens on PORT (default 3000)
```

3. Run frontend (separate terminal)

```powershell
cd client
npm run dev
# Open http://localhost:5173 (Vite default)
```

4. Shared state: the frontend expects the API at `http://localhost:3000/api` by default. If you run the backend on a different port, update `client/src/utils/api.js` or set the environment variable used by the frontend.

—

## Tests

Run backend tests:

```powershell
cd backend
npm test
```

There's a small unit test suite focused on domain logic and the SQLite repository.

---

## Backend Test Coverage (2025-11)

The backend now includes comprehensive automated tests for all major features and business logic. Key areas covered:

- **User & RBAC Middleware**
  - Tests for `attachCurrentUser` middleware: ensures user info and roles are extracted from Auth0 claims and attached to requests.
  - Tests for `roles` middleware: verifies that protected routes enforce required roles (admin, paid, etc.) and deny access otherwise.

- **Protected Routes**
  - Integration tests for all RBAC-protected endpoints, simulating requests with different user roles and checking for correct access or denial.

- **Admin Promotion Script**
  - Tests for the CLI script that promotes a user to admin, including error handling for missing or non-existent users. Uses mocked DB.

- **Domain & Use Case Logic**
  - Unit tests for core business logic: creating todos, handling recurrence, toggling status, and updating entities.
  - Recurrence logic is tested for correct next-due calculation and auto-creation of new tasks.

- **Repository Layer**
  - All DB operations are mocked in tests to ensure fast, isolated, and reliable test runs.

- **Test Approach**
  - Uses Jest for assertions and mocking, Supertest for HTTP simulation, and in-memory/mocked DB for all backend tests.
  - Both positive (success) and negative (error/denied) scenarios are covered for robust coverage.

To run all backend tests:

```powershell
cd backend
npm test
```

All tests must pass with no user code logs or unhandled errors. See `TESTING_CHECKLIST.md` for detailed scenarios.

—

## Continuous Integration

This repository uses GitHub Actions. The included workflow `ci.yml` runs backend tests and builds the frontend (the `client/` app) on pushes/PRs against `main`.

—

## Deployment


Deploy to Azure (recommended for free/demo):

This repository includes GitHub Actions workflows to deploy the frontend and backend to Azure App Service. The workflows are `azure-deploy-frontend.yml` and `azure-deploy-backend.yml` and expect the following repository secrets (see instructions below):

- `AZURE_CREDENTIALS` — JSON credentials of a Service Principal with contributor permissions for the resource group. Create it with the Azure CLI and paste the JSON into this secret.
- `FRONTEND_WEBAPP_NAME` — the name of the Azure Web App to receive the frontend (creates hostname `https://<name>.azurewebsites.net`).
- `BACKEND_WEBAPP_NAME` — the name of the Azure Web App to receive the backend.

Workflow behavior:
- `azure-deploy-frontend.yml` builds `client/` (`npm ci` + `npm run build`) and deploys the `client/dist` folder to the `FRONTEND_WEBAPP_NAME` web app.
- `azure-deploy-backend.yml` installs backend dependencies, runs tests (best-effort), zips the `backend/` folder and deploys the zip package to the `BACKEND_WEBAPP_NAME` web app.

Both workflows use `azure/login@v2` and `azure/webapps-deploy@v2` under the provided `AZURE_CREDENTIALS` secret.

Important: The Azure App Service free tier (F1) is available in many regions and provides a free `azurewebsites.net` hostname. If you prefer static-only hosting for the frontend, you can alternatively use Azure Static Web Apps (free tier) — that requires creating a Static Web App resource and using its deployment token.

Steps to create the service principal and resources (quick commands)

1. Install and login with the Azure CLI locally:

```powershell
az login
```

2. Create a resource group (pick a region):

```powershell
az group create --name lifeline-rg --location eastus
```

3. (Optional) Create an App Service plan on the free tier:

```powershell
az appservice plan create --name lifeline-plan --resource-group lifeline-rg --sku F1 --is-linux
```

4. Create two Web Apps (one for frontend, one for backend):

```powershell
az webapp create --resource-group lifeline-rg --plan lifeline-plan --name lifeline-frontend --runtime "NODE|18" --deployment-local-git
az webapp create --resource-group lifeline-rg --plan lifeline-plan --name lifeline-backend --runtime "NODE|18" --deployment-local-git
```

Pick unique `--name` values (these become `<name>.azurewebsites.net`). Use those names for the `FRONTEND_WEBAPP_NAME` and `BACKEND_WEBAPP_NAME` secrets.

5. Create a service principal and output the JSON used by the GitHub secret `AZURE_CREDENTIALS`:

```powershell
az ad sp create-for-rbac --name "github-actions-lifeline" --role contributor --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/lifeline-rg --sdk-auth
```

Copy the returned JSON and add it as the `AZURE_CREDENTIALS` secret in GitHub (Repository > Settings > Secrets & variables > Actions > New repository secret).

6. Add the two web app names as secrets:
- `FRONTEND_WEBAPP_NAME` = `lifeline-frontend` (example)
- `BACKEND_WEBAPP_NAME` = `lifeline-backend`

7. Push to `main` (or re-run Actions): the workflows will run and deploy to Azure.

Notes about environment variables and API URL:
- After the backend is live at `https://<BACKEND_WEBAPP_NAME>.azurewebsites.net`, update `client/src/utils/api.js` (or set a frontend env var) to point API calls at that URL.
- If you need persistent storage for SQLite you must mount storage or use a hosted DB for production. App Service local storage may not persist through instance restarts in all situations; for a demo it often works but is not guaranteed.


—

## Automatic Frontend Deployment (GitHub Pages)

The repository includes `.github/workflows/deploy-frontend.yml` (if you keep the default `main` branch and the workflow, it will automatically build the frontend and publish to GitHub Pages). If you prefer Vercel, connect the repo to Vercel and configure the build command `npm run build` with `client` as the project root.

—

## CV / Interview talking points

- Designed a clean separation of concerns with a hexagonal backend enabling easier unit testing and replacement of the persistence layer.
- Implemented a polished, mobile-first UI with Apple-style search pill, responsive alignment, and accessible controls.
- Wrote unit tests for the domain and repository layers, and added CI to ensure tests/builds run on every push/PR.
- Rewrote repo history and configured `.gitignore` to ensure secrets and heavy `node_modules`/db artifacts are not published.
- Automated frontend deployment to GitHub Pages and provided simple instructions to host the backend.

—

## LICENSE

This project uses the MIT license (see `LICENSE`).

—

## Contact / Want me to help further?

If you want, I can:
- Expand the README with screenshots, GIFs, or an architecture diagram
- Add a demo badge (live) at the top linking to the Pages/Vercel deployment
- Add branch protection rules and caching to CI to speed runs
- Set up a simple Render/Railway deployment for the backend and wire the frontend build to it

Tell me which of the above you want me to add next and I will implement it.
