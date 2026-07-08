# API contract v1

Conventions: base `/api/v1`; Bearer JWT (Auth0) unless marked public; camelCase JSON; errors are RFC 7807
`application/problem+json` (`@lifeline/shared` `problemSchema`); all list endpoints return
`{items, page, pageSize, totalItems, totalPages}`; zod schemas in `packages/shared` are the normative
request/response types — this table is the map, not the shape source.

## Resource shapes (normative: packages/shared)

- **Todo**: `{id, taskNumber, title, description, dueDate('YYYY-MM-DD'|null), dueTime('HH:mm'|null),
  isCompleted, isFlagged, duration(0-1440), priority('low'|'medium'|'high'), tags: Tag[],
  subtasks: [{subtaskId, title, isCompleted, position}], order, recurrence(object|null),
  originalId(uuid|null), archived, createdAt, updatedAt}`
- **Tag**: `{id, name, color('#RRGGBB'), userId(null for defaults), isDefault}`
- **Me**: `{id, email, name, picture, role, roles[], subscriptionStatus, profile: Profile|null, settings: Settings|null}`
- **Profile**: `{firstName, lastName, phone, country, city, timezone, avatarUrl, startDayOfWeek('Monday'…'Sunday'), onboardingCompleted}`
- **Settings**: `{theme('light'|'dark'|'system'), locale, layout(object)}`
- **McpKey**: `{id, name, keyPrefix, scopes[], status('active'|'expired'|'revoked'), createdAt, expiresAt, lastUsedAt, revokedAt}`

## Endpoints

| Method + path | Auth | Notes |
| --- | --- | --- |
| GET /health/live | public | `{status:'ok'}` — process up |
| GET /health/ready | public | `{ready, db, auth}` 200/503 — DB ping + JWKS warm state |
| GET /api/v1/info | public | `{name, version, guestMode:'local-only', time}` |
| GET /api/v1/me | JWT | Me (profile null ⇒ client routes to onboarding) |
| PUT /api/v1/me/profile | JWT | body Profile (firstName+lastName required; onboardingCompleted one-way true); 409 email conflict |
| PUT /api/v1/me/settings | JWT | body Settings partial; upsert |
| GET /api/v1/todos | JWT | filters: `q, tags(csv ids), priority, status(active\|completed), flagged, startDate, endDate, minDuration, maxDuration, taskNumber, includeArchived, sortBy(priority\|duration\|name\|date_desc), page, pageSize(≤100)`; default sort dueDate ASC NULLS LAST, order, taskNumber; archived excluded by default |
| POST /api/v1/todos | JWT | create; recurrence pre-expansion (returns first todo, `X-Total-Created` header for expansion count); 403 free-tier ≥200 active |
| GET /api/v1/todos/similar | JWT | `title(1-200), limit(1-20 def 5), threshold(0.1-1 def 0.3)` → `{items, query}` (pg_trgm) |
| GET /api/v1/todos/by-number/:taskNumber | JWT | 404 if none (archived resolvable) |
| GET /api/v1/todos/:id | JWT | 404 |
| PATCH /api/v1/todos/:id | JWT | partial: title, description, dueDate, dueTime, tags(ids or objects), isFlagged, duration, priority, subtasks(whole-array, subtaskId-stable), order; recurrence immutable → 400; archived → 409 |
| POST /api/v1/todos/:id/complete · /uncomplete | JWT | `{todo}`; archived → 409 |
| POST /api/v1/todos/:id/archive · /restore | JWT | idempotent; archive preserves tags |
| DELETE /api/v1/todos/:id | JWT | alias of archive; 204 |
| POST /api/v1/todos/batch | JWT | `{action: complete\|uncomplete\|archive\|restore, ids(1-100)}` → `{action, results:[{id, status, reason?}]}` |
| GET /api/v1/todos/:id/… subtask ops | JWT | POST `/subtasks` `{title}` · PATCH/DELETE `/subtasks/:subtaskId` · POST `/subtasks/:subtaskId/complete`·`/uncomplete` — all return updated Todo; archived parent → 409 |
| GET /api/v1/tags | JWT | defaults + own custom (defaults first, then name ASC) — plain array (small, unpaginated by design; documented exception) |
| POST /api/v1/tags | JWT | `{name(1-50), color(#RRGGBB)}`; 403 free-tier ≥50 custom; 409 duplicate name |
| PATCH /api/v1/tags/:id | JWT | 403 default/not-owner; 404 |
| DELETE /api/v1/tags/:id | JWT | 204; 403 default; 404 |
| GET /api/v1/stats | JWT | `?period=day\|week\|month\|year` or `?startDate&endDate` → `{periodTotals:{totalTodos, completedCount, completionRate, avgDuration, timeSpentTotal}, topTags:[{id,name,color,count}]≤10, groups:[{period, date, count}]}` |
| GET /api/v1/export | JWT | `?format=json\|csv` attachment; same payload family as old (camelCase user block) |
| POST /api/v1/import | JWT | `{data: object\|string, mode:'merge'\|'replace'}` → `{importedCount}`; transactional |
| POST /api/v1/account/reset | JWT | deletes todos + custom tags + settings; keeps user/profile/keys |
| GET /api/v1/mcp-keys | JWT | `?limit(1-50 def 25)` → `{items:[McpKey]}` |
| POST /api/v1/mcp-keys | JWT, 10/min | `{name(1-100), scopePreset:'read_only'\|'read_write', expiryPreset:'1_day'\|'7_days'\|'30_days'\|'90_days'\|'never'}` → 201 `{apiKey, plaintextKey}` (once) |
| POST /api/v1/mcp-keys/:id/revoke | JWT, 10/min | idempotent; 404 |
| POST /mcp (+ OAuth metadata well-knowns) | API key / Auth0 Bearer | embedded MCP module — see 04-mcp-tool-surface.md |
| GET /api/docs, /api/docs/openapi.json | public | OpenAPI 3.1 generated from the zod route registry |

Rate limits: `/api/v1/todos*` 60/min/user; mcp-key writes 10/min/user; MCP endpoint 120/min/principal.
Static SPA serving: production serves `apps/web/dist` with SPA fallback excluding `/api`, `/mcp`, `/health`.
