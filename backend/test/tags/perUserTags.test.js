const { AppDataSource } = require('../../src/infra/db/data-source');
const TypeORMTagRepository = require('../../src/infrastructure/TypeORMTagRepository');
const { CreateTag } = require('../../src/application/TagUseCases');
const { v4: uuidv4 } = require('uuid');

const RUN_DB = !!process.env.MSSQL_USER;
beforeAll(async () => {
  if (!RUN_DB) return;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  await AppDataSource.runMigrations();
});

afterAll(async () => {
  if (!RUN_DB) return;
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

const maybeDescribe = RUN_DB ? describe : describe.skip;
maybeDescribe('Per-User Custom Tag Limits', () => {
  test('free tier limited to 50 custom tags', async () => {
    const repo = new TypeORMTagRepository();
    const createTag = new CreateTag(repo);
    const userId = uuidv4();
    for (let i = 0; i < 50; i++) {
      await createTag.execute(userId, `Tag${i}`, '#123456', { maxTags: 50 });
    }
    await expect(createTag.execute(userId, 'Overflow', '#654321', { maxTags: 50 }))
      .rejects.toThrow(/Tag limit reached/);
  });

  test('paid/admin unlimited (no limits object passed)', async () => {
    const repo = new TypeORMTagRepository();
    const createTag = new CreateTag(repo);
    const userId = uuidv4();
    for (let i = 0; i < 60; i++) {
      await createTag.execute(userId, `PaidTag${i}`, '#abcdef');
    }
    const count = await repo.countCustomByUser(userId);
    expect(count).toBe(60);
  });
});
