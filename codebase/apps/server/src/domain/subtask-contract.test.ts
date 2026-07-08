import { describe, expect, it } from 'vitest';
import { DomainValidationError, NotFoundError } from './errors.js';
import {
  addSubtask,
  normalizeSubtasks,
  removeSubtask,
  setSubtaskCompletion,
  updateSubtask,
  type SubtaskRecord,
} from './subtask-contract.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function make(overrides: Partial<SubtaskRecord> & { subtaskId: string }): SubtaskRecord {
  return {
    id: overrides.subtaskId,
    title: 'A subtask',
    isCompleted: false,
    position: 1,
    ...overrides,
  };
}

describe('normalizeSubtasks', () => {
  it('returns [] for null/undefined', () => {
    expect(normalizeSubtasks(null)).toEqual([]);
    expect(normalizeSubtasks(undefined)).toEqual([]);
  });

  it('preserves provided subtaskId identity', () => {
    const [subtask] = normalizeSubtasks([{ subtaskId: 'stable-id-1', title: 'Keep me' }]);
    expect(subtask?.subtaskId).toBe('stable-id-1');
  });

  it('mints a UUID when subtaskId is missing or blank', () => {
    const [a, b] = normalizeSubtasks([{ title: 'no id' }, { subtaskId: '   ', title: 'blank id' }]);
    expect(a?.subtaskId).toMatch(UUID_RE);
    expect(b?.subtaskId).toMatch(UUID_RE);
    expect(a?.subtaskId).not.toBe(b?.subtaskId);
  });

  it('keeps raw.id as the legacy alias, defaulting to subtaskId', () => {
    const [withId, withoutId] = normalizeSubtasks([
      { subtaskId: 's1', id: 42, title: 'legacy numeric id' },
      { subtaskId: 's2', title: 'no legacy id' },
    ]);
    expect(withId?.id).toBe(42);
    expect(withoutId?.id).toBe('s2');
  });

  it('re-sequences positions 1..n ignoring client-sent positions', () => {
    const result = normalizeSubtasks([
      { title: 'first', position: 99 },
      { title: 'second', position: 1 },
      { title: 'third', position: 7 },
    ]);
    expect(result.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('trims titles and requires them', () => {
    const [subtask] = normalizeSubtasks([{ title: '  padded  ' }]);
    expect(subtask?.title).toBe('padded');
    expect(() => normalizeSubtasks([{ title: '' }])).toThrow(DomainValidationError);
    expect(() => normalizeSubtasks([{ title: '   ' }])).toThrow(DomainValidationError);
    expect(() => normalizeSubtasks([{ title: 123 }])).toThrow(DomainValidationError);
  });

  it('rejects titles longer than 500 characters', () => {
    expect(() => normalizeSubtasks([{ title: 'x'.repeat(501) }])).toThrow(DomainValidationError);
    expect(normalizeSubtasks([{ title: 'x'.repeat(500) }])).toHaveLength(1);
  });

  it('enforces the 50-subtask cap', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => ({ title: `Subtask ${i}` }));
    expect(normalizeSubtasks(fifty)).toHaveLength(50);
    expect(() => normalizeSubtasks([...fifty, { title: 'one too many' }])).toThrow(
      DomainValidationError,
    );
  });

  it('coerces isCompleted to boolean', () => {
    const result = normalizeSubtasks([
      { title: 'a', isCompleted: true },
      { title: 'b', isCompleted: 'yes' },
      { title: 'c' },
      { title: 'd', isCompleted: 0 },
    ]);
    expect(result.map((s) => s.isCompleted)).toEqual([true, true, false, false]);
  });
});

describe('setSubtaskCompletion', () => {
  it('flips completion immutably by subtaskId', () => {
    const original = [make({ subtaskId: 'a' }), make({ subtaskId: 'b', position: 2 })];
    const next = setSubtaskCompletion(original, 'b', true);
    expect(next.find((s) => s.subtaskId === 'b')?.isCompleted).toBe(true);
    expect(original.find((s) => s.subtaskId === 'b')?.isCompleted).toBe(false);
    expect(next).not.toBe(original);
  });

  it('throws NotFoundError for an unknown subtaskId', () => {
    expect(() => setSubtaskCompletion([make({ subtaskId: 'a' })], 'nope', true)).toThrow(
      NotFoundError,
    );
  });
});

describe('updateSubtask', () => {
  const list = [make({ subtaskId: 'a' }), make({ subtaskId: 'b', position: 2 })];

  it('updates title and/or completion', () => {
    const next = updateSubtask(list, 'a', { title: '  New title  ', isCompleted: true });
    expect(next[0]).toMatchObject({ subtaskId: 'a', title: 'New title', isCompleted: true });
  });

  it('validates the new title', () => {
    expect(() => updateSubtask(list, 'a', { title: '   ' })).toThrow(DomainValidationError);
    expect(() => updateSubtask(list, 'a', { title: 'x'.repeat(501) })).toThrow(
      DomainValidationError,
    );
  });

  it('throws NotFoundError for an unknown subtaskId', () => {
    expect(() => updateSubtask(list, 'zzz', { isCompleted: true })).toThrow(NotFoundError);
  });
});

describe('removeSubtask', () => {
  it('removes by subtaskId and re-sequences the survivors', () => {
    const list = [
      make({ subtaskId: 'a' }),
      make({ subtaskId: 'b', position: 2 }),
      make({ subtaskId: 'c', position: 3 }),
    ];
    const next = removeSubtask(list, 'b');
    expect(next.map((s) => s.subtaskId)).toEqual(['a', 'c']);
    expect(next.map((s) => s.position)).toEqual([1, 2]);
  });

  it('throws NotFoundError for an unknown subtaskId', () => {
    expect(() => removeSubtask([make({ subtaskId: 'a' })], 'b')).toThrow(NotFoundError);
  });
});

describe('addSubtask', () => {
  it('appends with a fresh identity and next position', () => {
    const next = addSubtask([make({ subtaskId: 'a' })], 'Added');
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ title: 'Added', isCompleted: false, position: 2 });
    expect(next[1]?.subtaskId).toMatch(UUID_RE);
  });

  it('enforces the cap on append', () => {
    const fifty = Array.from({ length: 50 }, (_, i) =>
      make({ subtaskId: `s${i}`, position: i + 1 }),
    );
    expect(() => addSubtask(fifty, 'overflow')).toThrow(DomainValidationError);
  });
});
