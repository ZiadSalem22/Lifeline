import express, { type Express } from 'express';
import request, { type Response as SupertestResponse } from 'supertest';
import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import type pg from 'pg';
import { parseEnv } from '../../src/config/env.js';
import { buildContainer } from '../../src/container.js';
import { createApp } from '../../src/http/app.js';
import { buildMcpRouter, type McpRouterOptions } from '../../src/mcp/router.js';
import { hashSecret } from '../../src/utils/mcp-key-crypto.js';
import { ResolveKeyPrincipal } from '../../src/application/mcp-keys/resolve-key-principal.js';
import { CreateTodo } from '../../src/application/todos/create-todo.js';
import { ListTodos } from '../../src/application/todos/list-todos.js';
import { GetTodo } from '../../src/application/todos/get-todo.js';
import { UpdateTodo } from '../../src/application/todos/update-todo.js';
import { SetTodoCompletion } from '../../src/application/todos/set-todo-completion.js';
import { ArchiveTodo } from '../../src/application/todos/archive-todo.js';
import { FindSimilarTodos } from '../../src/application/todos/find-similar-todos.js';
import { SubtaskOps } from '../../src/application/todos/subtask-ops.js';
import { ListTags } from '../../src/application/tags/list-tags.js';
import { CreateTag } from '../../src/application/tags/create-tag.js';
import { UpdateTag } from '../../src/application/tags/update-tag.js';
import { DeleteTag } from '../../src/application/tags/delete-tag.js';
import {
  InMemoryMcpKeyRepository,
  InMemoryTagRepository,
  InMemoryTodoRepository,
} from '../helpers/feature-fakes.js';
import {
  InMemoryProfileRepository,
  InMemorySettingsRepository,
  InMemoryUserRepository,
} from '../helpers/in-memory.js';

/**
 * Embedded MCP module — full-surface supertest suite over the in-memory
 * fakes: stateless JSON-RPC transport, dual auth, per-principal rate limit,
 * the 28-tool surface, and old-parity tool semantics (audit-mcp.md §4–§6).
 */

const PEPPER = 'test-pepper';
const USER_ID = 'user-1';
/** Wednesday 2026-07-08 (UTC) — fixed clock for all date goldens. */
const NOW = new Date('2026-07-08T12:00:00.000Z');

interface HarnessOptions {
  envOverrides?: Record<string, string> | undefined;
  routerOptions?: McpRouterOptions | undefined;
}

function buildHarness(options: HarnessOptions = {}) {
  const env = parseEnv({
    NODE_ENV: 'test',
    MCP_API_KEY_PEPPER: PEPPER,
    ...options.envOverrides,
  });
  const users = new InMemoryUserRepository();
  const profiles = new InMemoryProfileRepository();
  const settings = new InMemorySettingsRepository();
  const tags = new InMemoryTagRepository();
  tags.seedDefaults();
  const todos = new InMemoryTodoRepository(tags);
  const keys = new InMemoryMcpKeyRepository();

  users.seed({ id: USER_ID, name: 'Test User' });

  const useCases = {
    resolveKeyPrincipal: new ResolveKeyPrincipal({ keys, users }, { pepper: PEPPER }),
    createTodo: new CreateTodo({ todos, tags }),
    listTodos: new ListTodos({ todos }),
    getTodo: new GetTodo({ todos }),
    updateTodo: new UpdateTodo({ todos, tags }),
    setTodoCompletion: new SetTodoCompletion({ todos }),
    archiveTodo: new ArchiveTodo({ todos }),
    findSimilarTodos: new FindSimilarTodos({ todos }),
    subtaskOps: new SubtaskOps({ todos }),
    listTags: new ListTags({ tags }),
    createTag: new CreateTag({ tags }),
    updateTag: new UpdateTag({ tags }),
    deleteTag: new DeleteTag({ tags }),
  };

  const app = express();
  app.use(express.json());
  app.use(
    buildMcpRouter(
      {
        env,
        logger: pino({ enabled: false }),
        useCases,
        repos: { users, profiles, settings, todos },
      },
      { now: () => NOW, ...options.routerOptions },
    ),
  );

  let keySeq = 0;
  const issueKey = (
    scopes: string[],
    overrides: { userId?: string; status?: 'active' | 'revoked' } = {},
  ): string => {
    keySeq += 1;
    const keyPrefix = `lk_${keySeq.toString(16).padStart(8, '0')}`;
    const secret = `secret-${keySeq}`;
    keys.seed({
      userId: overrides.userId ?? USER_ID,
      keyPrefix,
      keyHash: hashSecret(secret, PEPPER),
      scopes,
      status: overrides.status ?? 'active',
      ...(overrides.status === 'revoked' ? { revokedAt: new Date() } : {}),
    });
    return `${keyPrefix}.${secret}`;
  };

  return { app, env, users, profiles, settings, tags, todos, keys, issueKey };
}

