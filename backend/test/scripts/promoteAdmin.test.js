// Prevent Jest from crashing on unhandled promise rejections in this test file
process.on('unhandledRejection', (err) => {
  // Fail the test if an unhandled rejection occurs
  if (err && err.message) {
    throw err;
  }
});


jest.mock('../../src/infra/db/data-source', () => {
  const userDb = {};
  return {
    AppDataSource: {
      isInitialized: true,
      initialize: jest.fn().mockResolvedValue(true),
      getRepository: jest.fn((entity) => {
        if (entity === 'User') {
          return {
            findOne: jest.fn(async ({ where }) => userDb[where.id] || null),
            save: jest.fn(async (user) => {
              userDb[user.id] = { ...user };
              return userDb[user.id];
            })
          };
        }
        return {};
      })
    },
    __userDb: userDb // for test access
  };
});

const { promoteAdmin } = require('../../src/scripts/promote-admin');

describe('promote-admin script (mocked DB)', () => {
  let userDb;
  beforeEach(() => {
    const infra = require('../../src/infra/db/data-source');
    userDb = infra.__userDb;
    for (const k in userDb) delete userDb[k];
    // Insert a test user
    userDb['test-promote'] = { id: 'test-promote', email: 'promote@example.com', name: 'Promote Me', role: 'free', subscription_status: 'none' };
  });

  it('should promote user to admin', async () => {
    await promoteAdmin('test-promote', { exitOnFinish: false });
    expect(userDb['test-promote'].role).toBe('admin');
  });


  it('should fail for non-existent user', async () => {
    await expect(promoteAdmin('does-not-exist', { exitOnFinish: false })).rejects.toThrow('User not found');
  });
});
