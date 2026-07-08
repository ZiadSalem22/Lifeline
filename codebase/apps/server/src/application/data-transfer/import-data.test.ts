import { describe, expect, it } from 'vitest';
import { LIMITS } from '@lifeline/shared';
import { DomainValidationError } from '../../domain/errors.js';
import {
  InMemoryTagRepository,
  InMemoryTodoRepository,
} from '../../../test/helpers/feature-fakes.js';
import { ImportData } from './import-data.js';

function build(generateId?: () => string) {
  const tags = new InMemoryTagRepository();
  tags.seedDefaults();
  const todos = new InMemoryTodoRepository(tags);
  const importData = new ImportData({ todos }, generateId !== undefined ? { generateId } : {});
  return { todos, tags, importData };
}

describe('ImportData — payload validation', () => {
  it("bad JSON string → 400 'Invalid JSON format'", async () => {
    const { importData } = build();
    await expect(importData.execute('u1', { data: '{oops', mode: 'merge' })).rejects.toThrow(
      new DomainValidationError('Invalid JSON format'),
    );
  });

  it("missing todos array → 400 'Invalid import format: missing todos array'", async () => {
    const { importData } = build();
    const expected = new DomainValidationError('Invalid import format: missing todos array');
    await expect(importData.execute('u1', { data: {}, mode: 'merge' })).rejects.toThrow(expected);
    await expect(
      importData.execute('u1', { data: { todos: 'nope' }, mode: 'merge' }),
    ).rejects.toThrow(expected);
    // A JSON string that parses to a non-object is the same problem.
    await expect(importData.execute('u1', { data: '[1,2]', mode: 'merge' })).rejects.toThrow(
      expected,
    );
  });

  it('accepts the payload as a JSON string (old export files)', async () => {
    const { todos, importData } = build();
    const result = await importData.execute('u1', {
      data: JSON.stringify({ todos: [{ title: 'From string' }] }),
      mode: 'merge',
    });
    expect(result).toEqual({ importedCount: 1 });
    expect(todos.rowsFor('u1')[0]?.title).toBe('From string');
  });

  it('a todo without a title rejects BEFORE any write', async () => {
    const { todos, importData } = build();
    await expect(
      importData.execute('u1', {
        data: { todos: [{ title: 'ok' }, { description: 'no title' }] },
        mode: 'merge',
      }),
    ).rejects.toThrow(/todos\[1\] is missing a title/);
    expect(todos.rowsFor('u1')).toHaveLength(0);
  });
});

describe('ImportData — tag remapping by lower(name)', () => {
  it('isDefault entries map to the existing default; unknown defaults are dropped', async () => {
    const { todos, importData } = build();
    await importData.execute('u1', {
      data: {
        tags: [
          { id: 'old-work', name: 'work', isDefault: true }, // → default-work
          { id: 'old-ghost', name: 'NoSuchDefault', isDefault: true }, // dropped
        ],
        todos: [{ title: 'Tagged', tags: ['old-work', 'old-ghost'] }],
      },
      mode: 'merge',
    });
    expect(todos.rowsFor('u1')[0]?.tags.map((tag) => tag.id)).toEqual(['default-work']);
  });

  it('custom tags match the user’s existing custom by name, else are created', async () => {
    const { todos, tags, importData } = build();
    const existing = tags.seedCustom('u1', { name: 'Garden', color: '#00FF00' });
    await importData.execute('u1', {
      data: {
        tags: [
          { id: 'old-1', name: 'GARDEN', color: '#FFFFFF' }, // matches by lower(name)
          { id: 'old-2', name: 'BrandNew', color: '#ABCDEF' }, // created
        ],
        todos: [{ title: 'Tagged', tags: [{ id: 'old-1' }, 'old-2'] }],
      },
      mode: 'merge',
    });
    const imported = todos.rowsFor('u1')[0];
    const names = imported?.tags.map((tag) => tag.name).sort();
    expect(names).toEqual(['BrandNew', 'Garden']);
    const garden = imported?.tags.find((tag) => tag.name === 'Garden');
    expect(garden?.id).toBe(existing.id); // remapped, NOT duplicated
    expect(await tags.countCustomByUser('u1')).toBe(2);
  });

  it('tag-creation failure drops the tag silently (old parity)', async () => {
    const { todos, tags, importData } = build();
    tags.failCreate = true;
    const result = await importData.execute('u1', {
      data: {
        tags: [{ id: 'old-1', name: 'WontExist', color: '#000000' }],
        todos: [{ title: 'Tagged', tags: ['old-1'] }],
      },
      mode: 'merge',
    });
    expect(result.importedCount).toBe(1);
    expect(todos.rowsFor('u1')[0]?.tags).toEqual([]);
  });

  it('unmapped tag refs on todos are dropped', async () => {
    const { todos, importData } = build();
    await importData.execute('u1', {
      data: { todos: [{ title: 'Tagged', tags: ['never-mapped', { id: 'also-not' }] }] },
      mode: 'merge',
    });
    expect(todos.rowsFor('u1')[0]?.tags).toEqual([]);
  });
});

