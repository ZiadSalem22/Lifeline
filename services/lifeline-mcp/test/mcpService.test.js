import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import express from 'express';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const require = createRequire(import.meta.url);
const { createInternalMcpRouter } = require('../../../backend/src/internal/mcp/router');
const { errorHandler } = require('../../../backend/src/middleware/errorHandler');
const { ResolveMcpApiKeyPrincipal } = require('../../../backend/src/application/ResolveMcpApiKeyPrincipal');
const { hashMcpApiKeySecret } = require('../../../backend/src/utils/mcpApiKeys');

const INIT_REQUEST = {
  jsonrpc: '2.0',
  id: 'init-1',
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: {
      name: 'lifeline-mcp-test-client',
      version: '1.0.0',
    },
  },
};

function buildMcpConfig(env = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    MCP_BIND_HOST: '127.0.0.1',
    MCP_PORT: '3030',
    MCP_ALLOWED_HOSTS: '',
    LIFELINE_BACKEND_BASE_URL: 'http://127.0.0.1:3000',
    MCP_INTERNAL_SHARED_SECRET: 'shared-secret',
    MCP_REQUEST_TIMEOUT_MS: '5000',
    MCP_LOG_LEVEL: 'info',
    ...env,
  });
}

function createTask(overrides = {}) {
  return {
    id: 'task-1',
    taskNumber: 1,
    title: 'Milk run',
    description: '',
    dueDate: '2026-03-07',
    dueTime: null,
    isCompleted: false,
    isFlagged: false,
    duration: 0,
    priority: 'medium',
    tags: [],
    subtasks: [],
    order: 0,
    recurrence: null,
    nextRecurrenceDue: null,
    originalId: null,
    archived: false,
    userId: 'user-1',
    ...overrides,
  };
}

function cloneTask(task) {
  return JSON.parse(JSON.stringify(task));
}

