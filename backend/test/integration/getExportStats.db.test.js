const { DataSource, EntitySchema } = require('typeorm');
const path = require('path');

describe('TypeORMTodoRepository.getExportStatsForUser (DB-backed)', () => {
  let testDs;
  let TypeORMTodoRepository;

  beforeAll(async () => {
    // Use minimal EntitySchema definitions compatible with SQLite to avoid MSSQL-specific types
    const TagEntity = new EntitySchema({
      name: 'Tag',
      tableName: 'tags',
      columns: {
        id: { type: 'varchar', primary: true },
        name: { type: 'varchar' },
        color: { type: 'varchar', nullable: true }
      }
    });

    const TodoEntity = new EntitySchema({
      name: 'Todo',
      tableName: 'todos',
      columns: {
        id: { type: 'varchar', primary: true },
        title: { type: 'varchar' },
        is_completed: { type: 'integer', default: 0 },
        user_id: { type: 'varchar' },
        duration: { type: 'integer', default: 0 },
        due_date: { type: 'datetime', nullable: true },
        archived: { type: 'integer', default: 0 }
      }
    });

    const TodoTagEntity = new EntitySchema({
      name: 'TodoTag',
      tableName: 'todo_tags',
      columns: {
        id: { type: 'integer', primary: true, generated: true }
      },
      relations: {
        todo: { type: 'many-to-one', target: 'Todo', joinColumn: { name: 'todo_id' } },
        tag: { type: 'many-to-one', target: 'Tag', joinColumn: { name: 'tag_id' } }
      }
    });

    testDs = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      entities: [TagEntity, TodoEntity, TodoTagEntity],
      synchronize: true,
      logging: false
    });

    await testDs.initialize();

    // Replace the exported AppDataSource so modules requiring it pick up this test DS
    const dsModulePath = path.resolve(__dirname, '../../src/infra/db/data-source.js');
    const dsModule = require(dsModulePath);
    dsModule.AppDataSource = testDs;

    // Require the repository AFTER overriding AppDataSource
    TypeORMTodoRepository = require('../../src/infrastructure/TypeORMTodoRepository');
  });

  afterAll(async () => {
    if (testDs && testDs.isInitialized) await testDs.destroy();
  });

  it('computes stats from seeded todos and tags', async () => {
    const userId = 'u-db-test';

    // Seed tags
    const tagRepo = testDs.getRepository('Tag');
    const tag1 = tagRepo.create({ id: 't1', name: 'Work', color: '#f00' });
    const tag2 = tagRepo.create({ id: 't2', name: 'Home', color: '#0f0' });
    await tagRepo.save([tag1, tag2]);

    // Seed todos (some completed, with durations and due dates)
    const todoRepo = testDs.getRepository('Todo');
    const today = new Date();
    const yesterday = new Date(today.getTime() - (24*60*60*1000));

    const todos = [
      todoRepo.create({ id: 'a', title: 'A', is_completed: 1, user_id: userId, duration: 30, due_date: today.toISOString() }),
      todoRepo.create({ id: 'b', title: 'B', is_completed: 0, user_id: userId, duration: 60, due_date: yesterday.toISOString() }),
      todoRepo.create({ id: 'c', title: 'C', is_completed: 0, user_id: userId, duration: 0, due_date: null })
    ];
    await todoRepo.save(todos);

    // Seed todo_tags using manager insert (sqlite uses ? placeholders)
    await testDs.manager.query('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', ['a', 't1']);
    await testDs.manager.query('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', ['b', 't1']);
    await testDs.manager.query('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)', ['b', 't2']);

    const repo = new TypeORMTodoRepository();
    const stats = await repo.getExportStatsForUser(userId);

    expect(stats).toBeDefined();
    expect(stats.totalTodos).toBe(3);
    expect(stats.completedCount).toBe(1);
    expect(stats.avgDuration).toBeGreaterThan(0);
    expect(Array.isArray(stats.topTags)).toBe(true);
    expect(Array.isArray(stats.tasksPerDay)).toBe(true);
    expect(stats.tasksPerDay.length).toBe(30);
  });
});
