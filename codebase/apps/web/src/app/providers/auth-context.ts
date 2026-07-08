import { createContext, useContext } from 'react';
import type { Me } from '@lifeline/shared';

export interface AuthContextValue {
  /** Resolved server identity (GET /me), null in guest mode / while loading. */
  currentUser: Me | null;
  /** True when running against localStorage only (unauthenticated or fallback). */
  guestMode: boolean;
  /** True once the first identity resolution attempt finished. */
  checkedIdentity: boolean;
  /** True while an identity resolution is in flight. */
  loading: boolean;
  /** User-facing status message (e.g. "Session expired. Using guest mode."). */
  notice: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