let rpcId = 0;

function rpc(
  app: Express,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): request.Test {
  rpcId += 1;
  return request(app)
    .post('/mcp')
    .set('Accept', 'application/json, text/event-stream')
    .set(headers)
    .send({ jsonrpc: '2.0', id: rpcId, method, params });
}

function callTool(
  app: Express,
  apiKey: string,
  name: string,
  args: Record<string, unknown> = {},
): request.Test {
  return rpc(app, 'tools/call', { name, arguments: args }, { 'x-api-key': apiKey });
}

function toolResult(response: SupertestResponse): {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown>;
} {
  expect(response.status).toBe(200);
  expect(response.body.error).toBeUndefined();
  return response.body.result;
}

const EXPECTED_TOOLS = [
  'search_tasks',
  'get_task',
  'list_today',
  'list_upcoming',
  'get_statistics',
  'list_tags',
  'create_tag',
  'update_tag',
  'delete_tag',
  'create_task',
  'update_task',
  'complete_task',
  'uncomplete_task',
  'delete_task',
  'export_tasks',
  'batch_complete',
  'batch_uncomplete',
  'batch_archive',
  'archive_task',
  'restore_task',
  'batch_restore',
  'list_tasks',
  'find_similar_tasks',
  'add_subtask',
  'complete_subtask',
  'uncomplete_subtask',
  'update_subtask',
  'remove_subtask',
];

const DESTRUCTIVE_TOOLS = new Set([
  'delete_tag',
  'delete_task',
  'batch_archive',
  'archive_task',
  'remove_subtask',
]);
const READ_TOOLS = new Set([
  'search_tasks',
  'get_task',
  'list_today',
  'list_upcoming',
  'get_statistics',
  'list_tags',
  'export_tasks',
  'list_tasks',
  'find_similar_tasks',
]);

describe('MCP transport + protocol', () => {
  it('handles the initialize handshake statelessly', async () => {
    const { app, issueKey } = buildHarness();
    const key = issueKey(['tasks:read']);
    const response = await rpc(
      app,
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.0' },
      },
      { 'x-api-key': key },
    );
    expect(response.status).toBe(200);
    expect(response.body.result.serverInfo).toMatchObject({
      name: 'lifeline-mcp',
      version: '0.1.0',
    });
    expect(response.body.result.instructions).toContain(
      'Lifeline MCP provides task management tools',
    );
    // Stateless: no session id issued.
    expect(response.headers['mcp-session-id']).toBeUndefined();
  });

  it('tools/list returns exactly the 28-tool surface with old annotations', async () => {
    const { app, issueKey } = buildHarness();
    const key = issueKey(['tasks:read']);
    const response = await rpc(app, 'tools/list', {}, { 'x-api-key': key });
    expect(response.status).toBe(200);

    const tools = response.body.result.tools as {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean };
    }[];

    expect(tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS);
    expect(tools).toHaveLength(28);

    for (const tool of tools) {
      expect(tool.annotations.openWorldHint).toBe(false);
      expect(tool.annotations.readOnlyHint).toBe(READ_TOOLS.has(tool.name));
      expect(tool.annotations.destructiveHint).toBe(DESTRUCTIVE_TOOLS.has(tool.name));
      expect(tool.description.length).toBeGreaterThan(20);
    }

    const deleteTask = tools.find((tool) => tool.name === 'delete_task');
    expect(deleteTask?.description).toMatch(/^Deprecated — use archive_task instead\./);

    const searchTasks = tools.find((tool) => tool.name === 'search_tasks');
    const searchProps = searchTasks?.inputSchema.properties as Record<string, unknown>;
    expect(Object.keys(searchProps)).toEqual(
      expect.arrayContaining(['query', 'q', 'tags', 'priority', 'status', 'flagged', 'sortBy']),
    );
  });

  it('rejects non-POST /mcp with a 405 JSON-RPC error', async () => {
    const { app } = buildHarness();
    const getResponse = await request(app).get('/mcp');
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.allow).toBe('POST');
    expect(getResponse.body.error).toMatchObject({
      code: -32000,
      data: { code: 'method_not_allowed', status: 405 },
    });

    const deleteResponse = await request(app).delete('/mcp');
    expect(deleteResponse.status).toBe(405);
  });
});

