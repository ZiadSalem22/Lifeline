import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { McpKey } from '@lifeline/shared';
import { makeUserAuth, renderWithProviders } from '../../test/harness';
import {
  bodyOf,
  installFetchMock,
  jsonResponse,
  makeMe,
  problemResponse,
} from '../../test/test-utils';
import { ApiKeysCard } from './ApiKeysCard';
import { ProfileDetailsCard } from './ProfileDetailsCard';

function makeMcpKey(overrides: Partial<McpKey> = {}): McpKey {
  return {
    id: 'key-1',
    name: 'Desktop CLI',
    keyPrefix: 'lk_abc123',
    scopes: ['tasks:read', 'tasks:write'],
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ProfileDetailsCard', () => {
  it('prefills from the resolved identity and saves with the browser timezone', async () => {
    const fetchMock = installFetchMock(makeMe());
    const user = userEvent.setup();
    const auth = makeUserAuth(makeMe());
    renderWithProviders(<ProfileDetailsCard />, { auth });

    expect(screen.getByLabelText('First name')).toHaveValue('Ziyad');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Profile updated successfully.')).toBeInTheDocument();
    expect(auth.refreshIdentity).toHaveBeenCalled();

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    const body = bodyOf(putCall?.[1]) as Record<string, unknown>;
    expect(body.firstName).toBe('Ziyad');
    expect(body.lastName).toBe('Salem');
    expect(typeof body.timezone).toBe('string'); // auto-injected browser timezone
    expect(body.onboardingCompleted).toBeUndefined(); // one-way flag never sent here
  });

  it('surfaces the dedicated message on 409 email conflict', async () => {
    installFetchMock(makeMe(), (pathname, method) =>
      pathname === '/api/v1/me/profile' && method === 'PUT'
        ? problemResponse(409, 'conflict', 'email already used')
        : null,
    );
    const user = userEvent.setup();
    const auth = makeUserAuth(makeMe());
    renderWithProviders(<ProfileDetailsCard />, { auth });

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(
      await screen.findByText('This email is already associated with another account.'),
    ).toBeInTheDocument();
    expect(auth.refreshIdentity).not.toHaveBeenCalled();
  });
});

describe('ApiKeysCard', () => {
  it('creates a key with the safe presets and reveals the plaintext exactly once', async () => {
    const createdBodies: unknown[] = [];
    installFetchMock(makeMe(), (pathname, method, init) => {
      if (pathname === '/api/v1/mcp-keys' && method === 'POST') {
        createdBodies.push(bodyOf(init));
        return jsonResponse({ apiKey: makeMcpKey(), plaintextKey: 'lk_abc123.supersecret' }, 201);
      }
      if (pathname === '/api/v1/mcp-keys' && method === 'GET') {
        return jsonResponse({ items: createdBodies.length > 0 ? [makeMcpKey()] : [] });
      }
      return null;
    });
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysCard />, { auth: makeUserAuth(makeMe()) });

    await user.click(await screen.findByRole('button', { name: 'Create your first API key' }));
    await user.type(screen.getByLabelText('Key name'), 'Desktop CLI');
    await user.click(screen.getByRole('button', { name: 'Create API key' }));

    // Plaintext shown once, with the copy warning; defaults read_write/30_days.
    expect(await screen.findByLabelText('Plaintext API key')).toHaveValue('lk_abc123.supersecret');
    expect(
      screen.getByText('This plaintext key will not be shown again after you leave this page.'),
    ).toBeInTheDocument();
    expect(createdBodies[0]).toEqual({
      name: 'Desktop CLI',
      scopePreset: 'read_write',
      expiryPreset: '30_days',
    });

    // The list itself only ever exposes the prefix.
    expect(await screen.findByText('Prefix: lk_abc123')).toBeInTheDocument();
    expect(screen.getByText('Read and write')).toBeInTheDocument();
  });

  it('revokes after confirm', async () => {
    let revoked = false;
    installFetchMock(makeMe(), (pathname, method) => {
      if (pathname === '/api/v1/mcp-keys' && method === 'GET') {
        return jsonResponse({
          items: [revoked ? makeMcpKey({ status: 'revoked' }) : makeMcpKey()],
        });
      }
      if (pathname === '/api/v1/mcp-keys/key-1/revoke' && method === 'POST') {
        revoked = true;
        return jsonResponse({ apiKey: makeMcpKey({ status: 'revoked' }) });
      }
      return null;
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<ApiKeysCard />, { auth: makeUserAuth(makeMe()) });

    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('API key revoked.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('revoked')).toBeInTheDocument());
    expect(window.confirm).toHaveBeenCalledWith(
      'Revoke API key "Desktop CLI"? This cannot be undone.',
    );
  });
});
