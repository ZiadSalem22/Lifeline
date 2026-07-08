import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { AuthAdapterContext } from './auth-adapter-context';
import type { AuthAdapter, AuthAdapterUser } from './auth-adapter-context';

/**
 * AuthAdapterProvider — mounts either the real Auth0 provider or a local stub
 * (VITE_AUTH_DISABLED=1) and exposes both through the same AuthAdapter
 * contract. Auth0 hooks/types never leak outside this file.
 */

const DEFAULT_SCOPE = 'openid profile email offline_access';

function Auth0Bridge({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, getAccessTokenSilently, loginWithRedirect, logout } =
    useAuth0();

  const value = useMemo<AuthAdapter>(() => {
    const adapterUser: AuthAdapterUser | null = user?.sub
      ? {
          sub: user.sub,
          ...(user.name !== undefined ? { name: user.name } : {}),
          ...(user.email !== undefined ? { email: user.email } : {}),
          ...(user.picture !== undefined ? { picture: user.picture } : {}),
        }
      : null;
    return {
      isLoading,
      isAuthenticated,
      user: adapterUser,
      getToken: async () => {
        const token = await getAccessTokenSilently();
        return token || null;
      },
      login: async () => {
        await loginWithRedirect();
      },
      logout: async () => {
        await logout({ logoutParams: { returnTo: window.location.origin } });
      },
    };
  }, [isLoading, isAuthenticated, user, getAccessTokenSilently, loginWithRedirect, logout]);

  return <AuthAdapterContext.Provider value={value}>{children}</AuthAdapterContext.Provider>;
}

function LocalAuthAdapter({ children }: { children: ReactNode }) {
  const value = useMemo<AuthAdapter>(
    () => ({
      isLoading: false,
      isAuthenticated: true,
      user: {
        sub: import.meta.env.VITE_AUTH_LOCAL_SUB || 'local-dev-user',
        name: 'Local Compose User',
      },
      getToken: () => Promise.resolve('local-compose-token'),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
    }),
    [],
  );

  return <AuthAdapterContext.Provider value={value}>{children}</AuthAdapterContext.Provider>;
}

export function AuthAdapterProvider({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_AUTH_DISABLED === '1') {
    return <LocalAuthAdapter>{children}</LocalAuthAdapter>;
  }

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const scope = import.meta.env.VITE_AUTH0_SCOPE || DEFAULT_SCOPE;

  if (!domain || !clientId) {
    throw new Error(
      'VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID are required unless VITE_AUTH_DISABLED=1',
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        scope,
        ...(audience ? { audience } : {}),
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}
