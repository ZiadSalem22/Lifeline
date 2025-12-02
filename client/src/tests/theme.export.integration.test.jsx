import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock AuthProvider to simulate authenticated user
vi.mock('../providers/AuthProvider.jsx', () => {
  const value = {
    isAuthenticated: true,
    authLoading: false,
    guestMode: false,
    currentUser: { sub: 'user|auth1', profile: { first_name: 'Auth', last_name: 'User' } },
    checkedIdentity: true,
    logout: vi.fn()
  };
  return {
    AuthProvider: ({ children }) => children,
    useAuthContext: () => value
  };
});

// Mock useApi to capture fetchWithAuth calls
const mockFetch = vi.fn();
vi.mock('../hooks/useApi', () => ({ useApi: () => ({ fetchWithAuth: mockFetch }) }));

import { ThemeProvider, useTheme } from '../providers/ThemeProvider.jsx';
import * as api from '../utils/api';

beforeEach(() => {
  mockFetch.mockReset();
});

function Providers({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeProvider persistence and export integration', () => {
  it('persists theme for authenticated users and export payload includes settings', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper: Providers });

    // Mock fetchWithAuth POST /api/settings to resolve with saved settings
    mockFetch.mockImplementation(async (input, options = {}) => {
      if (input && input.includes('/settings') && options.method === 'POST') {
        return { ok: true, json: async () => ({ theme: JSON.parse(options.body).theme }) };
      }
      if (input && input.includes('/export')) {
        return { ok: true, json: async () => ({ exported_at: new Date().toISOString(), user: { settings: { theme: 'sunset' } }, todos: [], tags: [], stats: {} }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await act(async () => {
      result.current.changeTheme('sunset');
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    // Verify that POST /api/settings was called with theme and layout.font
    const postCall = mockFetch.mock.calls.find(c => String(c[0]).includes('/settings'));
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall[1].body);
    expect(body.theme).toBe('sunset');

    // Now call exportTodos and assert returned payload includes settings
    const payload = await api.exportTodos('json', mockFetch);
    expect(payload).toHaveProperty('user');
    expect(payload.user).toHaveProperty('settings');
    expect(payload.user.settings.theme).toBe('sunset');
  });
});
