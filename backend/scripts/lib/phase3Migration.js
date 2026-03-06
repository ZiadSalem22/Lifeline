const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mssql = require('mssql');
const { AppDataSource } = require('../../src/infra/db/data-source');
const { DEFAULT_TAGS } = require('../../src/infra/db/defaultTags');

const envFile = process.env.NODE_ENV === 'development' ? '.env.local' : '.env';
dotenv.config({ path: path.join(__dirname, '..', '..', envFile) });

const ARTIFACTS_ROOT = path.join(__dirname, '..', '..', '..', 'database', 'phase3');
const RUNS_ROOT = path.join(ARTIFACTS_ROOT, 'runs');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getRunDirectory(runId) {
  return ensureDir(path.join(RUNS_ROOT, runId));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getMssqlConfig() {
  const server = process.env.MSSQL_SERVER;
  const username = process.env.MSSQL_USERNAME;
  const password = process.env.MSSQL_PASSWORD;
  const database = process.env.MSSQL_DATABASE;

  if (!server || !username || !password || !database) {
    throw new Error('Missing MSSQL connection settings. Expected MSSQL_SERVER, MSSQL_USERNAME, MSSQL_PASSWORD, MSSQL_DATABASE.');
  }

  return {
    server,
    port: Number(process.env.MSSQL_PORT || 1433),
    user: username,
    password,
    database,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      instanceName: process.env.MSSQL_INSTANCE || undefined,
    },
  };
}

function normalizeText(value) {
  if (value == null) return null;
  const out = String(value).trim();
  return out.length ? out : null;
}

function normalizeEmail(value) {
  return normalizeText(value)?.toLowerCase() || null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  if (typeof value === 'number') return value === 1;
  const lowered = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(lowered);
}

