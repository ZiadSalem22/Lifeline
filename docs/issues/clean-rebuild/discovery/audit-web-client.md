All data gathered. Final audit report follows.

# Lifeline OLD web client audit (client/src) — feature-parity rebuild grounding

Stack: React 19.2 + Vite 7 + JS (JSX, no TS), react-router-dom 6.30, @auth0/auth0-react 2.9, framer-motion, date-fns 4, uuid 13, CSS Modules + global CSS. No chart lib, no state lib, no fetch lib. Tests: Vitest + Testing Library (11 files in `client/src/tests/`). `client/src/app/routes/` contains only `.gitkeep` (empty — routes live inline in App.jsx).

## 1. Routes (all defined inline in `client/src/app/App.jsx` lines 757–2603)

| Path | Element | Notes |
|---|---|---|
| `/` | DashboardPage + inline dashboard JSX | main day view (defaults `selectedDate='today'`) |
| `/day/:day` | DashboardPage + **duplicated** dashboard JSX | `:day` = `today` \| `tomorrow` \| `YYYY-MM-DD`; regex sync at App.jsx:500–512; the entire dashboard block (~880 lines) is copy-pasted twice (lines 774–1656 and 1716–2598) |
| `/search` | AdvancedSearchPage | **defined twice** (App.jsx:758 and :1671 — first wins; second is dead) |
| `/advanced-search` | AdvancedSearchPage | duplicate alias |
| `/statistics` | StatisticsPage | |
| `/stats` | StatisticsPage | alias |
| `/profile` | ProtectedRoute→ProfilePage | |
| `/onboarding` | ProtectedRoute→OnboardingPage | auto-redirect here when `currentUser.profile.onboarding_completed === false` (App.jsx:62–70) |
| `/auth` | AuthPage | immediately calls Auth0 `loginWithRedirect` |
| `*` | `<Navigate to="/" replace />` | |

No `/settings` route — `pages/SettingsPage.jsx` is imported in App.jsx:19 but never mounted (**dead code**). Settings is a modal overlay (`showSettings` state). Query param deep-link: `?taskId=<id>` opens that task in edit mode (App.jsx:486–497).

## 2. App.jsx dashboard capabilities (AppInner + TaskCard, 3724 lines)

**Hero/header**: title = "Today"/"Tomorrow"/`format(date,'EEEE, MMMM d')`/"All Tasks"/`Search Results for "q"`; total-duration pill (`Xh Ym`); "N of M completed" + progress bar; tag-filter chips (multi-select, AND semantics, "Clear"); sort `<select>`: `date|priority|duration|name`.

**Composer (add-task card)**, auto-opens when `todos.length===0`, closes on outside-click/Escape (App.jsx:279–297):
- "Load task #" numeric input → `GET /todos/by-number/:n` prefills as template (title, description, tags, flag, priority, subtasks, duration; explicitly resets date/time/recurrence) + "Clear Template" button; autofocus on open (App.jsx:206–213)
- Title input, description textarea
- Duration: hours select 0–12h, minutes select 0–55 step 5
- Flag toggle (FlagIcon, red), `#` button reveals tag picker row, tag pills toggle, `+` circle opens Create-New-Tag modal (name + `<input type=color>`, default `#6C63FF`)
- `date` input (scheduleDate; falls back to selectedDate), `time` input (dueTime), priority select low/medium/high (default medium)
- Recurrence button → RecurrenceSelector modal; button shows `recurrence.type` when set
- Subtasks: input + Add button (Enter key adds), checkbox toggle, `×` remove; ids are `Date.now().toString()`
- Submit → provider `createTodo({title,dueDate,tags,isFlagged,duration,priority,dueTime,subtasks,description,recurrence})`; inline error banner on failure