describe('ImportData — merge/replace semantics', () => {
  it('replace purges the user’s todos and custom tags BEFORE importing', async () => {
    const { todos, tags, importData } = build();
    todos.seed('u1', { title: 'Pre-existing' });
    tags.seedCustom('u1', { name: 'OldCustom' });
    const result = await importData.execute('u1', {
      data: { todos: [{ title: 'Fresh' }] },
      mode: 'replace',
    });
    expect(result.importedCount).toBe(1);
    expect(todos.calls).toContain('deleteAllByUser');
    expect(tags.calls).toContain('deleteCustomByUser');
    expect(todos.rowsFor('u1').map((todo) => todo.title)).toEqual(['Fresh']);
    expect(await tags.countCustomByUser('u1')).toBe(0);
    // Defaults untouched.
    expect(tags.rows.get('default-work')).toBeDefined();
  });

  it('merge keeps existing rows; incoming id collision overwrites (upsert)', async () => {
    const { todos, importData } = build();
    const keep = todos.seed('u1', { title: 'Keep me' });
    const overwrite = todos.seed('u1', { title: 'Old title' });
    await importData.execute('u1', {
      data: { todos: [{ id: overwrite.id, title: 'New title' }] },
      mode: 'merge',
    });
    const rows = todos.rowsFor('u1');
    expect(rows).toHaveLength(2);
    expect(rows.find((todo) => todo.id === keep.id)?.title).toBe('Keep me');
    expect(rows.find((todo) => todo.id === overwrite.id)?.title).toBe('New title');
  });
});

describe('ImportData — todo normalization', () => {
  it('keeps incoming ids, generates uuids for missing ones, forces order 0', async () => {
    let counter = 0;
    const { todos, importData } = build(() => `gen-${(counter += 1)}`);
    await importData.execute('u1', {
      data: {
        todos: [{ id: 'keep-this-id', title: 'Has id', order: 99 }, { title: 'No id' }],
      },
      mode: 'merge',
    });
    const rows = todos.rowsFor('u1');
    expect(rows.map((todo) => todo.id).sort()).toEqual(['gen-1', 'keep-this-id']);
    expect(rows.every((todo) => todo.order === 0)).toBe(true);
  });

  it('normalizes snake_case fields, ISO datetimes, priorities, and subtasks', async () => {
    const { todos, importData } = build();
    await importData.execute('u1', {
      data: {
        todos: [
          {
            title: '  Padded  ',
            due_date: '2026-03-01T15:30:00Z',
            due_time: '08:15',
            is_completed: true,
            is_flagged: 1,
            priority: 'URGENT', // unknown → medium
            duration: '45.9',
            subtasks: [{ title: 'Sub' }, { notATitle: true }],
          },
        ],
      },
      mode: 'merge',
    });
    const row = todos.rowsFor('u1')[0];
    expect(row).toMatchObject({
      title: 'Padded',
      dueDate: '2026-03-01',
      dueTime: '08:15',
      isCompleted: true,
      isFlagged: true,
      priority: 'medium',
      duration: 45,
      order: 0,
    });
    expect(row?.subtasks).toHaveLength(1); // non-subtask entries dropped
    expect(row?.subtasks[0]).toMatchObject({ title: 'Sub', position: 1 });
  });

  it('returns the imported count', async () => {
    const { importData } = build();
    const result = await importData.execute('u1', {
      data: { todos: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] },
      mode: 'merge',
    });
    expect(result).toEqual({ importedCount: 3 });
  });

  // Regression (round2 finding #1): duration must be clamped to the product
  // limit during mapping — an int4-overflowing value used to blow up the
  // INSERT mid-import (22003) and, in replace mode, destroy the user's data.
  it('clamps an out-of-range duration to durationMaxMinutes', async () => {
    const { todos, importData } = build();
    await importData.execute('u1', {
      data: { todos: [{ title: 'Overflow', duration: 99_999_999_999 }] },
      mode: 'merge',
    });
    expect(todos.rowsFor('u1')[0]?.duration).toBe(1440); // LIMITS.durationMaxMinutes
  });

  it('NaN / negative durations normalize to 0', async () => {
    const { todos, importData } = build();
    await importData.execute('u1', {
      data: {
        todos: [
          { title: 'neg', duration: -50 },
          { title: 'nan', duration: 'abc' },
        ],
      },
      mode: 'merge',
    });
    expect(
      todos
        .rowsFor('u1')
        .map((todo) => todo.duration)
        .sort(),
    ).toEqual([0, 0]);
  });
});

