import { createContext, useContext } from 'react';

/**
 * Minimal identity contract wrapped around Auth0 (or the local dev stub).
 * Nothing outside auth-adapter.tsx may import @auth0/auth0-react — consumers
 * only ever see this interface.
 */
export interface AuthAdapterUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

export interface AuthAdapter {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthAdapterUser | null;
  /** Silent access-token acquisition; null when no token is available. */
  getToken: () => Promise<string | null>;
  /** Redirect to the hosted login (no-op in local mode). */
  login: () => Promise<void>;
  /** Log out and return to the app origin (no-op in local mode). */
  logout: () => Promise<void>;
}

export const AuthAdapterContext = createContext<AuthAdapter | null>(null);

export function useAuthAdapter(): AuthAdapter {
  const context = useContext(AuthAdapterContext);
  if (!context) throw new Error('useAuthAdapter must be used within AuthAdapterProvider');
  return context;
}