function createInMemoryTaskStore() {
  const tasksByUser = new Map([
    ['user-1', [createTask({ id: 'task-u1-1', taskNumber: 1, title: 'User one task' })]],
    ['user-2', [createTask({ id: 'task-u2-1', taskNumber: 1, title: 'User two task', userId: 'user-2' })]],
  ]);

  const tagsByUser = new Map([
    ['user-1', [{ id: 'tag-1', name: 'Inbox', color: '#000', userId: 'user-1', isDefault: true }]],
    ['user-2', [{ id: 'tag-2', name: 'Inbox', color: '#000', userId: 'user-2', isDefault: true }]],
  ]);

  function getUserTasks(userId) {
    if (!tasksByUser.has(userId)) {
      tasksByUser.set(userId, []);
    }
    return tasksByUser.get(userId);
  }

  function getUserTags(userId) {
    if (!tagsByUser.has(userId)) {
      tagsByUser.set(userId, []);
    }
    return tagsByUser.get(userId);
  }

  function findTaskById(userId, id) {
    return getUserTasks(userId).find((task) => task.id === id) || null;
  }

  function findTaskByNumber(userId, taskNumber) {
    return getUserTasks(userId).find((task) => task.taskNumber === taskNumber) || null;
  }

  let tagIdCounter = 100;

  return {
    todoRepository: {
      async findByTaskNumber(userId, taskNumber) {
        const task = findTaskByNumber(userId, taskNumber);
        return task ? cloneTask(task) : null;
      },
      async findById(id, userId) {
        const task = findTaskById(userId, id);
        return task ? cloneTask(task) : null;
      },
      async countByUser(userId) {
        return getUserTasks(userId).filter((task) => !task.archived).length;
      },
      async save(task) {
        const userTasks = getUserTasks(task.userId);
        const index = userTasks.findIndex((candidate) => candidate.id === task.id);
        if (index >= 0) {
          userTasks[index] = cloneTask(task);
        } else {
          userTasks.push(cloneTask(task));
        }
        return cloneTask(task);
      },
      async delete(id, userId) {
        const userTasks = getUserTasks(userId);
        const index = userTasks.findIndex((task) => task.id === id);
        if (index >= 0) {
          userTasks.splice(index, 1);
        }
      },
      async unarchive(id, userId) {
        const task = findTaskById(userId, id);
        if (task) {
          task.archived = false;
        }
      },
      async findSimilarByTitle(userId, title, { limit = 5 } = {}) {
        const normalised = title.toLowerCase();
        return getUserTasks(userId)
          .filter((t) => !t.archived && t.title.toLowerCase().includes(normalised.slice(0, 4)))
          .slice(0, limit)
          .map(cloneTask);
      },
    },
    searchTodos: {
      async execute(userId, filters = {}) {
        let tasks = getUserTasks(userId).filter((task) => !task.archived);
        const query = String(filters.q || '').trim().toLowerCase();
        if (query) {
          tasks = tasks.filter((task) => task.title.toLowerCase().includes(query));
        }
        if (filters.taskNumber) {
          tasks = tasks.filter((task) => task.taskNumber === filters.taskNumber);
        }
        return {
          todos: tasks.map(cloneTask),
          total: tasks.length,
        };
      },
    },
    listTodos: {
      async execute(userId) {
        return getUserTasks(userId).filter((task) => !task.archived).map(cloneTask);
      },
    },
    createTodoForInternalMcp: {
      async execute(userId, payload) {
        const userTasks = getUserTasks(userId);
        const nextTaskNumber = userTasks.reduce((max, task) => Math.max(max, task.taskNumber || 0), 0) + 1;
        const newTask = createTask({
          ...payload,
          id: `task-${userId}-${nextTaskNumber}`,
          taskNumber: nextTaskNumber,
          userId,
          title: payload.title,
          description: payload.description || '',
          dueDate: payload.dueDate || null,
          dueTime: payload.dueTime || null,
          isFlagged: Boolean(payload.isFlagged),
          duration: Number(payload.duration || 0),
          priority: payload.priority || 'medium',
          tags: Array.isArray(payload.tags) ? payload.tags : [],
          subtasks: Array.isArray(payload.subtasks) ? payload.subtasks : [],
          recurrence: payload.recurrence || null,
        });
        userTasks.push(cloneTask(newTask));
        return cloneTask(newTask);
      },
    },
    updateTodo: {
      async execute(userId, id, updates) {
        const task = findTaskById(userId, id);
        Object.assign(task, updates);
        return cloneTask(task);
      },
    },
    deleteTodo: {
      async execute(userId, id) {
        const task = findTaskById(userId, id);
        if (task) {
          task.archived = true;
        }
      },
    },
    setTodoCompletion: {
      async execute(userId, id, isCompleted) {
        const task = findTaskById(userId, id);
        task.isCompleted = isCompleted;
        return cloneTask(task);
      },
    },
    snapshot(userId) {
      return getUserTasks(userId).map(cloneTask);
    },
    createTag: {
      async execute(userId, name, color) {
        const tags = getUserTags(userId);
        const tag = { id: `tag-${++tagIdCounter}`, name, color, userId, isDefault: false };
        tags.push(tag);
        return { ...tag };
      },
    },
    listTags: {
      async execute(userId) {
        return getUserTags(userId).map((t) => ({ ...t }));
      },
    },
    updateTag: {
      async execute(userId, id, name, color) {
        const tags = getUserTags(userId);
        const tag = tags.find((t) => t.id === id);
        if (!tag) throw new Error('Tag not found');
        if (tag.isDefault || tag.userId !== userId) throw new Error('Forbidden');
        tag.name = name;
        tag.color = color;
        return { ...tag };
      },
    },
    deleteTag: {
      async execute(userId, id) {
        const tags = getUserTags(userId);
        const idx = tags.findIndex((t) => t.id === id);
        if (idx >= 0) tags.splice(idx, 1);
      },
    },
  };
}

async function listenOnRandomPort(app) {
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function createJwksServer() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  jwk.kid = 'lifeline-test-key';

  const app = express();
  app.get('/.well-known/jwks.json', (_req, res) => {
    res.json({ keys: [jwk] });
  });

  const { server, baseUrl } = await listenOnRandomPort(app);

  return {
    server,
    issuer: `${baseUrl}/`,
    kid: jwk.kid,
    privateKey,
  };
}

async function signAccessToken({
  issuer,
  audience,
  subject = 'auth0|oauth-user-1',
  scope = 'tasks:read tasks:write',
  expiresIn = '1h',
  privateKey,
  kid,
  claims = {},
}) {
  return new SignJWT({
    scope,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

async function createClient(baseUrl, apiKey) {
  const client = new Client({ name: 'lifeline-mcp-test-client', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  });

  await client.connect(transport);
  return {
    client,
    transport,
  };
}

test('lifeline-mcp service health endpoint initializes successfully', async () => {
  const app = createApp({
    config: buildMcpConfig(),
  });

  const { server, baseUrl } = await listenOnRandomPort(app);
  try {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, 'ok');
    assert.equal(payload.transport, 'streamable-http');
  } finally {
    await closeServer(server);
  }
});

test('lifeline-mcp rejects missing API keys clearly', async () => {
  const app = createApp({
    config: buildMcpConfig(),
    backendClient: {
      async resolveApiKey() {
        throw new Error('should not be called');
      },
    },
  });

  const { server, baseUrl } = await listenOnRandomPort(app);
  try {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(INIT_REQUEST),
    });

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error.data.code, 'missing_api_key');
    assert.match(payload.error.message, /Missing API key/i);
  } finally {
    await closeServer(server);
  }
});