**Task list** (`orderedTodos` = filteredTodos regrouped incomplete-first, App.jsx:549–557), empty state = animated SparklesIcon "All clear!". TaskCard (memo, App.jsx:2630–3723):
- Checkbox toggle complete (also **double-click card toggles complete** when not editing)
- `#taskNumber` pill before title; click title → inline edit (only if not completed)
- Priority badge (High red `#ef4444`; medium/low muted); duration badge; description clamp (3.6em) + hover note-preview popup via NoteIcon in actions column; recurrence badge (RepeatIcon + `Daily|Range|Weekdays` from `recurrence.mode`); dueTime row `🕐 HH:mm`; dueDate row shown only in search mode (`showDate`) with "Go to day" arrow button
- Tag chips on card are clickable → toggles that tag in `selectedFilterTags`
- Subtasks: progress bar + `done/total` counter + chevron expand (framer-motion). Collapsed shows first 2 + "+N more". Each subtask: checkbox (optimistic `setTodos` then `onUpdateTodo(id,{subtasks})` with rollback on error), hover-reveal Edit (inline rename, Enter/Escape/blur), flag button (visible only when `isFlagged`)
- Inline edit mode: title input (Enter save / Escape cancel), description textarea (Ctrl/Cmd+Enter save), tag pills, priority select, duration h/m number inputs, full subtask editor (add/rename/toggle/remove), Save/Cancel buttons; on save shows "Saved" toast 1.8s
- Hover actions: Edit, priority quick-select, Go-to-day (search only), Delete
- Flag button in actions column only rendered when `todo.isFlagged` (unflag); flagging a task is done via composer or search
- **Drag-drop reorder**: HTML5 dataTransfer, reorders local `todos` array only (App.jsx:375–412). `reorderTodo()` API fn exists in api.js:102 but is **never called — order is not persisted** (lost on reload). Cards with subtasks are draggable only when collapsed.

**Search behavior**: typing in TopBar search auto-navigates to `/search` (App.jsx:717–721); leaving `/search` clears query (710–714).

**Keyboard shortcuts** (all local, no global hotkey system): Escape closes add-card / sidebar / modals / cancels edits / clears search selection; Enter saves title edit & adds subtask; Ctrl/Cmd+Enter saves description.

**Guest banner** ("Hello guest… stored locally"), StatusBanner (guest mode / auth+todo error strip), loading spinner gate until `checkedIdentity && !loading`.

**No archive feature exists in the client** (no archive views/actions anywhere; grep confirms zero hits). Batch complete/uncomplete/delete exists only inside Advanced Search.

**Dead/vestigial in App.jsx**: `handleFontChange` is a no-op stub (`/* future: font provider */`, App.jsx:203) — the Settings font dropdown **does nothing** even though `ThemeProvider.changeFont` exists and works; `currentPage`/`onNavigate` unused by Sidebar; `guestStorage` unused; duplicated `renderHeroSection` (lines 631–706) is defined but the dashboards use inline duplicated JSX instead.

## 3. Feature pages

**AdvancedSearch** (`components/search/AdvancedSearch.jsx`, 700 lines): filters = free-text q (matches title/description/subtask titles/taskNumber incl. `#N`), taskNumber exact, tags (OR/any), priority any/low/medium/high, status any/active/completed, flaggedOnly checkbox, startDate/endDate, min/maxDuration (minutes), sortBy `date_desc|date_asc|date|priority|duration|name`. Quick-filter buttons: High Priority / Active / Completed / Sort newest-oldest toggle. Dual-mode engine: preloads current month via `fetchTodosForMonth` (search endpoint with startDate/endDate, limit 1000); client "Preview" results debounced 220ms for q≥2 chars (max 50 rows); server "Live" search debounced 400ms via `GET /todos/search?...` (paged, `limit=10`); guest mode filters `guestTodos` entirely client-side. Multi-select rows (click toggle, shift-click range, Esc clears) → batch **Delete** / **Mark as Done/Undone** via `POST /todos/batch {action:'delete'|'complete'|'uncomplete', ids}` (local-only in guest). Results grouped "This Week"/"Older" when date-sorted; row = #num, title, date pill (Today/Tomorrow/Yesterday/MMM d), description, tag chips, flag icon, edit button; double-click/double-tap row → go to day. Pagination Prev/Next.

