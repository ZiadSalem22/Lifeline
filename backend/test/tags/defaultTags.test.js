const { AppDataSource } = require('../../src/infra/db/data-source');
const TypeORMTagRepository = require('../../src/infrastructure/TypeORMTagRepository');
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
maybeDescribe('Default Global Tags', () => {
  test('are returned along with user custom tags', async () => {
    const repo = new TypeORMTagRepository();
    const userId = uuidv4();
    const tags = await repo.findAllForUser(userId);
    const defaultTags = tags.filter(t => t.isDefault);
    expect(defaultTags.length).toBeGreaterThanOrEqual(10);
  });

  test('cannot be modified', async () => {
    const repo = new TypeORMTagRepository();
    const userId = uuidv4();
    const tags = await repo.findAllForUser(userId);
    const firstDefault = tags.find(t => t.isDefault);
    expect(firstDefault).toBeTruthy();
    // Attempt to save should throw 403
    await expect(repo.save(firstDefault)).rejects.toThrow(/Default tags cannot be modified/);
  });

  test('cannot be deleted', async () => {
    const repo = new TypeORMTagRepository();
    const userId = uuidv4();
    const tags = await repo.findAllForUser(userId);
    const firstDefault = tags.find(t => t.isDefault);
    await expect(repo.delete(firstDefault.id, userId)).rejects.toThrow(/Default tags cannot be deleted/);
  });
});