function parseJsonObject(value, fallback = {}) {
  if (value == null || value === '') return { ok: true, value: fallback };
  if (typeof value === 'object' && !Array.isArray(value)) return { ok: true, value };
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { ok: false, reason: 'Expected JSON object' };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

function parseJsonArray(value, fallback = []) {
  if (value == null || value === '') return { ok: true, value: fallback };
  if (Array.isArray(value)) return { ok: true, value };
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
      return { ok: false, reason: 'Expected JSON array' };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

function normalizeWeekday(value) {
  const mapping = {
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
  };
  const normalized = normalizeText(value);
  if (!normalized) return 'Monday';
  return mapping[normalized.toLowerCase()] || 'Monday';
}

function uniqueByLatest(rows, keySelector) {
  const seen = new Map();
  for (const row of rows) {
    const key = keySelector(row);
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, row);
      continue;
    }

    const existingTs = new Date(existing.updated_at || existing.created_at || 0).getTime();
    const currentTs = new Date(row.updated_at || row.created_at || 0).getTime();
    if (currentTs >= existingTs) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

async function exportSnapshot({ runId = timestampId(), outputPath } = {}) {
  const resolvedRunId = runId;
  const runDir = getRunDirectory(resolvedRunId);
  const snapshotPath = outputPath || path.join(runDir, 'mssql-snapshot.json');
  const manifestPath = path.join(runDir, 'extract-manifest.json');
  const pool = await mssql.connect(getMssqlConfig());

  const datasets = {
    users: await pool.request().query(`
      SELECT id, auth0_sub, email, name, picture, role, subscription_status, created_at, updated_at
      FROM users
      ORDER BY id ASC
    `),
    user_profiles: await pool.request().query(`
      SELECT user_id, first_name, last_name, phone, country, city, timezone, avatar_url, onboarding_completed, start_day_of_week, created_at, updated_at
      FROM user_profiles
      ORDER BY user_id ASC
    `),
    user_settings: await pool.request().query(`
      SELECT user_id, theme, locale, layout, created_at, updated_at
      FROM user_settings
      ORDER BY user_id ASC
    `),
    todos: await pool.request().query(`
      SELECT id, user_id, task_number, title, description, due_date, due_time, is_completed, is_flagged, duration, priority, subtasks, [order], recurrence, next_recurrence_due, original_id, archived,
             CAST(NULL AS datetime) AS created_at,
             CAST(NULL AS datetime) AS updated_at
      FROM todos
      ORDER BY user_id ASC, task_number ASC, id ASC
    `),
    tags: await pool.request().query(`
      SELECT id, name, color, user_id, is_default,
             CAST(NULL AS datetime) AS created_at,
             CAST(NULL AS datetime) AS updated_at
      FROM tags
      ORDER BY CASE WHEN user_id IS NULL THEN 0 ELSE 1 END ASC, user_id ASC, name ASC, id ASC
    `),
    todo_tags: await pool.request().query(`
      SELECT todo_id, tag_id
      FROM todo_tags
      ORDER BY todo_id ASC, tag_id ASC
    `),
  };

  await pool.close();

  const snapshot = {
    metadata: {
      runId: resolvedRunId,
      generatedAt: new Date().toISOString(),
      source: 'mssql',
      tables: Object.fromEntries(Object.entries(datasets).map(([name, result]) => [name, result.recordset.length])),
    },
    users: datasets.users.recordset,
    user_profiles: datasets.user_profiles.recordset,
    user_settings: datasets.user_settings.recordset,
    todos: datasets.todos.recordset,
    tags: datasets.tags.recordset,
    todo_tags: datasets.todo_tags.recordset,
  };

  writeJson(snapshotPath, snapshot);
  writeJson(manifestPath, snapshot.metadata);

  return { runId: resolvedRunId, runDir, snapshotPath, manifestPath, snapshot };
}

function transformSnapshot(snapshot, { runId = snapshot?.metadata?.runId || timestampId() } = {}) {
  const runDir = getRunDirectory(runId);
  const transformedPath = path.join(runDir, 'transformed-snapshot.json');
  const reportPath = path.join(runDir, 'transform-report.json');
  const now = new Date().toISOString();
  const rejects = [];

  const users = [];
  const usersById = new Map();
  const auth0Subs = new Set();
  const emails = new Set();

  for (const row of snapshot.users || []) {
    const id = normalizeText(row.id);
    const auth0Sub = normalizeText(row.auth0_sub);
    if (!id || !auth0Sub) {
      rejects.push({ table: 'users', id: row.id || null, reason: 'Missing id or auth0_sub' });
      continue;
    }
    if (auth0Subs.has(auth0Sub)) {
      rejects.push({ table: 'users', id, reason: 'Duplicate auth0_sub' });
      continue;
    }
    const email = normalizeEmail(row.email);
    if (email && emails.has(email)) {
      rejects.push({ table: 'users', id, reason: 'Duplicate non-null email' });
      continue;
    }
    auth0Subs.add(auth0Sub);
    if (email) emails.add(email);
    const user = {
      id,
      auth0_sub: auth0Sub,
      email,
      name: normalizeText(row.name),
      picture: normalizeText(row.picture),
      role: normalizeText(row.role) || 'free',
      subscription_status: normalizeText(row.subscription_status) || 'none',
      created_at: normalizeTimestamp(row.created_at) || now,
      updated_at: normalizeTimestamp(row.updated_at) || now,
    };
    users.push(user);
    usersById.set(id, user);
  }

  const rawProfiles = uniqueByLatest(snapshot.user_profiles || [], row => normalizeText(row.user_id));
  const rawSettings = uniqueByLatest(snapshot.user_settings || [], row => normalizeText(row.user_id));

  const profiles = [];
  const profilesByUserId = new Map();
  for (const row of rawProfiles) {
    const userId = normalizeText(row.user_id);
    if (!userId || !usersById.has(userId)) {
      rejects.push({ table: 'user_profiles', id: row.user_id || null, reason: 'Missing or orphaned user_id' });
      continue;
    }
    const profile = {
      user_id: userId,
      first_name: normalizeText(row.first_name),
      last_name: normalizeText(row.last_name),
      phone: normalizeText(row.phone),
      country: normalizeText(row.country),
      city: normalizeText(row.city),
      timezone: normalizeText(row.timezone),
      avatar_url: normalizeText(row.avatar_url),
      onboarding_completed: normalizeBoolean(row.onboarding_completed),
      start_day_of_week: normalizeWeekday(row.start_day_of_week),
      created_at: normalizeTimestamp(row.created_at) || now,
      updated_at: normalizeTimestamp(row.updated_at) || now,
    };
    profiles.push(profile);
    profilesByUserId.set(userId, profile);
  }

  const settings = [];
  const settingsByUserId = new Map();
  for (const row of rawSettings) {
    const userId = normalizeText(row.user_id);
    if (!userId || !usersById.has(userId)) {
      rejects.push({ table: 'user_settings', id: row.user_id || null, reason: 'Missing or orphaned user_id' });
      continue;
    }
    const parsedLayout = parseJsonObject(row.layout, {});
    if (!parsedLayout.ok) {
      rejects.push({ table: 'user_settings', id: userId, reason: `Invalid layout JSON: ${parsedLayout.reason}` });
      continue;
    }
    const setting = {
      user_id: userId,
      theme: normalizeText(row.theme) || 'system',
      locale: normalizeText(row.locale) || 'en',
      layout: parsedLayout.value,
      created_at: normalizeTimestamp(row.created_at) || now,
      updated_at: normalizeTimestamp(row.updated_at) || now,
    };
    settings.push(setting);
    settingsByUserId.set(userId, setting);
  }

  for (const user of users) {
    if (!profilesByUserId.has(user.id)) {
      const backfilled = {
        user_id: user.id,
        first_name: null,
        last_name: null,
        phone: null,
        country: null,
        city: null,
        timezone: null,
        avatar_url: null,
        onboarding_completed: false,
        start_day_of_week: 'Monday',
        created_at: now,
        updated_at: now,
      };
      profiles.push(backfilled);
      profilesByUserId.set(user.id, backfilled);
    }

    if (!settingsByUserId.has(user.id)) {
      const backfilled = {
        user_id: user.id,
        theme: 'system',
        locale: 'en',
        layout: {},
        created_at: now,
        updated_at: now,
      };
      settings.push(backfilled);
      settingsByUserId.set(user.id, backfilled);
    }
  }

  const todos = [];
  const todoIds = new Set();
  const taskNumbersByUser = new Map();
  for (const row of snapshot.todos || []) {
    const id = normalizeText(row.id);
    const userId = normalizeText(row.user_id);
    const taskNumber = Number(row.task_number);
    if (!id || !userId || !usersById.has(userId)) {
      rejects.push({ table: 'todos', id: row.id || null, reason: 'Missing id or orphaned user_id' });
      continue;
    }
    if (!Number.isInteger(taskNumber) || taskNumber <= 0) {
      rejects.push({ table: 'todos', id, reason: 'Invalid task_number' });
      continue;
    }
    const perUser = taskNumbersByUser.get(userId) || new Set();
    if (perUser.has(taskNumber)) {
      rejects.push({ table: 'todos', id, reason: 'Duplicate task_number for user' });
      continue;
    }
    const parsedSubtasks = parseJsonArray(row.subtasks, []);
    const parsedRecurrence = row.recurrence == null || row.recurrence === ''
      ? { ok: true, value: null }
      : parseJsonObject(row.recurrence, null);
    if (!parsedSubtasks.ok) {
      rejects.push({ table: 'todos', id, reason: `Invalid subtasks JSON: ${parsedSubtasks.reason}` });
      continue;
    }
    if (!parsedRecurrence.ok) {
      rejects.push({ table: 'todos', id, reason: `Invalid recurrence JSON: ${parsedRecurrence.reason}` });
      continue;
    }
    const todo = {
      id,
      user_id: userId,
      task_number: taskNumber,
      title: normalizeText(row.title),
      description: normalizeText(row.description),
      due_date: normalizeTimestamp(row.due_date),
      due_time: normalizeText(row.due_time),
      is_completed: normalizeBoolean(row.is_completed),
      is_flagged: normalizeBoolean(row.is_flagged),
      duration: Number(row.duration || 0),
      priority: ['low', 'medium', 'high'].includes(String(row.priority || '').toLowerCase()) ? String(row.priority).toLowerCase() : 'medium',
      subtasks: parsedSubtasks.value,
      order: Number(row.order || 0),
      recurrence: parsedRecurrence.value,
      next_recurrence_due: normalizeTimestamp(row.next_recurrence_due),
      original_id: normalizeText(row.original_id),
      archived: normalizeBoolean(row.archived),
      created_at: normalizeTimestamp(row.created_at) || now,
      updated_at: normalizeTimestamp(row.updated_at) || now,
    };
    if (!todo.title) {
      rejects.push({ table: 'todos', id, reason: 'Missing title' });
      continue;
    }
    todos.push(todo);
    todoIds.add(id);
    perUser.add(taskNumber);
    taskNumbersByUser.set(userId, perUser);
  }

  for (const todo of todos) {
    if (todo.original_id && !todoIds.has(todo.original_id)) {
      todo.original_id = null;
    }
  }

  const tags = [];
  const tagIds = new Set();
  const defaultNames = new Set();
  const customNames = new Map();
  for (const row of snapshot.tags || []) {
    const id = normalizeText(row.id);
    const name = normalizeText(row.name);
    const color = normalizeText(row.color);
    const userId = normalizeText(row.user_id);
    const isDefault = normalizeBoolean(row.is_default);

    if (!id || !name || !color) {
      rejects.push({ table: 'tags', id: row.id || null, reason: 'Missing id, name, or color' });
      continue;
    }

    if ((isDefault && userId) || (!isDefault && !userId)) {
      rejects.push({ table: 'tags', id, reason: 'Contradictory default/custom tag ownership' });
      continue;
    }

    if (!isDefault && !usersById.has(userId)) {
      rejects.push({ table: 'tags', id, reason: 'Custom tag has orphaned user_id' });
      continue;
    }

    const lowered = name.toLowerCase();
    if (isDefault) {
      if (defaultNames.has(lowered)) continue;
      defaultNames.add(lowered);
    } else {
      const namespace = customNames.get(userId) || new Set();
      if (namespace.has(lowered)) {
        rejects.push({ table: 'tags', id, reason: 'Duplicate custom tag name within user namespace' });
        continue;
      }
      namespace.add(lowered);
      customNames.set(userId, namespace);
    }

    tagIds.add(id);
    tags.push({
      id,
      name,
      color,
      user_id: isDefault ? null : userId,
      is_default: isDefault,
      created_at: normalizeTimestamp(row.created_at) || now,
      updated_at: normalizeTimestamp(row.updated_at) || now,
    });
  }

  for (const def of DEFAULT_TAGS) {
    if (!defaultNames.has(def.name.toLowerCase())) {
      defaultNames.add(def.name.toLowerCase());
      tagIds.add(def.id);
      tags.push({
        id: def.id,
        name: def.name,
        color: def.color,
        user_id: null,
        is_default: true,
        created_at: now,
        updated_at: now,
      });
    }
  }

  const todoTags = [];
  const todoTagPairs = new Set();
  let orphanedTodoTags = 0;
  let duplicateTodoTags = 0;
  for (const row of snapshot.todo_tags || []) {
    const todoId = normalizeText(row.todo_id);
    const tagId = normalizeText(row.tag_id);
    if (!todoId || !tagId || !todoIds.has(todoId) || !tagIds.has(tagId)) {
      orphanedTodoTags += 1;
      continue;
    }
    const pairKey = `${todoId}::${tagId}`;
    if (todoTagPairs.has(pairKey)) {
      duplicateTodoTags += 1;
      continue;
    }
    todoTagPairs.add(pairKey);
    todoTags.push({ todo_id: todoId, tag_id: tagId, created_at: now });
  }

  const transformed = {
    metadata: {
      runId,
      generatedAt: now,
      sourceRunId: snapshot?.metadata?.runId || null,
    },
    users,
    user_profiles: profiles,
    user_settings: settings,
    todos,
    tags,
    todo_tags: todoTags,
  };

  const report = {
    metadata: transformed.metadata,
    counts: {
      source: snapshot.metadata?.tables || {},
      transformed: {
        users: users.length,
        user_profiles: profiles.length,
        user_settings: settings.length,
        todos: todos.length,
        tags: tags.length,
        todo_tags: todoTags.length,
      },
    },
    rejects,
    dropped: {
      orphanedTodoTags,
      duplicateTodoTags,
      backfilledProfiles: profiles.length - rawProfiles.length,
      backfilledSettings: settings.length - rawSettings.length,
      seededDefaultTags: tags.filter(tag => tag.is_default).length - Array.from(defaultNames).length + DEFAULT_TAGS.filter(def => !((snapshot.tags || []).some(tag => String(tag.name || '').trim().toLowerCase() === def.name.toLowerCase() && normalizeBoolean(tag.is_default)))).length,
    },
    success: rejects.length === 0,
  };

  writeJson(transformedPath, transformed);
  writeJson(reportPath, report);
  return { runId, runDir, transformedPath, reportPath, transformed, report };
}

async function importSnapshot(transformed, { runId = transformed?.metadata?.runId || timestampId() } = {}) {
  const runDir = getRunDirectory(runId);
  const reportPath = path.join(runDir, 'import-report.json');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  await AppDataSource.manager.transaction(async (manager) => {
    await manager.insert('User', transformed.users);
    await manager.insert('UserProfile', transformed.user_profiles);
    await manager.insert('UserSettings', transformed.user_settings);
    await manager.insert('Todo', transformed.todos);
    await manager.insert('Tag', transformed.tags);
    await manager.insert('TodoTag', transformed.todo_tags);
  });

  const report = {
    runId,
    importedAt: new Date().toISOString(),
    counts: {
      users: transformed.users.length,
      user_profiles: transformed.user_profiles.length,
      user_settings: transformed.user_settings.length,
      todos: transformed.todos.length,
      tags: transformed.tags.length,
      todo_tags: transformed.todo_tags.length,
    },
    success: true,
  };

  writeJson(reportPath, report);
  return { runId, runDir, reportPath, report };
}

async function validateTarget({ sourceSnapshot, transformedSnapshot, runId = transformedSnapshot?.metadata?.runId || timestampId() } = {}) {
  const runDir = getRunDirectory(runId);
  const reportPath = path.join(runDir, 'validation-report.json');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const counts = {
    users: await AppDataSource.getRepository('User').count(),
    user_profiles: await AppDataSource.getRepository('UserProfile').count(),
    user_settings: await AppDataSource.getRepository('UserSettings').count(),
    todos: await AppDataSource.getRepository('Todo').count(),
    tags: await AppDataSource.getRepository('Tag').count(),
    todo_tags: await AppDataSource.getRepository('TodoTag').count(),
  };

  const duplicateAuth0Sub = await AppDataSource.query(`
    SELECT auth0_sub, COUNT(*) AS count
    FROM users
    GROUP BY auth0_sub
    HAVING COUNT(*) > 1
  `);

  const duplicateEmail = await AppDataSource.query(`
    SELECT lower(email) AS email, COUNT(*) AS count
    FROM users
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  `);

  const duplicateTaskNumbers = await AppDataSource.query(`
    SELECT user_id, task_number, COUNT(*) AS count
    FROM todos
    GROUP BY user_id, task_number
    HAVING COUNT(*) > 1
  `);

  const orphanedProfiles = await AppDataSource.query(`
    SELECT p.user_id
    FROM user_profiles p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE u.id IS NULL
  `);

  const orphanedSettings = await AppDataSource.query(`
    SELECT s.user_id
    FROM user_settings s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE u.id IS NULL
  `);

  const orphanedTodos = await AppDataSource.query(`
    SELECT t.id
    FROM todos t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE u.id IS NULL
  `);

  const orphanedTodoTags = await AppDataSource.query(`
    SELECT tt.todo_id, tt.tag_id
    FROM todo_tags tt
    LEFT JOIN todos t ON t.id = tt.todo_id
    LEFT JOIN tags tg ON tg.id = tt.tag_id
    WHERE t.id IS NULL OR tg.id IS NULL
  `);

  const missingProfiles = await AppDataSource.query(`
    SELECT u.id
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  `);

  const missingSettings = await AppDataSource.query(`
    SELECT u.id
    FROM users u
    LEFT JOIN user_settings s ON s.user_id = u.id
    WHERE s.user_id IS NULL
  `);

  const invalidLayout = await AppDataSource.query(`
    SELECT user_id
    FROM user_settings
    WHERE jsonb_typeof(layout) <> 'object'
  `);

  const invalidSubtasks = await AppDataSource.query(`
    SELECT id
    FROM todos
    WHERE jsonb_typeof(subtasks) <> 'array'
  `);

  const invalidRecurrence = await AppDataSource.query(`
    SELECT id
    FROM todos
    WHERE recurrence IS NOT NULL AND jsonb_typeof(recurrence) <> 'object'
  `);

  const report = {
    runId,
    validatedAt: new Date().toISOString(),
    counts,
    expectedCounts: {
      users: transformedSnapshot.users.length,
      user_profiles: transformedSnapshot.user_profiles.length,
      user_settings: transformedSnapshot.user_settings.length,
      todos: transformedSnapshot.todos.length,
      tags: transformedSnapshot.tags.length,
      todo_tags: transformedSnapshot.todo_tags.length,
    },
    baselineCounts: sourceSnapshot.metadata?.tables || {},
    checks: {
      duplicateAuth0Sub: duplicateAuth0Sub.length,
      duplicateEmail: duplicateEmail.length,
      duplicateTaskNumbers: duplicateTaskNumbers.length,
      orphanedProfiles: orphanedProfiles.length,
      orphanedSettings: orphanedSettings.length,
      orphanedTodos: orphanedTodos.length,
      orphanedTodoTags: orphanedTodoTags.length,
      missingProfiles: missingProfiles.length,
      missingSettings: missingSettings.length,
      invalidLayout: invalidLayout.length,
      invalidSubtasks: invalidSubtasks.length,
      invalidRecurrence: invalidRecurrence.length,
    },
  };

  report.success =
    Object.entries(report.expectedCounts).every(([key, value]) => counts[key] === value) &&
    Object.values(report.checks).every(value => value === 0);

  writeJson(reportPath, report);
  return { runId, runDir, reportPath, report };
}

async function resetTargetDatabase() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const hasUsersTable = await AppDataSource.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `);

  if (!hasUsersTable[0]?.exists) {
    throw new Error('Target PostgreSQL schema is not initialized. Run the PostgreSQL migration before rehearsal.');
  }

  await AppDataSource.query(`
    TRUNCATE TABLE todo_tags, todos, tags, user_profiles, user_settings, users RESTART IDENTITY CASCADE
  `);
}

module.exports = {
  ARTIFACTS_ROOT,
  RUNS_ROOT,
  exportSnapshot,
  getRunDirectory,
  importSnapshot,
  readJson,
  resetTargetDatabase,
  timestampId,
  transformSnapshot,
  validateTarget,
  writeJson,
};
