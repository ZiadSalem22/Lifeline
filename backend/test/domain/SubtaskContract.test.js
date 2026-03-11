const { normalizeSubtask, normalizeSubtasks, isValidSubtaskId, MAX_SUBTASKS_PER_TASK, MAX_TITLE_LENGTH } = require('../../src/domain/SubtaskContract');

describe('SubtaskContract', () => {
  describe('normalizeSubtask', () => {
    it('assigns a subtaskId when missing', () => {
      const result = normalizeSubtask({ title: 'Buy milk' }, 1);
      expect(result.subtaskId).toBeDefined();
      expect(isValidSubtaskId(result.subtaskId)).toBe(true);
    });

    it('preserves an existing subtaskId', () => {
      const existingId = '550e8400-e29b-41d4-a716-446655440000';
      const result = normalizeSubtask({ title: 'Buy milk', subtaskId: existingId }, 1);
      expect(result.subtaskId).toBe(existingId);
    });

    it('assigns the given position', () => {
      const result = normalizeSubtask({ title: 'Task', subtaskId: '550e8400-e29b-41d4-a716-446655440000' }, 3);
      expect(result.position).toBe(3);
    });

    it('defaults isCompleted to false', () => {
      const result = normalizeSubtask({ title: 'Task' }, 1);
      expect(result.isCompleted).toBe(false);
    });

    it('preserves isCompleted when provided', () => {
      const result = normalizeSubtask({ title: 'Task', isCompleted: true }, 1);
      expect(result.isCompleted).toBe(true);
    });

    it('preserves the legacy id field when present', () => {
      const result = normalizeSubtask({ title: 'Task', id: 42 }, 1);
      expect(result.id).toBe(42);
    });

    it('does not include id key when not present', () => {
      const result = normalizeSubtask({ title: 'Task' }, 1);
      expect(Object.prototype.hasOwnProperty.call(result, 'id')).toBe(false);
    });

    it('trims whitespace from title', () => {
      const result = normalizeSubtask({ title: '  Buy milk  ' }, 1);
      expect(result.title).toBe('Buy milk');
    });

    it('throws when raw is not an object', () => {
      expect(() => normalizeSubtask(null, 1)).toThrow('Each subtask must be an object.');
      expect(() => normalizeSubtask('string', 1)).toThrow('Each subtask must be an object.');
    });

    it('throws when title is empty', () => {
      expect(() => normalizeSubtask({ title: '' }, 1)).toThrow(/Subtask title is required/);
    });

    it('throws when title is only whitespace', () => {
      expect(() => normalizeSubtask({ title: '   ' }, 1)).toThrow(/Subtask title is required/);
    });

    it('throws when title exceeds max length', () => {
      const longTitle = 'a'.repeat(MAX_TITLE_LENGTH + 1);
      expect(() => normalizeSubtask({ title: longTitle }, 1)).toThrow(/Subtask title is required/);
    });

    it('accepts title at exactly max length', () => {
      const maxTitle = 'a'.repeat(MAX_TITLE_LENGTH);
      const result = normalizeSubtask({ title: maxTitle }, 1);
      expect(result.title).toBe(maxTitle);
    });
  });

  describe('normalizeSubtasks', () => {
    it('returns empty array for non-array input', () => {
      expect(normalizeSubtasks(null)).toEqual([]);
      expect(normalizeSubtasks(undefined)).toEqual([]);
      expect(normalizeSubtasks('string')).toEqual([]);
    });

    it('normalizes and re-sequences positions', () => {
      const input = [
        { title: 'First' },
        { title: 'Second' },
        { title: 'Third' },
      ];
      const result = normalizeSubtasks(input);
      expect(result).toHaveLength(3);
      expect(result[0].position).toBe(1);
      expect(result[1].position).toBe(2);
      expect(result[2].position).toBe(3);
    });

    it('assigns unique subtaskIds to each element', () => {
      const input = [{ title: 'A' }, { title: 'B' }];
      const result = normalizeSubtasks(input);
      expect(result[0].subtaskId).not.toBe(result[1].subtaskId);
    });

    it('throws when array exceeds max size', () => {
      const tooMany = Array.from({ length: MAX_SUBTASKS_PER_TASK + 1 }, (_, i) => ({ title: `Task ${i}` }));
      expect(() => normalizeSubtasks(tooMany)).toThrow(/at most/);
    });

    it('accepts array at exactly max size', () => {
      const exact = Array.from({ length: MAX_SUBTASKS_PER_TASK }, (_, i) => ({ title: `Task ${i}` }));
      const result = normalizeSubtasks(exact);
      expect(result).toHaveLength(MAX_SUBTASKS_PER_TASK);
    });
  });

  describe('isValidSubtaskId', () => {
    it('validates correct UUIDs', () => {
      expect(isValidSubtaskId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidSubtaskId('A50E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('rejects invalid values', () => {
      expect(isValidSubtaskId('')).toBe(false);
      expect(isValidSubtaskId('not-a-uuid')).toBe(false);
      expect(isValidSubtaskId(123)).toBe(false);
      expect(isValidSubtaskId(null)).toBe(false);
    });
  });
});
