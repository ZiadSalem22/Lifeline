const express = require('express');
const request = require('supertest');
const { requireAuth, requireRole } = require('../../src/middleware/roles');

describe('Protected routes integration', () => {
  function makeApp(user) {
    const app = express();
    app.use((req, res, next) => {
      req.currentUser = user;
      next();
    });
    app.get('/api/me', requireAuth(), (req, res) => res.json({ id: user && user.id }));
    app.get('/api/admin/secret', requireRole('admin'), (req, res) => res.json({ admin: true }));
    app.get('/api/ai/feature', requireRole('paid'), (req, res) => res.json({ ai: true }));
    // Use real error handler for correct error codes
    const { errorHandler } = require('../../src/middleware/errorHandler');
    const { AppError } = require('../../src/utils/errors');
    app.use(errorHandler);
    return app;
  }

  it('should allow /api/me for authenticated user', async () => {
    const app = makeApp({ id: 'u1', roles: ['free'] });
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('u1');
  });

  it('should block /api/me for unauthenticated user', async () => {
    const app = makeApp(null);
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(403);
  });

  it('should allow /api/admin/secret for admin', async () => {
    const app = makeApp({ id: 'u2', roles: ['admin'] });
    const res = await request(app).get('/api/admin/secret');
    expect(res.status).toBe(200);
    expect(res.body.admin).toBe(true);
  });

  it('should block /api/admin/secret for non-admin', async () => {
    const app = makeApp({ id: 'u3', roles: ['free'] });
    const res = await request(app).get('/api/admin/secret');
    expect(res.status).toBe(403);
  });

  it('should allow /api/ai/feature for paid', async () => {
    const app = makeApp({ id: 'u4', roles: ['paid'] });
    const res = await request(app).get('/api/ai/feature');
    expect(res.status).toBe(200);
    expect(res.body.ai).toBe(true);
  });

  it('should block /api/ai/feature for free', async () => {
    const app = makeApp({ id: 'u5', roles: ['free'] });
    const res = await request(app).get('/api/ai/feature');
    expect(res.status).toBe(403);
  });
});
