const { FindSimilarTasks } = require('../../src/application/FindSimilarTasks');

describe('FindSimilarTasks', () => {
  it('requires todoRepository', () => {
    expect(() => new FindSimilarTasks()).toThrow('todoRepository is required');
  });

  it('validates that title is required', async () => {
    const repo = { findSimilarByTitle: jest.fn() };
    const useCase = new FindSimilarTasks(repo);

    await expect(useCase.execute('user-1', { title: '' })).rejects.toMatchObject({ message: /title is required/ });
    await expect(useCase.execute('user-1', { title: null })).rejects.toMatchObject({ message: /title is required/ });
    await expect(useCase.execute('user-1', {})).rejects.toMatchObject({ message: /title is required/ });
  });

  it('validates limit bounds', async () => {
    const repo = { findSimilarByTitle: jest.fn() };
    const useCase = new FindSimilarTasks(repo);

    await expect(useCase.execute('user-1', { title: 'test', limit: 0 })).rejects.toMatchObject({ message: /limit/ });
    await expect(useCase.execute('user-1', { title: 'test', limit: 21 })).rejects.toMatchObject({ message: /limit/ });
  });

  it('validates threshold bounds', async () => {
    const repo = { findSimilarByTitle: jest.fn() };
    const useCase = new FindSimilarTasks(repo);

    await expect(useCase.execute('user-1', { title: 'test', threshold: 0.05 })).rejects.toMatchObject({ message: /threshold/ });
    await expect(useCase.execute('user-1', { title: 'test', threshold: 1.5 })).rejects.toMatchObject({ message: /threshold/ });
  });

  it('delegates to repository with trimmed title and defaults', async () => {
    const mockResult = { tasks: [{ title: 'Buy milk' }], count: 1 };
    const repo = { findSimilarByTitle: jest.fn().mockResolvedValue(mockResult) };
    const useCase = new FindSimilarTasks(repo);

    const result = await useCase.execute('user-1', { title: '  Buy milk  ' });
    expect(repo.findSimilarByTitle).toHaveBeenCalledWith('user-1', 'Buy milk', { limit: 5, threshold: 0.3 });
    expect(result).toBe(mockResult);
  });

  it('passes custom limit and threshold', async () => {
    const repo = { findSimilarByTitle: jest.fn().mockResolvedValue({ tasks: [], count: 0 }) };
    const useCase = new FindSimilarTasks(repo);

    await useCase.execute('user-1', { title: 'test', limit: 10, threshold: 0.5 });
    expect(repo.findSimilarByTitle).toHaveBeenCalledWith('user-1', 'test', { limit: 10, threshold: 0.5 });
  });
});
