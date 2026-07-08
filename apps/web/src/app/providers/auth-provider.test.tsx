import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthAdapterContext } from './auth-adapter-context';
import type { AuthAdapter } from './auth-adapter-context';
import { AuthProvider } from './auth-provider';
import { makeMe } from '../../test/test-utils';

/**
 * Regression: once the adapter reports authenticated, requests fired by the
 * identity resolution must carry the bearer token. A prior race registered the
 * token supplier in an [adapter] effect, so the first GET /me after login went
 * out tokenless → 401 → the app fell back to guest ("Hello Guest").
 */
describe('AuthProvider token wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function authenticatedAdapter(): AuthAdapter {
    return {
      isLoading: false,
      isAuthenticated: true,
      user: { sub: 'auth0|123', email: 'x@example.com' },
      getToken: () => Promise.resolve('test-token'),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
    };
  }

  it('attaches the bearer token to GET /me when the adapter is authenticated', async () => {
    const seenAuthHeaders: (string | null)[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seenAuthHeaders.push(headers.get('authorization'));
      return Promise.resolve(
        new Response(JSON.stringify(makeMe()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <AuthAdapterContext.Provider value={authenticatedAdapter()}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <div />
          </AuthProvider>
        </QueryClientProvider>
      </AuthAdapterContext.Provider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Every request the provider fired must have carried the token — never null.
    expect(seenAuthHeaders.length).toBeGreaterThan(0);
    expect(seenAuthHeaders).not.toContain(null);
    expect(seenAuthHeaders[0]).toBe('Bearer test-token');
  });
});
