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

cd ..\frontend
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
cd frontend
npm run dev
# Open http://localhost:5173 (Vite default)
```

4. Shared state: the frontend expects the API at `http://localhost:3000/api` by default. If you run the backend on a different port, update `frontend/src/api.js` or set the environment variable used by the frontend.

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

This repository uses GitHub Actions. The included workflow `ci.yml` runs backend tests and builds the frontend on pushes/PRs against `main`.

—

## Deployment

Live demo (recommended setup):

1. Backend: deploy to a small Node host such as Render (https://render.com), Railway (https://railway.app), or a small VPS/Heroku alternative.
	 - Create a new service and set environment variables (if any). Upload the repository or connect GitHub and set the start command to `node src/index.js` (or use the `npm start` script).
	 - Ensure your SQLite file is mounted/persisted or switch to a hosted DB for a production demo.

2. Frontend: deploy to GitHub Pages (automated) or Vercel.
	 - This repository includes a GitHub Actions workflow `deploy-frontend.yml` that builds `frontend` and deploys the static output to GitHub Pages on pushes to `main`.
	 - After the first push, Pages will be available at `https://<your-username>.github.io/<repo-name>/` (you can enable a custom domain in the repository settings).

Notes: The frontend must be configured to call your deployed backend URL (update `frontend/src/api.js` or configure an environment variable). For a polished public demo, deploy backend first and set a public `API_URL` in the frontend build.

—

## Automatic Frontend Deployment (GitHub Pages)

The repository includes `.github/workflows/deploy-frontend.yml` (if you keep the default `main` branch and the workflow, it will automatically build the frontend and publish to GitHub Pages). If you prefer Vercel, connect the repo to Vercel and configure the build command `npm run build` with `frontend` as the project root.

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