/**
 * Transactional import (decisions #10, api-contract 'transactional'). The
 * use-case fully maps + validates EVERY row before any write, and the repo
 * runs purge + writes atomically. A bad user payload must never leave a side
 * effect (round1 #1: a partial replace = permanent data loss).
 */
describe('ImportData — validate-before-write (zero side effects on bad payload)', () => {
  const longTitle = 'x'.repeat(LIMITS.subtaskTitleMax + 1); // 501 chars

  it('a 501-char subtask title on a MID-LIST row → 400 with ZERO purge/write calls (replace)', async () => {
    const { todos, tags, importData } = build();
    // Seed pre-existing data that replace mode would purge if it ran.
    todos.seed('u1', { title: 'Original 1' });
    todos.seed('u1', { title: 'Original 2' });
    tags.seedCustom('u1', { name: 'KeepMe' });

    const payload = {
      todos: [
        { title: 'row 0' },
        { title: 'row 1' },
        { title: 'row 2' },
        { title: 'row 3' },
        { title: 'row 4' },
        { title: 'row 5', subtasks: [{ title: longTitle }] }, // invalid, mid-list
        { title: 'row 6' },
      ],
    };

    await expect(importData.execute('u1', { data: payload, mode: 'replace' })).rejects.toThrow(
      DomainValidationError,
    );

    // NOTHING was purged and NOTHING was written — pre-validation ran first.
    expect(todos.calls).not.toContain('importAll');
    expect(todos.calls).not.toContain('deleteAllByUser');
    expect(todos.calls).not.toContain('upsertImported');
    expect(tags.calls).not.toContain('deleteCustomByUser');
    // Originals still fully present.
    expect(
      todos
        .rowsFor('u1')
        .map((todo) => todo.title)
        .sort(),
    ).toEqual(['Original 1', 'Original 2']);
    expect(await tags.countCustomByUser('u1')).toBe(1);
  });

  it('the error message identifies the offending subtask length', async () => {
    const { importData } = build();
    await expect(
      importData.execute('u1', {
        data: { todos: [{ title: 'ok', subtasks: [{ title: longTitle }] }] },
        mode: 'merge',
      }),
    ).rejects.toThrow(/at most 500 characters/);
  });

  it('an oversized subtask array is truncated to the cap (old parity, no throw)', async () => {
    // Import intentionally slices to 50 BEFORE normalizing (old-app parity),
    // so an over-cap array truncates rather than 400s — but each surviving
    // title is still contract-validated (the 501-char case above).
    const { todos, importData } = build();
    const subtasks = Array.from({ length: LIMITS.subtasksPerTodoMax + 5 }, (_, i) => ({
      title: `s${i}`,
    }));
    const result = await importData.execute('u1', {
      data: { todos: [{ title: 'many', subtasks }] },
      mode: 'merge',
    });
    expect(result.importedCount).toBe(1);
    expect(todos.rowsFor('u1')[0]?.subtasks).toHaveLength(LIMITS.subtasksPerTodoMax);
  });

  it('a valid replace import runs atomically through importAll', async () => {
    const { todos, importData } = build();
    todos.seed('u1', { title: 'Old' });
    const result = await importData.execute('u1', {
      data: { todos: [{ title: 'New 1' }, { title: 'New 2' }] },
      mode: 'replace',
    });
    expect(result).toEqual({ importedCount: 2 });
    expect(todos.calls).toContain('importAll');
    expect(
      todos
        .rowsFor('u1')
        .map((todo) => todo.title)
        .sort(),
    ).toEqual(['New 1', 'New 2']);
  });
});
