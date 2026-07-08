import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { pino } from 'pino';
import { PROBLEM_CONTENT_TYPE, problemSchema } from '@lifeline/shared';
import {
  AppError,
  ConflictError,
  DomainValidationError,
  NotFoundError,
} from '../../domain/errors.js';
import { requestId } from './request-id.js';
import { errorHandler, notFoundHandler } from './error-handler.js';
import { getValidated, validate } from './validate.js';

const bodySchema = z.object({
  title: z.string().min(1),
  count: z.number().int().min(1),
});
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

function buildApp(): express.Express {
  const app = express();
  app.use(requestId());
  app.use(express.json({ limit: '1kb' }));

  app.post('/validated', validate(bodySchema), (req, res) => {
    res.json(getValidated<z.infer<typeof bodySchema>>(req));
  });
  app.get('/query', validate(querySchema, 'query'), (req, res) => {
    res.json(getValidated<z.infer<typeof querySchema>>(req, 'query'));
  });
  app.get('/not-found-error', () => {
    throw new NotFoundError('No task found with that number.');
  });
  app.get('/conflict', () => {
    throw new ConflictError('Cannot modify an archived task. Restore it first.');
  });
  app.get('/domain-validation', () => {
    throw new DomainValidationError('subtasks exceeded', { subtasks: ['too many'] });
  });
  app.get('/custom-app-error', () => {
    throw new AppError(503, 'internal', 'Authentication service temporarily unavailable');
  });
  app.get('/boom', () => {
    throw new Error('kaboom secret details');
  });
  app.get('/async-boom', () => Promise.reject(new Error('async kaboom')));

  app.use(notFoundHandler());
  app.use(errorHandler(pino({ enabled: false })));
  return app;
}

const app = buildApp();

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  const parsed = problemSchema.safeParse(JSON.parse(response.text));
  expect(parsed.success).toBe(true);
  if (parsed.success) {
    expect(parsed.data.status).toBe(status);
    expect(parsed.data.code).toBe(code);
    expect(parsed.data.requestId).toBeTruthy();
  }
}

describe('errorHandler', () => {
  it('maps ZodError → 400 validation_failed with flattened field errors', async () => {
    const response = await request(app).post('/validated').send({ title: '', count: 0 });
    expectProblem(response, 400, 'validation_failed');
    const body = JSON.parse(response.text) as { errors: Record<string, string[]> };
    expect(Object.keys(body.errors)).toEqual(expect.arrayContaining(['title', 'count']));
  });

  it('passes validated bodies through', async () => {
    const response = await request(app).post('/validated').send({ title: 'ok', count: 2 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ title: 'ok', count: 2 });
  });

  it('validates and coerces query params via req.validated (Express 5 getter-safe)', async () => {
    const response = await request(app).get('/query?page=3');
    expect(response.body).toEqual({ page: 3 });
    const defaulted = await request(app).get('/query');
    expect(defaulted.body).toEqual({ page: 1 });
    const bad = await request(app).get('/query?page=zero');
    expectProblem(bad, 400, 'validation_failed');
  });

  it('maps NotFoundError → 404 problem', async () => {
    const response = await request(app).get('/not-found-error');
    expectProblem(response, 404, 'not_found');
    expect((JSON.parse(response.text) as { detail: string }).detail).toBe(
      'No task found with that number.',
    );
  });

  it('maps ConflictError → 409 problem', async () => {
    expectProblem(await request(app).get('/conflict'), 409, 'conflict');
  });

  it('maps DomainValidationError → 400 with fieldErrors', async () => {
    const response = await request(app).get('/domain-validation');
    expectProblem(response, 400, 'validation_failed');
    expect((JSON.parse(response.text) as { errors: unknown }).errors).toEqual({
      subtasks: ['too many'],
    });
  });

  it('honors arbitrary AppError status/code', async () => {
    expectProblem(await request(app).get('/custom-app-error'), 503, 'internal');
  });

  it('maps unknown errors → 500 internal with a generic detail', async () => {
    const response = await request(app).get('/boom');
    expectProblem(response, 500, 'internal');
    expect(response.text).not.toContain('kaboom secret details');
  });

  it('catches async handler rejections (Express 5)', async () => {
    expectProblem(await request(app).get('/async-boom'), 500, 'internal');
  });

  it('maps malformed JSON bodies → 400 validation_failed', async () => {
    const response = await request(app)
      .post('/validated')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expectProblem(response, 400, 'validation_failed');
  });

  it('maps oversized bodies → 413 payload_too_large', async () => {
    const response = await request(app)
      .post('/validated')
      .send({ title: 'x'.repeat(5000), count: 1 });
    expectProblem(response, 413, 'payload_too_large');
  });

  it('unmatched routes → 404 problem via notFoundHandler', async () => {
    const response = await request(app).get('/nope/nothing');
    expectProblem(response, 404, 'not_found');
  });

  it('echoes X-Request-Id and reuses an incoming one', async () => {
    const response = await request(app).get('/not-found-error').set('X-Request-Id', 'trace-me-123');
    expect(response.headers['x-request-id']).toBe('trace-me-123');
    expect((JSON.parse(response.text) as { requestId: string }).requestId).toBe('trace-me-123');
  });
});
