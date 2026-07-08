# Feature-parity inventory (quality-gate checklist)

Tick at phase 12. ✱ = deliberate improvement over old behavior (see 05-decisions.md).

## Auth & identity
- [ ] Auth0 Universal Login (SPA redirect), refresh tokens, localStorage cache; logout
- [ ] `/api/v1/me` identity with role/roles (claim namespaces incl. legacy), profile, settings
- [ ] Onboarding: first/last/email required, phone, country (US/CA/MX ⇒ Sunday start), start-day select; 409 email-conflict recovery; one-way onboardingCompleted; auto-redirect until completed
- [ ] Guest mode: unauthenticated ⇒ local todos/tags in localStorage (`guest_todos`/`guest_tags`), 10 default tags seeded, recurrence expansion + spawn-next-on-complete client-side, wiped at login; 401 session-expiry auto-fallback to guest (once)
- [ ] AUTH_DISABLED=1 local-dev bypass with deterministic local user (server + `VITE_AUTH_DISABLED` client stub)
- [ ] Roles free/paid/admin; free-tier caps (200 active todos, 50 custom tags); promote-admin script ✱(effective now — no claim clobber)

## Todos (server + web)
- [ ] CRUD with validation (title ≤200, description ≤2000, duration 0–1440, priority low/med/high, dueDate date-only, dueTime HH:mm)
- [ ] Per-user task numbers (unique, immutable) + by-number lookup + `#N` search + load-as-template in composer
- [ ] Subtasks: stable subtaskId, ≤50, titles ≤500, positions re-sequenced; add/rename/toggle/remove inline; optimistic UI w/ rollback
- [ ] Recurrence: modes daily/dateRange/specificDays + legacy types; pre-generate on create; dateRange spans match every day in range; recurrence badge + selector modal UI
- [ ] Complete/uncomplete (checkbox + double-click card), flag, priority quick-set, inline edit (title/desc/tags/priority/duration/subtasks) with keyboard shortcuts (Enter/Escape/Ctrl+Enter)
- [ ] Drag-drop reorder ✱(persisted via PATCH order — old client never saved it)
- [ ] Archive lifecycle: DELETE=archive (tags preserved ✱), restore, archived excluded from lists by default; archived mutations 409 ✱(guards actually work)
- [ ] Batch complete/uncomplete/archive/restore with per-item results ✱(restore new to REST)
- [ ] Search: q over title/description/subtasks/taskNumber, tag/priority/status/flag/date-range/duration filters, sorts, pagination
- [ ] Similar tasks (pg_trgm) ✱(now public REST, used by composer/MCP)
- [ ] Day views: today/tomorrow/`/day/:date` routes, date filtering incl. dateRange spans, total-duration pill, progress bar, tag-filter chips (AND), sort select, empty state

## Tags
- [ ] Defaults (10, global, immutable) + per-user custom CRUD, hex color ✱(validated `#RRGGBB`), dup-name 409, defaults-first ordering
- [ ] Tag chips on cards toggle filters; composer tag picker + create-tag modal; Settings tag manager ✱(works in guest mode too)

## Profile / Settings / Stats
- [ ] Profile details card (names, email, phone, country, city, avatarUrl+preview, auto timezone); MCP API keys card (create w/ presets, plaintext-once + copy, list, revoke)
- [ ] Settings modal: tags, appearance (9 themes, font select ✱wired, font size ✱wired or removed), about, import/export
- [ ] Theme/font persisted locally + `PUT /me/settings` for authed users
- [ ] Statistics page: donut (completion), line (tasks/day), top-tags bars; period tabs All/Day/Week/Month/Year with pickers; week-start preference (profile startDayOfWeek, fallback settings.layout.weekStart) ✱(calendar + MCP windows respect it too)
- [ ] Export JSON/CSV download; import merge/replace w/ count feedback ✱(transactional); reset account (danger confirm)

## MCP (embedded ✱)
- [ ] All 28 tools, same names/schemas/result shapes (see 04-mcp-tool-surface.md)
- [ ] Dual auth: `lk_…` API keys (same hash scheme — existing keys keep working) + Auth0 OAuth; scope enforcement tasks:read/write
- [ ] Streamable HTTP stateless at `/mcp`; OAuth protected-resource metadata; per-principal rate limit ✱
- [ ] Self-serve key lifecycle from web UI

## Ops
- [ ] `/health/live` + `/health/ready` (DB + JWKS state); graceful shutdown; pino request logs w/ request IDs
- [ ] Multi-stage Dockerfile (web build → server runtime serving SPA), compose dev + prod, deploy-branch workflow updated
- [ ] Baseline migration adopts existing prod DB without data loss (guide in final docs)
- [ ] CI green: lint, format, typecheck, test, build

## Explicitly dropped (documented)
- Notifications (410 stubs + no-op poller), `/api/ai`, `/api/admin` HTTP namespace, `client-next/`, cosmic background (dead flag), legacy local auth forms (dead code), public schema-dump endpoint.
