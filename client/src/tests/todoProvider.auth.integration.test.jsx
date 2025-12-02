import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock AuthProvider to simulate authenticated user (non-guest)
vi.mock('../providers/AuthProvider.jsx', () => {
  const value = {
    isAuthenticated: true,
    authLoading: false,
    guestMode: false,
    currentUser: { sub: 'user|auth1', profile: { first_name: 'Auth', last_name: 'User', onboarding_completed: true } },
    checkedIdentity: true,
    logout: vi.fn()
  };
  return {
    AuthProvider: ({ children }) => children,
    useAuthContext: () => value
  };
});

// Stable fetchWithAuth mock
vi.mock('../hooks/useApi', () => {
  const fetchWithAuth = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  return { useApi: () => ({ fetchWithAuth }) };
});

// Spy on API module functions used by TodoProvider
const initialTodos = [
  { id: 't1', title: 'Server todo 1', dueDate: new Date().toISOString().slice(0,10), isCompleted: false },
];
const initialTags = [ { id: 'tag1', name: 'Work', color: '#ff8800' } ];
let todosState = [...initialTodos];

vi.mock('../utils/api', () => {
  return {
    fetchTodos: vi.fn(async () => todosState),
    fetchTags: vi.fn(async () => initialTags),
    createTodo: vi.fn(async (title, dueDate) => {
      const todo = { id: 'new-auth', title, dueDate, isCompleted: false };
      todosState = [todo, ...todosState];
      return todo;
    }),
    updateTodo: vi.fn(async (id, updates) => {
      todosState = todosState.map(t => t.id === id ? { ...t, ...updates } : t);
      return todosState.find(t => t.id === id);
    }),
    toggleTodo: vi.fn(async (id) => {
      todosState = todosState.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t);
      return todosState.find(t => t.id === id);
    }),
    deleteTodo: vi.fn(async (id) => {
      todosState = todosState.filter(t => t.id !== id);
    }),
    toggleFlag: vi.fn(async (id) => {
      todosState = todosState.map(t => t.id === id ? { ...t, isFlagged: !t.isFlagged } : t);
      return todosState.find(t => t.id === id);
    })
  };
});

import { ThemeProvider } from '../providers/ThemeProvider.jsx';
import { TodoProvider, useTodos } from '../providers/TodoProvider.jsx';

beforeEach(() => {
  // Reset state between tests
  todosState = [...initialTodos];
  localStorage.clear();
});

function Providers({ children }) {
  return (
    <ThemeProvider>
      <TodoProvider>{children}</TodoProvider>
    </ThemeProvider>
  );
}

describe('TodoProvider (authenticated mode)', () => {
  it('loads initial server todos and performs CRUD operations', async () => {
    const { result } = renderHook(() => useTodos(), { wrapper: Providers });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Initial load
    expect(result.current.todos.length).toBe(1);
    expect(result.current.tags.length).toBe(1);
    expect(result.current.todos[0].title).toMatch(/server todo/i);

    // Create
    const todayStr = new Date().toISOString().slice(0,10);
    await act(async () => {
      await result.current.createTodo({ title: 'Auth create', dueDate: todayStr });
    });
    expect(result.current.todos.length).toBe(2);

    // Toggle completion
    const targetId = result.current.todos[0].id;
    await act(async () => { await result.current.toggleTodo(targetId); });
    const toggled = result.current.todos.find(t => t.id === targetId);
    expect(toggled.isCompleted).toBe(true);

    // Flag
    await act(async () => { await result.current.toggleFlag(targetId); });
    const flagged = result.current.todos.find(t => t.id === targetId);
    expect(flagged.isFlagged).toBe(true);

    // Delete
    await act(async () => { await result.current.deleteTodo(targetId); });
    expect(result.current.todos.some(t => t.id === targetId)).toBe(false);
  });

  it('updates a todo priority and reflects change in state', async () => {
    const { result } = renderHook(() => useTodos(), { wrapper: Providers });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Create a new todo to update
    const todayStr = new Date().toISOString().slice(0,10);
    let created;
    await act(async () => {
      created = await result.current.createTodo({ title: 'Priority test', dueDate: todayStr });
    });

    expect(result.current.todos.some(t => t.id === created.id)).toBe(true);

    // Update priority
    await act(async () => {
      await result.current.updateTodo(created.id, { priority: 'high' });
    });

    const updated = result.current.todos.find(t => t.id === created.id);
    expect(updated).toBeTruthy();
    expect(updated.priority).toBe('high');
  });
});
