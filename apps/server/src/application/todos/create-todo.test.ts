import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../domain/errors.js';
import type { SubtaskRecord } from '../../domain/subtask-contract.js';
import {
  InMemoryTagRepository,
  InMemoryTodoRepository,
} from '../../../test/helpers/feature-fakes.js';
import { CreateTodo } from './create-todo.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function build() {
  const tags = new InMemoryTagRepository();
  tags.seedDefaults();
  const todos = new InMemoryTodoRepository(tags);
  return { todos, tags, createTodo: new CreateTodo({ todos, tags }) };
}

describe('CreateTodo — recurrence pre-expansion (audit-domain-logic §2)', () => {
  it('daily: one row per day in [startDate..endDate] inclusive', async () => {
    const { todos, createTodo } = build();
    const { todo, createdCount } = await createTodo.execute('u1', 'free', {
      title: 'Water plants',
      dueDate: '2026-03-01',
      recurrence: { mode: 'daily', startDate: '2026-03-01', endDate: '2026-03-05' },
    });
    expect(createdCount).toBe(5);
    const rows = todos.rowsFor('u1');
    expect(rows.map((row) => row.dueDate).sort()).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
    ]);
    // Returned todo = first occurrence; recurrence object copied to EVERY row.
    expect(todo.dueDate).toBe('2026-03-01');
    for (const row of rows) {
      expect(row.recurrence).toEqual({
        mode: 'daily',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
      });
    }
    // Distinct sequential task numbers per row.
    expect(new Set(rows.map((row) => row.taskNumber)).size).toBe(5);
  });

  it('specificDays: only matching UTC weekdays within the range', async () => {
    const { todos, createTodo } = build();
    // 2026-03-02 is a Monday; range Mon..Sun.
    const { createdCount } = await createTodo.execute('u1', 'free', {
      title: 'Gym',
      dueDate: '2026-03-02',
      recurrence: {
        mode: 'specificDays',
        startDate: '2026-03-02',
        endDate: '2026-03-08',
        selectedDays: ['Monday', 'Wednesday'],
      },
    });
    expect(createdCount).toBe(2);
    expect(
      todos
        .rowsFor('u1')
        .map((row) => row.dueDate)
        .sort(),
    ).toEqual(['2026-03-02', '2026-03-04']);
  });

  it('dateRange: exactly one logical todo with dueDate = startDate', async () => {
    const { todos, createTodo } = build();
    const { todo, createdCount } = await createTodo.execute('u1', 'free', {
      title: 'Conference',
      dueDate: '2026-04-10',
      recurrence: { mode: 'dateRange', startDate: '2026-04-01', endDate: '2026-04-07' },
    });
    expect(createdCount).toBe(1);
    expect(todo.dueDate).toBe('2026-04-01');
    expect(todos.rowsFor('u1')).toHaveLength(1);
  });

  it('legacy weekly: steps 7*interval days from dueDate through endDate', async () => {
    const { todos, createTodo } = build();
    const { createdCount } = await createTodo.execute('u1', 'free', {
      title: 'Weekly report',
      dueDate: '2026-03-01',
      recurrence: { type: 'weekly', interval: 1, endDate: '2026-03-29' },
    });
    expect(createdCount).toBe(5);
    expect(
      todos
        .rowsFor('u1')
        .map((row) => row.dueDate)
        .sort(),
    ).toEqual(['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22', '2026-03-29']);
  });

  it('no recurrence: a single row, normalized date-only dueDate', async () => {
    const { todos, createTodo } = build();
    const { todo, createdCount } = await createTodo.execute('u1', 'free', {
      title: 'One-off',
      dueDate: '2026-05-05T13:45:00Z', // ISO datetime input → date-only
    });
    expect(createdCount).toBe(1);
    expect(todo.dueDate).toBe('2026-05-05');
    expect(todos.calls).toContain('create'); // single-row path, not createMany
  });
});

