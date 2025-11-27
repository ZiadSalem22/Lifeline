const express = require('express');
const request = require('supertest');
const { createRateLimiter } = require('../../src/middleware/rateLimit');

function buildApp(limit, windowMs = 60000) {
  const app = express();
  app.use((req, _res, next) => { req.currentUser = { id: 'user-1', roles: [] }; next(); });
  app.use(createRateLimiter({ windowMs, max: limit, keyGenerator: (req) => req.currentUser.id }));
  app.get('/api/todos', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rateLimit middleware', () => {
  it('allows up to the limit and blocks beyond', async () => {
    const app = buildApp(3, 10000);
    await request(app).get('/api/todos').expect(200);
    await request(app).get('/api/todos').expect(200);
    await request(app).get('/api/todos').expect(200);
    await request(app).get('/api/todos').expect(429);
  });
});
