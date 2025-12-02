const TypeORMTodoRepository = require('../../src/infrastructure/TypeORMTodoRepository');
const { AppDataSource } = require('../../src/infra/db/data-source');

describe('TypeORMTodoRepository.getExportStatsForUser (integration-style with mocked queries)', () => {
  it('returns aggregated stats shaped for export', async () => {
    const repo = new TypeORMTodoRepository();

    // Stub AppDataSource.manager.query to return predictable values based on query content
    AppDataSource.manager = {
      query: jest.fn(async (sql, params) => {
        const s = String(sql).toLowerCase();
        if (s.includes('count(*)') && s.includes('sum(case when is_completed')) {
          return [{ total: 3, completed: 1 }];
        }
        if (s.includes('avg(case when duration')) {
          return [{ avgDur: 42 }];
        }
        if (s.includes('select t.id') && s.includes('join todo_tags')) {
          return [
            { id: 'tag1', name: 'Work', color: '#f00', cnt: 2 },
            { id: 'tag2', name: 'Home', color: '#0f0', cnt: 1 }
          ];
        }
        if (s.includes('convert(varchar(10), due_date')) {
          return [
            { day: new Date().toISOString().slice(0,10), cnt: 2 }
          ];
        }
        return [];
      })
    };

    const stats = await repo.getExportStatsForUser('user-1');

    expect(stats).toBeDefined();
    expect(stats.totalTodos).toBe(3);
    expect(stats.completedCount).toBe(1);
    expect(stats.avgDuration).toBe(42);
    expect(Array.isArray(stats.topTags)).toBe(true);
    expect(Array.isArray(stats.tasksPerDay)).toBe(true);
    expect(stats.tasksPerDay.length).toBe(30);
  });
});