test('lifeline-mcp runs representative read and write tools end-to-end through the internal backend adapter', async () => {
  process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
  process.env.MCP_API_KEY_PEPPER = 'pepper';

  const taskStore = createInMemoryTaskStore();
  const mcpApiKeyRepository = {
    async findByKeyPrefix(keyPrefix) {
      const records = {
        lk_rw: {
          id: 'key-rw',
          userId: 'user-1',
          name: 'RW key',
          keyPrefix: 'lk_rw',
          keyHash: hashMcpApiKeySecret('secret-rw', 'pepper'),
          scopes: ['tasks:read', 'tasks:write'],
          status: 'active',
          expiresAt: null,
          revokedAt: null,
        },
      };
      return records[keyPrefix] || null;
    },
    async recordUsage() {
      return undefined;
    },
  };
  const userRepository = {
    async findById(id) {
      const users = {
        'user-1': { id: 'user-1', name: 'User One', role: 'paid' },
        'user-2': { id: 'user-2', name: 'User Two', role: 'paid' },
      };
      return users[id] || null;
    },
  };
  const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
    mcpApiKeyRepository,
    userRepository,
    now: () => new Date('2026-03-07T12:00:00.000Z'),
  });

  const backendApp = express();
  backendApp.use(express.json());
  backendApp.use('/internal/mcp', createInternalMcpRouter({
    mcpApiKeyRepository,
    userRepository,
    resolveMcpApiKeyPrincipal,
    todoRepository: taskStore.todoRepository,
    searchTodos: taskStore.searchTodos,
    listTodos: taskStore.listTodos,
    createTodoForInternalMcp: taskStore.createTodoForInternalMcp,
    updateTodo: taskStore.updateTodo,
    deleteTodo: taskStore.deleteTodo,
    setTodoCompletion: taskStore.setTodoCompletion,
    createTag: taskStore.createTag,
    listTags: taskStore.listTags,
    updateTag: taskStore.updateTag,
    deleteTag: taskStore.deleteTag,
  }));
  backendApp.use(errorHandler);

  const { server: backendServer, baseUrl: backendBaseUrl } = await listenOnRandomPort(backendApp);

  const mcpApp = createApp({
    config: buildMcpConfig({ LIFELINE_BACKEND_BASE_URL: backendBaseUrl }),
  });
  const { server: mcpServer, baseUrl: mcpBaseUrl } = await listenOnRandomPort(mcpApp);

  let clientTransport = null;
  try {
    const { client, transport } = await createClient(mcpBaseUrl, 'lk_rw.secret-rw');
    clientTransport = transport;

    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === 'search_tasks'));
    assert.ok(tools.tools.some((tool) => tool.name === 'create_task'));

    const getTaskResult = await client.callTool({
      name: 'get_task',
      arguments: { taskNumber: 1 },
    });
    assert.equal(getTaskResult.structuredContent.task.id, 'task-u1-1');
    assert.equal(getTaskResult.structuredContent.task.title, 'User one task');

    const createResult = await client.callTool({
      name: 'create_task',
      arguments: {
        title: 'Created through MCP',
        dueDate: '2026-03-07',
        priority: 'high',
      },
    });
    assert.equal(createResult.structuredContent.task.taskNumber, 2);

    const completeResult = await client.callTool({
      name: 'complete_task',
      arguments: { taskNumber: 2 },
    });
    assert.equal(completeResult.structuredContent.completed, true);
    assert.equal(completeResult.structuredContent.task.isCompleted, true);

    const searchResult = await client.callTool({
      name: 'search_tasks',
      arguments: { query: 'Created through MCP' },
    });
    assert.equal(searchResult.structuredContent.total, 1);
    assert.equal(searchResult.structuredContent.tasks[0].taskNumber, 2);

    const userOneTasks = taskStore.snapshot('user-1');
    const userTwoTasks = taskStore.snapshot('user-2');
    assert.equal(userOneTasks.length, 2);
    assert.equal(userTwoTasks.length, 1);
    assert.equal(userTwoTasks[0].title, 'User two task');
  } finally {
    if (clientTransport) {
      await clientTransport.close();
    }
    await closeServer(mcpServer);
    await closeServer(backendServer);
  }
});

