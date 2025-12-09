const express = require('express');
const request = require('supertest');
const { requireAuth } = require('../../src/middleware/roles');
const { errorHandler } = require('../../src/middleware/errorHandler');

function makeApp(currentUser, repo) {
  const app = express();
  app.use((req, res, next) => { req.currentUser = currentUser; next(); });
  app.get('/api/todos/by-number/:taskNumber', requireAuth(), async (req, res) => {
    const n = parseInt(req.params.taskNumber, 10);
    if (Number.isNaN(n) || n < 1) return res.status(400).json({ message: 'invalid task number' });
    const todo = await repo.findByTaskNumber(req.currentUser.id, n);
    if (!todo) return res.status(404).json({ message: 'not found' });
    res.json(todo);
  });
  app.use(errorHandler);
  return app;
}

describe('GET /api/todos/by-number/:taskNumber', () => {
  it('returns 400 for invalid number', async () => {
    const app = makeApp({ id: 'u1' }, { findByTaskNumber: jest.fn() });
    const res = await request(app).get('/api/todos/by-number/0');
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    const repo = { findByTaskNumber: jest.fn(() => null) };
    const app = makeApp({ id: 'u1' }, repo);
    const res = await request(app).get('/api/todos/by-number/5');
    expect(res.status).toBe(404);
    expect(repo.findByTaskNumber).toHaveBeenCalledWith('u1', 5);
  });

  it('returns todo when found', async () => {
    const sample = { id: 't1', title: 'Hi', taskNumber: 2 };
    const repo = { findByTaskNumber: jest.fn(() => sample) };
    const app = makeApp({ id: 'u1' }, repo);
    const res = await request(app).get('/api/todos/by-number/2');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('t1');
  });
});
