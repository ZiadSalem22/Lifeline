const { AppDataSource } = require('../../src/infra/db/data-source');
const TypeORMTagRepository = require('../../src/infrastructure/TypeORMTagRepository');
const { CreateTag, UpdateTag, DeleteTag } = require('../../src/application/TagUseCases');
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
maybeDescribe('Tag Security', () => {
  test('cannot modify another user\'s custom tag', async () => {
    const repo = new TypeORMTagRepository();
    const createTag = new CreateTag(repo);
    const updateTag = new UpdateTag(repo);
    const userA = uuidv4();
    const userB = uuidv4();
    const tag = await createTag.execute(userA, 'UserATag', '#123123');
    await expect(updateTag.execute(userB, tag.id, 'Hacked', '#fff'))
      .rejects.toThrow(/Forbidden/);
  });

  test('cannot delete another user\'s custom tag', async () => {
    const repo = new TypeORMTagRepository();
    const createTag = new CreateTag(repo);
    const deleteTag = new DeleteTag(repo);
    const userA = uuidv4();
    const userB = uuidv4();
    const tag = await createTag.execute(userA, 'UserATag2', '#456456');
    await expect(deleteTag.execute(userB, tag.id))
      .rejects.toThrow(/Forbidden/);
  });

  test('cannot spoof is_default via payload (repository.save blocks)', async () => {
    const repo = new TypeORMTagRepository();
    const Tag = require('../../src/domain/Tag');
    const userId = uuidv4();
    const spoof = new Tag(uuidv4(), 'ShouldFail', '#000000', userId, true);
    await expect(repo.save(spoof)).rejects.toThrow(/Default tags cannot be modified/);
  });
});