test('lifeline-mcp exposes statistics, tags, batch, and export tools end-to-end', async () => {
  process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
  process.env.MCP_API_KEY_PEPPER = 'pepper';

  const taskStore = createInMemoryTaskStore();
  const mcpApiKeyRepository = {
    async findByKeyPrefix(keyPrefix) {
      const records = {
        lk_rw: {
          id: 'key-rw',
          userId: 'user-1',
          name: 'RW key',
          keyPrefix: 'lk_rw',
          keyHash: hashMcpApiKeySecret('secret-rw', 'pepper'),
          scopes: ['tasks:read', 'tasks:write'],
          status: 'active',
          expiresAt: null,
          revokedAt: null,
        },
      };
      return records[keyPrefix] || null;
    },
    async recordUsage() {
      return undefined;
    },
  };
  const userRepository = {
    async findById(id) {
      return { id, name: 'User One', role: 'paid' };
    },
  };
  const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
    mcpApiKeyRepository,
    userRepository,
    now: () => new Date('2026-03-07T12:00:00.000Z'),
  });

  const backendApp = express();
  backendApp.use(express.json());
  backendApp.use('/internal/mcp', createInternalMcpRouter({
    mcpApiKeyRepository,
    userRepository,
    resolveMcpApiKeyPrincipal,
    todoRepository: taskStore.todoRepository,
    searchTodos: taskStore.searchTodos,
    listTodos: taskStore.listTodos,
    createTodoForInternalMcp: taskStore.createTodoForInternalMcp,
    updateTodo: taskStore.updateTodo,
    deleteTodo: taskStore.deleteTodo,
    setTodoCompletion: taskStore.setTodoCompletion,
    createTag: taskStore.createTag,
    listTags: taskStore.listTags,
    updateTag: taskStore.updateTag,
    deleteTag: taskStore.deleteTag,
    getNow: () => new Date('2026-03-07T12:00:00.000Z'),
  }));
  backendApp.use(errorHandler);

  const { server: backendServer, baseUrl: backendBaseUrl } = await listenOnRandomPort(backendApp);
  const mcpApp = createApp({
    config: buildMcpConfig({ LIFELINE_BACKEND_BASE_URL: backendBaseUrl }),
  });
  const { server: mcpServer, baseUrl: mcpBaseUrl } = await listenOnRandomPort(mcpApp);

  let clientTransport = null;
  try {
    const { client, transport } = await createClient(mcpBaseUrl, 'lk_rw.secret-rw');
    clientTransport = transport;

    // Verify all new tools are listed
    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    for (const expected of ['get_statistics', 'list_tags', 'create_tag', 'update_tag', 'delete_tag', 'batch_complete', 'batch_uncomplete', 'batch_archive', 'export_tasks']) {
      assert.ok(toolNames.includes(expected), `expected tool ${expected} to be listed`);
    }

    // get_statistics
    const statsResult = await client.callTool({ name: 'get_statistics', arguments: {} });
    assert.equal(statsResult.isError, undefined);
    assert.equal(statsResult.structuredContent.total, 1);
    assert.equal(statsResult.structuredContent.active, 1);

    // list_tags
    const tagsResult = await client.callTool({ name: 'list_tags', arguments: {} });
    assert.ok(Array.isArray(tagsResult.structuredContent.tags));
    assert.equal(tagsResult.structuredContent.tags[0].name, 'Inbox');

    // create_tag
    const createTagResult = await client.callTool({
      name: 'create_tag',
      arguments: { name: 'Work', color: '#FF0000' },
    });
    assert.equal(createTagResult.isError, undefined);
    const createdTag = createTagResult.structuredContent.tag || createTagResult.structuredContent;
    assert.equal(createdTag.name, 'Work');

    // update_tag
    const updateTagResult = await client.callTool({
      name: 'update_tag',
      arguments: { id: createdTag.id, name: 'Office', color: '#00FF00' },
    });
    assert.equal(updateTagResult.isError, undefined);

    // delete_tag
    const deleteTagResult = await client.callTool({
      name: 'delete_tag',
      arguments: { id: createdTag.id },
    });
    assert.equal(deleteTagResult.isError, undefined);

    // Create extra tasks for batch operations
    await client.callTool({ name: 'create_task', arguments: { title: 'Batch A' } });
    await client.callTool({ name: 'create_task', arguments: { title: 'Batch B' } });

    // batch_complete
    const batchCompleteResult = await client.callTool({
      name: 'batch_complete',
      arguments: { taskNumbers: [2, 3] },
    });
    assert.equal(batchCompleteResult.isError, undefined);
    assert.ok(Array.isArray(batchCompleteResult.structuredContent.results));
    assert.equal(batchCompleteResult.structuredContent.results.length, 2);
    assert.equal(batchCompleteResult.structuredContent.results[0].status, 'completed');

    // batch_uncomplete
    const batchUncompleteResult = await client.callTool({
      name: 'batch_uncomplete',
      arguments: { taskNumbers: [2] },
    });
    assert.equal(batchUncompleteResult.isError, undefined);
    assert.equal(batchUncompleteResult.structuredContent.results[0].status, 'uncompleted');

    // batch_archive
    const batchArchiveResult = await client.callTool({
      name: 'batch_archive',
      arguments: { taskNumbers: [3] },
    });
    assert.equal(batchArchiveResult.isError, undefined);
    assert.equal(batchArchiveResult.structuredContent.results[0].status, 'archived');

    // export_tasks
    const exportResult = await client.callTool({ name: 'export_tasks', arguments: {} });
    assert.equal(exportResult.isError, undefined);
    assert.ok(exportResult.structuredContent.exported_at);
    assert.ok(Array.isArray(exportResult.structuredContent.todos));
    assert.ok(exportResult.structuredContent.stats.totalTodos >= 1);

    // Verify preview text is present on read tools
    const searchResult = await client.callTool({
      name: 'search_tasks',
      arguments: { query: 'User one' },
    });
    assert.ok(searchResult.content?.length > 0 || searchResult.structuredContent);

    // Verify get_task returns rich detail
    const getTaskResult = await client.callTool({
      name: 'get_task',
      arguments: { taskNumber: 1 },
    });
    assert.equal(getTaskResult.structuredContent.task.title, 'User one task');
    assert.ok(getTaskResult.content?.some((c) => c.type === 'text'));
  } finally {
    if (clientTransport) {
      await clientTransport.close();
    }
    await closeServer(mcpServer);
    await closeServer(backendServer);
  }
});

