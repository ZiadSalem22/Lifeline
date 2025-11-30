import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePanel from '../components/ProfilePanel.jsx';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true })
}));

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({
    fetchWithAuth: async (url, opts) => {
      if (url.endsWith('/me')) {
        return { ok: true, json: async () => ({ sub: 'user|1', profile: { first_name: 'A', last_name: 'B' } }) };
      }
      if (url.endsWith('/profile')) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    }
  })
}));

describe('ProfilePanel', () => {
  it('renders in center container and saves', async () => {
    render(<ProfilePanel />);
    expect(await screen.findByText(/Your Profile/i)).toBeTruthy();
    const save = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(save);
    await waitFor(() => {
      expect(screen.getByText(/Profile updated successfully!/i)).toBeTruthy();
    });
  });
});
