import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import { InMemoryTodoRepository } from '../../../test/helpers/feature-fakes.js';
import { SetTodoCompletion } from './set-todo-completion.js';
import { ArchiveTodo } from './archive-todo.js';
import { BatchTodos } from './batch-todos.js';
import { FindSimilarTodos } from './find-similar-todos.js';
import { GetTodo } from './get-todo.js';
import { ListTodos } from './list-todos.js';

function build() {
  const todos = new InMemoryTodoRepository();
  return {
    todos,
    setCompletion: new SetTodoCompletion({ todos }),
    archive: new ArchiveTodo({ todos }),
    batch: new BatchTodos({ todos }),
    similar: new FindSimilarTodos({ todos }),
    getTodo: new GetTodo({ todos }),
    listTodos: new ListTodos({ todos }),
  };
}

describe('SetTodoCompletion', () => {
  it('completes and uncompletes', async () => {
    const { todos, setCompletion } = build();
    const seeded = todos.seed('u1');
    expect((await setCompletion.execute('u1', seeded.id, true)).isCompleted).toBe(true);
    expect((await setCompletion.execute('u1', seeded.id, false)).isCompleted).toBe(false);
  });

  it('404 unknown, 409 archived', async () => {
    const { todos, setCompletion } = build();
    const archived = todos.seed('u1', { archived: true });
    await expect(setCompletion.execute('u1', 'ghost', true)).rejects.toThrow(NotFoundError);
    await expect(setCompletion.execute('u1', archived.id, true)).rejects.toThrow(ConflictError);
  });
});

describe('ArchiveTodo', () => {
  it('archives and is idempotent (no second write)', async () => {
    const { todos, archive } = build();
    const seeded = todos.seed('u1');
    const archived = await archive.archive('u1', seeded.id);
    expect(archived.archived).toBe(true);
    const again = await archive.archive('u1', seeded.id);
    expect(again.archived).toBe(true);
    expect(todos.calls.filter((call) => call.startsWith('setArchived'))).toHaveLength(1);
  });

  it('archive preserves tag links (decisions #4)', async () => {
    const { todos, archive } = build();
    const seeded = todos.seed('u1', {
      tags: [{ id: 'default-work', name: 'Work', color: '#3B82F6', userId: null, isDefault: true }],
    });
    const archived = await archive.archive('u1', seeded.id);
    expect(archived.tags).toHaveLength(1);
  });

  it('restore flips back; restoring an active task is a no-op with a note', async () => {
    const { todos, archive } = build();
    const seeded = todos.seed('u1', { archived: true });
    const restored = await archive.restore('u1', seeded.id);
    expect(restored).toMatchObject({ restored: true });
    expect(restored.todo.archived).toBe(false);
    expect(restored.note).toBeUndefined();

    const again = await archive.restore('u1', seeded.id);
    expect(again).toMatchObject({ restored: true, note: 'Task was already active.' });
    expect(todos.calls.filter((call) => call.endsWith(':false'))).toHaveLength(1);
  });

  it('404 for unknown ids on both directions', async () => {
    const { archive } = build();
    await expect(archive.archive('u1', 'ghost')).rejects.toThrow(NotFoundError);
    await expect(archive.restore('u1', 'ghost')).rejects.toThrow(NotFoundError);
  });
});