test('lifeline-mcp reports scope failures clearly for write tools', async () => {
  process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
  process.env.MCP_API_KEY_PEPPER = 'pepper';

  const taskStore = createInMemoryTaskStore();
  const mcpApiKeyRepository = {
    async findByKeyPrefix(keyPrefix) {
      const records = {
        lk_ro: {
          id: 'key-ro',
          userId: 'user-1',
          name: 'RO key',
          keyPrefix: 'lk_ro',
          keyHash: hashMcpApiKeySecret('secret-ro', 'pepper'),
          scopes: ['tasks:read'],
          status: 'active',
          expiresAt: null,
          revokedAt: null,
        },
      };
      return records[keyPrefix] || null;
    },
    async recordUsage() {
      return undefined;
    },
  };
  const userRepository = {
    async findById(id) {
      return { id, name: 'User One', role: 'paid' };
    },
  };
  const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
    mcpApiKeyRepository,
    userRepository,
    now: () => new Date('2026-03-07T12:00:00.000Z'),
  });

  const backendApp = express();
  backendApp.use(express.json());
  backendApp.use('/internal/mcp', createInternalMcpRouter({
    mcpApiKeyRepository,
    userRepository,
    resolveMcpApiKeyPrincipal,
    todoRepository: taskStore.todoRepository,
    searchTodos: taskStore.searchTodos,
    listTodos: taskStore.listTodos,
    createTodoForInternalMcp: taskStore.createTodoForInternalMcp,
    updateTodo: taskStore.updateTodo,
    deleteTodo: taskStore.deleteTodo,
    setTodoCompletion: taskStore.setTodoCompletion,
    createTag: taskStore.createTag,
    listTags: taskStore.listTags,
    updateTag: taskStore.updateTag,
    deleteTag: taskStore.deleteTag,
  }));
  backendApp.use(errorHandler);

  const { server: backendServer, baseUrl: backendBaseUrl } = await listenOnRandomPort(backendApp);
  const mcpApp = createApp({
    config: buildMcpConfig({ LIFELINE_BACKEND_BASE_URL: backendBaseUrl }),
  });
  const { server: mcpServer, baseUrl: mcpBaseUrl } = await listenOnRandomPort(mcpApp);

  let clientTransport = null;
  try {
    const { client, transport } = await createClient(mcpBaseUrl, 'lk_ro.secret-ro');
    clientTransport = transport;

    const result = await client.callTool({
      name: 'create_task',
      arguments: { title: 'Should fail' },
    });

    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, 'scope_denied');
    assert.match(result.structuredContent.error.message, /missing required scope/i);
  } finally {
    if (clientTransport) {
      await clientTransport.close();
    }
    await closeServer(mcpServer);
    await closeServer(backendServer);
  }
});

