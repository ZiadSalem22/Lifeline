import { useCallback, useMemo } from 'react';

let tokenErrorLogged = false;
let missingRefreshHandled = false;

import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_ENV = import.meta.env.VITE_API_BASE_URL;

export const AUTH_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
export const AUTH_SCOPE = import.meta.env.VITE_AUTH0_SCOPE;

let audienceWarned = false;

export function createTokenOptions() {
  const authorizationParams = {};
  if (AUTH_AUDIENCE) authorizationParams.audience = AUTH_AUDIENCE;
  if (AUTH_SCOPE) authorizationParams.scope = AUTH_SCOPE;

  return Object.keys(authorizationParams).length > 0
    ? { authorizationParams }
    : undefined;
}

const ensureAbsoluteUrl = (input) => {
  if (!input) throw new Error("fetchWithAuth: url is required");

  if (/^https?:\/\//i.test(input)) return input;

  if (!API_BASE_ENV) throw new Error("VITE_API_BASE_URL is not defined");

  const raw = API_BASE_ENV.replace(/\/$/, "");
  const base = raw.endsWith("/api") ? raw : `${raw}/api`;
  let path = String(input).startsWith("/") ? String(input) : `/${input}`;

  if (base.endsWith("/api") && path.startsWith("/api")) {
    path = path.replace(/^\/api/, "");
  }
  return `${base}${path}`;
};

export function useApi() {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();

  const tokenOptions = useMemo(() => createTokenOptions(), []);

  const fetchWithAuth = useCallback(
    async (input, options = {}) => {
      let token;

      try {
        if (!AUTH_AUDIENCE && !audienceWarned) {
          console.warn(
            "Auth warning: VITE_AUTH0_AUDIENCE is not set; tokens may be rejected by the API."
          );
          audienceWarned = true;
        }

        // 5-second timeout for silent token refresh
        token = await Promise.race([
          getAccessTokenSilently(tokenOptions),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("SilentRefreshTimeout")),
              5000
            )
          ),
        ]);
      } catch (err) {
        const msg = String(err?.message || "");

        // Handle timeout
        if (msg === "SilentRefreshTimeout") {
          console.warn("Silent refresh timed out — redirecting to login.");
          return loginWithRedirect({
            authorizationParams: {
              audience: AUTH_AUDIENCE,
              scope: AUTH_SCOPE,
            },
          });
        
        }

        // Existing missing refresh token logic
        if (err) {
          err.code = err.code || "TOKEN_ERROR";
          err.status = err.status || 401;
        }

        const isMissingRefresh =
          msg.includes("Missing Refresh Token") ||
          msg.toLowerCase().includes("missing_refresh_token");

        if (isMissingRefresh && !missingRefreshHandled) {
          try {
            missingRefreshHandled = true;

            // Clear stale localStorage keys
            Object.keys(localStorage)
              .filter((k) => k && k.startsWith("auth0."))
              .forEach((k) => localStorage.removeItem(k));

            return loginWithRedirect({
              authorizationParams: {
                audience: AUTH_AUDIENCE,
                scope: AUTH_SCOPE,
              },
            });
          } catch (cleanupErr) {
            console.error("Failed to handle missing refresh token cleanup", cleanupErr);
          }
        }

        if (!tokenErrorLogged) {
          console.error("fetchWithAuth: failed to retrieve token", err);
          tokenErrorLogged = true;
        }

        throw err;
      }

      if (!token) {
        const err = new Error("Auth token unavailable");
        err.code = "TOKEN_ERROR";
        err.status = 401;
        throw err;
      }

      const url = ensureAbsoluteUrl(input);

      const headers = { ...(options.headers || {}) };
      headers.Authorization = `Bearer ${token}`;
      if (!headers.Accept) headers.Accept = "application/json";

      const isFormData = options.body instanceof FormData;
      if (!headers["Content-Type"] && !isFormData) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          if (!options.quiet401) {
            console.log("API ERROR STATUS:", response.status, url);
          }
          if (options.quiet401) return response;

          const error = new Error(`Unauthorized request to ${url}`);
          error.status = 401;
          throw error;
        }
      }

      return response;
    },
    [getAccessTokenSilently, tokenOptions]
  );

  return { fetchWithAuth, tokenOptions };
}
