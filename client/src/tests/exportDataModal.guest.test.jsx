import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportDataModal from '../components/settings/ExportDataModal';

// Mock providers/hooks for guest mode
vi.mock('../providers/AuthProvider.jsx', () => ({
  useAuthContext: () => ({ guestMode: true, currentUser: null })
}));
vi.mock('../providers/TodoProvider.jsx', () => ({
  useTodos: () => ({ todos: [], tags: [] })
}));
vi.mock('../hooks/useApi', () => ({ useApi: () => ({ fetchWithAuth: async () => {} }) }));
vi.mock('../utils/guestApi', () => ({
  fetchTodos: async () => ([{ id: 'g1', title: 'Guest Todo', isCompleted: true, dueDate: '2025-12-01' }]),
  fetchTags: async () => ([{ id: 'tg1', name: 'GuestTag', color: '#fff' }])
}));

describe('ExportDataModal (guest)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds export JSON from localStorage and guestApi', async () => {
    // set some localStorage preferences
    localStorage.setItem('theme', 'light');
    localStorage.setItem('locale', 'fr');
    localStorage.setItem('showSidebar', 'false');

    render(<ExportDataModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText(/Download JSON/i)).toBeDefined());
    // Preview should indicate guest mode
    expect(screen.getByText(/Guest Todo/)).toBeDefined();

    // Click download and ensure blob created
    global.URL.createObjectURL = vi.fn(() => 'blob://x');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const btn = screen.getByText(/Download JSON/i);
    fireEvent.click(btn);
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled());
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
