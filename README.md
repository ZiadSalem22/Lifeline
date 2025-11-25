# Lifeline

Lifeline is a modern, full‑stack task manager built with a Vite + React frontend and a Node.js + Express backend (SQLite for local persistence). This repository contains both frontend and backend code, CI workflows, and a simple deployment pipeline.

This README is written to be CV-friendly: it highlights features, architecture, technical decisions, and step-by-step deployment instructions so recruiters and interviewers can quickly understand the project and run a live demo.

—

**Quick Project Summary (CV blurb)**

- Title: Lifeline — modern task manager
- Stack: React (Vite), Node.js (Express), SQLite, GitHub Actions
- Highlights: Clean architecture, use-case driven backend, Apple-style UI patterns, responsive mobile-first design, automated CI, and continuous deployment to GitHub Pages (frontend)

Example one-line CV bullet:

“Built Lifeline, a full‑stack React + Node.js task manager with a clean hexagonal backend, modern responsive UI (Vite + React), and automated CI/CD on GitHub Actions — live demo available.”

—

## Features

- Create, update, toggle, tag, and search todos
- Tagging system with many-to-many relationships
- Recurrence and reminder support (domain-level logic)
- Translucent Apple-style header search pill and mobile-first layout
- Sidebar with quick-actions and theme toggle
- Clean Architecture: application use-cases, domain entities, infrastructure implementations
- Unit tests for critical use-cases and infrastructure
- CI: automated tests and frontend build via GitHub Actions
- Deployment: frontend deployed to GitHub Pages (workflow included). Backend can be deployed to Render, Railway, or similar platforms.

—

## Tech stack & notable libraries

- Frontend: React + Vite, Framer Motion (animations), date-fns, React Calendar
- Backend: Node.js, Express, SQLite (sqlite3), Joi (validation), Winston (logging)
- Dev/test: Jest, eslint
- CI/CD: GitHub Actions

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