test('lifeline-mcp rejects conflicting id and taskNumber selectors for mutations', async () => {
  process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
  process.env.MCP_API_KEY_PEPPER = 'pepper';

  const taskStore = createInMemoryTaskStore();
  const mcpApiKeyRepository = {
    async findByKeyPrefix(keyPrefix) {
      if (keyPrefix !== 'lk_rw_conflict') return null;
      return {
        id: 'key-rw-conflict',
        userId: 'user-1',
        name: 'RW key',
        keyPrefix: 'lk_rw_conflict',
        keyHash: hashMcpApiKeySecret('secret-rw', 'pepper'),
        scopes: ['tasks:read', 'tasks:write'],
        status: 'active',
        expiresAt: null,
        revokedAt: null,
      };
    },
    async recordUsage() {
      return undefined;
    },
  };
  const userRepository = {
    async findById(id) {
      return { id, name: 'User One', role: 'paid' };
    },
  };
  const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
    mcpApiKeyRepository,
    userRepository,
    now: () => new Date('2026-03-07T12:00:00.000Z'),
  });

  const backendApp = express();
  backendApp.use(express.json());
  backendApp.use('/internal/mcp', createInternalMcpRouter({
    mcpApiKeyRepository,
    userRepository,
    resolveMcpApiKeyPrincipal,
    todoRepository: taskStore.todoRepository,
    searchTodos: taskStore.searchTodos,
    listTodos: taskStore.listTodos,
    createTodoForInternalMcp: taskStore.createTodoForInternalMcp,
    updateTodo: taskStore.updateTodo,
    deleteTodo: taskStore.deleteTodo,
    setTodoCompletion: taskStore.setTodoCompletion,
    createTag: taskStore.createTag,
    listTags: taskStore.listTags,
    updateTag: taskStore.updateTag,
    deleteTag: taskStore.deleteTag,
  }));
  backendApp.use(errorHandler);

  const { server: backendServer, baseUrl: backendBaseUrl } = await listenOnRandomPort(backendApp);
  const mcpApp = createApp({
    config: buildMcpConfig({ LIFELINE_BACKEND_BASE_URL: backendBaseUrl }),
  });
  const { server: mcpServer, baseUrl: mcpBaseUrl } = await listenOnRandomPort(mcpApp);

  let clientTransport = null;
  try {
    const { client, transport } = await createClient(mcpBaseUrl, 'lk_rw_conflict.secret-rw');
    clientTransport = transport;

    const result = await client.callTool({
      name: 'complete_task',
      arguments: {
        taskNumber: 1,
        id: 'task-does-not-match',
      },
    });

    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, 'invalid_input');
    assert.match(result.structuredContent.error.message, /do not resolve to the same task/i);
  } finally {
    if (clientTransport) {
      await clientTransport.close();
    }
    await closeServer(mcpServer);
    await closeServer(backendServer);
  }
});

test('lifeline-mcp exposes OAuth metadata and executes tools through a validated Auth0 bearer token', async () => {
  const jwks = await createJwksServer();
  let observedPrincipal = null;

  const app = createApp({
    config: buildMcpConfig({
      MCP_PUBLIC_BASE_URL: 'http://127.0.0.1:43030',
      MCP_AUTH0_DOMAIN: '127.0.0.1',
      MCP_AUTH0_ISSUER: jwks.issuer,
      MCP_AUTH0_AUDIENCE: 'https://lifeline-api',
      MCP_AUTH0_SUPPORTED_SCOPES: 'tasks:read,tasks:write',
    }),
    backendClient: {
      async resolveOAuthPrincipal({ claims, scopes }) {
        return {
          subjectType: 'oauth_access_token',
          lifelineUserId: claims.sub,
          authMethod: 'auth0_oauth',
          scopes,
          subjectId: claims.sub,
          displayName: claims.name,
        };
      },
      async searchTasks(principal) {
        observedPrincipal = principal;
        return {
          tasks: [{ id: 'task-oauth-1', taskNumber: 1, title: 'OAuth task' }],
          total: 1,
          page: 1,
          limit: 30,
        };
      },
    },
  });

  const { server, baseUrl } = await listenOnRandomPort(app);

  try {
    const accessToken = await signAccessToken({
      issuer: jwks.issuer,
      audience: 'https://lifeline-api',
      privateKey: jwks.privateKey,
      kid: jwks.kid,
      claims: { name: 'OAuth User One' },
    });

    const metadataResponse = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    assert.equal(metadataResponse.status, 200);
    const oauthMetadata = await metadataResponse.json();
    assert.equal(oauthMetadata.issuer, jwks.issuer);
    assert.equal(oauthMetadata.authorization_endpoint, new URL('/authorize', jwks.issuer).href);
    assert.equal(oauthMetadata.token_endpoint, new URL('/oauth/token', jwks.issuer).href);

    const resourceMetadataResponse = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(resourceMetadataResponse.status, 200);
    const resourceMetadata = await resourceMetadataResponse.json();
    assert.equal(resourceMetadata.resource, 'http://127.0.0.1:43030/mcp');
    assert.deepEqual(resourceMetadata.authorization_servers, [jwks.issuer]);

    const client = new Client({ name: 'lifeline-mcp-oauth-test-client', version: '1.0.0' }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    await client.connect(transport);

    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === 'search_tasks'));

    const result = await client.callTool({
      name: 'search_tasks',
      arguments: { query: 'oauth' },
    });

    assert.equal(result.structuredContent.total, 1);
    assert.equal(result.structuredContent.tasks[0].title, 'OAuth task');
    assert.equal(observedPrincipal?.authMethod, 'auth0_oauth');
    assert.deepEqual(observedPrincipal?.scopes, ['tasks:read', 'tasks:write']);

    await transport.close();
  } finally {
    await closeServer(server);
    await closeServer(jwks.server);
  }
});

