import { useCallback, useMemo } from 'react';

let tokenErrorLogged = false; // suppress repeat noisy token errors in dev
import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_ENV = import.meta.env.VITE_API_BASE_URL;

export const AUTH_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
export const AUTH_SCOPE = import.meta.env.VITE_AUTH0_SCOPE;

let audienceWarned = false;

export function createTokenOptions() {
  const authorizationParams = {};
  if (AUTH_AUDIENCE) {
    authorizationParams.audience = AUTH_AUDIENCE;
  }
  if (AUTH_SCOPE) {
    authorizationParams.scope = AUTH_SCOPE;
  }

  return Object.keys(authorizationParams).length > 0
    ? { authorizationParams }
    : undefined;
}

const ensureAbsoluteUrl = (input) => {
  if (!input) {
    throw new Error('fetchWithAuth: url is required');
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  if (!API_BASE_ENV) {
    throw new Error('VITE_API_BASE_URL is not defined');
  }

  const raw = API_BASE_ENV.replace(/\/$/, '');
  const base = raw.endsWith('/api') ? raw : `${raw}/api`;
  let path = String(input).startsWith('/') ? String(input) : `/${input}`;
  // Prevent duplicate '/api' when API_BASE_URL already contains '/api' and caller passed '/api/...'
  if (base.endsWith('/api') && path.startsWith('/api')) {
    path = path.replace(/^\/api/, '');
  }
  return `${base}${path}`;
};

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  const tokenOptions = useMemo(() => createTokenOptions(), []);

  const fetchWithAuth = useCallback(async (input, options = {}) => {
    let token;
    try {
      if (!AUTH_AUDIENCE && !audienceWarned) {
        console.warn('Auth warning: VITE_AUTH0_AUDIENCE is not set; tokens may be rejected by the API.');
        audienceWarned = true;
      }
      token = await getAccessTokenSilently(tokenOptions);
    } catch (err) {
      if (err) {
        err.code = err.code || 'TOKEN_ERROR';
        // unify with HTTP handling so callers can treat like 401
        err.status = err.status || 401;
      }
      if (!tokenErrorLogged) {
        console.error('fetchWithAuth: failed to retrieve token (will fallback)', err);
        tokenErrorLogged = true;
      } else {
        // minimal subsequent warning
        console.warn('fetchWithAuth: token still unavailable, suppressing repeat logs');
      }
      throw err;
    }

    if (!token) {
      console.warn('fetchWithAuth: missing token for request', input);
      const noTokenError = new Error('Auth token unavailable');
      noTokenError.code = 'TOKEN_ERROR';
      noTokenError.status = 401;
      if (!tokenErrorLogged) {
        console.error('fetchWithAuth: missing token (will fallback)');
        tokenErrorLogged = true;
      }
      throw noTokenError;
    }

    const url = ensureAbsoluteUrl(input);

    const headers = { ...(options.headers || {}) };
    headers.Authorization = `Bearer ${token}`;
    if (!headers.Accept) {
      headers.Accept = 'application/json';
    }
    const isFormData = options.body instanceof FormData;
    if (!headers['Content-Type'] && !isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.debugAuth) {
      const tokenPreview = typeof token === 'string' ? token.slice(0, 12) + '...' : 'none';
      console.debug('fetchWithAuth debug:', {
        url,
        hasToken: !!token,
        tokenPreview,
        hasAuthHeader: true,
        method: options.method || 'GET'
      });
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Allow callers to suppress noisy 401 logs for benign flows (e.g. optional settings save)
        if (!options.quiet401) {
          console.log('API ERROR STATUS:', response.status, url);
        }
        const error = new Error(`Unauthorized request to ${url}`);
        error.status = 401;
        throw error;
      }
    }

    return response;
  }, [getAccessTokenSilently, tokenOptions]);

  return { fetchWithAuth, tokenOptions };
}
