const request = require('supertest');

// Mock DB and make auth middleware return 401 to simulate guest/no-auth
jest.mock('../../src/infra/db/data-source', () => ({ AppDataSource: { isInitialized: true, initialize: async () => {} } }));
jest.mock('../../src/middleware/auth0', () => ({ checkJwt: (req, res, next) => res.status(401).json({ error: 'Unauthorized' }) }));

// Prevent TypeORM repos from initializing
jest.mock('../../src/infrastructure/TypeORMTodoRepository', () => {
  return jest.fn().mockImplementation(() => ({}));
});
jest.mock('../../src/infrastructure/TypeORMTagRepository', () => {
  return jest.fn().mockImplementation(() => ({}));
});

describe('GET /api/export (guest/unauthenticated)', () => {
  let app;
  beforeAll(() => {
    app = require('../../src/index');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/export').expect(401);
    expect(res.body).toHaveProperty('error');
  });
});
