const request = require('supertest');
const express = require('express');
jest.mock('../../src/infrastructure/TypeORMUserRepository', () => ({ ensureUserFromAuth0Claims: async () => ({ id: 'user-1', email: 'u@example.com' }) }));
jest.mock('../../src/infrastructure/TypeORMUserProfileRepository', () => ({
  findByUserId: jest.fn(async () => null),
  saveOrUpdate: jest.fn(async (id, data) => ({ user_id: id, ...data }))
}));
const { attachCurrentUser } = require('../../src/middleware/attachCurrentUser');
const { requireAuth } = require('../../src/middleware/roles');

// Build a minimal app exposing /api/me and /api/profile
function buildApp(mockUser) {
  const app = express();
  app.use(express.json());
  app.use((req,res,next)=>{ req.headers.authorization = 'Bearer test'; next(); });
  app.use((req,res,next)=>{ req.auth = { payload: { sub: mockUser.id, email: mockUser.email } }; next(); });
  app.use(attachCurrentUser);
  const router = express.Router();
  router.get('/me', requireAuth(), (req,res) => {
    res.json({ id: req.currentUser.id, email: req.currentUser.email, profile: req.currentUser.profile });
  });
  router.post('/profile', requireAuth(), async (req,res)=>{
    const repo = require('../../src/infrastructure/TypeORMUserProfileRepository');
    const saved = await repo.saveOrUpdate(req.currentUser.id, req.body);
    res.json({ onboarding_completed: !!saved.onboarding_completed });
  });
  app.use('/api', router);
  return app;
}

describe('GET /api/me with profile', () => {
  it('defaults onboarding_completed to false when profile missing', async () => {
    const app = buildApp({ id:'user-1', email:'u@example.com' });
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeTruthy();
    expect(res.body.profile.onboarding_completed).toBe(false);
  });

  it('after POST /api/profile onboarding_completed true', async () => {
    const app = buildApp({ id:'user-1', email:'u@example.com' });
    const post = await request(app).post('/api/profile').send({ first_name:'A', last_name:'B', onboarding_completed:true });
    expect(post.status).toBe(200);
    expect(post.body.onboarding_completed).toBe(true);
  });
});