describe('MCP authentication', () => {
  it('401s missing credentials (API-key mode message)', async () => {
    const { app } = buildHarness();
    const response = await rpc(app, 'tools/list');
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: -32001,
      data: { code: 'missing_api_key', status: 401 },
    });
    expect(response.headers['www-authenticate']).toBeUndefined();
  });

  it('401s unknown API keys and 403s revoked keys', async () => {
    const { app, issueKey } = buildHarness();
    const badKey = await rpc(app, 'tools/list', {}, { 'x-api-key': 'lk_ffffffff.wrong' });
    expect(badKey.status).toBe(401);
    expect(badKey.body.error.data).toEqual({ code: 'unauthorized', status: 401 });

    const revoked = issueKey(['tasks:read'], { status: 'revoked' });
    const revokedResponse = await rpc(app, 'tools/list', {}, { 'x-api-key': revoked });
    expect(revokedResponse.status).toBe(403);
    expect(revokedResponse.body.error).toMatchObject({
      code: -32003,
      data: { code: 'forbidden', status: 403 },
    });
  });

  it('accepts the API key as a Bearer token too (old parity)', async () => {
    const { app, issueKey } = buildHarness();
    const key = issueKey(['tasks:read']);
    const response = await rpc(app, 'tools/list', {}, { authorization: `Bearer ${key}` });
    expect(response.status).toBe(200);
    expect(response.body.result.tools).toHaveLength(28);
  });

  it('records API-key usage on successful auth', async () => {
    const { app, issueKey, keys } = buildHarness();
    const key = issueKey(['tasks:read']);
    await rpc(app, 'tools/list', {}, { 'x-api-key': key });
    expect(keys.usageCalls).toHaveLength(1);
  });

  it('returns scope_denied as an error RESULT (not a protocol error)', async () => {
    const { app, issueKey } = buildHarness();
    const readOnlyKey = issueKey(['tasks:read']);
    const response = await callTool(app, readOnlyKey, 'create_task', { title: 'Nope' });
    const result = toolResult(response);
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      code: 'scope_denied',
      status: 403,
    });
    expect(result.content[0]?.text).toContain('tasks:write');
  });

  it('honors the tasks:* wildcard for writes', async () => {
    const { app, issueKey } = buildHarness();
    const key = issueKey(['tasks:*']);
    const response = await callTool(app, key, 'create_task', { title: 'Wildcard task' });
    const result = toolResult(response);
    expect(result.isError).toBeUndefined();
  });
});

describe('MCP OAuth path', () => {
  const oauthEnv = {
    MCP_AUTH0_DOMAIN: 'tenant.auth0.com',
    MCP_AUTH0_AUDIENCE: 'https://lifeline-api',
    MCP_PUBLIC_BASE_URL: 'https://mcp.example.com',
  };
  const oauthVerifier = {
    verify: (token: string) => {
      if (token === 'good.jwt.token') {
        return Promise.resolve({
          sub: 'auth0|oauth-user',
          scope: 'tasks:read',
          permissions: ['tasks:write'],
          name: 'OAuth User',
        });
      }
      return Promise.reject(Object.assign(new Error('jwt expired'), { code: 'ERR_JWT_EXPIRED' }));
    },
  };

  it('401s missing credentials with WWW-Authenticate + resource metadata', async () => {
    const { app } = buildHarness({ envOverrides: oauthEnv });
    const response = await rpc(app, 'tools/list');
    expect(response.status).toBe(401);
    expect(response.body.error.data.code).toBe('missing_auth');
    expect(response.headers['www-authenticate']).toContain(
      'resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it('serves the protected-resource metadata well-known', async () => {
    const { app } = buildHarness({ envOverrides: oauthEnv });
    const response = await request(app).get('/.well-known/oauth-protected-resource/mcp');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      resource: 'https://mcp.example.com/mcp',
      scopes_supported: ['tasks:read', 'tasks:write'],
    });
  });

  it('verifies JWT bearers, JIT-provisions the user, and merges scope + permissions', async () => {
    const { app, users } = buildHarness({
      envOverrides: oauthEnv,
      routerOptions: { now: () => NOW, verifier: oauthVerifier },
    });
    const response = await rpc(
      app,
      'tools/call',
      { name: 'create_task', arguments: { title: 'Via OAuth' } },
      { authorization: 'Bearer good.jwt.token' },
    );
    const result = toolResult(response);
    expect(result.isError).toBeUndefined();
    expect((result.structuredContent.task as { title: string }).title).toBe('Via OAuth');
    // JIT provisioning created the user from the token claims.
    expect(users.rows.has('auth0|oauth-user')).toBe(true);
  });

  it('401s invalid/expired JWTs with the old error codes', async () => {
    const { app } = buildHarness({
      envOverrides: oauthEnv,
      routerOptions: { now: () => NOW, verifier: oauthVerifier },
    });
    const response = await rpc(app, 'tools/list', {}, { authorization: 'Bearer bad.jwt.token' });
    expect(response.status).toBe(401);
    expect(response.body.error.data.code).toBe('oauth_token_expired');
    expect(response.headers['www-authenticate']).toContain('resource_metadata=');
  });

  it('routes non-JWT bearers to the API-key path even with OAuth enabled', async () => {
    const { app, issueKey } = buildHarness({ envOverrides: oauthEnv });
    const key = issueKey(['tasks:read']);
    const response = await rpc(app, 'tools/list', {}, { authorization: `Bearer ${key}` });
    expect(response.status).toBe(200);
  });
});

