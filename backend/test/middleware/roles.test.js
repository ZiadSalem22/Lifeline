const express = require('express');
const request = require('supertest');
const { requireAuth, requireRole, requireRoleIn, requirePaid } = require('../../src/middleware/roles');

describe('roles middleware', () => {
  function makeApp(mw, user) {
    const app = express();
    app.use((req, res, next) => {
      req.currentUser = user;
      next();
    });
    app.get('/test', mw, (req, res) => res.json({ ok: true }));
    // Use real error handler for correct error codes
    const { errorHandler } = require('../../src/middleware/errorHandler');
    const { AppError } = require('../../src/utils/errors');
    app.use(errorHandler);
    return app;
  }

  it('requireAuth: allows authenticated, blocks unauthenticated', async () => {
    let app = makeApp(requireAuth(), { id: 'u1' });
    let res = await request(app).get('/test');
    expect(res.status).toBe(200);
    app = makeApp(requireAuth(), null);
    res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/Guest mode works only locally/);
  });

  it('requireRole: allows correct role, blocks others', async () => {
    let app = makeApp(requireRole('admin'), { id: 'u1', roles: ['admin'] });
    let res = await request(app).get('/test');
    expect(res.status).toBe(200);
    app = makeApp(requireRole('admin'), { id: 'u2', roles: ['free'] });
    res = await request(app).get('/test');
    expect(res.status).toBe(403);
  });

  it('requireRoleIn: allows any matching role', async () => {
    let app = makeApp(requireRoleIn(['admin', 'paid']), { id: 'u1', roles: ['paid'] });
    let res = await request(app).get('/test');
    expect(res.status).toBe(200);
    app = makeApp(requireRoleIn(['admin', 'paid']), { id: 'u2', roles: ['free'] });
    res = await request(app).get('/test');
    expect(res.status).toBe(403);
  });

  it('requirePaid: allows paid/admin, blocks free', async () => {
    let app = makeApp(requirePaid(), { id: 'u1', roles: ['paid'] });
    let res = await request(app).get('/test');
    expect(res.status).toBe(200);
    app = makeApp(requirePaid(), { id: 'u2', roles: ['admin'] });
    res = await request(app).get('/test');
    expect(res.status).toBe(200);
    app = makeApp(requirePaid(), { id: 'u3', roles: ['free'] });
    res = await request(app).get('/test');
    expect(res.status).toBe(403);
  });
});
