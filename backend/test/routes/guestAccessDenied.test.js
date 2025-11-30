const express = require('express');
const request = require('supertest');
const { requireAuth } = require('../../src/middleware/roles');
const { errorHandler } = require('../../src/middleware/errorHandler');

// Fake repository to assert no calls when unauthenticated
const fakeRepo = { list: jest.fn(() => [{ id: 't1' }]) };

function makeApp(currentUser) {
  const app = express();
  app.use((req, res, next) => { req.currentUser = currentUser; next(); });
  app.get('/api/todos', requireAuth(), (req, res) => {
    const data = fakeRepo.list();
    res.json(data);
  });
  app.use(errorHandler);
  return app;
}

describe('Guest access denial', () => {
  it('returns 401 and does not call repository when unauthenticated', async () => {
    const app = makeApp(null); // simulate guest (no auth)
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Guest mode works only locally/);
    expect(fakeRepo.list).not.toHaveBeenCalled();
  });

  it('allows access and calls repository when authenticated', async () => {
    const app = makeApp({ id: 'user1', roles: ['free'] });
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(fakeRepo.list).toHaveBeenCalledTimes(1);
  });
});
