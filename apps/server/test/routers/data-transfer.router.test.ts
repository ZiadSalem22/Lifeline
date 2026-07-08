import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROBLEM_CONTENT_TYPE, problemSchema } from '@lifeline/shared';
import { OpenApiRegistry } from '../../src/http/openapi/registry.js';
import { buildImportRouter } from '../../src/http/routes/import.js';
import { buildAccountRouter, RESET_ACCOUNT_MESSAGE } from '../../src/http/routes/account.js';
import { ImportData } from '../../src/application/data-transfer/import-data.js';
import { ResetAccount } from '../../src/application/data-transfer/reset-account.js';
import { InMemoryTagRepository, InMemoryTodoRepository } from '../helpers/feature-fakes.js';
import { InMemorySettingsRepository } from '../helpers/in-memory.js';
import { makeApp, makeUser } from '../helpers/router-app.js';
import type { CurrentUser } from '../../src/application/ports.js';

let todos: InMemoryTodoRepository;
let tags: InMemoryTagRepository;
let settings: InMemorySettingsRepository;

beforeEach(() => {
  tags = new InMemoryTagRepository();
  tags.seedDefaults();
  todos = new InMemoryTodoRepository(tags);
  settings = new InMemorySettingsRepository();
});

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  expect(problemSchema.safeParse(response.body).success).toBe(true);
  expect(response.body).toMatchObject({ status, code });
}

describe('POST /api/v1/import', () => {
  function importApp(user: CurrentUser | null = makeUser({ id: 'u1' })) {
    return makeApp(
      '/api/v1/import',
      buildImportRouter({
        importData: new ImportData({ todos }),
        registry: new OpenApiRegistry(),
      }),
      user,
    );
  }

  it('imports an object payload and returns {importedCount}', async () => {
    const response = await request(importApp())
      .post('/api/v1/import')
      .send({ data: { todos: [{ title: 'a' }, { title: 'b' }] }, mode: 'merge' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ importedCount: 2 });
    expect(todos.rowsFor('u1')).toHaveLength(2);
  });

  it('mode defaults to merge; string payloads are accepted', async () => {
    todos.seed('u1', { title: 'Existing' });
    const response = await request(importApp())
      .post('/api/v1/import')
      .send({ data: JSON.stringify({ todos: [{ title: 'From string' }] }) });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ importedCount: 1 });
    expect(todos.rowsFor('u1')).toHaveLength(2); // merge kept the existing row
  });

  it("400 problem 'Invalid JSON format' for a malformed JSON string", async () => {
    const response = await request(importApp())
      .post('/api/v1/import')
      .send({ data: '{not json', mode: 'merge' });
    expectProblem(response, 400, 'validation_failed');
    expect(response.body.detail).toBe('Invalid JSON format');
  });

  it("400 problem 'Invalid import format: missing todos array'", async () => {
    const response = await request(importApp())
      .post('/api/v1/import')
      .send({ data: { nope: true }, mode: 'merge' });
    expectProblem(response, 400, 'validation_failed');
    expect(response.body.detail).toBe('Invalid import format: missing todos array');
  });

  it('400 schema problems: missing data, bad mode', async () => {
    expectProblem(
      await request(importApp()).post('/api/v1/import').send({ mode: 'merge' }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(importApp())
        .post('/api/v1/import')
        .send({ data: { todos: [] }, mode: 'overwrite' }),
      400,
      'validation_failed',
    );
  });

  it('replace mode purges before importing', async () => {
    todos.seed('u1', { title: 'Old' });
    tags.seedCustom('u1', { name: 'OldTag' });
    const response = await request(importApp())
      .post('/api/v1/import')
      .send({ data: { todos: [{ title: 'New' }] }, mode: 'replace' });
    expect(response.status).toBe(200);
    expect(todos.rowsFor('u1').map((todo) => todo.title)).toEqual(['New']);
    expect(await tags.countCustomByUser('u1')).toBe(0);
  });

  it('401 problem without a user', async () => {
    expectProblem(
      await request(importApp(null))
        .post('/api/v1/import')
        .send({ data: { todos: [] } }),
      401,
      'unauthorized',
    );
  });
});

describe('POST /api/v1/account/reset', () => {
  function accountApp(user: CurrentUser | null = makeUser({ id: 'u1' })) {
    return makeApp(
      '/api/v1/account',
      buildAccountRouter({
        resetAccount: new ResetAccount({ todos, tags, settings }),
        registry: new OpenApiRegistry(),
      }),
      user,
    );
  }

  it('200 with the exact old-app success message; data actually deleted', async () => {
    todos.seed('u1');
    tags.seedCustom('u1', { name: 'Mine' });
    await settings.upsert('u1', { theme: 'dark' });

    const response = await request(accountApp()).post('/api/v1/account/reset');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Account data reset: todos, tags, and theme deleted.',
    });
    expect(response.body.message).toBe(RESET_ACCOUNT_MESSAGE);
    expect(todos.rowsFor('u1')).toHaveLength(0);
    expect(await tags.countCustomByUser('u1')).toBe(0);
    expect(await settings.get('u1')).toBeNull();
  });

  it('404 problem for other methods/paths under /account', async () => {
    expectProblem(await request(accountApp()).get('/api/v1/account/reset'), 404, 'not_found');
    expectProblem(await request(accountApp()).post('/api/v1/account/nuke'), 404, 'not_found');
  });

  it('401 problem without a user', async () => {
    expectProblem(
      await request(accountApp(null)).post('/api/v1/account/reset'),
      401,
      'unauthorized',
    );
  });
});
