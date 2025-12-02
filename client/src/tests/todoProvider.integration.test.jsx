import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../providers/ThemeProvider.jsx';
import { TodoProvider, useTodos } from '../providers/TodoProvider.jsx';

// Stub AuthProvider + hook to force stable guest mode without side effects
vi.mock('../providers/AuthProvider.jsx', () => {
  const value = {
    isAuthenticated: false,
    authLoading: false,
    guestMode: true,
    currentUser: null,
    checkedIdentity: true,
    logout: vi.fn()
  };
  return {
    AuthProvider: ({ children }) => children,
    useAuthContext: () => value
  };
});

// Mock API hook with stable fetchWithAuth reference
vi.mock('../hooks/useApi', () => {
  const fetchWithAuth = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  return { useApi: () => ({ fetchWithAuth }) };
});

// Ensure clean localStorage between runs
beforeEach(() => {
  localStorage.clear();
});

function Providers({ children }) {
  return (
    <ThemeProvider>
      <TodoProvider>{children}</TodoProvider>
    </ThemeProvider>
  );
}

describe('TodoProvider integration (guest mode)', () => {
  it('creates, filters, and flag toggles todos', async () => {
    const { result } = renderHook(() => useTodos(), { wrapper: Providers });

    // Wait for initial provider load to finish
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.todos.length).toBe(0);

    // Create a todo for today
    const todayStr = new Date().toISOString().slice(0, 10);
    await act(async () => {
      await result.current.createTodo({
        title: 'Write integration test',
        dueDate: todayStr,
        tags: [],
        isFlagged: false,
        duration: 30,
        priority: 'medium',
        dueTime: null,
        subtasks: [{ id: 'st1', title: 'Set up', isCompleted: false }],
        description: 'Ensure provider works after refactor',
        recurrence: null
      });
    });

    expect(result.current.todos.length).toBe(1);
    expect(result.current.filteredTodos.length).toBe(1);
    expect(result.current.filteredTodos[0].title).toMatch(/integration test/i);

    // Create a second todo for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    await act(async () => {
      await result.current.createTodo({
        title: 'Tomorrow task',
        dueDate: tomorrowStr,
        tags: [],
        isFlagged: true,
        duration: 10,
        priority: 'low'
      });
    });

    expect(result.current.todos.length).toBe(2);

    // Filter to today only
    act(() => { result.current.handleSelectDate('today'); });
    expect(result.current.filteredTodos.length).toBe(1);
    expect(result.current.filteredTodos[0].dueDate).toBe(todayStr);

    // Toggle flag on first todo
    const targetId = result.current.filteredTodos[0].id;
    const wasFlagged = result.current.filteredTodos[0].isFlagged;
    await act(async () => { await result.current.toggleFlag(targetId); });
    const afterToggle = result.current.todos.find(t => t.id === targetId);
    expect(afterToggle.isFlagged).toBe(!wasFlagged);
  });
});