**Statistics** (`components/statistics/Statistics.jsx`): **no chart library — hand-rolled inline SVG** `DonutChart` (completion %) and `LineChart` (tasks/day points) + CSS progress bars for Top Tags. Period tabs All/Day/Week/Month/Year with pickers (date, date-in-week + This/Last Week presets, month, year). Week-start preference `monday|sunday|saturday` loaded from `/me` (`profile.start_day_of_week` first, then `settings.layout.weekStart`), saved via `POST /settings {layout:{weekStart}}`. Metrics: Total, Completed, Avg Duration (m), Time Spent (m). Reads server shape `stats.periodTotals.{totalTodos,completedCount,completionRate,avgDuration,timeSpentTotal}` / `topTagsInPeriod` / `groups` with fallback flat keys `{totalTodos,completedCount,completionRate,avgDuration,timeSpentTotal,topTags,tasksPerDay}`; guest mode computes the flat shape locally.

**Settings modal** (`components/settings/Settings.jsx`): tabs Tags / Appearance / About / Import-Export.
- Tags: add (name + color input, random preset from 10-color palette: `#6366F1 #22C55E #EF4444 #F59E0B #3B82F6 #A855F7 #14B8A6 #EAB308 #FB7185 #0EA5E9`), inline edit (Enter/Escape), delete. **Uses server api.createTag/updateTag/deleteTag unconditionally — broken in guest mode** (parity bug to fix).
- Appearance: Theme select (9 themes), Font select (5 fonts — wired to no-op, see above), Font Size range 12–20 **with no onChange (non-functional)**.
- About: "Lifeline v1.0.0 … © 2025 Golden Gateway".
- Import/Export tab renders full ExportImport component inline; footer "Press Esc to close" but **no Esc handler on the Settings modal itself** (only overlay click).

**ExportImport** (`components/settings/ExportImport.jsx`): export format select JSON/CSV → `GET /export?format=` download (`todos_export_<ts>.json|csv`); import mode select `merge|replace`, file picker `.json,.csv` → `POST /import {data:<file text>, mode}`, success shows `importedCount`, completion triggers `window.location.reload()`; **Delete All Data** → confirm → `POST /reset-account` → reload. Requires fetchWithAuth (server-only; no guest path).

**ExportDataModal** (`components/settings/ExportDataModal.jsx`): guest-aware full JSON export `{exported_at, user, todos, tags, settings, stats}` → `lifeline-export-YYYY-MM-DD.json`; imported into Settings.jsx but **never rendered** — dead in app (covered only by tests).

**Profile** (`/profile` → `components/profile/ProfilePanel.jsx` = ProfileDetailsCard + ApiKeysCard):
- ProfileDetailsCard: fields first_name*, last_name*, email, phone, country, city, avatar_url (+preview); saves via `POST /profile` with browser `timezone` auto-injected; re-fetches `/me` after save. **No startDay field here** — startDay lives in Onboarding + Statistics week-start.
- ApiKeysCard (MCP keys): list `GET /mcp-api-keys` → `{apiKeys:[{id,name,keyPrefix,status:active|revoked|expired,scopes,createdAt,expiresAt,lastUsedAt}]}`; create `POST /mcp-api-keys {name, scopePreset:'read_only'|'read_write', expiryPreset:'1_day'|'7_days'|'30_days'|'90_days'|'never'}` → returns `{apiKey, plaintextKey}` shown once with copy-to-clipboard; revoke `POST /mcp-api-keys/:id/revoke`. Scope label mapping: `tasks:read`→"Read only", `tasks:read,tasks:write`→"Read and write".

**Onboarding** (`pages/OnboardingPage.jsx`): First/Last/Email required, Phone, Country (typing US/Canada/Mexico auto-sets startDay=Sunday else Monday), Start Day select Sunday/Monday/Saturday. Submits `POST /profile {first_name,last_name,email,timezone,phone,country,start_day_of_week,onboarding_completed:true}`; handles 409 email-conflict with "Use different email" recovery; refreshes identity then navigates `/`.

