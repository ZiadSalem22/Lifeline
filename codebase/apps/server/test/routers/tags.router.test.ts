import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROBLEM_CONTENT_TYPE, problemSchema } from '@lifeline/shared';
import { OpenApiRegistry } from '../../src/http/openapi/registry.js';
import { buildTagsRouter } from '../../src/http/routes/tags.js';
import { ListTags } from '../../src/application/tags/list-tags.js';
import { CreateTag } from '../../src/application/tags/create-tag.js';
import { UpdateTag } from '../../src/application/tags/update-tag.js';
import { DeleteTag } from '../../src/application/tags/delete-tag.js';
import { InMemoryTagRepository } from '../helpers/feature-fakes.js';
import { makeApp, makeUser } from '../helpers/router-app.js';

let tags: InMemoryTagRepository;
let app: ReturnType<typeof makeApp>;

beforeEach(() => {
  tags = new InMemoryTagRepository();
  tags.seedDefaults();
  app = makeApp('/api/v1/tags', buildRouter(), makeUser({ id: 'u1' }));
});

function buildRouter() {
  return buildTagsRouter({
    listTags: new ListTags({ tags }),
    createTag: new CreateTag({ tags }),
    updateTag: new UpdateTag({ tags }),
    deleteTag: new DeleteTag({ tags }),
    registry: new OpenApiRegistry(),
  });
}

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  expect(problemSchema.safeParse(response.body).success).toBe(true);
  expect(response.body).toMatchObject({ status, code });
}

describe('GET /api/v1/tags', () => {
  it('returns a plain array (documented pagination exception), defaults first', async () => {
    tags.seedCustom('u1', { name: 'zzz' });
    const response = await request(app).get('/api/v1/tags');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(11);
    expect(response.body[0].isDefault).toBe(true);
    expect(response.body[10]).toMatchObject({ name: 'zzz', isDefault: false });
  });
});

describe('POST /api/v1/tags', () => {
  it('201 creates a custom tag', async () => {
    const response = await request(app)
      .post('/api/v1/tags')
      .send({ name: 'Garden', color: '#00FF00' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Garden',
      color: '#00FF00',
      userId: 'u1',
      isDefault: false,
    });
  });

  it('400 on bad color/name; 409 duplicate; 403 free-tier cap', async () => {
    expectProblem(
      await request(app).post('/api/v1/tags').send({ name: 'Bad', color: 'red' }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app).post('/api/v1/tags').send({ color: '#00FF00' }),
      400,
      'validation_failed',
    );

    tags.seedCustom('u1', { name: 'Taken' });
    expectProblem(
      await request(app).post('/api/v1/tags').send({ name: 'taken', color: '#00FF00' }),
      409,
      'conflict',
    );

    for (let i = 0; i < 49; i += 1) tags.seedCustom('u1', { name: `filler-${i}` });
    const capped = await request(app)
      .post('/api/v1/tags')
      .send({ name: 'over-cap', color: '#00FF00' });
    expectProblem(capped, 403, 'forbidden');
    expect(capped.body.detail).toBe('Free tier max tags reached.');
  });
});

describe('PATCH /api/v1/tags/:id', () => {
  it('guards: 404 unknown, 403 default, 403 not-owner; 200 on own custom', async () => {
    const mine = tags.seedCustom('u1', { name: 'Mine' });
    const foreign = tags.seedCustom('u2', { name: 'Foreign' });

    expectProblem(
      await request(app).patch('/api/v1/tags/ghost').send({ name: 'x' }),
      404,
      'not_found',
    );
    expectProblem(
      await request(app).patch('/api/v1/tags/default-work').send({ name: 'x' }),
      403,
      'forbidden',
    );
    expectProblem(
      await request(app).patch(`/api/v1/tags/${foreign.id}`).send({ name: 'x' }),
      403,
      'forbidden',
    );

    const ok = await request(app)
      .patch(`/api/v1/tags/${mine.id}`)
      .send({ name: 'Renamed', color: '#ABCDEF' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: mine.id, name: 'Renamed', color: '#ABCDEF' });
  });

  it('400 on invalid color format', async () => {
    const mine = tags.seedCustom('u1', { name: 'Mine' });
    expectProblem(
      await request(app).patch(`/api/v1/tags/${mine.id}`).send({ color: 'blue' }),
      400,
      'validation_failed',
    );
  });
});

describe('DELETE /api/v1/tags/:id', () => {
  it('204 own custom; 403 default; 403 foreign; 404 unknown', async () => {
    const mine = tags.seedCustom('u1', { name: 'Mine' });
    const foreign = tags.seedCustom('u2', { name: 'Foreign' });

    const ok = await request(app).delete(`/api/v1/tags/${mine.id}`);
    expect(ok.status).toBe(204);
    expect(tags.rows.has(mine.id)).toBe(false);

    expectProblem(await request(app).delete('/api/v1/tags/default-work'), 403, 'forbidden');
    expectProblem(await request(app).delete(`/api/v1/tags/${foreign.id}`), 403, 'forbidden');
    expectProblem(await request(app).delete('/api/v1/tags/ghost'), 404, 'not_found');
  });
});

describe('auth guard', () => {
  it('401 problem when no current user is attached', async () => {
    const bare = makeApp('/api/v1/tags', buildRouter(), null);
    expectProblem(await request(bare).get('/api/v1/tags'), 401, 'unauthorized');
  });
});
