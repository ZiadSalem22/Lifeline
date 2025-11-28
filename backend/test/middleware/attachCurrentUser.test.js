
const express = require('express');
const request = require('supertest');

jest.mock('../../src/infrastructure/TypeORMUserRepository', () => {
  return {
    ensureUserFromAuth0Claims: jest.fn(async (claims) => ({
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      role: (claims['https://lifeline-api/roles'] && claims['https://lifeline-api/roles'][0]) || 'free',
      subscription_status: 'none',
    })),
  };
});
jest.mock('../../src/infrastructure/TypeORMUserProfileRepository', () => {
  return {
    findByUserId: jest.fn(async (userId) => null),
  };
});
const { attachCurrentUser } = require('../../src/middleware/attachCurrentUser');

describe('attachCurrentUser middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should populate req.currentUser with roles and role from Auth0 claims', async () => {
    const app = express();
    app.use((req, res, next) => {
      req.headers.authorization = 'Bearer test';
      req.auth = { payload: {
        sub: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'pic.png',
        'https://lifeline-api/roles': ['paid', 'admin']
      }};
      next();
    });
    app.use(attachCurrentUser);
    app.get('/me', (req, res) => {
      res.json(req.currentUser);
    });
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user123');
    expect(res.body.roles).toContain('admin');
    expect(res.body.role).toBe('admin');
  });

  it('should default to role free if no roles present', async () => {
    const app = express();
    app.use((req, res, next) => {
      req.headers.authorization = 'Bearer test';
      req.auth = { payload: {
        sub: 'user456',
        email: 'test2@example.com',
        name: 'No Role',
        picture: 'pic2.png'
      }};
      next();
    });
    app.use(attachCurrentUser);
    app.get('/me', (req, res) => {
      res.json(req.currentUser);
    });
    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user456');
    expect(res.body.role).toBe('free');
    expect(res.body.roles).toEqual([]);
  });
});
