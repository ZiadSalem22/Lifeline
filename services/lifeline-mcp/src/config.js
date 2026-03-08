import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'development' ? '.env.local' : '.env';
dotenv.config({ path: envFile });

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTimeout(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed >= 100 ? parsed : fallback;
}

function normalizeOptionalUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  return new URL(normalized).href;
}

function buildIssuerUrl(domain, explicitIssuer) {
  const normalizedIssuer = normalizeOptionalUrl(explicitIssuer);
  if (normalizedIssuer) {
    return normalizedIssuer;
  }

  const normalizedDomain = String(domain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');

  if (!normalizedDomain) return null;
  return `https://${normalizedDomain}/`;
}

function buildAuth0OAuthMetadata({
  issuer,
  supportedScopes,
  registrationEndpoint,
  revocationEndpoint,
  serviceDocumentationUrl,
}) {
  if (!issuer) return null;

  const issuerUrl = new URL(issuer);

  return Object.freeze({
    issuer: issuerUrl.href,
    authorization_endpoint: new URL('/authorize', issuerUrl).href,
    token_endpoint: new URL('/oauth/token', issuerUrl).href,
    jwks_uri: new URL('/.well-known/jwks.json', issuerUrl).href,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    scopes_supported: supportedScopes.length > 0 ? supportedScopes : undefined,
    revocation_endpoint: revocationEndpoint || undefined,
    registration_endpoint: registrationEndpoint || undefined,
    service_documentation: serviceDocumentationUrl || undefined,
  });
}

export function loadConfig(env = process.env) {
  const host = String(env.MCP_BIND_HOST || '127.0.0.1');
  const publicBaseUrl = String(env.MCP_PUBLIC_BASE_URL || '').trim();
  const auth0Domain = String(env.MCP_AUTH0_DOMAIN || env.AUTH0_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
  const auth0Audiences = [
    ...splitCsv(env.MCP_AUTH0_AUDIENCE || env.AUTH0_AUDIENCE),
    ...splitCsv(env.MCP_AUTH0_AUDIENCE_ALT || env.AUTH0_AUDIENCE_ALT),
  ];
  const auth0Issuer = buildIssuerUrl(auth0Domain, env.MCP_AUTH0_ISSUER || env.AUTH0_ISSUER);
  const auth0SupportedScopes = splitCsv(env.MCP_AUTH0_SUPPORTED_SCOPES || 'tasks:read,tasks:write');
  const auth0RegistrationEndpoint = normalizeOptionalUrl(env.MCP_AUTH0_REGISTRATION_ENDPOINT);
  const auth0ServiceDocumentationUrl = normalizeOptionalUrl(env.MCP_AUTH0_SERVICE_DOCUMENTATION_URL);
  const auth0RevocationEndpoint = normalizeOptionalUrl(env.MCP_AUTH0_REVOCATION_ENDPOINT)
    || (auth0Issuer ? new URL('/oauth/revoke', auth0Issuer).href : null);
  const auth0Enabled = Boolean(auth0Issuer && auth0Audiences.length > 0);

  return Object.freeze({
    serviceName: 'lifeline-mcp',
    serviceVersion: '0.1.0',
    host,
    port: parsePort(env.MCP_PORT || env.PORT, 3030),
    publicBaseUrl: publicBaseUrl || null,
    allowedHosts: splitCsv(env.MCP_ALLOWED_HOSTS),
    backendBaseUrl: String(env.LIFELINE_BACKEND_BASE_URL || 'http://127.0.0.1:3000'),
    internalSharedSecret: String(env.MCP_INTERNAL_SHARED_SECRET || ''),
    requestTimeoutMs: parseTimeout(env.MCP_REQUEST_TIMEOUT_MS, 5000),
    logLevel: String(env.MCP_LOG_LEVEL || 'info'),
    auth0: Object.freeze({
      enabled: auth0Enabled,
      domain: auth0Domain || null,
      issuerUrl: auth0Issuer,
      audiences: auth0Audiences,
      jwksUri: auth0Issuer ? new URL('/.well-known/jwks.json', auth0Issuer).href : null,
      supportedScopes: auth0SupportedScopes,
      registrationEndpoint: auth0RegistrationEndpoint,
      revocationEndpoint: auth0RevocationEndpoint,
      resourceName: String(env.MCP_AUTH0_RESOURCE_NAME || 'Lifeline MCP').trim() || 'Lifeline MCP',
      serviceDocumentationUrl: auth0ServiceDocumentationUrl,
      oauthMetadata: auth0Enabled
        ? buildAuth0OAuthMetadata({
          issuer: auth0Issuer,
          supportedScopes: auth0SupportedScopes,
          registrationEndpoint: auth0RegistrationEndpoint,
          revocationEndpoint: auth0RevocationEndpoint,
          serviceDocumentationUrl: auth0ServiceDocumentationUrl,
        })
        : null,
    }),
  });
}