describe('BatchTodos — per-item statuses (old MCP semantics, §5)', () => {
  it('maps every branch: completed, error(archived), not_found, archived, already_active, restored', async () => {
    const { todos, batch } = build();
    const active = todos.seed('u1');
    const archivedRow = todos.seed('u1', { archived: true });

    const complete = await batch.execute('u1', {
      action: 'complete',
      ids: [active.id, archivedRow.id, 'ghost'],
    });
    expect(complete).toEqual({
      action: 'complete',
      results: [
        { id: active.id, status: 'completed' },
        { id: archivedRow.id, status: 'error', reason: 'archived' },
        { id: 'ghost', status: 'not_found' },
      ],
    });

    const uncomplete = await batch.execute('u1', { action: 'uncomplete', ids: [active.id] });
    expect(uncomplete.results).toEqual([{ id: active.id, status: 'uncompleted' }]);

    const archive = await batch.execute('u1', {
      action: 'archive',
      ids: [active.id, archivedRow.id],
    });
    expect(archive.results).toEqual([
      { id: active.id, status: 'archived' },
      { id: archivedRow.id, status: 'archived' }, // idempotent
    ]);

    const restore = await batch.execute('u1', {
      action: 'restore',
      ids: [active.id, archivedRow.id],
    });
    expect(restore.results).toEqual([
      { id: active.id, status: 'restored' }, // was archived by the previous batch
      { id: archivedRow.id, status: 'restored' },
    ]);

    const alreadyActive = await batch.execute('u1', { action: 'restore', ids: [active.id] });
    expect(alreadyActive.results).toEqual([{ id: active.id, status: 'already_active' }]);
  });

  it('archive on an already-archived task performs no extra write', async () => {
    const { todos, batch } = build();
    const archivedRow = todos.seed('u1', { archived: true });
    await batch.execute('u1', { action: 'archive', ids: [archivedRow.id] });
    expect(todos.calls.filter((call) => call.startsWith('setArchived'))).toHaveLength(0);
  });

  it('foreign rows read as not_found (user scoping)', async () => {
    const { todos, batch } = build();
    const foreign = todos.seed('other');
    const result = await batch.execute('u1', { action: 'complete', ids: [foreign.id] });
    expect(result.results).toEqual([{ id: foreign.id, status: 'not_found' }]);
  });
});

describe('FindSimilarTodos', () => {
  it('delegates limit/threshold to the repository and wraps {items, query}', async () => {
    const { todos, similar } = build();
    todos.seed('u1', { title: 'Water the plants' });
    todos.seed('u1', { title: 'Completely different' });
    const result = await similar.execute('u1', {
      title: 'Water the plants',
      limit: 5,
      threshold: 0.3,
    });
    expect(result.query).toBe('Water the plants');
    expect(result.items.map((todo) => todo.title)).toEqual(['Water the plants']);
  });

  it('archived rows are included (old-app parity, §6)', async () => {
    const { todos, similar } = build();
    todos.seed('u1', { title: 'Water the plants', archived: true });
    const result = await similar.execute('u1', {
      title: 'Water the plants',
      limit: 5,
      threshold: 0.3,
    });
    expect(result.items).toHaveLength(1);
  });
});

describe('GetTodo / ListTodos', () => {
  it('byId resolves archived rows; 404 messages match the contract', async () => {
    const { todos, getTodo } = build();
    const archived = todos.seed('u1', { archived: true, taskNumber: 42 });
    await expect(getTodo.byId('u1', archived.id)).resolves.toMatchObject({ archived: true });
    await expect(getTodo.byTaskNumber('u1', 42)).resolves.toMatchObject({ id: archived.id });
    await expect(getTodo.byId('u1', 'ghost')).rejects.toThrow('Task not found.');
    await expect(getTodo.byTaskNumber('u1', 999)).rejects.toThrow(
      'No task found with that number.',
    );
  });

  it('wraps the page envelope with computed totalPages', async () => {
    const { todos, listTodos } = build();
    for (let i = 0; i < 5; i += 1) todos.seed('u1');
    const page = await listTodos.execute('u1', { page: 2, pageSize: 2 });
    expect(page).toMatchObject({ page: 2, pageSize: 2, totalItems: 5, totalPages: 3 });
    expect(page.items).toHaveLength(2);
  });

  it('totalPages is 0 for an empty result', async () => {
    const { listTodos } = build();
    const page = await listTodos.execute('u1', { page: 1, pageSize: 50 });
    expect(page).toMatchObject({ items: [], totalItems: 0, totalPages: 0 });
  });
});
