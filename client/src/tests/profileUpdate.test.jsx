import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePanel from '../components/ProfilePanel.jsx';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true })
}));

const fetchSpy = vi.fn(async (url, opts) => {
  if (url.endsWith('/me')) {
    return { ok: true, json: async () => ({ sub: 'user|1', profile: { first_name: 'Jane', last_name: 'Doe' } }) };
  }
  if (url.endsWith('/profile')) {
    return { ok: true, json: async () => ({}) };
  }
  return { ok: true, json: async () => ({}) };
});

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({ fetchWithAuth: fetchSpy })
}));

describe('Profile update payload', () => {
  it('includes auto-detected timezone when saving', async () => {
    render(<ProfilePanel />);
    // Click save immediately; default names already set from /me mock
    const save = await screen.findByRole('button', { name: /save changes/i });
    fireEvent.click(save);

    await waitFor(() => {
      const calls = fetchSpy.mock.calls.filter(([url]) => url.endsWith('/profile'));
      expect(calls.length).toBeGreaterThan(0);
      const body = JSON.parse(calls[0][1].body);
      expect(body.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    });
  });
});
