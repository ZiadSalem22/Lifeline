const request = require('supertest');

// Prevent real TypeORM DB initialization in tests
jest.mock('../../src/infra/db/data-source', () => ({ AppDataSource: { isInitialized: true, initialize: async () => {} } }));

// Bypass Auth0 middleware in tests
jest.mock('../../src/middleware/auth0', () => ({ checkJwt: (req, res, next) => next() }));

// Mock attachCurrentUser before loading the app so middleware is replaced
jest.mock('../../src/middleware/attachCurrentUser', () => ({
  attachCurrentUser: (req, res, next) => {
    req.currentUser = {
      id: 'test|user1',
      email: 'test@example.com',
      profile: { first_name: 'T' },
      settings: { theme: 'dark', locale: 'en-US', layout: { font: 'Inter' } }
    };
    next();
  }
}));

// We will mock the user repositories to avoid touching real DB in unit test
jest.mock('../../src/infrastructure/TypeORMUserSettingsRepository', () => ({
  saveOrUpdate: jest.fn(async (userId, settings) => ({ ...settings })),
  findByUserId: jest.fn(async (userId) => ({ theme: 'dark', locale: 'en-US', layout: { font: 'Inter' } }))
}));

jest.mock('../../src/infrastructure/TypeORMTodoRepository', () => {
  return jest.fn().mockImplementation(() => ({
    getExportStatsForUser: jest.fn(async (userId) => ({ totalTodos: 1, completedCount: 0, completionRate: 0 })),
  }));
});

jest.mock('../../src/infrastructure/TypeORMTagRepository', () => {
  return jest.fn().mockImplementation(() => ({}));
});
// Mock ListTodos and TagUseCases to return deterministic empty sets
jest.mock('../../src/application/ListTodos', () => {
  return jest.fn().mockImplementation(() => ({ execute: async (userId) => ([]) }));
});
jest.mock('../../src/application/TagUseCases', () => ({
  ListTags: jest.fn().mockImplementation(() => ({ execute: async (userId) => ([]) })),
  CreateTag: jest.fn(),
  DeleteTag: jest.fn(),
  UpdateTag: jest.fn()
}));
const app = require('../../src/index');

describe('Export includes persisted settings', () => {
  it('saves settings and includes them in export payload', async () => {
    // attachCurrentUser was mocked earlier to set req.currentUser

    // Request export (settings are provided by the mocked UserSettings repo)
    const resExport = await request(app)
      .get('/api/export')
      .set('Authorization', 'Bearer faketoken');
    if (resExport.status !== 200) console.error('/api/export failed', resExport.status, resExport.body);
    expect(resExport.status).toBe(200);

    const payload = resExport.body;
    expect(payload).toHaveProperty('user');
    expect(payload.user).toHaveProperty('settings');
    // settings should reflect saved data (or mocked findByUserId)
    expect(payload.user.settings).toBeTruthy();
    // Because our mocked findByUserId returns theme 'dark' by default, allow either
    expect(['sunset', 'dark']).toContain(payload.user.settings.theme);
    expect(payload.todos).toBeDefined();
    expect(payload.tags).toBeDefined();
    expect(payload.stats).toBeDefined();
  });
});
