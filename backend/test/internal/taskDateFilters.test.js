const { resolveWindowToken, doesTaskOccurInRange } = require('../../src/internal/mcp/taskDateFilters');

describe('resolveWindowToken', () => {
  const now = new Date('2026-03-11T12:00:00Z');

  it('resolves this_week', () => {
    const result = resolveWindowToken('this_week', now, { startDayOfWeek: 0 });
    expect(result.start).toBeDefined();
    expect(result.end).toBeDefined();
    expect(result.start <= '2026-03-11').toBe(true);
    expect(result.end >= '2026-03-11').toBe(true);
  });

  it('resolves next_week', () => {
    const result = resolveWindowToken('next_week', now, { startDayOfWeek: 0 });
    expect(result.start > '2026-03-11').toBe(true);
  });

  it('resolves this_month', () => {
    const result = resolveWindowToken('this_month', now);
    expect(result.start).toBe('2026-03-01');
    expect(result.end).toBe('2026-03-31');
  });

  it('resolves next_month', () => {
    const result = resolveWindowToken('next_month', now);
    expect(result.start).toBe('2026-04-01');
    expect(result.end).toBe('2026-04-30');
  });

  it('resolves overdue', () => {
    const result = resolveWindowToken('overdue', now);
    expect(result.start).toBe('2000-01-01');
    expect(result.end).toBe('2026-03-10');
  });

  it('resolves YYYY-MM format', () => {
    const result = resolveWindowToken('2026-06', now);
    expect(result.start).toBe('2026-06-01');
    expect(result.end).toBe('2026-06-30');
  });

  it('throws for invalid token', () => {
    expect(() => resolveWindowToken('invalid', now)).toThrow(/Invalid window token/);
  });
});

describe('doesTaskOccurInRange', () => {
  it('returns true for task due within range', () => {
    const task = { dueDate: '2026-03-15' };
    expect(doesTaskOccurInRange(task, '2026-03-01', '2026-03-31')).toBe(true);
  });

  it('returns false for task outside range', () => {
    const task = { dueDate: '2026-04-01' };
    expect(doesTaskOccurInRange(task, '2026-03-01', '2026-03-31')).toBe(false);
  });

  it('returns true for dateRange recurrence spanning into range', () => {
    const task = {
      dueDate: '2026-03-01',
      recurrence: { mode: 'dateRange', startDate: '2026-02-25', endDate: '2026-03-05' },
    };
    expect(doesTaskOccurInRange(task, '2026-03-01', '2026-03-31')).toBe(true);
  });

  it('returns false for dateRange recurrence entirely before range', () => {
    const task = {
      dueDate: '2026-02-01',
      recurrence: { mode: 'dateRange', startDate: '2026-02-01', endDate: '2026-02-15' },
    };
    expect(doesTaskOccurInRange(task, '2026-03-01', '2026-03-31')).toBe(false);
  });

  it('returns false for null due date with no recurrence', () => {
    const task = { dueDate: null };
    expect(doesTaskOccurInRange(task, '2026-03-01', '2026-03-31')).toBe(false);
  });

  it('returns true for task due on range boundary', () => {
    const task = { dueDate: '2026-03-31' };
    expect(doesTaskOccurInRange(task, '2026-03-01', '2026-03-31')).toBe(true);
  });
});
