const TypeORMTodoRepository = require('../../src/infrastructure/TypeORMTodoRepository');

describe('TypeORMTodoRepository.countByUser (mocked)', () => {
  it('excludes archived', async () => {
    const repo = new TypeORMTodoRepository();
    repo.repo = { count: jest.fn(async ({ where }) => (where.archived === 0 && where.user_id === 'u1') ? 5 : 99 ) };
    const count = await repo.countByUser('u1');
    expect(count).toBe(5);
  });
});