describe('CreateTodo — free-tier cap (200 active incl. expansion)', () => {
  it('rejects when the expansion would cross the cap', async () => {
    const { todos, createTodo } = build();
    for (let i = 0; i < 199; i += 1) todos.seed('u1');
    await expect(
      createTodo.execute('u1', 'free', {
        title: 'Two days',
        recurrence: { mode: 'daily', startDate: '2026-03-01', endDate: '2026-03-02' },
      }),
    ).rejects.toThrow(new ForbiddenError('Free tier max tasks reached.'));
    expect(todos.rowsFor('u1')).toHaveLength(199); // nothing written
  });

  it('allows exactly reaching the cap', async () => {
    const { todos, createTodo } = build();
    for (let i = 0; i < 198; i += 1) todos.seed('u1');
    const { createdCount } = await createTodo.execute('u1', 'free', {
      title: 'Two days',
      recurrence: { mode: 'daily', startDate: '2026-03-01', endDate: '2026-03-02' },
    });
    expect(createdCount).toBe(2);
    expect(todos.rowsFor('u1')).toHaveLength(200);
  });

  it('archived rows do not count toward the cap', async () => {
    const { todos, createTodo } = build();
    for (let i = 0; i < 200; i += 1) todos.seed('u1', { archived: true });
    await expect(createTodo.execute('u1', 'free', { title: 'ok' })).resolves.toMatchObject({
      createdCount: 1,
    });
  });

  it('paid users bypass the cap', async () => {
    const { todos, createTodo } = build();
    for (let i = 0; i < 250; i += 1) todos.seed('u1');
    await expect(createTodo.execute('u1', 'paid', { title: 'ok' })).resolves.toBeDefined();
  });
});

describe('CreateTodo — subtask normalization (stable identity)', () => {
  it('mints uuid subtaskIds, keeps provided ones, re-sequences positions', async () => {
    const { createTodo } = build();
    const keep = '5f0f1c9a-3b1f-4c62-9a8e-6a1b2c3d4e5f';
    const { todo } = await createTodo.execute('u1', 'free', {
      title: 'With subtasks',
      subtasks: [
        { title: '  First  ', position: 99 },
        { subtaskId: keep, title: 'Second', isCompleted: true },
      ],
    });
    const [first, second] = todo.subtasks as SubtaskRecord[];
    expect(first?.title).toBe('First'); // trimmed
    expect(first?.subtaskId).toMatch(UUID_RE);
    expect(first?.id).toBe(first?.subtaskId); // legacy alias mirrors
    expect(first?.position).toBe(1); // client position ignored
    expect(first?.isCompleted).toBe(false);
    expect(second?.subtaskId).toBe(keep);
    expect(second?.position).toBe(2);
    expect(second?.isCompleted).toBe(true);
  });

  it('the SAME normalized subtask array (same subtaskIds) lands on every expanded row', async () => {
    const { todos, createTodo } = build();
    await createTodo.execute('u1', 'free', {
      title: 'Recurring with subtasks',
      subtasks: [{ title: 'Step' }],
      recurrence: { mode: 'daily', startDate: '2026-03-01', endDate: '2026-03-03' },
    });
    const ids = new Set(todos.rowsFor('u1').map((row) => row.subtasks[0]?.subtaskId));
    expect(ids.size).toBe(1);
  });

  it('resolves tag references and drops unknown ids', async () => {
    const { createTodo } = build();
    const { todo } = await createTodo.execute('u1', 'free', {
      title: 'Tagged',
      tags: ['default-work', { name: 'personal' }, 'ghost-tag'],
    });
    expect(todo.tags.map((tag) => tag.id).sort()).toEqual(['default-personal', 'default-work']);
  });

  it('applies defaults: medium priority, duration 0, order 0, not flagged', async () => {
    const { createTodo } = build();
    const { todo } = await createTodo.execute('u1', 'free', { title: 'Defaults' });
    expect(todo).toMatchObject({
      priority: 'medium',
      duration: 0,
      order: 0,
      isFlagged: false,
      isCompleted: false,
      archived: false,
      dueDate: null,
    });
  });
});
