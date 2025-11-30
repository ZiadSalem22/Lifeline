const request = require('supertest');
const express = require('express');
jest.mock('../../src/infrastructure/TypeORMUserRepository', () => ({ ensureUserFromAuth0Claims: async () => ({ id: 'user-1', email: 'u@example.com' }) }));
jest.mock('../../src/infrastructure/TypeORMUserProfileRepository', () => ({
  findByUserId: jest.fn(async () => null),
  saveOrUpdate: jest.fn(async (id, data) => ({ user_id: id, ...data }))
}));
const { attachCurrentUser } = require('../../src/middleware/attachCurrentUser');
const { requireAuth } = require('../../src/middleware/roles');

function buildApp(authenticated=true) {
  const app = express();
  app.use(express.json());
  if (authenticated) {
    app.use((req,res,next)=>{ req.headers.authorization = 'Bearer test'; next(); });
    app.use((req,res,next)=>{ req.auth = { payload: { sub: 'user-1', email: 'u@example.com' } }; next(); });
  }
  // Headers + payload simulate auth

  app.use(attachCurrentUser);
  const router = express.Router();
  router.post('/profile', requireAuth(), async (req,res)=>{
    const repo = require('../../src/infrastructure/TypeORMUserProfileRepository');
    const { first_name, last_name } = req.body || {};
    if (!first_name || !last_name) return res.status(400).json({ error: 'first_name and last_name are required' });
    const saved = await repo.saveOrUpdate(req.currentUser.id, req.body);
    res.json({ first_name: saved.first_name, last_name: saved.last_name, onboarding_completed: !!saved.onboarding_completed });
  });
  app.use('/api', router);
  return { app };
}

describe('POST /api/profile', () => {
  it('creates new profile', async () => {
    const { app } = buildApp(true);
    const res = await request(app).post('/api/profile').send({ first_name:'A', last_name:'B', onboarding_completed:true });
    expect(res.status).toBe(200);
    expect(res.body.onboarding_completed).toBe(true);
  });

  it('rejects guest (Unauthorized)', async () => {
    const { app } = buildApp(false);
    const res = await request(app).post('/api/profile').send({ first_name:'A', last_name:'B', onboarding_completed:true });
    expect([401,403]).toContain(res.status);
  });

  it('validates required fields', async () => {
    const { app } = buildApp(true);
    const res = await request(app).post('/api/profile').send({ first_name:'', last_name:'', onboarding_completed:true });
    expect(res.status).toBe(400);
  });
});
