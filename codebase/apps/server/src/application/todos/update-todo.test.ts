import { describe, expect, it } from 'vitest';
import { ConflictError, DomainValidationError, NotFoundError } from '../../domain/errors.js';
import {
  InMemoryTagRepository,
  InMemoryTodoRepository,
} from '../../../test/helpers/feature-fakes.js';
import { UpdateTodo } from './update-todo.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function build() {
  const tags = new InMemoryTagRepository();
  tags.seedDefaults();
  const todos = new InMemoryTodoRepository(tags);
  return { todos, tags, updateTodo: new UpdateTodo({ todos, tags }) };
}

describe('UpdateTodo — guards', () => {
  it('404 for unknown ids and foreign rows', async () => {
    const { todos, updateTodo } = build();
    const foreign = todos.seed('other-user');
    await expect(updateTodo.execute('u1', 'ghost', { title: 'x' })).rejects.toThrow(NotFoundError);
    await expect(updateTodo.execute('u1', foreign.id, { title: 'x' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('409 when the todo is archived (guard actually fires — old bug #2 fixed)', async () => {
    const { todos, updateTodo } = build();
    const archived = todos.seed('u1', { archived: true });
    await expect(updateTodo.execute('u1', archived.id, { title: 'x' })).rejects.toThrow(
      new ConflictError('Cannot modify an archived task. Restore it first.'),
    );
  });

  it('400 when recurrence is present in the input (immutable after create)', async () => {
    const { todos, updateTodo } = build();
    const todo = todos.seed('u1');
    await expect(
      updateTodo.execute('u1', todo.id, { title: 'x', recurrence: { mode: 'daily' } }),
    ).rejects.toThrow(new DomainValidationError('Recurrence cannot be changed after creation.'));
    // Even recurrence: null counts as an attempted change.
    await expect(
      updateTodo.execute('u1', todo.id, { title: 'x', recurrence: null }),
    ).rejects.toThrow(DomainValidationError);
  });
});

describe('UpdateTodo — partial updates', () => {
  it('only touches sent fields; empty-string dueDate/dueTime clear to null', async () => {
    const { todos, updateTodo } = build();
    const seeded = todos.seed('u1', {
      title: 'Before',
      dueDate: '2026-03-01',
      dueTime: '09:30',
      priority: 'high',
      duration: 45,
    });
    const updated = await updateTodo.execute('u1', seeded.id, { title: 'After' });
    expect(updated).toMatchObject({
      title: 'After',
      dueDate: '2026-03-01',
      dueTime: '09:30',
      priority: 'high',
      duration: 45,
    });
    const cleared = await updateTodo.execute('u1', seeded.id, { dueDate: '', dueTime: '' });
    expect(cleared.dueDate).toBeNull();
    expect(cleared.dueTime).toBeNull();
    expect(cleared.title).toBe('After');
  });

  it('order passes through (frontend owns sibling consistency)', async () => {
    const { todos, updateTodo } = build();
    const seeded = todos.seed('u1');
    const updated = await updateTodo.execute('u1', seeded.id, { order: 7 });
    expect(updated.order).toBe(7);
  });

  it('never flips isCompleted/archived (explicit endpoints own those)', async () => {
    const { todos, updateTodo } = build();
    const seeded = todos.seed('u1', { isCompleted: true });
    const updated = await updateTodo.execute('u1', seeded.id, { title: 'still done' });
    expect(updated.isCompleted).toBe(true);
    expect(updated.archived).toBe(false);
  });
});

describe('UpdateTodo — subtask whole-array replacement', () => {
  it('keeps echoed subtaskIds, mints new ones for additions, re-sequences', async () => {
    const { todos, updateTodo } = build();
    const keep = '5f0f1c9a-3b1f-4c62-9a8e-6a1b2c3d4e5f';
    const seeded = todos.seed('u1', {
      subtasks: [{ subtaskId: keep, title: 'Old', isCompleted: true, position: 1 }],
    });
    const updated = await updateTodo.execute('u1', seeded.id, {
      subtasks: [{ title: 'Brand new' }, { subtaskId: keep, title: 'Renamed', isCompleted: true }],
    });
    expect(updated.subtasks).toHaveLength(2);
    const [first, second] = updated.subtasks;
    expect(first?.subtaskId).toMatch(UUID_RE);
    expect(first?.subtaskId).not.toBe(keep);
    expect(first?.position).toBe(1);
    expect(second?.subtaskId).toBe(keep); // identity preserved across replace
    expect(second?.title).toBe('Renamed');
    expect(second?.isCompleted).toBe(true);
    expect(second?.position).toBe(2);
  });

  it('an omitted subtask is dropped (whole-array contract)', async () => {
    const { todos, updateTodo } = build();
    const seeded = todos.seed('u1', {
      subtasks: [
        { subtaskId: 'a-1', title: 'A', isCompleted: false, position: 1 },
        { subtaskId: 'b-2', title: 'B', isCompleted: false, position: 2 },
      ],
    });
    const updated = await updateTodo.execute('u1', seeded.id, {
      subtasks: [{ subtaskId: 'b-2', title: 'B' }],
    });
    expect(updated.subtasks).toHaveLength(1);
    expect(updated.subtasks[0]).toMatchObject({ subtaskId: 'b-2', position: 1 });
  });
});

describe('UpdateTodo — tag relinking', () => {
  it('replaces links only when tags is present; unknown ids are dropped', async () => {
    const { todos, tags, updateTodo } = build();
    const custom = tags.seedCustom('u1', { name: 'Mine' });
    const seeded = todos.seed('u1', {
      tags: [{ id: 'default-work', name: 'Work', color: '#3B82F6', userId: null, isDefault: true }],
    });

    const untouched = await updateTodo.execute('u1', seeded.id, { title: 'no tag change' });
    expect(untouched.tags.map((tag) => tag.id)).toEqual(['default-work']);

    const relinked = await updateTodo.execute('u1', seeded.id, {
      tags: [custom.id, 'ghost', { name: 'health' }],
    });
    expect(relinked.tags.map((tag) => tag.id).sort()).toEqual([custom.id, 'default-health'].sort());
  });
});
