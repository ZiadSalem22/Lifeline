import React, { createContext, useContext, useMemo } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';

const AuthAdapterContext = createContext(null);
const CLIENT_AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === '1';

function Auth0Bridge({ children }) {
  const auth = useAuth0();
  const value = useMemo(() => auth, [auth]);
  return <AuthAdapterContext.Provider value={value}>{children}</AuthAdapterContext.Provider>;
}

function LocalAuthProvider({ children }) {
  const value = useMemo(() => ({
    isLoading: false,
    isAuthenticated: true,
    user: {
      sub: import.meta.env.VITE_AUTH_LOCAL_SUB || 'local-dev-user',
      name: 'Local Compose User',
    },
    loginWithRedirect: async () => undefined,
    logout: async () => undefined,
    getAccessTokenSilently: async () => 'local-compose-token',
  }), []);

  return <AuthAdapterContext.Provider value={value}>{children}</AuthAdapterContext.Provider>;
}

export function AuthAdapterProvider({ children }) {
  if (CLIENT_AUTH_DISABLED) {
    return <LocalAuthProvider>{children}</LocalAuthProvider>;
  }

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
  const scope = import.meta.env.VITE_AUTH0_SCOPE || 'openid profile email offline_access';

  if (!domain || !clientId) {
    throw new Error('VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID are required when VITE_AUTH_DISABLED is not enabled');
  }

  const authorizationParams = {
    redirect_uri: window.location.origin,
    scope,
  };

  if (audience) {
    authorizationParams.audience = audience;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={authorizationParams}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

export function useAuthAdapter() {
  const context = useContext(AuthAdapterContext);
  if (!context) {
    throw new Error('useAuthAdapter must be used within AuthAdapterProvider');
  }
  return context;
}

export function isClientAuthDisabled() {
  return CLIENT_AUTH_DISABLED;
}