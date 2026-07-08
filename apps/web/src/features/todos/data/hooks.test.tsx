import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Todo } from '@lifeline/shared';
import { AuthContext } from '../../../app/providers/auth-context';
import { guestApi } from '../../../shared/guest/guest-api';
import { makeGuestAuth, newQueryClient } from '../../../test/harness';
import { makeTodo, seedGuestTodos } from '../../../test/test-utils';
import { todosQueryKey, useReorder, useUpdateSubtasks } from './hooks';

/**
 * Guest-mode hook tests: the guest adapter is the real localStorage
 * implementation, so optimistic-cache semantics are exercised end to end
 * without any fetch mocking.
 */

const queryClientRef = { current: newQueryClient() };

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={makeGuestAuth()}>
      <QueryClientProvider client={queryClientRef.current}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );
}

const KEY = todosQueryKey(true);

beforeEach(() => {
  window.localStorage.clear();
  queryClientRef.current = newQueryClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUpdateSubtasks (optimistic + rollback)', () => {
  const subtasks = (done: boolean): Todo['subtasks'] => [
    { subtaskId: 's-1', title: 'Step', isCompleted: done, position: 1 },
  ];

  it('applies the patch optimistically and keeps the server result on success', async () => {
    const todo = makeTodo({ subtasks: subtasks(false) });
    seedGuestTodos([todo]);
    queryClientRef.current.setQueryData<Todo[]>(KEY, [todo]);

    const { result } = renderHook(() => useUpdateSubtasks(), { wrapper });
    act(() => {
      result.current.mutate({ id: todo.id, subtasks: subtasks(true) });
    });

    await waitFor(() => {
      const cached = queryClientRef.current.getQueryData<Todo[]>(KEY);
      expect(cached?.[0]?.subtasks[0]?.isCompleted).toBe(true);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Persisted in guest storage too.
    const stored = await guestApi.fetchTodos();
    expect(stored[0]?.subtasks[0]?.isCompleted).toBe(true);
  });

  it('rolls the cache back when the mutation fails', async () => {
    // Cache knows the todo, but guest storage does NOT -> updateTodo throws.
    const todo = makeTodo({ subtasks: subtasks(false) });
    seedGuestTodos([]);
    queryClientRef.current.setQueryData<Todo[]>(KEY, [todo]);

    const { result } = renderHook(() => useUpdateSubtasks(), { wrapper });
    act(() => {
      result.current.mutate({ id: todo.id, subtasks: subtasks(true) });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = queryClientRef.current.getQueryData<Todo[]>(KEY);
    expect(cached?.[0]?.subtasks[0]?.isCompleted).toBe(false);
  });
});

describe('useReorder (persisted drag-drop)', () => {
  it('PATCHes only the items whose order changed and moves the cache optimistically', async () => {
    const a = makeTodo({ id: 'a', order: 0 });
    const b = makeTodo({ id: 'b', order: 1 });
    const c = makeTodo({ id: 'c', order: 2 });
    seedGuestTodos([a, b, c]);
    queryClientRef.current.setQueryData<Todo[]>(KEY, [a, b, c]);
    const updateSpy = vi.spyOn(guestApi, 'updateTodo');

    const { result } = renderHook(() => useReorder(), { wrapper });
    act(() => {
      // Drop c onto b: [a, c, b] — a keeps order 0.
      result.current.reorder('c', 'b', ['a', 'b', 'c']);
    });

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(2));
    expect(updateSpy).toHaveBeenCalledWith('c', { order: 1 });
    expect(updateSpy).toHaveBeenCalledWith('b', { order: 2 });

    const cached = queryClientRef.current.getQueryData<Todo[]>(KEY);
    expect(cached?.map((todo) => todo.id)).toEqual(['a', 'c', 'b']);
    expect(cached?.map((todo) => todo.order)).toEqual([0, 1, 2]);
  });

  it('is a no-op when nothing changes', () => {
    const a = makeTodo({ id: 'a', order: 0 });
    seedGuestTodos([a]);
    queryClientRef.current.setQueryData<Todo[]>(KEY, [a]);
    const updateSpy = vi.spyOn(guestApi, 'updateTodo');

    const { result } = renderHook(() => useReorder(), { wrapper });
    act(() => {
      result.current.reorder('a', 'a', ['a']);
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