test('lifeline-mcp rejects expired OAuth bearer tokens and advertises protected-resource metadata', async () => {
  const jwks = await createJwksServer();
  const app = createApp({
    config: buildMcpConfig({
      MCP_PUBLIC_BASE_URL: 'http://127.0.0.1:43031',
      MCP_AUTH0_DOMAIN: '127.0.0.1',
      MCP_AUTH0_ISSUER: jwks.issuer,
      MCP_AUTH0_AUDIENCE: 'https://lifeline-api',
    }),
    backendClient: {
      async resolveOAuthPrincipal() {
        throw new Error('should not be called');
      },
    },
  });

  const { server, baseUrl } = await listenOnRandomPort(app);

  try {
    const expiredToken = await signAccessToken({
      issuer: jwks.issuer,
      audience: 'https://lifeline-api',
      expiresIn: '-10s',
      privateKey: jwks.privateKey,
      kid: jwks.kid,
    });

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(INIT_REQUEST),
    });

    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate') || '', /resource_metadata="http:\/\/127\.0\.0\.1:43031\/.well-known\/oauth-protected-resource\/mcp"/i);
    const payload = await response.json();
    assert.equal(payload.error.data.code, 'oauth_token_expired');
  } finally {
    await closeServer(server);
    await closeServer(jwks.server);
  }
});

test('lifeline-mcp rejects OAuth bearer tokens with the wrong audience', async () => {
  const jwks = await createJwksServer();
  const app = createApp({
    config: buildMcpConfig({
      MCP_PUBLIC_BASE_URL: 'http://127.0.0.1:43032',
      MCP_AUTH0_DOMAIN: '127.0.0.1',
      MCP_AUTH0_ISSUER: jwks.issuer,
      MCP_AUTH0_AUDIENCE: 'https://lifeline-api',
    }),
    backendClient: {
      async resolveOAuthPrincipal() {
        throw new Error('should not be called');
      },
    },
  });

  const { server, baseUrl } = await listenOnRandomPort(app);

  try {
    const wrongAudienceToken = await signAccessToken({
      issuer: jwks.issuer,
      audience: 'https://other-audience',
      privateKey: jwks.privateKey,
      kid: jwks.kid,
    });

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wrongAudienceToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(INIT_REQUEST),
    });

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error.data.code, 'invalid_oauth_token');
    assert.match(payload.error.message, /audience does not match the Lifeline API/i);
  } finally {
    await closeServer(server);
    await closeServer(jwks.server);
  }
});

