# Lifeline Frontend (React + Vite)

This is the Lifeline web client, a modern React app built with Vite. It provides a polished, mobile-first UI for managing todos, tags, and statistics, with full Guest Mode support (localStorage-only) and seamless integration with the Lifeline Node.js backend when logged in.

## Features

- Guest Mode: create/update/toggle/flag/delete todos and tags stored in localStorage (no backend or auth required).
- Advanced Search: multi-criteria search with month preload and robust client fallbacks when the server is unavailable.
- Statistics: displays productivity insights; uses backend data when available, otherwise computes locally.
- Calendar & Navigation: modern calendar and double-click/double-tap on search results to jump to the task date.
- Sidebar & TopBar: responsive Apple-style header and drawer; global layout offset so content never sits under the sidebar.
- Themes & Animations: light/dark themes, CSS variables, and smooth transitions with framer-motion.

## Project Structure (client/)

- `src/app/App.jsx`: main app orchestration, routing, global state.
- `src/components/`: UI modules (layout, search, statistics, calendar, settings).
- `src/utils/api.js`: backend API calls (used when authenticated).
- `src/utils/guestApi.js`: localStorage-backed CRUD for Guest Mode.
- `src/hooks/useGuestStorage.js`: helpers to safely read/write guest data.
- `src/styles/base.css`: global styles, theme variables, and layout rules (includes `--sidebar-width`).

## Development

Run the client locally (default Vite dev server at http://localhost:5173):

```powershell
cd client
npm install
npm run dev
```

If you also run the backend, it should be available at `http://localhost:3000/api`. The client will use authenticated API calls when logged in; otherwise it remains fully functional in Guest Mode.

## Build

```powershell
cd client
npm run build
```

## Key Behaviors

- Auth transitions: on login/logout, guest localStorage (`guest_todos`, `guest_tags`) is cleared to prevent mixed sessions.
- Advanced Search: empty filters default to current-month results; falls back to local data if server returns errors.
- Statistics: tries server first; computes locally on failure.
- Layout: desktop pages offset by `--sidebar-width`; TopBar shifts accordingly; mobile drawer uses overlay without covering content.

## Notes

- Ensure the backend URL in `src/utils/api.js` matches your deployed server if not using `http://localhost:3000`.
- For production hosting, build and deploy the `client/dist` directory to your platform of choice.