describe('MCP rate limiting (per principal)', () => {
  it('caps requests per principal and isolates buckets', async () => {
    const { app, issueKey } = buildHarness({
      routerOptions: { now: () => NOW, rateLimit: { limit: 3 } },
    });
    const key = issueKey(['tasks:read']);
    for (let i = 0; i < 3; i += 1) {
      const ok = await rpc(app, 'tools/list', {}, { 'x-api-key': key });
      expect(ok.status).toBe(200);
    }
    const blocked = await rpc(app, 'tools/list', {}, { 'x-api-key': key });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body.error).toMatchObject({
      code: -32000,
      data: { code: 'rate_limited', status: 429 },
    });

    // A different key (principal) still has budget — the old code had one
    // shared anonymous bucket.
    const otherKey = issueKey(['tasks:read']);
    const other = await rpc(app, 'tools/list', {}, { 'x-api-key': otherKey });
    expect(other.status).toBe(200);
  });
});

describe('MCP tools end-to-end (fakes)', () => {
  it('create_task resolves NL dates and tag names, and defaults empty dueDate to today', async () => {
    const { app, issueKey } = buildHarness();
    const key = issueKey(['tasks:read', 'tasks:write']);

    const created = toolResult(
      await callTool(app, key, 'create_task', {
        title: 'Buy milk',
        dueDate: 'tomorrow',
        tags: ['Work'],
        subtasks: [{ title: 'Find store' }, { title: 'Pay' }],
      }),
    );
    const task = created.structuredContent.task as Record<string, unknown>;
    expect(task.dueDate).toBe('2026-07-09');
    expect(task.tags).toEqual([{ id: 'default-work', name: 'Work', color: '#3B82F6' }]);
    const subtasks = task.subtasks as { subtaskId: string; position: number; id: string }[];
    expect(subtasks).toHaveLength(2);
    expect(subtasks[0]?.position).toBe(1);
    expect(subtasks[0]?.subtaskId).toMatch(/^[0-9a-f-]{36}$/);
    expect(subtasks[0]?.id).toBe(subtasks[0]?.subtaskId);
    expect(created.content[0]?.text).toBe('Created task #1: Buy milk');

    const defaulted = toolResult(
      await callTool(app, key, 'create_task', { title: 'No date', dueDate: '' }),
    );
    expect((defaulted.structuredContent.task as Record<string, unknown>).dueDate).toBe(
      '2026-07-08',
    );
  });

  it('create_task rejects unknown tag references with invalid_input', async () => {
    const { app, issueKey } = buildHarness();
    const key = issueKey(['tasks:write']);
    const result = toolResult(
      await callTool(app, key, 'create_task', { title: 'Tagged', tags: ['Nope'] }),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      code: 'invalid_input',
      status: 400,
      message: 'Tag "Nope" was not found for the current user.',
    });
  });

  it('create_task surfaces the free-tier cap as a 403 error result', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    for (let i = 0; i < 200; i += 1) {
      todos.seed(USER_ID, { title: `Task ${i}` });
    }
    const result = toolResult(await callTool(app, key, 'create_task', { title: 'One too many' }));
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      code: 'forbidden',
      status: 403,
      message: 'Free tier max tasks reached.',
    });
  });

  it('get_task resolves archived tasks and 404s unknown numbers', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:read']);
    todos.seed(USER_ID, { title: 'Archived one', archived: true });

    const found = toolResult(await callTool(app, key, 'get_task', { taskNumber: 1 }));
    expect((found.structuredContent.task as Record<string, unknown>).archived).toBe(true);
    expect(found.content[0]?.text).toContain('Archived: yes');

    const missing = toolResult(await callTool(app, key, 'get_task', { taskNumber: 999 }));
    expect(missing.isError).toBe(true);
    expect(missing.structuredContent.error).toMatchObject({ code: 'not_found', status: 404 });
  });

  it('search_tasks applies filters and validates dates', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:read']);
    todos.seed(USER_ID, { title: 'Write report', priority: 'high', isFlagged: true });
    todos.seed(USER_ID, { title: 'Write email', priority: 'low' });
    todos.seed(USER_ID, { title: 'Done thing', isCompleted: true });
    todos.seed(USER_ID, { title: 'Hidden', archived: true });

    const all = toolResult(await callTool(app, key, 'search_tasks', {}));
    expect(all.structuredContent.total).toBe(3); // archived excluded by default
    expect(all.structuredContent).toMatchObject({ page: 1, limit: 30 });

    const flaggedHigh = toolResult(
      await callTool(app, key, 'search_tasks', { priority: 'high', flagged: true }),
    );
    expect(flaggedHigh.structuredContent.total).toBe(1);

    const textual = toolResult(await callTool(app, key, 'search_tasks', { query: 'write' }));
    expect(textual.structuredContent.total).toBe(2);

    const badDate = toolResult(await callTool(app, key, 'search_tasks', { startDate: 'nope' }));
    expect(badDate.isError).toBe(true);
    expect(badDate.structuredContent.error).toMatchObject({
      code: 'invalid_input',
      message: 'Invalid startDate. Use YYYY-MM-DD format.',
    });
  });

  it('update_task keeps patch semantics: absent dueDate untouched, empty string clears', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    todos.seed(USER_ID, { title: 'Dated', dueDate: '2026-07-20' });

    const titleOnly = toolResult(
      await callTool(app, key, 'update_task', { taskNumber: 1, title: 'Renamed' }),
    );
    expect(titleOnly.structuredContent.task).toMatchObject({
      title: 'Renamed',
      dueDate: '2026-07-20',
    });

    const cleared = toolResult(
      await callTool(app, key, 'update_task', { taskNumber: 1, dueDate: '' }),
    );
    expect((cleared.structuredContent.task as Record<string, unknown>).dueDate).toBeNull();

    const natural = toolResult(
      await callTool(app, key, 'update_task', { taskNumber: 1, dueDate: 'in 2 days' }),
    );
    expect((natural.structuredContent.task as Record<string, unknown>).dueDate).toBe('2026-07-10');
  });

  it('update_task rejects recurrence changes with invalid_input', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    todos.seed(USER_ID, { title: 'Recurring' });
    const result = toolResult(
      await callTool(app, key, 'update_task', {
        taskNumber: 1,
        title: 'Still recurring',
        recurrence: { mode: 'daily' },
      }),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      code: 'invalid_input',
      status: 400,
      message: 'Unsupported update fields: recurrence.',
    });
  });

  it('update_task cross-checks taskNumber and id selectors', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    todos.seed(USER_ID, { title: 'First' });
    todos.seed(USER_ID, { title: 'Second' });
    const result = toolResult(
      await callTool(app, key, 'update_task', {
        taskNumber: 1,
        id: 'not-the-first-id',
        title: 'Mismatch',
      }),
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      code: 'invalid_input',
      message: 'Provided id and taskNumber do not resolve to the same task.',
    });
  });

  it('complete_task on an archived task is a conflict error result', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    todos.seed(USER_ID, { title: 'Archived', archived: true });
    const result = toolResult(await callTool(app, key, 'complete_task', { taskNumber: 1 }));
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      code: 'conflict',
      status: 409,
      message: 'Cannot complete an archived task. Restore it first.',
    });
  });

  it('archive/restore lifecycle keeps the old payload shapes', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    const seeded = todos.seed(USER_ID, { title: 'Lifecycle' });

    const archived = toolResult(await callTool(app, key, 'archive_task', { taskNumber: 1 }));
    expect(archived.structuredContent).toEqual({
      id: seeded.id,
      taskNumber: 1,
      deleted: true,
      deleteMode: 'archived',
    });

    const restored = toolResult(await callTool(app, key, 'restore_task', { taskNumber: 1 }));
    expect(restored.structuredContent).toMatchObject({ restored: true });
    expect((restored.structuredContent.task as Record<string, unknown>).archived).toBe(false);
    expect(restored.structuredContent.note).toBeUndefined();

    const again = toolResult(await callTool(app, key, 'restore_task', { taskNumber: 1 }));
    expect(again.structuredContent.note).toBe('Task was already active.');

    const deleted = toolResult(await callTool(app, key, 'delete_task', { taskNumber: 1 }));
    expect(deleted.structuredContent).toMatchObject({ deleted: true, deleteMode: 'archived' });
    expect(deleted.content[0]?.text).toContain('archived, not permanently deleted');
  });

  it('batch_complete returns per-item statuses (mixed outcomes)', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    todos.seed(USER_ID, { title: 'Active one' });
    todos.seed(USER_ID, { title: 'Archived one', archived: true });

    const result = toolResult(
      await callTool(app, key, 'batch_complete', { taskNumbers: [1, 2, 999] }),
    );
    expect(result.structuredContent).toEqual({
      action: 'complete',
      results: [
        { taskNumber: 1, status: 'completed' },
        { taskNumber: 2, status: 'error', reason: 'Cannot complete an archived task.' },
        { taskNumber: 999, status: 'not_found' },
      ],
    });
    expect(result.content[0]?.text).toBe(
      'Batch complete: #1: completed, #2: error, #999: not_found',
    );
  });

  it('batch_restore and batch_archive keep old wire actions and statuses', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    todos.seed(USER_ID, { title: 'Active' });
    todos.seed(USER_ID, { title: 'Archived', archived: true });

    const restore = toolResult(await callTool(app, key, 'batch_restore', { taskNumbers: [1, 2] }));
    expect(restore.structuredContent).toEqual({
      action: 'restore',
      results: [
        { taskNumber: 1, status: 'already_active' },
        { taskNumber: 2, status: 'restored' },
      ],
    });

    const archive = toolResult(await callTool(app, key, 'batch_archive', { taskNumbers: [1] }));
    expect(archive.structuredContent).toEqual({
      action: 'delete', // old wire action name preserved
      results: [{ taskNumber: 1, status: 'archived' }],
    });
  });

  it('subtask add/complete/update/remove keep stable subtaskIds', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:write']);
    todos.seed(USER_ID, { title: 'Parent' });

    const added = toolResult(
      await callTool(app, key, 'add_subtask', { taskNumber: 1, title: 'Step one' }),
    );
    const addedTask = added.structuredContent.task as {
      subtasks: { subtaskId: string; title: string; isCompleted: boolean; position: number }[];
    };
    expect(addedTask.subtasks).toHaveLength(1);
    const subtaskId = addedTask.subtasks[0]!.subtaskId;
    expect(subtaskId).toMatch(/^[0-9a-f-]{36}$/);

    const completed = toolResult(
      await callTool(app, key, 'complete_subtask', { taskNumber: 1, subtaskId }),
    );
    const completedTask = completed.structuredContent.task as typeof addedTask;
    expect(completedTask.subtasks[0]).toMatchObject({ subtaskId, isCompleted: true });

    const uncompleted = toolResult(
      await callTool(app, key, 'uncomplete_subtask', { taskNumber: 1, subtaskId }),
    );
    expect((uncompleted.structuredContent.task as typeof addedTask).subtasks[0]).toMatchObject({
      subtaskId,
      isCompleted: false,
    });

    const renamed = toolResult(
      await callTool(app, key, 'update_subtask', { taskNumber: 1, subtaskId, title: 'Renamed' }),
    );
    expect((renamed.structuredContent.task as typeof addedTask).subtasks[0]).toMatchObject({
      subtaskId,
      title: 'Renamed',
      position: 1,
    });

    const removed = toolResult(
      await callTool(app, key, 'remove_subtask', { taskNumber: 1, subtaskId }),
    );
    expect(removed.structuredContent.removed).toBe(true);
    expect((removed.structuredContent.task as typeof addedTask).subtasks).toHaveLength(0);

    const missing = toolResult(
      await callTool(app, key, 'complete_subtask', { taskNumber: 1, subtaskId }),
    );
    expect(missing.isError).toBe(true);
    expect(missing.structuredContent.error).toMatchObject({ code: 'not_found' });
  });

  it('list_tasks honors the profile start-day-of-week (Monday vs Sunday goldens)', async () => {
    // NOW is Wednesday 2026-07-08. Sunday 2026-07-05 belongs to this_week
    // ONLY when weeks start on Sunday.
    const sundayTask = { title: 'Sunday task', dueDate: '2026-07-05' };

    const mondayHarness = buildHarness();
    const mondayKey = mondayHarness.issueKey(['tasks:read']);
    mondayHarness.todos.seed(USER_ID, sundayTask);
    await mondayHarness.profiles.upsert(USER_ID, { startDayOfWeek: 'Monday' });
    const mondayWindow = toolResult(
      await callTool(mondayHarness.app, mondayKey, 'list_tasks', { window: 'this_week' }),
    );
    expect(mondayWindow.structuredContent).toMatchObject({
      windowToken: 'this_week',
      resolvedStart: '2026-07-06',
      resolvedEnd: '2026-07-12',
      count: 0,
    });

    const sundayHarness = buildHarness();
    const sundayKey = sundayHarness.issueKey(['tasks:read']);
    sundayHarness.todos.seed(USER_ID, sundayTask);
    await sundayHarness.profiles.upsert(USER_ID, { startDayOfWeek: 'Sunday' });
    const sundayWindow = toolResult(
      await callTool(sundayHarness.app, sundayKey, 'list_tasks', { window: 'this_week' }),
    );
    expect(sundayWindow.structuredContent).toMatchObject({
      resolvedStart: '2026-07-05',
      resolvedEnd: '2026-07-11',
      count: 1,
    });
  });

  it('list_tasks falls back to settings.layout.weekStart, then Monday', async () => {
    const settingsHarness = buildHarness();
    const key = settingsHarness.issueKey(['tasks:read']);
    await settingsHarness.settings.upsert(USER_ID, { layout: { weekStart: 0 } });
    const viaSettings = toolResult(
      await callTool(settingsHarness.app, key, 'list_tasks', { window: 'this_week' }),
    );
    expect(viaSettings.structuredContent).toMatchObject({ resolvedStart: '2026-07-05' });

    const defaultHarness = buildHarness();
    const defaultKey = defaultHarness.issueKey(['tasks:read']);
    const viaDefault = toolResult(
      await callTool(defaultHarness.app, defaultKey, 'list_tasks', { window: 'this_week' }),
    );
    expect(viaDefault.structuredContent).toMatchObject({ resolvedStart: '2026-07-06' });
  });

  it('list_tasks: overdue window and includeCompleted behavior', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:read']);
    todos.seed(USER_ID, { title: 'Overdue', dueDate: '2026-07-01' });
    todos.seed(USER_ID, { title: 'Done overdue', dueDate: '2026-07-01', isCompleted: true });
    todos.seed(USER_ID, { title: 'Future', dueDate: '2026-08-01' });

    const overdue = toolResult(await callTool(app, key, 'list_tasks', { window: 'overdue' }));
    expect(overdue.structuredContent).toMatchObject({
      resolvedStart: '2000-01-01',
      resolvedEnd: '2026-07-07',
      count: 1,
    });

    const withCompleted = toolResult(
      await callTool(app, key, 'list_tasks', { window: 'this_month', includeCompleted: true }),
    );
    expect(withCompleted.structuredContent.count).toBe(2);

    const invalid = toolResult(await callTool(app, key, 'list_tasks', { window: 'whenever' }));
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent.error).toMatchObject({ code: 'invalid_input' });
  });

  it('list_today includes dateRange spans covering today', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:read']);
    todos.seed(USER_ID, { title: 'Due today', dueDate: '2026-07-08' });
    todos.seed(USER_ID, { title: 'Due tomorrow', dueDate: '2026-07-09' });
    todos.seed(USER_ID, {
      title: 'Spanning',
      dueDate: '2026-07-01',
      recurrence: { mode: 'dateRange', startDate: '2026-07-01', endDate: '2026-07-31' },
    });

    const result = toolResult(await callTool(app, key, 'list_today', {}));
    expect(result.structuredContent).toMatchObject({
      dateToken: 'today',
      resolvedDate: '2026-07-08',
    });
    const titles = (result.structuredContent.tasks as { title: string }[]).map((t) => t.title);
    expect(titles.sort()).toEqual(['Due today', 'Spanning']);
  });

  it('list_upcoming filters by span end, sorts by effective date, excludes unscheduled', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:read']);
    todos.seed(USER_ID, { title: 'Past', dueDate: '2026-07-01' });
    todos.seed(USER_ID, { title: 'Later', dueDate: '2026-07-20' });
    todos.seed(USER_ID, { title: 'Sooner', dueDate: '2026-07-10' });
    todos.seed(USER_ID, { title: 'Unscheduled', dueDate: null });
    todos.seed(USER_ID, { title: 'Done', dueDate: '2026-07-15', isCompleted: true });

    const result = toolResult(
      await callTool(app, key, 'list_upcoming', { fromDate: '2026-07-09' }),
    );
    expect(result.structuredContent).toMatchObject({
      fromDate: '2026-07-09',
      includesUnscheduled: false,
      ordering: 'effectiveDateAsc,orderAsc,taskNumberAsc',
      count: 2,
    });
    const titles = (result.structuredContent.tasks as { title: string }[]).map((t) => t.title);
    expect(titles).toEqual(['Sooner', 'Later']);

    const invalid = toolResult(await callTool(app, key, 'list_upcoming', { fromDate: '07/09' }));
    expect(invalid.isError).toBe(true);
  });

  it('find_similar_tasks returns ranked matches and enforces schema bounds', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:read']);
    todos.seed(USER_ID, { title: 'Buy groceries' });
    todos.seed(USER_ID, { title: 'Totally different' });

    const found = toolResult(
      await callTool(app, key, 'find_similar_tasks', { title: 'Buy groceries' }),
    );
    expect(found.structuredContent).toMatchObject({ query: 'Buy groceries', count: 1 });

    // limit > 20 violates the input schema. The SDK enforces the bound and
    // surfaces it as a tool error result (isError) rather than crashing the
    // JSON-RPC protocol — the correct modern MCP behavior for bad tool input.
    const outOfBounds = toolResult(
      await callTool(app, key, 'find_similar_tasks', { title: 'Buy groceries', limit: 50 }),
    );
    expect(outOfBounds.isError).toBe(true);
    expect(outOfBounds.content[0]?.text).toMatch(/limit|-32602|Invalid arguments|too_big|<=20/i);
  });

  it('get_statistics and export_tasks keep the old shapes', async () => {
    const { app, issueKey, todos } = buildHarness();
    const key = issueKey(['tasks:read']);
    todos.seed(USER_ID, { title: 'Overdue', dueDate: '2026-07-01', duration: 30 });
    todos.seed(USER_ID, {
      title: 'Flagged future',
      dueDate: '2026-08-01',
      duration: 20,
      isFlagged: true,
    });
    todos.seed(USER_ID, { title: 'Done flagged', isCompleted: true, isFlagged: true });
    todos.seed(USER_ID, { title: 'Archived', archived: true });

    const stats = toolResult(await callTool(app, key, 'get_statistics', {}));
    expect(stats.structuredContent).toEqual({
      total: 3,
      active: 2,
      completed: 1,
      flagged: 1,
      overdue: 1,
      totalActiveMinutes: 50,
    });

    const exported = toolResult(await callTool(app, key, 'export_tasks', {}));
    expect(Object.keys(exported.structuredContent)).toEqual(['exported_at', 'todos', 'stats']);
    expect(exported.structuredContent.stats).toEqual({
      totalTodos: 3,
      completedCount: 1,
      completionRate: 33,
    });
    expect(exported.structuredContent.todos as unknown[]).toHaveLength(3);
  });

  it('tag management: list/create/update/delete with old payloads and guards', async () => {
    const { app, issueKey } = buildHarness();
    const key = issueKey(['tasks:read', 'tasks:write']);

    const listed = toolResult(await callTool(app, key, 'list_tags', {}));
    expect((listed.structuredContent.tags as unknown[]).length).toBe(10); // seeded defaults
    expect((listed.structuredContent.tags as Record<string, unknown>[])[0]).toMatchObject({
      isDefault: true,
      userId: null,
    });

    const created = toolResult(
      await callTool(app, key, 'create_tag', { name: 'Deep Work', color: '#123456' }),
    );
    const createdTag = created.structuredContent.tag as { id: string; name: string };
    expect(createdTag.name).toBe('Deep Work');
    expect(created.content[0]?.text).toBe('Created tag "Deep Work" (#123456).');

    const updated = toolResult(
      await callTool(app, key, 'update_tag', {
        id: createdTag.id,
        name: 'Deeper Work',
        color: '#654321',
      }),
    );
    expect(updated.structuredContent.tag).toMatchObject({ name: 'Deeper Work' });

    const defaultGuard = toolResult(
      await callTool(app, key, 'update_tag', { id: 'default-work', name: 'X', color: '#000000' }),
    );
    expect(defaultGuard.isError).toBe(true);
    expect(defaultGuard.structuredContent.error).toMatchObject({ code: 'forbidden', status: 403 });

    const deleted = toolResult(await callTool(app, key, 'delete_tag', { id: createdTag.id }));
    expect(deleted.structuredContent).toEqual({ deleted: true, id: createdTag.id });

    const deleteDefault = toolResult(
      await callTool(app, key, 'delete_tag', { id: 'default-work' }),
    );
    expect(deleteDefault.isError).toBe(true);
    expect(deleteDefault.structuredContent.error).toMatchObject({ code: 'forbidden' });
  });
});

describe('MCP mount on the composed app', () => {
  const failingPool = {
    query: () => Promise.reject(new Error('no database in unit tests')),
    end: () => Promise.resolve(),
  } as unknown as pg.Pool;

  function buildComposedApp(): Express {
    const env = parseEnv({ NODE_ENV: 'test', AUTH_DISABLED: '1' });
    const container = buildContainer(env, pino({ enabled: false }), { pool: failingPool });
    return createApp(container);
  }

  it('POST /mcp is public (own auth, before the /api/v1 gate)', async () => {
    const app = buildComposedApp();
    const response = await request(app)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    // Reaches the MCP module's own auth (401 JSON-RPC), NOT the API auth gate.
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      error: { data: { code: 'missing_api_key' } },
    });
  });

  it('GET /mcp on the composed app returns the 405 JSON-RPC error', async () => {
    const app = buildComposedApp();
    const response = await request(app).get('/mcp');
    expect(response.status).toBe(405);
    expect(response.body.error).toMatchObject({ code: -32000 });
  });
});