test('lifeline-mcp exposes archive, restore, subtask, and window tools end-to-end', async () => {
  process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
  process.env.MCP_API_KEY_PEPPER = 'pepper';

  const taskStore = createInMemoryTaskStore();
  const mcpApiKeyRepository = {
    async findByKeyPrefix(keyPrefix) {
      if (keyPrefix !== 'lk_rw') return null;
      return {
        id: 'key-rw',
        userId: 'user-1',
        name: 'RW key',
        keyPrefix: 'lk_rw',
        keyHash: hashMcpApiKeySecret('secret-rw', 'pepper'),
        scopes: ['tasks:read', 'tasks:write'],
        status: 'active',
        expiresAt: null,
        revokedAt: null,
      };
    },
    async recordUsage() {
      return undefined;
    },
  };
  const userRepository = {
    async findById(id) {
      return { id, name: 'User One', role: 'paid' };
    },
  };
  const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
    mcpApiKeyRepository,
    userRepository,
    now: () => new Date('2026-03-10T12:00:00.000Z'),
  });

  const backendApp = express();
  backendApp.use(express.json());
  backendApp.use('/internal/mcp', createInternalMcpRouter({
    mcpApiKeyRepository,
    userRepository,
    resolveMcpApiKeyPrincipal,
    todoRepository: taskStore.todoRepository,
    searchTodos: taskStore.searchTodos,
    listTodos: taskStore.listTodos,
    createTodoForInternalMcp: taskStore.createTodoForInternalMcp,
    updateTodo: taskStore.updateTodo,
    deleteTodo: taskStore.deleteTodo,
    setTodoCompletion: taskStore.setTodoCompletion,
    createTag: taskStore.createTag,
    listTags: taskStore.listTags,
    updateTag: taskStore.updateTag,
    deleteTag: taskStore.deleteTag,
    getNow: () => new Date('2026-03-10T12:00:00.000Z'),
  }));
  backendApp.use(errorHandler);

  const { server: backendServer, baseUrl: backendBaseUrl } = await listenOnRandomPort(backendApp);
  const mcpApp = createApp({
    config: buildMcpConfig({ LIFELINE_BACKEND_BASE_URL: backendBaseUrl }),
  });
  const { server: mcpServer, baseUrl: mcpBaseUrl } = await listenOnRandomPort(mcpApp);

  let clientTransport = null;
  try {
    const { client, transport } = await createClient(mcpBaseUrl, 'lk_rw.secret-rw');
    clientTransport = transport;

    // Verify the new tools appear in listing
    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    for (const expected of [
      'archive_task', 'restore_task', 'batch_restore',
      'add_subtask', 'complete_subtask', 'uncomplete_subtask', 'update_subtask', 'remove_subtask',
    ]) {
      assert.ok(toolNames.includes(expected), `expected tool ${expected} to be listed`);
    }

    // Create a task with a dueDate in this_week range (2026-03-10 is tuesday)
    const createResult = await client.callTool({
      name: 'create_task',
      arguments: { title: 'Week task', dueDate: '2026-03-12', priority: 'high' },
    });
    assert.equal(createResult.structuredContent.task.title, 'Week task');
    const weekTaskNumber = createResult.structuredContent.task.taskNumber;

    // archive_task
    const archiveResult = await client.callTool({
      name: 'archive_task',
      arguments: { taskNumber: weekTaskNumber },
    });
    assert.equal(archiveResult.isError, undefined);

    // restore_task
    const restoreResult = await client.callTool({
      name: 'restore_task',
      arguments: { taskNumber: weekTaskNumber },
    });
    assert.equal(restoreResult.isError, undefined);

    // add_subtask
    const addSubResult = await client.callTool({
      name: 'add_subtask',
      arguments: { taskNumber: weekTaskNumber, title: 'Step 1' },
    });
    assert.equal(addSubResult.isError, undefined);

    // Verify the task now has subtasks
    const getResult = await client.callTool({
      name: 'get_task',
      arguments: { taskNumber: weekTaskNumber },
    });
    assert.ok(getResult.structuredContent.task.subtasks.length >= 1);
    const subtaskId = getResult.structuredContent.task.subtasks[0].subtaskId;

    // complete_subtask
    const completeSubResult = await client.callTool({
      name: 'complete_subtask',
      arguments: { taskNumber: weekTaskNumber, subtaskId },
    });
    assert.equal(completeSubResult.isError, undefined);

    // uncomplete_subtask
    const uncompleteSubResult = await client.callTool({
      name: 'uncomplete_subtask',
      arguments: { taskNumber: weekTaskNumber, subtaskId },
    });
    assert.equal(uncompleteSubResult.isError, undefined);

    // update_subtask
    const updateSubResult = await client.callTool({
      name: 'update_subtask',
      arguments: { taskNumber: weekTaskNumber, subtaskId, title: 'Updated Step 1' },
    });
    assert.equal(updateSubResult.isError, undefined);

    // remove_subtask
    const removeSubResult = await client.callTool({
      name: 'remove_subtask',
      arguments: { taskNumber: weekTaskNumber, subtaskId },
    });
    assert.equal(removeSubResult.isError, undefined);
  } finally {
    if (clientTransport) {
      await clientTransport.close();
    }
    await closeServer(mcpServer);
    await closeServer(backendServer);
  }
});
