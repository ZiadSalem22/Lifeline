import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock AuthProvider to simulate authenticated user (non-guest)
vi.mock('../providers/AuthProvider.jsx', () => {
  const value = {
    isAuthenticated: true,
    authLoading: false,
    guestMode: false,
    currentUser: { sub: 'user|auth1' },
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

// Mock API to return server todo with ISO datetime for dueDate
const serverTodos = [
  { id: 's1', title: 'Server ISO Todo', dueDate: new Date().toISOString(), isCompleted: false }
];
vi.mock('../utils/api', () => ({
  fetchTodos: vi.fn(async () => serverTodos),
  fetchTags: vi.fn(async () => []),
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  toggleTodo: vi.fn(),
  deleteTodo: vi.fn(),
  toggleFlag: vi.fn()
}));

import { ThemeProvider } from '../providers/ThemeProvider.jsx';
import { TodoProvider, useTodos } from '../providers/TodoProvider.jsx';

function Providers({ children }) {
  return (
    <ThemeProvider>
      <TodoProvider>{children}</TodoProvider>
    </ThemeProvider>
  );
}

describe('TodoProvider dueDate normalization', () => {
  beforeEach(() => { localStorage.clear(); });

  it('normalizes ISO datetime dueDate to YYYY-MM-DD so filteredTodos includes server item for today', async () => {
    const { result } = renderHook(() => useTodos(), { wrapper: Providers });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // initial server todo should load
    expect(result.current.todos.length).toBe(1);
    // ensure filteredTodos for today includes it
    const todayStr = new Date().toISOString().slice(0,10);
    expect(result.current.filteredTodos.length).toBeGreaterThanOrEqual(1);
    expect(result.current.filteredTodos.some(t => t.dueDate === todayStr)).toBe(true);
  });
});
