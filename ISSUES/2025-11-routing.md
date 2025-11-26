# Issue: Routing & basename handling (branch: `issue/routing`)

**Summary**

After converting in-app page switching to `react-router` routes and adding an Auth page, the app shows route-related warnings in certain deployments (notably when served under a subpath like `/Lifeline/`). A previous large automated edit to `client/src/app/App.jsx` also introduced truncation/JSX errors that were later repaired, but end-to-end runtime verification was interrupted.

**Reproduction**

1. Checkout branch: `issue/routing` (already created and pushed).
2. From repo root:

```powershell
cd client; npm install; npm run dev
```

3. Open the dev server URL (usually `http://localhost:5173/`).
4. Observe console for warnings such as:
   - "No routes matched location '/Lifeline/'"
   - Any React errors pointing to `App.jsx` or missing imports (e.g., `Routes is not defined`).

**Findings so far**

- `react-router-dom` v6 was added and `App.jsx` was converted to use `<Routes>` / `<Route>`.
- `client/src/app/main.jsx` was updated to set `BrowserRouter` `basename` using `import.meta.env.BASE_URL || '/'` to support subpath deployments.
- File-level JSX/syntax issues in `App.jsx` were fixed; the file currently parses when inspected locally.
- Dev-server run to confirm runtime behavior was cancelled before completion; further verification is required.

**Proposed next steps**

1. Start the dev server and verify `/` and `/auth` routes render correctly in both root and subpath contexts.
2. If warnings about unmatched routes appear when serving under `/Lifeline/`, confirm `vite.config.js` `base` setting and adjust or document how to set `BASE_URL` during preview/build.
3. Add a small integration check (manual or automated) to validate that the app can be served under a subpath.
4. If any remaining syntax/runtime errors reference `App.jsx`, patch them and re-run the dev server.

**Acceptance criteria**

- Running the dev server locally and visiting `/` shows the dashboard.
- Visiting `/auth` shows the Auth page inside the `DashboardPage` shell.
- No route-matching warnings for intended base paths when served with `BASE_URL` configured.

**Notes**

- I can open a prefilled GitHub issue page for you, or create the issue via the GitHub API if you provide a token. For now, this local issue file documents the problem and the work plan.

---

Branch: `issue/routing`
Created: 2025-11-25
Author: Local workspace (assistant)
