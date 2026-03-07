import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProfilePanel from '../components/ProfilePanel.jsx';

const fetchWithAuth = vi.fn();
const listMcpApiKeys = vi.fn();
const createMcpApiKey = vi.fn();
const revokeMcpApiKey = vi.fn();
const fetchMe = vi.fn();
const saveProfile = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({ fetchWithAuth }),
}));

vi.mock('../context/LoadingContext', () => ({
  useLoading: () => ({ isLoading: false }),
}));

vi.mock('../utils/api', () => ({
  fetchMe: (...args) => fetchMe(...args),
  saveProfile: (...args) => saveProfile(...args),
  listMcpApiKeys: (...args) => listMcpApiKeys(...args),
  createMcpApiKey: (...args) => createMcpApiKey(...args),
  revokeMcpApiKey: (...args) => revokeMcpApiKey(...args),
}));

describe('Profile API key management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMe.mockResolvedValue({
      email: 'jane@example.com',
      profile: {
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '',
        country: '',
        city: '',
        avatar_url: '',
      },
    });
    listMcpApiKeys.mockResolvedValue({
      apiKeys: [
        {
          id: 'key-1',
          name: 'Existing key',
          keyPrefix: 'lk_existing',
          scopes: ['tasks:read'],
          status: 'active',
          createdAt: '2026-03-07T10:00:00.000Z',
          expiresAt: null,
          lastUsedAt: null,
          revokedAt: null,
        },
      ],
    });
    createMcpApiKey.mockResolvedValue({
      apiKey: {
        id: 'key-2',
        name: 'Desktop CLI',
        keyPrefix: 'lk_created',
        scopes: ['tasks:read', 'tasks:write'],
        status: 'active',
        createdAt: '2026-03-07T12:00:00.000Z',
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: null,
      },
      plaintextKey: 'lk_created.secret-value',
    });
    revokeMcpApiKey.mockResolvedValue({
      apiKey: {
        id: 'key-1',
        name: 'Existing key',
        keyPrefix: 'lk_existing',
        scopes: ['tasks:read'],
        status: 'revoked',
        createdAt: '2026-03-07T10:00:00.000Z',
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: '2026-03-07T12:30:00.000Z',
      },
    });

    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('renders the API keys section, creates a key, reveals it once, and revokes an existing key', async () => {
    render(<ProfilePanel />);

    expect(await screen.findByRole('heading', { name: /api keys/i })).toBeDefined();
    expect(await screen.findByText(/Existing key/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /create api key/i }));
    fireEvent.change(screen.getByLabelText(/key name/i), { target: { value: 'Desktop CLI' } });
    fireEvent.change(screen.getByLabelText(/access/i), { target: { value: 'read_write' } });
    fireEvent.change(screen.getByLabelText(/expiry/i), { target: { value: 'never' } });
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }));

    await waitFor(() => {
      expect(createMcpApiKey).toHaveBeenCalledWith({
        name: 'Desktop CLI',
        scopePreset: 'read_write',
        expiryPreset: 'never',
      }, fetchWithAuth);
    });

    expect(await screen.findByDisplayValue('lk_created.secret-value')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /copy key/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('lk_created.secret-value');
    });

    const existingKeyCard = screen.getByText(/Existing key/i).closest('article');
    fireEvent.click(within(existingKeyCard).getByRole('button', { name: /revoke/i }));

    await waitFor(() => {
      expect(revokeMcpApiKey).toHaveBeenCalledWith('key-1', fetchWithAuth);
    });

    expect(await screen.findByText(/API key revoked/i)).toBeDefined();
  });
});
