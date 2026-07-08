import { describe, expect, it } from 'vitest';
import { createGuestApi, GUEST_TAGS_KEY } from './guest-api';
import type { GuestStorage } from './guest-api';

function memoryStorage(seed: Record<string, string> = {}): GuestStorage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe('guest-api tags', () => {
  it('seeds the 10 default tags with tag-* ids and shared colors', async () => {
    const api = createGuestApi(memoryStorage());
    const tags = await api.fetchTags();
    expect(tags).toHaveLength(10);
    expect(tags[0]).toMatchObject({
      id: 'tag-work',
      name: 'Work',
      color: '#3B82F6',
      isDefault: true,
      userId: null,
    });
    expect(tags.at(-1)).toMatchObject({ id: 'tag-misc', name: 'Misc', color: '#9CA3AF' });
  });

  it('re-merges missing defaults case-insensitively without duplicating', async () => {
    const storage = memoryStorage({
      [GUEST_TAGS_KEY]: JSON.stringify([
        { id: 'custom-1', name: 'work', color: '#000000', userId: null, isDefault: false },
      ]),
    });
    const api = createGuestApi(storage);
    const tags = await api.fetchTags();
    // 'work' (case-insensitive) satisfies the Work default; 9 others re-added.
    expect(tags).toHaveLength(10);
    expect(tags.filter((tag) => tag.name.toLowerCase() === 'work')).toHaveLength(1);
    expect(tags[0]?.id).toBe('custom-1');
    expect(tags.some((tag) => tag.id === 'tag-personal')).toBe(true);
  });

  it('creates, updates, and deletes custom tags', async () => {
    const api = createGuestApi(memoryStorage());
    const tag = await api.createTag({ name: 'Deep Work', color: '#112233' });
    expect(tag.isDefault).toBe(false);
    const updated = await api.updateTag(tag.id, { color: '#445566' });
    expect(updated).toMatchObject({ name: 'Deep Work', color: '#445566' });
    await api.deleteTag(tag.id);
    const tags = await api.fetchTags();
    expect(tags.some((t) => t.id === tag.id)).toBe(false);
  });
});

describe('guest-api todos', () => {
  it('assigns incrementing taskNumbers (max + 1)', async () => {
    const api = createGuestApi(memoryStorage());
    const first = await api.createTodo({ title: 'one' });
    const second = await api.createTodo({ title: 'two' });
    expect(first.taskNumber).toBe(1);
    expect(second.taskNumber).toBe(2);
    await api.deleteTodo(first.id);
    const third = await api.createTodo({ title: 'three' });
    expect(third.taskNumber).toBe(3);
  });

  it('expands daily recurrence into one todo per day', async () => {
    const api = createGuestApi(memoryStorage());
    const first = await api.createTodo({
      title: 'stretch',
      recurrence: { mode: 'daily', startDate: '2026-07-01', endDate: '2026-07-03' },
    });
    const todos = await api.fetchTodos();
    expect(todos.map((todo) => todo.dueDate)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(todos.map((todo) => todo.taskNumber)).toEqual([1, 2, 3]);
    expect(first.dueDate).toBe('2026-07-01');
  });

  it('creates a single spanning todo for dateRange (server semantics)', async () => {
    const api = createGuestApi(memoryStorage());
    const created = await api.createTodo({
      title: 'conference',
      recurrence: { mode: 'dateRange', startDate: '2026-07-01', endDate: '2026-07-10' },
    });
    const todos = await api.fetchTodos();
    expect(todos).toHaveLength(1);
    expect(created.dueDate).toBe('2026-07-01');
    expect(created.recurrence).toMatchObject({ mode: 'dateRange', endDate: '2026-07-10' });
  });

  it('expands specificDays onto matching weekdays only', async () => {
    const api = createGuestApi(memoryStorage());
    await api.createTodo({
      title: 'gym',
      recurrence: {
        mode: 'specificDays',
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        selectedDays: ['Monday'],
      },
    });
    const todos = await api.fetchTodos();
    // Mondays in the window: Jul 6 and Jul 13, 2026.
    expect(todos.map((todo) => todo.dueDate)).toEqual(['2026-07-06', '2026-07-13']);
  });

  it('expands legacy {type, interval} recurrence', async () => {
    const api = createGuestApi(memoryStorage());
    await api.createTodo({
      title: 'review',
      dueDate: '2026-07-01',
      recurrence: { type: 'weekly', interval: 2, endDate: '2026-08-01' },
    });
    const todos = await api.fetchTodos();
    expect(todos.map((todo) => todo.dueDate)).toEqual(['2026-07-01', '2026-07-15', '2026-07-29']);
  });

  it('spawns the next occurrence on complete, resets subtasks with stable ids, stops at endDate', async () => {
    const api = createGuestApi(memoryStorage());
    const created = await api.createTodo({
      title: 'water plants',
      recurrence: { mode: 'dateRange', startDate: '2026-07-01', endDate: '2026-07-02' },
      subtasks: [{ title: 'front garden' }],
    });
    const subtaskId = created.subtasks[0]!.subtaskId;

    // Complete the subtask, then the todo itself.
    await api.updateTodo(created.id, {
      subtasks: [{ subtaskId, title: 'front garden', isCompleted: true }],
    });
    const toggled = await api.toggleTodo(created.id);
    expect(toggled.isCompleted).toBe(true);

    const afterFirstToggle = await api.fetchTodos();
    expect(afterFirstToggle).toHaveLength(2);
    const spawned = afterFirstToggle.find((todo) => todo.dueDate === '2026-07-02')!;
    expect(spawned.isCompleted).toBe(false);
    expect(spawned.taskNumber).toBe(2);
    expect(spawned.originalId).toBe(created.id);
    // Subtask identity is stable; completion resets.
    expect(spawned.subtasks[0]).toMatchObject({
      subtaskId,
      title: 'front garden',
      isCompleted: false,
    });

    // Completing the last occurrence (dueDate === endDate) spawns nothing.
    await api.toggleTodo(spawned.id);
    const afterSecondToggle = await api.fetchTodos();
    expect(afterSecondToggle).toHaveLength(2);
    expect(afterSecondToggle.every((todo) => todo.isCompleted)).toBe(true);
  });

  it('toggleFlag flips the flag and updateTodo patches fields', async () => {
    const api = createGuestApi(memoryStorage());
    const created = await api.createTodo({ title: 'flag me' });
    expect((await api.toggleFlag(created.id)).isFlagged).toBe(true);
    expect((await api.toggleFlag(created.id)).isFlagged).toBe(false);
    const updated = await api.updateTodo(created.id, { title: 'renamed', priority: 'high' });
    expect(updated).toMatchObject({ title: 'renamed', priority: 'high' });
  });
});
