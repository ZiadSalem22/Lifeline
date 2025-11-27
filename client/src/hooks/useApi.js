import { useCallback, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const AUTH_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
export const AUTH_SCOPE = import.meta.env.VITE_AUTH0_SCOPE;

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

  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not defined');
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const path = String(input).startsWith('/') ? String(input) : `/${input}`;
  return `${base}${path}`;
};

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  const tokenOptions = useMemo(() => createTokenOptions(), []);

  const fetchWithAuth = useCallback(async (input, options = {}) => {
    let token;
    try {
      token = await getAccessTokenSilently(tokenOptions);
    } catch (err) {
      console.error('fetchWithAuth: failed to retrieve token', err);
      throw err;
    }

    if (!token) {
      console.warn('fetchWithAuth: missing token for request', input);
      throw new Error('Auth token unavailable');
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('API ERROR STATUS:', response.status, url);
        const error = new Error(`Unauthorized request to ${url}`);
        error.status = 401;
        throw error;
      }
    }

    return response;
  }, [getAccessTokenSilently, tokenOptions]);

  return { fetchWithAuth, tokenOptions };
}
