import { beforeEach, describe, expect, it } from 'vitest';
import { makeTodo, seedGuestTags, seedGuestTodos } from '../../test/test-utils';
import { buildGuestExport, importGuestData, wipeGuestData } from './export-import-lib';

beforeEach(() => {
  window.localStorage.clear();
});

describe('buildGuestExport', () => {
  it('bundles the local workspace as a v1-shaped payload', () => {
    seedGuestTodos([makeTodo({ title: 'Exported' })]);
    const payload = buildGuestExport();
    expect(payload.user.id).toBe('guest');
    expect(payload.todos).toHaveLength(1);
    expect(typeof payload.exportedAt).toBe('string');
  });
});

describe('importGuestData', () => {
  it('merge appends and re-numbers past the existing max task number', () => {
    seedGuestTodos([makeTodo({ taskNumber: 5, title: 'Existing' })]);
    const count = importGuestData(
      JSON.stringify({
        todos: [
          { title: 'Imported camel', dueDate: '2026-07-01', isCompleted: true },
          { title: 'Imported snake', due_date: '2026-07-02T10:00:00Z', is_flagged: true },
        ],
        tags: [{ name: 'Imported Tag', color: '#123456' }],
      }),
      'merge',
    );
    expect(count).toBe(2);
    const stored = JSON.parse(window.localStorage.getItem('guest_todos') ?? '[]') as {
      title: string;
      taskNumber: number;
      dueDate: string | null;
      isCompleted: boolean;
      isFlagged: boolean;
    }[];
    expect(stored).toHaveLength(3);
    expect(stored[1]).toMatchObject({
      title: 'Imported camel',
      taskNumber: 6,
      dueDate: '2026-07-01',
      isCompleted: true,
    });
    expect(stored[2]).toMatchObject({
      title: 'Imported snake',
      taskNumber: 7,
      dueDate: '2026-07-02', // normalized from the ISO datetime
      isFlagged: true,
    });
    const tags = JSON.parse(window.localStorage.getItem('guest_tags') ?? '[]') as {
      name: string;
    }[];
    expect(tags.some((tag) => tag.name === 'Imported Tag')).toBe(true);
  });

  it('replace swaps the whole todo list', () => {
    seedGuestTodos([makeTodo({ title: 'Old' }), makeTodo({ title: 'Older' })]);
    const count = importGuestData(JSON.stringify({ todos: [{ title: 'Fresh' }] }), 'replace');
    expect(count).toBe(1);
    const stored = JSON.parse(window.localStorage.getItem('guest_todos') ?? '[]') as {
      title: string;
    }[];
    expect(stored.map((todo) => todo.title)).toEqual(['Fresh']);
  });

  it('rejects invalid JSON', () => {
    expect(() => importGuestData('not json', 'merge')).toThrow('Invalid JSON file.');
  });
});

describe('wipeGuestData', () => {
  it('removes both guest keys', () => {
    seedGuestTodos([makeTodo()]);
    seedGuestTags([]);
    wipeGuestData();
    expect(window.localStorage.getItem('guest_todos')).toBeNull();
    expect(window.localStorage.getItem('guest_tags')).toBeNull();
  });
});
