#!/usr/bin/env node
process.env.AUTH_DISABLED = '1';
process.env.AUTH_LOCAL_USER_ID = process.env.AUTH_LOCAL_USER_ID || 'guest-local';

const request = require('supertest');
const { AppDataSource } = require('../src/infra/db/data-source');
const app = require('../src/index');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const runSuffix = Date.now();

  const me = await request(app).get('/api/me');
  if (me.statusCode !== 200) throw new Error(`/api/me failed with ${me.statusCode}`);
  assert(me.body && me.body.id, '/api/me did not return a user id');

  const profilePayload = {
    first_name: 'Phase3',
    last_name: 'Verifier',
    email: null,
    phone: '555-0100',
    country: 'Local',
    city: 'Verifier City',
    avatar_url: null,
    timezone: 'UTC',
    start_day_of_week: 'Monday',
    onboarding_completed: true,
  };
  const savedProfile = await request(app).post('/api/profile').send(profilePayload);
  if (savedProfile.statusCode !== 200) throw new Error(`/api/profile failed with ${savedProfile.statusCode}`);
  assert(savedProfile.body.start_day_of_week === 'Monday', '/api/profile did not persist start_day_of_week correctly');
  assert(!Object.prototype.hasOwnProperty.call(savedProfile.body, 'birthday'), '/api/profile response still exposes birthday');

  const savedSettings = await request(app).post('/api/settings').send({ theme: 'dark', locale: 'en', layout: { weekStart: 'Monday', font: 'inter' } });
  if (savedSettings.statusCode !== 200) throw new Error(`/api/settings failed with ${savedSettings.statusCode}`);
  assert(savedSettings.body.theme === 'dark', '/api/settings did not persist theme');
  assert(savedSettings.body.locale === 'en', '/api/settings did not persist locale');
  assert(savedSettings.body.layout && savedSettings.body.layout.weekStart === 'Monday', '/api/settings did not persist layout');

  const meAfterSetup = await request(app).get('/api/me');
  if (meAfterSetup.statusCode !== 200) throw new Error(`/api/me reload failed with ${meAfterSetup.statusCode}`);
  assert(meAfterSetup.body.profile?.first_name === 'Phase3', 'Profile reload did not return saved first_name');
  assert(meAfterSetup.body.profile?.city === 'Verifier City', 'Profile reload did not return saved city');
  assert(meAfterSetup.body.profile?.start_day_of_week === 'Monday', 'Profile reload did not return saved week start');
  assert(!Object.prototype.hasOwnProperty.call(meAfterSetup.body.profile || {}, 'birthday'), '/api/me profile still exposes birthday');
  assert(meAfterSetup.body.settings?.theme === 'dark', '/api/me did not return saved settings theme');
  assert(meAfterSetup.body.settings?.layout?.weekStart === 'Monday', '/api/me did not return saved settings layout');

  const createdTag = await request(app).post('/api/tags').send({ name: `Phase 3 Tag ${runSuffix}`, color: '#123456' });
  if (createdTag.statusCode !== 201) throw new Error(`/api/tags POST failed with ${createdTag.statusCode}`);
  assert(createdTag.body.name === `Phase 3 Tag ${runSuffix}`, '/api/tags POST returned unexpected name');

  const createdTodo = await request(app).post('/api/todos').send({
    title: `Phase 3 smoke todo ${runSuffix}`,
    dueDate: '2026-03-06',
    tags: [{
      id: createdTag.body.id,
      name: createdTag.body.name,
      color: createdTag.body.color,
      userId: createdTag.body.userId || process.env.AUTH_LOCAL_USER_ID || 'guest-local',
      isDefault: false,
    }],
    isFlagged: true,
    duration: 30,
    priority: 'high',
    dueTime: '09:30',
    subtasks: [{ id: 'sub-1', title: 'Verify smoke path', isCompleted: false }],
    description: 'Created during Phase 3 verification',
    recurrence: null,
  });
  if (createdTodo.statusCode !== 201) throw new Error(`/api/todos POST failed with ${createdTodo.statusCode}`);
  assert(createdTodo.body.title === `Phase 3 smoke todo ${runSuffix}`, '/api/todos POST returned unexpected title');
  assert(Array.isArray(createdTodo.body.tags) && createdTodo.body.tags.some((tag) => tag.id === createdTag.body.id), 'Created todo is missing the created tag');

  const todoId = createdTodo.body.id;

  const updatedTodo = await request(app).patch(`/api/todos/${todoId}`).send({
    title: `Phase 3 smoke todo ${runSuffix} updated`,
    description: 'Updated during verification',
    priority: 'medium',
    duration: 45,
    tags: [{
      id: createdTag.body.id,
      name: createdTag.body.name,
      color: createdTag.body.color,
      userId: createdTag.body.userId || process.env.AUTH_LOCAL_USER_ID || 'guest-local',
      isDefault: false,
    }],
  });
  if (updatedTodo.statusCode !== 200) throw new Error(`/api/todos/:id PATCH failed with ${updatedTodo.statusCode}`);
  assert(updatedTodo.body.title.endsWith('updated'), '/api/todos PATCH did not update title');
  assert(updatedTodo.body.duration === 45, '/api/todos PATCH did not update duration');

  const toggledTodo = await request(app).patch(`/api/todos/${todoId}/toggle`);
  if (toggledTodo.statusCode !== 200) throw new Error(`/api/todos/:id/toggle failed with ${toggledTodo.statusCode}`);
  assert(toggledTodo.body.isCompleted === true, '/api/todos/:id/toggle did not mark the todo completed');

  const listedTodos = await request(app).get('/api/todos');
  if (listedTodos.statusCode !== 200 || !Array.isArray(listedTodos.body) || listedTodos.body.length === 0) {
    throw new Error('/api/todos GET did not return todos');
  }
  const listedTodo = listedTodos.body.find((todo) => todo.id === todoId);
  assert(!!listedTodo, '/api/todos GET did not include the created todo');
  assert(listedTodo.isCompleted === true, '/api/todos GET did not reflect the toggled completion state');
  assert(Array.isArray(listedTodo.tags) && listedTodo.tags.some((tag) => tag.id === createdTag.body.id), '/api/todos GET did not preserve tag association');

  const tags = await request(app).get('/api/tags');
  if (tags.statusCode !== 200 || !Array.isArray(tags.body)) {
    throw new Error('/api/tags GET failed');
  }
  assert(tags.body.some((tag) => tag.id === createdTag.body.id), '/api/tags GET did not return the created custom tag');

  const stats = await request(app).get('/api/stats?period=month');
  if (stats.statusCode !== 200) throw new Error(`/api/stats failed with ${stats.statusCode}`);
  assert(typeof stats.body.periodTotals?.totalTodos === 'number' && stats.body.periodTotals.totalTodos >= 1, '/api/stats did not return a sensible totalTodos value');
  assert(typeof stats.body.periodTotals?.completedCount === 'number' && stats.body.periodTotals.completedCount >= 1, '/api/stats did not return a sensible completedCount value');
  assert(Array.isArray(stats.body.groups), '/api/stats did not return a groups array');

  const exported = await request(app).get('/api/export?format=json');
  if (exported.statusCode !== 200) throw new Error(`/api/export failed with ${exported.statusCode}`);
  assert(Array.isArray(exported.body.todos), '/api/export did not return a todos array');
  assert(Array.isArray(exported.body.tags), '/api/export did not return a tags array');
  assert(exported.body.user?.profile?.first_name === 'Phase3', '/api/export did not include saved profile data');
  assert(!Object.prototype.hasOwnProperty.call(exported.body.user?.profile || {}, 'birthday'), '/api/export still exposes birthday');
  assert(exported.body.todos.some((todo) => todo.id === todoId), '/api/export did not include the created todo');
  assert(exported.body.tags.some((tag) => tag.id === createdTag.body.id), '/api/export did not include the created tag');

  const pendingNotifications = await request(app).get('/api/notifications/pending');
  if (pendingNotifications.statusCode !== 200) throw new Error(`/api/notifications/pending failed with ${pendingNotifications.statusCode}`);
  assert(Array.isArray(pendingNotifications.body) && pendingNotifications.body.length === 0, '/api/notifications/pending should return an empty array');

  const scheduledNotification = await request(app).post('/api/notifications/schedule').send({ todoId, minutesBefore: 5 });
  if (scheduledNotification.statusCode !== 410) throw new Error(`/api/notifications/schedule expected 410, got ${scheduledNotification.statusCode}`);

  const markedNotification = await request(app).patch('/api/notifications/some-id/sent');
  if (markedNotification.statusCode !== 410) throw new Error(`/api/notifications/:id/sent expected 410, got ${markedNotification.statusCode}`);

  console.log(JSON.stringify({
    verifiedAt: new Date().toISOString(),
    meStatus: me.statusCode,
    meReloadStatus: meAfterSetup.statusCode,
    profileStatus: savedProfile.statusCode,
    settingsStatus: savedSettings.statusCode,
    createdTagId: createdTag.body.id,
    createdTodoId: todoId,
    updatedTodoStatus: updatedTodo.statusCode,
    toggledTodoStatus: toggledTodo.statusCode,
    todoCount: listedTodos.body.length,
    tagCount: tags.body.length,
    statsStatus: stats.statusCode,
    exportStatus: exported.statusCode,
    pendingNotificationsStatus: pendingNotifications.statusCode,
    scheduleNotificationStatus: scheduledNotification.statusCode,
    markNotificationStatus: markedNotification.statusCode,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[verify-local-postgres-runtime] Failed:', error && error.stack ? error.stack : error);
    process.exit(1);
  })
  .finally(async () => {
    try { if (AppDataSource.isInitialized) await AppDataSource.destroy(); } catch (_) {}
  });
