import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePanel from '../components/ProfilePanel.jsx';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true })
}));

const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
const fetchMe = vi.fn(async () => ({
  email: 'jane@example.com',
  profile: { first_name: 'Jane', last_name: 'Doe' },
}));
const saveProfile = vi.fn(async () => ({}));

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({ fetchWithAuth: fetchSpy })
}));

vi.mock('../context/LoadingContext', () => ({
  useLoading: () => ({ isLoading: false })
}));

vi.mock('../utils/api', () => ({
  fetchMe: (...args) => fetchMe(...args),
  saveProfile: (...args) => saveProfile(...args),
  listMcpApiKeys: vi.fn(async () => ({ apiKeys: [] })),
  createMcpApiKey: vi.fn(async () => ({})),
  revokeMcpApiKey: vi.fn(async () => ({})),
}));

describe('Profile update payload', () => {
  it('includes auto-detected timezone when saving', async () => {
    render(<ProfilePanel />);
    // Click save immediately; default names already set from /me mock
    const save = await screen.findByRole('button', { name: /save changes/i });
    fireEvent.click(save);

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalledTimes(1);
      const payload = saveProfile.mock.calls[0][0];
      expect(payload.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    });
  });
});
