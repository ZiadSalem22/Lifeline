const request = require('supertest');

// Mock heavy startup pieces before requiring the app
jest.mock('../../src/infra/db/data-source', () => ({ AppDataSource: { isInitialized: true, initialize: async () => {} } }));
jest.mock('../../src/middleware/auth0', () => ({ checkJwt: (req, res, next) => next() }));
jest.mock('../../src/middleware/attachCurrentUser', () => ({ attachCurrentUser: (req, res, next) => { req.currentUser = { id: 'user-123', email: 'user@example.com', profile: { first_name: 'Test' }, role: 'free', roles: [] }; next(); } }));

// Mock ListTodos to return deterministic todos for the user
jest.mock('../../src/application/ListTodos', () => {
  return jest.fn().mockImplementation(() => ({
    execute: async (userId) => ([
      {
        id: 't1',
        title: 'First Todo',
        description: 'Desc',
        dueDate: '2025-12-01',
        dueTime: null,
        isCompleted: false,
        isFlagged: false,
        priority: 'medium',
        duration: 30,
        tags: [{ id: 'g1', name: 'Inbox', color: '#000' }],
        subtasks: [],
        recurrence: null,
        originalId: null
      }
    ])
  }));
});

// Mock TagUseCases.ListTags
jest.mock('../../src/application/TagUseCases', () => ({
  ListTags: jest.fn().mockImplementation(() => ({ execute: async (userId) => ([{ id: 'g1', name: 'Inbox', color: '#000' }]) })),
  CreateTag: jest.fn(),
  DeleteTag: jest.fn(),
  UpdateTag: jest.fn()
}));

// Prevent TypeORM repos from initializing (they call AppDataSource.getRepository)
jest.mock('../../src/infrastructure/TypeORMTodoRepository', () => {
  return jest.fn().mockImplementation(() => ({}));
});
jest.mock('../../src/infrastructure/TypeORMTagRepository', () => {
  return jest.fn().mockImplementation(() => ({}));
});

describe('GET /api/export (authenticated)', () => {
  let app;
  beforeAll(() => {
    // require app after mocks
    app = require('../../src/index');
  });

  it('returns JSON export with user metadata and todos', async () => {
    const res = await request(app).get('/api/export').expect(200).expect('Content-Type', /application\/json/);
    expect(res.headers['content-disposition']).toMatch(/todos_export.json/);
    const body = res.body;
    expect(body).toHaveProperty('user');
    expect(body.user.id).toBe('user-123');
    expect(Array.isArray(body.todos)).toBe(true);
    expect(body.todos[0].id).toBe('t1');
    expect(Array.isArray(body.tags)).toBe(true);
    expect(body.tags[0].id).toBe('g1');
  });

  it('returns CSV when format=csv', async () => {
    const res = await request(app).get('/api/export?format=csv').expect(200).expect('Content-Type', /text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/todos_export.csv/);
    // CSV should contain header and our todo title
    expect(res.text).toMatch(/title,description,dueDate/);
    expect(res.text).toMatch(/First Todo/);
  });
});
