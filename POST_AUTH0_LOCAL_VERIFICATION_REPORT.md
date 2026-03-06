# Post-Auth0 Local Verification Report

## 1. Executive Summary

The focused post-Auth0 / pre-Phase-5 verification pass completed successfully.

The supported local/containerized app path now uses `http://localhost:3020` instead of `http://localhost:3001`. The local Compose stack rebuilt cleanly, booted successfully, served the frontend shell and SPA fallback on port `3020`, and passed the core backend/API verification flow before and after restart.

Auth0-related browser-origin assumptions are aligned with the public origins only:
- production: `https://lifeline.a2z-us.com`
- local: `http://localhost:3020`

## 2. Port and Config Changes

Confirmed and/or updated:
- `compose.yaml`
  - published app port default changed from `3001` to `3020`
  - `APP_ORIGIN`, `CORS_ORIGIN`, and `FRONTEND_ORIGIN` defaults changed to `http://localhost:3020`
- `compose.env.example`
  - `APP_PORT=3020`
  - same-origin local defaults now use `http://localhost:3020`
  - Auth0 guidance comments now point to the public browser origins only
- `backend/.env.example`
  - browser/app origin examples now include:
    - `https://lifeline.a2z-us.com`
    - `http://localhost:3020`
- `backend/src/index.js`
  - default allowlist includes `http://localhost:3020`
  - default allowlist includes `https://lifeline.a2z-us.com`
- `backend/scripts/verify-compose-runtime.js`
  - local verification target aligned to `http://localhost:3020`
- `client/.env.example`
  - local/Auth0 guidance updated to the `3020` browser origin
- `PHASE4_IMPLEMENTATION_REPORT.md`
  - local Compose port references updated from `3001` to `3020`

No unrelated refactors were introduced.

## 3. Auth0 Alignment Check

Checked local/production browser-origin alignment against the new Auth0 setup.

Verified alignment points:
- public production browser origin: `https://lifeline.a2z-us.com`
- public local browser origin: `http://localhost:3020`
- no supported browser/Auth0 config path depends on a container name or internal Docker host

Key observations:
- `client/src/providers/AuthAdapterProvider.jsx` uses `window.location.origin` for the Auth0 `redirect_uri`
- frontend logout flows use `window.location.origin` as the return target, which keeps Auth0/browser redirects on the public origin
- `compose.yaml` only passes Auth0 domain/audience values; it does not introduce container names or internal hosts into browser-origin config
- backend DB wiring still uses the internal Compose host `lifeline-postgres`, but that is runtime-only infrastructure and not part of browser/Auth0 origin configuration

Result:
- Auth0/browser assumptions are correctly aligned to public origins only
- the local supported browser origin is now `http://localhost:3020`

## 4. Local Compose Verification Results

Executed successfully:
- `docker compose --env-file compose.env.example build`
- `docker compose --env-file compose.env.example up -d`
- browser-host reachability checks against `http://localhost:3020`
- `npm run verify:compose` with `LIFELINE_BASE_URL=http://localhost:3020`

Validated successfully:
- image build succeeded
- Compose stack booted successfully
- app was reachable on `http://localhost:3020`
- frontend shell loaded from `/`
- SPA fallback worked from `/statistics`
- `/api/health/db`
- `/api/me`
- `/api/profile`
- `/api/settings`
- `/api/tags`
- `/api/todos`
- `/api/stats`
- `/api/export`

Observed verification result snapshot:
- first full verification run succeeded on `http://localhost:3020`
- returned `todoCount: 7`

Additional note:
- the active terminal session still had a stale `LIFELINE_BASE_URL=http://127.0.0.1:3001` override from earlier work
- once explicitly overridden to `http://localhost:3020`, the supported verification path passed cleanly
- this was a shell-environment artifact, not a repo/config blocker

## 5. Persistence / Restart Verification

Executed successfully:
- `docker compose --env-file compose.env.example restart lifeline-postgres lifeline-app`
- second `npm run verify:compose` with `LIFELINE_BASE_URL=http://localhost:3020`
- `docker compose --env-file compose.env.example down`

Observed results:
- both services returned to healthy state after restart
- app remained published on host port `3020`
- endpoint verification passed again after restart
- persisted data remained intact across restart

Persistence evidence:
- verification run before restart returned `todoCount: 7`
- verification run after restart returned `todoCount: 8`

Result:
- persistence still works across restart
- no supported local/containerized flow was broken by the Auth0/port alignment update

## 6. Remaining Issues

No repo-level blocker remains for the verified local/containerized path.

Minor note:
- a stale terminal-only `LIFELINE_BASE_URL` override pointing at the old `3001` port can still cause ad hoc verification failures if reused without resetting it
- the committed verification script and supported config now align to `http://localhost:3020`

## 7. Completion Status

Completed successfully.

The app is ready for the next phase from the perspective of:
- local/browser origin alignment
- Auth0 public-origin assumptions
- local Compose runtime correctness
- restart/persistence verification
