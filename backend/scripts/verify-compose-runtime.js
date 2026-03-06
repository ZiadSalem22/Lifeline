#!/usr/bin/env node

const DEFAULT_BASE_URL = `http://localhost:${process.env.APP_PORT || 3020}`;
const BASE_URL = (process.env.LIFELINE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectJson(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function expectText(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const payload = await response.text();
  return { response, payload };
}

async function main() {
  const root = await expectText('/');
  assert(root.response.ok, `GET / failed with ${root.response.status}`);
  assert(root.payload.includes('<div id="root"></div>'), 'GET / did not return the frontend shell');

  const statisticsRoute = await expectText('/statistics');
  assert(statisticsRoute.response.ok, `GET /statistics failed with ${statisticsRoute.response.status}`);
  assert(statisticsRoute.payload.includes('<div id="root"></div>'), 'GET /statistics did not resolve through SPA fallback');

  const dbHealth = await expectJson('/api/health/db');
  assert(dbHealth.response.ok, `/api/health/db failed with ${dbHealth.response.status}`);
  assert(dbHealth.payload?.db === 'ok', '/api/health/db did not return db=ok');

  const me = await expectJson('/api/me');
  assert(me.response.ok, `/api/me failed with ${me.response.status}`);
  assert(me.payload?.id, '/api/me did not return a user id');

  const runSuffix = Date.now();
  const profile = await expectJson('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Phase4',
      last_name: 'Compose',
      email: null,
      phone: '555-0200',
      country: 'Local',
      city: 'Compose City',
      avatar_url: null,
      timezone: 'UTC',
      start_day_of_week: 'Monday',
      onboarding_completed: true,
    }),
  });
  assert(profile.response.ok, `/api/profile failed with ${profile.response.status}`);

  const settings = await expectJson('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'dark', locale: 'en', layout: { weekStart: 'Monday', font: 'inter' } }),
  });
  assert(settings.response.ok, `/api/settings failed with ${settings.response.status}`);

  const tag = await expectJson('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Phase 4 Tag ${runSuffix}`, color: '#654321' }),
  });
  assert(tag.response.status === 201, `/api/tags POST failed with ${tag.response.status}`);

  const todo = await expectJson('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Phase 4 compose todo ${runSuffix}`,
      dueDate: '2026-03-06',
      tags: [tag.payload],
      isFlagged: true,
      duration: 20,
      priority: 'high',
      dueTime: '10:00',
      subtasks: [{ id: 'compose-subtask-1', title: 'Verify compose flow', isCompleted: false }],
      description: 'Created during Phase 4 compose verification',
      recurrence: null,
    }),
  });
  assert(todo.response.status === 201, `/api/todos POST failed with ${todo.response.status}`);

  const tags = await expectJson('/api/tags');
  assert(tags.response.ok, `/api/tags GET failed with ${tags.response.status}`);
  assert(Array.isArray(tags.payload) && tags.payload.some((entry) => entry.id === tag.payload.id), '/api/tags GET did not return the created tag');

  const todos = await expectJson('/api/todos');
  assert(todos.response.ok, `/api/todos GET failed with ${todos.response.status}`);
  assert(Array.isArray(todos.payload) && todos.payload.some((entry) => entry.id === todo.payload.id), '/api/todos GET did not return the created todo');

  const stats = await expectJson('/api/stats?period=month');
  assert(stats.response.ok, `/api/stats failed with ${stats.response.status}`);
  assert(typeof stats.payload?.periodTotals?.totalTodos === 'number', '/api/stats did not return periodTotals.totalTodos');

  const exported = await expectJson('/api/export?format=json');
  assert(exported.response.ok, `/api/export failed with ${exported.response.status}`);
  assert(Array.isArray(exported.payload?.todos), '/api/export did not return a todos array');
  assert(Array.isArray(exported.payload?.tags), '/api/export did not return a tags array');

  console.log(JSON.stringify({
    verifiedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    rootStatus: root.response.status,
    statisticsRouteStatus: statisticsRoute.response.status,
    dbHealthStatus: dbHealth.response.status,
    meStatus: me.response.status,
    profileStatus: profile.response.status,
    settingsStatus: settings.response.status,
    tagStatus: tag.response.status,
    todoStatus: todo.response.status,
    tagsStatus: tags.response.status,
    todosStatus: todos.response.status,
    statsStatus: stats.response.status,
    exportStatus: exported.response.status,
    createdTagId: tag.payload.id,
    createdTodoId: todo.payload.id,
    todoCount: Array.isArray(todos.payload) ? todos.payload.length : null,
  }, null, 2));
}

main().catch((error) => {
  console.error('[verify-compose-runtime] Failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});