**Auth pages**: AuthPage = redirect-only to Auth0 Universal Login. `components/auth/Auth.jsx`, `SignInForm.jsx`, `SignUpForm.jsx` are **dead code** (local email/password forms never routed; forms don't authenticate — just call `onAuth()`). ProtectedRoute: `!isAuthenticated → <Navigate to="/auth">`.

**Layout**: two competing layouts — DashboardPage (Sidebar+TopBar+`.main-content`, also fetches `/me` and prints "Authenticated as: {sub}" debug footer) used for `/` and `/day/:day`; AppLayout (CSS-module version) used for search/stats/profile/settings pages. Sidebar (portal to body): quick-nav Home/Search/Stats + light-dark toggle (toggles `dark`↔`white` only) + Settings; ModernCalendar (month grid, S M T W T F S header, **hardcoded Sunday-first — ignores startDay pref**); Previous/Today/Next day buttons; version footer. TopBar: hamburger (mobile), "Home" title, search input, identity chip (avatar/initial + first name) with dropdown Profile/Settings/Logout, guest pill "Hello Guest" + Login button.

## 4. Design system

**Token source**: `styles/base.css` (all themes; lines 120–363). Canonical token names (per theme): `--color-primary, --color-primary-dark, --color-primary-light, --color-accent, --color-bg, --color-surface, --color-surface-light, --color-surface-hover, --color-text, --color-text-muted, --color-border, --color-border-hover, --color-danger, --shadow-primary, --shadow-dark`; `white`/`dark`/`blue-dark`/`clean-beige` also define `--color-top-bar-bg, --search-focus`. `white` additionally defines the global font/transition/radius tokens: `--font-family-base:"DM Sans",sans-serif; --font-family-heading:"Space Grotesk",sans-serif; --font-size-base:.875rem; --font-size-heading:1.875rem; --font-size-subheading:1.125rem; --transition-fast:.2s cubic-bezier(.4,0,.2,1); --transition-base:.3s; --transition-slow:.5s; --border-radius-small:8px; --border-radius-medium:12px; --border-radius-large:16px` (quirk: these only exist under `[data-theme='white']` — other themes inherit only if white was applied to root; html default is `data-theme="dark"` in index.html but ThemeProvider default is `white`).

**9 themes** (`ThemeProvider.themes`): `dark` (black `#000` + neon green `#0f4`), `blue-dark` (black + `#1E90FF`), `white` (default; white + green `rgb(48,199,99)`), `clean-beige` (`#fdfbf7` + taupe `#8b7765`), `pink` (`#FFF0F5` + `#FF69B4`), `red` (`#FFF5EE` + `#DC143C`), `blue` (`#F0F8FF` + `#1E90FF`), `midnight` (`#191970` + `#8A2BE2`), `sunset` (`#FFFAF0` + `#FF8C00`). Exact hex values in base.css:120–363.

**Layout tokens**: `:root` at base.css:393 `--sidebar-width:300px` then **overridden** at base.css:1589: `--sidebar-width:220px; --sidebar-width-large:260px` (≥1400px), `--layout-max-width:1280px; --gap-page:48px; --gap-page-mobile:24px`. `styles/variables.css`: `--space-2…--space-28` (2,4,6,8,10,12,14,16,20,24,28px), `--radius-8/10/12`. `design/spacing.css`: `--gap-xs:6 --gap-sm:8 --gap-md:12 --gap-lg:16 --gap-xl:20`. `design/typography.css`: `--font-h1:1.875rem --font-h2:1.5rem --font-h3:1.25rem --font-body:var(--font-size-base,.875rem)`. `design/colors.css`: `--brand-*` aliases of `--color-*`. `design/breakpoints.css`: `@custom-media --sm 640px / --md 768px / --lg 1024px` (max-width). Priority colors hardcoded in TaskCard: high `#ef4444`, medium `#FDBA74`, low `#6EE7B7`.

**Fonts**: Google Fonts `@import` at top of base.css: Space Grotesk (headings), DM Sans (body default), Inter, Montserrat. Font options in App.jsx:83–89: Inter, DM Sans, Space Grotesk, Montserrat, Times New Roman.

**Icons**: hand-rolled inline SVGs (Feather-style, 20×20, stroke=currentColor, strokeWidth 2) in `icons/Icons.jsx`: Logo, Sun, Moon, Delete, Check, Flag(filled prop), Settings, Calendar, Clock, Tomorrow, Menu, Tag, ChevronLeft/Right, Sparkles, Search, ArrowRight, Close, Edit, Note, Stats, Home; plus `icons/RepeatIcon.jsx`. No icon package.

**Misc**: `styles/cosmic-background.css` + `CosmicBackground.jsx` (DOM-generated starfield; only rendered when `showBackground` prop true — effectively off), `utils/themeColors.js` (JS color mirror, stale — doesn't match base.css values), global animation classes in base.css (`fade-in-slide-down`, `scale-in`, `task-card-enter-exit`, etc.), custom scrollbar, safe-area utilities in globals.css.

## 5. State/data layer

**Provider tree** (`app/main.jsx` → App): `AuthAdapterProvider` (Auth0Provider `cacheLocation=localstorage, useRefreshTokens=true`, or LocalAuthProvider stub when `VITE_AUTH_DISABLED=1` returning token `'local-compose-token'`) → BrowserRouter → ErrorBoundary → LoadingProvider (+LoadingOverlay) → `AuthProvider` → `ThemeProvider` → `TodoProvider` → AppInner.

- **AuthProvider** (`providers/AuthProvider.jsx`): resolves identity via `getAccessTokenSilently` (22s timeout race) + `GET /me`; sets `currentUser` (`{sub?, email, profile:{…, onboarding_completed}}`), `guestMode=true` when unauthenticated; clears `guest_todos`/`guest_tags` from localStorage on successful login (lines 67–75); exposes `login/logout/refreshIdentity/setGuestMode/checkedIdentity`.
- **ThemeProvider**: theme + font in localStorage keys `theme`/`font`; applies `data-theme` attr and `--font-family-base` inline; persists to `POST /api/settings {theme, layout:{font}}` (quiet401) for authed users.
- **TodoProvider** (`providers/TodoProvider.jsx`): holds `todos, tags, selectedDate('today')`, `searchQuery, sortOption('date'), selectedFilterTags, loading, error`. Branches every op guest vs server. `normalize()` coerces dueDate → `YYYY-MM-DD`|null. Loads todos+tags after identity resolves; **refetches todos on every selectedDate change** (recurrence freshness, line 120–126). 401/"Missing Refresh Token"/login_required → one-time automatic guest fallback (`guestFallbackAppliedRef`) with error "Session expired. Using guest mode.". CRUD: createTodo (prepends), updateTodo, toggleTodo, toggleFlag, deleteTodo — all **pessimistic** (await server, then setState) *except* subtask edits in TaskCard which are optimistic with rollback. `filteredTodos` memo: date filter (today/tomorrow/exact; `recurrence.mode==='dateRange'` matches any day in `[startDate,endDate]`), text filter (title+description), tag filter (must include ALL selected), then sort.
- **API client** (`utils/api.js`, 355 lines): plain-fetch functions all taking `fetchWithAuth` last-arg; endpoints: `/todos`, `/todos/search`, `/todos/:id`, `/todos/:id/toggle`, `/todos/:id/flag`, `/todos/:id/reorder` (unused), `/todos/batch`, `/todos/by-number/:n`, `/tags(/:id)`, `/stats(?period|?startDate&endDate)`, `/export?format=`, `/import`, `/settings`, `/profile`, `/me`, `/mcp-api-keys(/:id/revoke)`, `/reset-account`. Wraps mutations in `withLoading()` → module-level `loadingManager` stack (`startLoading(message)`/`stopLoading(token)`) → LoadingContext → global LoadingOverlay with min-visible 200ms. `utils/apiClient.js` (`createApiClient`) is a tiny GET-only wrapper — **unused/dead**. `utils/apiBase.js`: `VITE_API_BASE_URL` (default `/`), normalizes to `<base>/api`, strips leading `/api` from paths.
- **useApi.fetchWithAuth** (`hooks/useApi.js`): gets Auth0 token silently (20s timeout race), audience/scope from `VITE_AUTH0_AUDIENCE`/`VITE_AUTH0_SCOPE`; on "Missing Refresh Token" clears `auth0.*` localStorage keys and forces `loginWithRedirect` once; sets `Authorization: Bearer`, `Accept`, `Content-Type: application/json` (skipped for FormData); `quiet401` option returns raw response instead of throwing. **No caching layer, no SWR/React Query — plain state + refetch.**
- **NotificationPoller** (`providers/NotificationPoller.jsx`): **confirmed disabled no-op** — 7 lines, returns `null`, comment "Notifications temporarily disabled to stop outbound polling calls." Rendered in App at line 756 with an unused `onNotify` prop.

## 6. Guest-mode localStorage adapter

`utils/guestApi.js` + `hooks/useGuestStorage.js`. Keys: `guest_todos`, `guest_tags`. Mirrors api.js signatures 1:1 (`fetchTodos, createTodo(title,dueDate,tags,isFlagged,duration,priority,dueTime,subtasks,description,recurrence), updateTodo, deleteTodo, toggleTodo, toggleFlag, fetchTags, createTag, updateTag, deleteTag`) so TodoProvider can branch `guestMode ? guestApi.x : apiX`. Todo shape: `{id:uuidv4, title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence, isCompleted:false, createdAt, updatedAt, taskNumber:max+1}`. Recurrence expansion mirrors backend CreateTodo (guestApi.js:46–91): `mode daily|dateRange` → one todo per day start→end; `specificDays` → todos on matching weekdays (`selectedDays` lowercase names); legacy `type daily|weekly|monthly|custom` with `interval`. `toggleTodo` on completing a recurring todo spawns the single next occurrence (subtasks reset, new uuids) respecting endDate (lines 117–169). `getGuestTags` seeds/merges 10 default tags matching backend migration `1660000040000-AddDefaultTagsSupport`: Work `#3B82F6`, Personal `#10B981`, Health `#EF4444`, Finance `#F59E0B`, Study `#6366F1`, Family `#EC4899`, Errands `#6B7280`, Ideas `#8B5CF6`, Important `#DC2626`, Misc `#9CA3AF` (ids `tag-work`…`tag-misc`); re-adds missing defaults by case-insensitive name on every read. Not covered in guest mode: stats endpoint (computed inline in Statistics), export/import (server-only ExportImport; guest path only via dead ExportDataModal), settings persistence, Settings-modal tag CRUD (bug noted above).

## 7. client-next verdict

`client-next/` is an abandoned, source-less husk: it contains only `.env.example` (Next.js env names `NEXT_PUBLIC_API_URL`, Auth0 placeholders marked "Phase 2"), a `node_modules/`, and a stale `.next/` build-artifact directory — there is no `package.json`, no `app/`/`src/`/`pages/` source, and no config file at the top level. Nothing in `client/` or the running stack references it. Verdict: dead experiment (a Next.js scaffold whose source was deleted or never committed); safe to ignore entirely for the rebuild — the Vite `client/` is the sole real web client.

## Explicit dead-code / parity-bug list (for rebuild decisions)

| Item | Location | Status |
|---|---|---|
| `pages/SettingsPage.jsx` | imported App.jsx:19, never routed | dead |
| Second `/search` route | App.jsx:1671 | dead (shadowed) |
| `components/auth/Auth.jsx`, `SignInForm`, `SignUpForm`, `styles/auth.css` | never routed; forms don't auth | dead |
| `utils/apiClient.js` `createApiClient` | no callers | dead |
| `api.reorderTodo` | api.js:102 | never called → drag-drop order not persisted |
| `ExportDataModal` | imported Settings.jsx:3, never rendered | dead in app (test-only) |
| Font change from Settings | App.jsx:203 no-op despite working `ThemeProvider.changeFont` | broken |
| Font Size slider | Settings.jsx:428–437, no onChange | non-functional |
| Settings tag CRUD in guest mode | Settings.jsx uses server api only | broken in guest |
| `NotificationPoller` | providers/NotificationPoller.jsx | confirmed no-op (returns null) |
| Calendar week start | ModernCalendar.jsx:14 Sunday-hardcoded | ignores startDay pref |
| `useTheme.js` hook + `themeColors.js` | duplicate/stale theme systems vs ThemeProvider/base.css | vestigial |
| `renderHeroSection`, `currentPage`, `guestStorage`, `handleThemeChange` indirection | App.jsx | vestigial |
| Dashboard JSX duplicated for `/` and `/day/:day` | App.jsx 774–1656 vs 1716–2598 | consolidate in rebuild |
