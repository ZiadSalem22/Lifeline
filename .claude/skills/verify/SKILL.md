---
name: verify
description: Build, launch, and drive the Lifeline web app for runtime verification.
---

# Verifying Lifeline changes in a running browser

## Build + launch (web app, guest mode — no Postgres needed)

The server needs Postgres, but the web app has first-class guest mode
(localStorage) that kicks in when the API answers 401. Stub the API:

```bash
npm install && npm run build --workspace @lifeline/shared   # shared must be built first
node -e "require('http').createServer((q,s)=>{s.writeHead(401,{'content-type':'application/json'});s.end('{}')}).listen(4001)" &
VITE_AUTH_DISABLED=1 VITE_PROXY_TARGET=http://localhost:4001 \
  npm run dev -w @lifeline/web -- --port 5199 --strictPort
```

- `VITE_AUTH_DISABLED=1` is REQUIRED — without it the app throws
  (Auth0 env vars missing) and renders the error boundary.
- Without the 401 stub, `/api` 502s are NOT treated as guest fallback:
  plan data never becomes `ready` and every write is silently guard-blocked
  (looks like your feature is broken when it isn't).

## Driving with Playwright

Global playwright (ESM import by absolute path) + preinstalled chromium:

```js
import { chromium } from 'file:///opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
```

Useful seeds via `context.addInitScript`:

- `localStorage.setItem('homeViewMode', 'plan')` — land on the Daily Plan
  (raw string, NOT JSON).
- `localStorage.setItem('theme', 'paper')` — any of the 10 themes.

## Gotchas

- Plan writes are optimistic to the React Query cache but debounced 800ms
  (`PLAN_SAVE_DEBOUNCE_MS`) before hitting localStorage — wait ≥1s before
  asserting on `daily_plan:<date>` / `daily_plan_settings` keys.
- `getByText('DAILY PLAN')` is ambiguous (mode-toggle tab vs masthead) —
  use `{ exact: true }`.
- Phone context: `{ viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true }`.
