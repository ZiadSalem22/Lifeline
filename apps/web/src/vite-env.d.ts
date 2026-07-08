/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API server origin; empty string = same origin. `/api/v1` is appended by the client. */
  readonly VITE_API_BASE_URL?: string;
  /** Auth0 tenant domain (required unless VITE_AUTH_DISABLED=1). */
  readonly VITE_AUTH0_DOMAIN?: string;
  /** Auth0 application client id (required unless VITE_AUTH_DISABLED=1). */
  readonly VITE_AUTH0_CLIENT_ID?: string;
  /** Auth0 API identifier used as token audience. */
  readonly VITE_AUTH0_AUDIENCE?: string;
  /** OAuth scopes; defaults to "openid profile email offline_access". */
  readonly VITE_AUTH0_SCOPE?: string;
  /** "1" bypasses Auth0 with a fixed local identity + token "local-compose-token". */
  readonly VITE_AUTH_DISABLED?: string;
  /** Subject used in local auth mode; defaults to "local-dev-user". */
  readonly VITE_AUTH_LOCAL_SUB?: string;
  /** Version string shown in the sidebar footer. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
