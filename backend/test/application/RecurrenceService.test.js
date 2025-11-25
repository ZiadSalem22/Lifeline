const RecurrenceService = require('../../src/application/RecurrenceService');

describe('RecurrenceService.calculateNextDueDate - new modes', () => {
  test('daily mode advances by one day', () => {
    const recurrence = { mode: 'daily', startDate: '2025-11-24', endDate: '2025-11-30' };
    const next = RecurrenceService.calculateNextDueDate('2025-11-24', recurrence);
    expect(next).toBe('2025-11-25');
  });

  test('dateRange mode stops after end date', () => {
    const recurrence = { mode: 'dateRange', startDate: '2025-11-01', endDate: '2025-11-03' };
    const mid = RecurrenceService.calculateNextDueDate('2025-11-02', recurrence);
    expect(mid).toBe('2025-11-03');
    const end = RecurrenceService.calculateNextDueDate('2025-11-03', recurrence);
    expect(end).toBeNull();
  });

  test('specificDays mode finds next selected weekday', () => {
    const recurrence = { mode: 'specificDays', selectedDays: ['Monday', 'Wednesday'], startDate: '2025-11-24', endDate: '2025-12-31' };
    // 2025-11-24 is Monday; next should be Wednesday 2025-11-26
    const next = RecurrenceService.calculateNextDueDate('2025-11-24', recurrence);
    expect(next).toBe('2025-11-26');
  });

  test('specificDays mode returns null if no days provided', () => {
    const recurrence = { mode: 'specificDays', selectedDays: [], startDate: '2025-11-24', endDate: '2025-12-31' };
    const next = RecurrenceService.calculateNextDueDate('2025-11-24', recurrence);
    expect(next).toBeNull();
  });
});

describe('RecurrenceService.createNextOccurrence', () => {
  test('creates next occurrence with propagated fields and resets completion', () => {
    const parent = {
      id: 'parent-1',
      title: 'Daily Standup',
      description: 'Team sync',
      dueDate: '2025-11-24',
      dueTime: '09:00',
      tags: [{ id: 't1', name: 'work' }],
      isFlagged: true,
      duration: 30,
      priority: 'high',
      isCompleted: true,
      subtasks: [
        { id: 's1', title: 'Prepare notes', isCompleted: true },
        { id: 's2', title: 'Join call', isCompleted: true }
      ],
      recurrence: { mode: 'daily', startDate: '2025-11-24', endDate: '2025-11-30' }
    };

    const next = RecurrenceService.createNextOccurrence(parent);
    expect(next).toBeDefined();
    expect(next.id).not.toBe(parent.id);
    expect(next.title).toBe(parent.title);
    expect(next.dueDate).toBe('2025-11-25'); // daily advances one day
    expect(next.isCompleted).toBe(false);
    expect(next.originalId).toBe(parent.id);
    // Subtasks reset
    expect(next.subtasks).toHaveLength(2);
    next.subtasks.forEach(st => {
      expect(st.isCompleted).toBe(false);
      expect(st.id).not.toBe('s1');
      expect(st.id).not.toBe('s2');
    });
  });

  test('returns null when recurrence ended (dateRange beyond end)', () => {
    const parent = {
      id: 'parent-2',
      title: 'Limited Task',
      description: '',
      dueDate: '2025-11-03',
      recurrence: { mode: 'dateRange', startDate: '2025-11-01', endDate: '2025-11-03' }
    };
    const next = RecurrenceService.createNextOccurrence(parent);
    expect(next).toBeNull();
  });
});

describe('RecurrenceService.getRecurrenceText', () => {
  test('daily mode text', () => {
    expect(RecurrenceService.getRecurrenceText({ mode: 'daily' })).toMatch(/Every day/);
  });
  test('dateRange mode text includes dates', () => {
    const text = RecurrenceService.getRecurrenceText({ mode: 'dateRange', startDate: '2025-11-01', endDate: '2025-11-03' });
    expect(text).toMatch(/2025/);
  });
  test('specificDays mode lists short days', () => {
    const text = RecurrenceService.getRecurrenceText({ mode: 'specificDays', selectedDays: ['Monday','Wednesday','Friday'] });
    expect(text).toMatch(/Mon/);
    expect(text).toMatch(/Wed/);
    expect(text).toMatch(/Fri/);
  });
});
