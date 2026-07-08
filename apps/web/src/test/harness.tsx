import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { RouteObject } from 'react-router';
import type { Me } from '@lifeline/shared';
import { AuthContext } from '../app/providers/auth-context';
import type { AuthContextValue } from '../app/providers/auth-context';

/** Feature-test harness: AuthContext stub + fresh QueryClient (+ optional router). */

export function makeGuestAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    currentUser: null,
    guestMode: true,
    checkedIdentity: true,
    loading: false,
    notice: null,
    login: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    refreshIdentity: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

export function makeUserAuth(me: Me, overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return makeGuestAuth({ currentUser: me, guestMode: false, ...overrides });
}

export function newQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export interface RenderWithProvidersOptions {
  auth?: AuthContextValue;
  queryClient?: QueryClient;
  /** When set, the UI renders inside a memory router at this location. */
  path?: string;
  /** Custom routes; defaults to a catch-all rendering the passed element. */
  routes?: RouteObject[];
}

export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const auth = options.auth ?? makeGuestAuth();
  const queryClient = options.queryClient ?? newQueryClient();

  let content: ReactElement = ui;
  let router: ReturnType<typeof createMemoryRouter> | null = null;
  if (options.path !== undefined) {
    router = createMemoryRouter(options.routes ?? [{ path: '*', element: ui }], {
      initialEntries: [options.path],
    });
    content = <RouterProvider router={router} />;
  }

  const result = render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
    </AuthContext.Provider>,
  );
  return { ...result, auth, queryClient, router };
}
