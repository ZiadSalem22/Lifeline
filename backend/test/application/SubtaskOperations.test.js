const { SubtaskOperations } = require('../../src/application/SubtaskOperations');

function createMockTask(overrides = {}) {
  return {
    id: 'task-1',
    userId: 'user-1',
    title: 'Test Task',
    archived: false,
    subtasks: [
      { subtaskId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', title: 'Step 1', isCompleted: false, position: 1 },
      { subtaskId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002', title: 'Step 2', isCompleted: false, position: 2 },
    ],
    ...overrides,
  };
}

function createMockRepo(task = null) {
  const saved = [];
  return {
    findById: jest.fn().mockResolvedValue(task),
    save: jest.fn().mockImplementation((t) => { saved.push(t); return Promise.resolve(t); }),
    _saved: saved,
  };
}

describe('SubtaskOperations', () => {
  it('requires todoRepository', () => {
    expect(() => new SubtaskOperations()).toThrow('todoRepository is required');
  });

  describe('addSubtask', () => {
    it('adds a subtask and normalizes', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      const result = await ops.addSubtask('user-1', 'task-1', { title: 'Step 3' });
      expect(result.subtasks).toHaveLength(3);
      expect(result.subtasks[2].title).toBe('Step 3');
      expect(result.subtasks[2].position).toBe(3);
      expect(repo.save).toHaveBeenCalledWith(task);
    });

    it('rejects if task is archived', async () => {
      const task = createMockTask({ archived: true });
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      await expect(ops.addSubtask('user-1', 'task-1', { title: 'Nope' }))
        .rejects.toMatchObject({ message: expect.stringMatching(/archived/) });
    });

    it('rejects if task not found', async () => {
      const repo = createMockRepo(null);
      const ops = new SubtaskOperations(repo);

      await expect(ops.addSubtask('user-1', 'task-1', { title: 'Nope' }))
        .rejects.toThrow(/Task not found/);
    });
  });

  describe('completeSubtask', () => {
    it('marks a subtask completed', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      const result = await ops.completeSubtask('user-1', 'task-1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001');
      const completed = result.subtasks.find(s => s.subtaskId === 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001');
      expect(completed.isCompleted).toBe(true);
    });

    it('rejects for invalid subtaskId', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      await expect(ops.completeSubtask('user-1', 'task-1', 'invalid'))
        .rejects.toMatchObject({ message: 'Invalid subtaskId.' });
    });

    it('rejects when subtask not found', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      await expect(ops.completeSubtask('user-1', 'task-1', '00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow(/Subtask not found/);
    });
  });

  describe('uncompleteSubtask', () => {
    it('marks a subtask not completed', async () => {
      const task = createMockTask({
        subtasks: [{ subtaskId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', title: 'Done', isCompleted: true, position: 1 }],
      });
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      const result = await ops.uncompleteSubtask('user-1', 'task-1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001');
      expect(result.subtasks[0].isCompleted).toBe(false);
    });
  });

  describe('updateSubtask', () => {
    it('renames a subtask', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      const result = await ops.updateSubtask('user-1', 'task-1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', { title: 'Renamed' });
      expect(result.subtasks[0].title).toBe('Renamed');
    });

    it('updates completion state', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      const result = await ops.updateSubtask('user-1', 'task-1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', { isCompleted: true });
      expect(result.subtasks[0].isCompleted).toBe(true);
    });

    it('rejects empty title', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      await expect(ops.updateSubtask('user-1', 'task-1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001', { title: '' }))
        .rejects.toThrow(/Subtask title cannot be empty/);
    });
  });

  describe('removeSubtask', () => {
    it('removes a subtask and re-sequences positions', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      const result = await ops.removeSubtask('user-1', 'task-1', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001');
      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0].title).toBe('Step 2');
      expect(result.subtasks[0].position).toBe(1);
    });

    it('rejects for non-existent subtask', async () => {
      const task = createMockTask();
      const repo = createMockRepo(task);
      const ops = new SubtaskOperations(repo);

      await expect(ops.removeSubtask('user-1', 'task-1', '00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow(/Subtask not found/);
    });
  });
});
