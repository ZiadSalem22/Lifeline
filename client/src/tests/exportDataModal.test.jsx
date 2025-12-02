import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportDataModal from '../components/settings/ExportDataModal';

// Mock providers/hooks
vi.mock('../providers/AuthProvider.jsx', () => ({
  useAuthContext: () => ({ guestMode: false, currentUser: { id: 'u1', email: 'u1@example.com' } })
}));
vi.mock('../providers/TodoProvider.jsx', () => ({
  useTodos: () => ({ todos: [{ id: 't1', title: 'T1' }], tags: [{ id: 'g1', name: 'Inbox' }] })
}));
vi.mock('../hooks/useApi', () => ({ useApi: () => ({ fetchWithAuth: async () => {} }) }));

describe('ExportDataModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads preview from /api/export when authenticated and shows download button', async () => {
    const mockData = { version: 1, exportDate: '2025-12-01T00:00:00Z', user: { id: 'u1' }, todos: [{ id: 't1', title: 'T1' }], tags: [{ id: 'g1', name: 'Inbox' }] };
    global.fetch = vi.fn(async (url) => ({ ok: true, json: async () => mockData }));

    render(<ExportDataModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText(/Download JSON/i)).toBeDefined());
    // Preview should include todo id
    expect(screen.getByText(/T1/)).toBeDefined();

    // Spy on toast event dispatch
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    // Mock URL.createObjectURL
    const mockUrl = 'blob://test';
    global.URL.createObjectURL = vi.fn(() => mockUrl);

    const btn = screen.getByText(/Download JSON/i);
    fireEvent.click(btn);

    // Ensure createObjectURL called and toast dispatched
    await waitFor(() => expect(global.URL.createObjectURL).toHaveBeenCalled());
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
