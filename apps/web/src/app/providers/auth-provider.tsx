import { useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, setTokenSupplier } from '../../shared/api/client';
import { getMe } from '../../shared/api/endpoints';
import { GUEST_TAGS_KEY, GUEST_TODOS_KEY } from '../../shared/guest/guest-api';
import { useAuthAdapter } from './auth-adapter-context';
import { AuthContext } from './auth-context';
import type { AuthContextValue } from './auth-context';

/**
 * Identity resolution, ported from the old AuthProvider semantics on top of
 * TanStack Query (identity is fully derived state):
 * - adapter authenticated → silent token (22s timeout race) → GET /me → currentUser;
 * - unauthenticated → guest mode;
 * - automatic guest fallback on 401 / "Missing Refresh Token" / login_required
 *   with the notice "Session expired. Using guest mode." (retry is disabled, so
 *   the fallback cannot loop — refreshIdentity() is the explicit way back);
 * - guest localStorage data is wiped when a login succeeds.
 */

const TOKEN_TIMEOUT_MS = 22_000;
const SESSION_EXPIRED_NOTICE = 'Session expired. Using guest mode.';

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SilentRefreshTimeout')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function isGuestFallbackError(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401) return true;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const rawCode =
    typeof error === 'object' && error !== null && 'error' in error ? error.error : null;
  const errorCode = typeof rawCode === 'string' ? rawCode : '';
  return (
    message.includes('Missing Refresh Token') ||
    message.includes('login_required') ||
    message.includes('Login required') ||
    errorCode === 'login_required'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const adapter = useAuthAdapter();

  // The api client asks the adapter for a token on every request.
  useEffect(() => {
    setTokenSupplier(async () => {
      if (!adapter.isAuthenticated) return null;
      try {
        return await adapter.getToken();
      } catch {
        return null;
      }
    });
    return () => setTokenSupplier(null);
  }, [adapter]);

  const enabled = !adapter.isLoading && adapter.isAuthenticated;

  const identityQuery = useQuery({
    queryKey: ['me', adapter.user?.sub ?? null],
    enabled,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const token = await withTimeout(adapter.getToken(), TOKEN_TIMEOUT_MS);
      if (!token) throw new Error('login_required');
      return getMe();
    },
  });

  // Login succeeded: guest data is wiped (documented product behavior).
  const loginSucceeded = identityQuery.isSuccess;
  useEffect(() => {
    if (!loginSucceeded) return;
    try {
      window.localStorage.removeItem(GUEST_TODOS_KEY);
      window.localStorage.removeItem(GUEST_TAGS_KEY);
    } catch {
      // storage unavailable — nothing to clean
    }
  }, [loginSucceeded]);

  const login = useCallback(() => adapter.login(), [adapter]);
  const logout = useCallback(() => adapter.logout(), [adapter]);
  const refetch = identityQuery.refetch;
  const refreshIdentity = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const error = identityQuery.error;
  const guestFallback = enabled && error !== null && isGuestFallbackError(error);
  const timedOut = error instanceof Error && error.message === 'SilentRefreshTimeout';

  const checkedIdentity =
    !adapter.isLoading && (!adapter.isAuthenticated || identityQuery.isFetched);
  const loading = adapter.isLoading || (enabled && identityQuery.isLoading);
  const currentUser = !guestFallback ? (identityQuery.data ?? null) : null;
  const guestMode = !loading && (!adapter.isAuthenticated || guestFallback);
  const notice = guestFallback
    ? SESSION_EXPIRED_NOTICE
    : timedOut
      ? 'Network slow, retrying authentication...'
      : error !== null
        ? 'Failed to load user profile. Check connection.'
        : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      guestMode,
      checkedIdentity,
      loading,
      notice,
      login,
      logout,
      refreshIdentity,
    }),
    [currentUser, guestMode, checkedIdentity, loading, notice, login, logout, refreshIdentity],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
