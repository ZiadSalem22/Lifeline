import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import { AppError } from '../domain/errors.js';
import { extractClaims } from '../application/identity/claims.js';
import type { UserRepository } from '../application/ports.js';
import type { ResolveKeyPrincipal } from '../application/mcp-keys/resolve-key-principal.js';
import { McpAuthError, McpScopeError } from './errors.js';

/**
 * MCP request authentication, ported from the old
 * `services/lifeline-mcp/src/auth/*` — dual auth with the SAME routing rules:
 *
 * - `x-api-key` header → API-key path.
 * - `Authorization: Bearer <tok>`: JWT-shaped AND OAuth configured → OAuth
 *   path (jose JWKS verify + JIT user provisioning); anything else → API-key
 *   path (old parity: `lk_…` keys are accepted as Bearer tokens too).
 * - Missing credentials → 401, with `WWW-Authenticate` carrying the
 *   protected-resource metadata URL when OAuth is enabled.
 *
 * The API-key path calls `resolveKeyPrincipal` in-process — the old backend
 * round-trip, shared secret, and principal headers are gone.
 */

export const LIFELINE_MCP_SCOPES = Object.freeze({
  TASKS_READ: 'tasks:read',
  TASKS_WRITE: 'tasks:write',
  TASKS_ALL: 'tasks:*',
  ALL: '*',
});

export interface McpPrincipal {
  readonly subjectType: string;
  readonly lifelineUserId: string;
  readonly authMethod: string;
  readonly scopes: readonly string[];
  readonly subjectId: string;
  readonly displayName: string | null;
}

export function normalizePrincipalScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((scope) => String(scope ?? '').trim()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    return [
      ...new Set(
        value
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean),
      ),
    ];
  }
  return [];
}

export function buildNormalizedPrincipal(input: {
  subjectType: string;
  lifelineUserId: string;
  authMethod: string;
  scopes?: unknown;
  subjectId: string;
  displayName?: string | null | undefined;
}): McpPrincipal {
  if (!input.subjectType || !input.lifelineUserId || !input.authMethod || !input.subjectId) {
    throw new McpAuthError('Resolved principal is incomplete.', {
      status: 500,
      code: 'principal_invalid',
    });
  }

  return Object.freeze({
    subjectType: String(input.subjectType),
    lifelineUserId: String(input.lifelineUserId),
    authMethod: String(input.authMethod),
    scopes: Object.freeze(normalizePrincipalScopes(input.scopes)),
    subjectId: String(input.subjectId),
    displayName: input.displayName ? String(input.displayName) : null,
  });
}

function matchesScope(grantedScope: string, requiredScope: string): boolean {
  if (!grantedScope || !requiredScope) return false;
  if (grantedScope === requiredScope) return true;
  if (grantedScope === LIFELINE_MCP_SCOPES.ALL) return true;
  if (grantedScope === LIFELINE_MCP_SCOPES.TASKS_ALL && requiredScope.startsWith('tasks:')) {
    return true;
  }
  return false;
}

export function hasRequiredScope(
  principal: McpPrincipal,
  requiredScopes: readonly string[],
): boolean {
  const grantedScopes = normalizePrincipalScopes([...principal.scopes]);
  return requiredScopes.some((requiredScope) =>
    grantedScopes.some((grantedScope) => matchesScope(grantedScope, requiredScope)),
  );
}

/** Throws 403 `scope_denied` when the principal lacks every required scope. */
export function assertPrincipalScopes(
  principal: McpPrincipal,
  requiredScopes: readonly string[],
): void {
  if (requiredScopes.length === 0) return;
  if (!hasRequiredScope(principal, requiredScopes)) {
    throw new McpScopeError(
      `Authenticated principal is missing required scope: ${requiredScopes.join(' or ')}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Token shape + header extraction
// ---------------------------------------------------------------------------

export function looksLikeJwt(token: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token.trim());
}

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const normalized = headerValue.trim();
  if (normalized === '') return null;
  const match = /^Bearer\s+(.+)$/i.exec(normalized);
  return match ? (match[1] ?? '').trim() : normalized;
}

function extractClientIp(req: Request): string | undefined {
  const forwardedFor = req.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}

function escapeAuthenticateValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildWwwAuthenticateHeader({
  code = 'invalid_token',
  description,
  resourceMetadataUrl,
}: {
  code?: string | undefined;
  description?: string | undefined;
  resourceMetadataUrl?: string | null | undefined;
}): string {
  const parts = [`Bearer error="${escapeAuthenticateValue(code)}"`];
  if (description) parts.push(`error_description="${escapeAuthenticateValue(description)}"`);
  if (resourceMetadataUrl) {
    parts.push(`resource_metadata="${escapeAuthenticateValue(resourceMetadataUrl)}"`);
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// OAuth (Auth0) configuration + verifier
// ---------------------------------------------------------------------------

export interface McpOAuthConfig {
  enabled: boolean;
  issuerUrl: string | null;
  audiences: string[];
  jwksUri: string | null;
  supportedScopes: string[];
}

function buildIssuerUrl(explicitIssuer: string | null, domain: string | null): string | null {
  if (explicitIssuer !== null && explicitIssuer.trim() !== '') {
    return new URL(explicitIssuer.trim()).href;
  }
  if (domain === null || domain === '') return null;
  return `https://${domain}/`;
}

/**
 * MCP_AUTH0_* with AUTH0_* fallbacks (old `config.js` parity). OAuth is
 * enabled only when both an issuer and at least one audience resolve.
 */
export function resolveMcpOAuthConfig(
  env: Pick<
    Env,
    | 'MCP_AUTH0_ISSUER'
    | 'MCP_AUTH0_DOMAIN'
    | 'AUTH0_DOMAIN'
    | 'MCP_AUTH0_AUDIENCES'
    | 'AUTH0_AUDIENCES'
    | 'MCP_AUTH0_SUPPORTED_SCOPES'
  >,
): McpOAuthConfig {
  const issuerUrl = buildIssuerUrl(env.MCP_AUTH0_ISSUER, env.MCP_AUTH0_DOMAIN ?? env.AUTH0_DOMAIN);
  const audiences =
    env.MCP_AUTH0_AUDIENCES.length > 0 ? [...env.MCP_AUTH0_AUDIENCES] : [...env.AUTH0_AUDIENCES];
  const enabled = issuerUrl !== null && audiences.length > 0;
  return {
    enabled,
    issuerUrl,
    audiences,
    jwksUri: issuerUrl === null ? null : new URL('/.well-known/jwks.json', issuerUrl).href,
    supportedScopes: [...env.MCP_AUTH0_SUPPORTED_SCOPES],
  };
}

/** Injectable OAuth access-token verifier (jose in production, fake in tests). */
export interface McpTokenVerifier {
  verify(token: string): Promise<JWTPayload>;
}

export function createJoseMcpVerifier(config: McpOAuthConfig, timeoutMs: number): McpTokenVerifier {
  if (!config.enabled || config.jwksUri === null || config.issuerUrl === null) {
    throw new Error('OAuth configuration is required to create the MCP token verifier');
  }
  const jwks = createRemoteJWKSet(new URL(config.jwksUri), {
    timeoutDuration: Math.max(timeoutMs, 1000),
  });
  const issuer = config.issuerUrl;
  const audience = config.audiences.length <= 1 ? config.audiences[0] : config.audiences;
  return {
    async verify(token: string): Promise<JWTPayload> {
      const { payload } = await jwtVerify(token.trim(), jwks, {
        issuer,
        ...(audience !== undefined ? { audience } : {}),
        algorithms: ['RS256'],
      });
      return payload;
    },
  };
}

function normalizeScopeValues(value: unknown, separator: string): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

/** Union of `scope` (space-split) and `permissions` (array or comma-split). */
export function buildScopeList(payload: JWTPayload): string[] {
  return [
    ...new Set([
      ...normalizeScopeValues(payload.scope, ' '),
      ...normalizeScopeValues(payload.permissions, ','),
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Request authenticator
// ---------------------------------------------------------------------------

export interface McpAuthenticatorDeps {
  env: Env;
  logger: Logger;
  resolveKeyPrincipal: ResolveKeyPrincipal;
  users: Pick<UserRepository, 'ensureFromClaims'>;
  /** Injectable for tests; defaults to the jose remote-JWKS verifier. */
  verifier?: McpTokenVerifier | undefined;
  /** Protected-resource metadata URL advertised in WWW-Authenticate. */
  resourceMetadataUrl?: string | null | undefined;
}

export interface McpRequestAuthenticator {
  authenticate(req: Request): Promise<McpPrincipal>;
  oauth: McpOAuthConfig;
}

export function createMcpAuthenticator(deps: McpAuthenticatorDeps): McpRequestAuthenticator {
  const oauth = resolveMcpOAuthConfig(deps.env);
  const resourceMetadataUrl = deps.resourceMetadataUrl ?? null;
  let verifier: McpTokenVerifier | null = deps.verifier ?? null;

  const authError = (
    message: string,
    { code, status = 401 }: { code: string; status?: number },
  ): McpAuthError =>
    new McpAuthError(message, {
      status,
      code,
      ...(oauth.enabled
        ? {
            headers: {
              'WWW-Authenticate': buildWwwAuthenticateHeader({
                code: 'invalid_token',
                description: message,
                resourceMetadataUrl,
              }),
            },
          }
        : {}),
    });

  async function authenticateApiKey(req: Request, presentedKey: string): Promise<McpPrincipal> {
    try {
      const resolved = await deps.resolveKeyPrincipal.execute({
        apiKey: presentedKey,
        ip: extractClientIp(req),
        userAgent: req.get('user-agent') ?? undefined,
      });
      return buildNormalizedPrincipal(resolved.principal);
    } catch (error) {
      if (error instanceof McpAuthError) throw error;
      if (error instanceof AppError && [401, 403, 404].includes(error.status)) {
        throw authError(error.message, { status: error.status, code: error.code });
      }
      deps.logger.error({ err: error }, 'MCP API-key resolution failed');
      throw new McpAuthError('Failed to resolve API key.', {
        status: 502,
        code: 'api_key_resolution_failed',
      });
    }
  }

  async function authenticateOAuth(token: string): Promise<McpPrincipal> {
    verifier ??= createJoseMcpVerifier(oauth, deps.env.AUTH_TIMEOUT_MS);

    let payload: JWTPayload;
    try {
      payload = await verifier.verify(token);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      deps.logger.warn({ reason }, 'MCP OAuth access token validation failed');
      const expired = (error as { code?: string }).code === 'ERR_JWT_EXPIRED';
      throw authError(expired ? 'OAuth access token has expired.' : 'Invalid OAuth access token.', {
        code: expired ? 'oauth_token_expired' : 'invalid_oauth_token',
      });
    }

    const subject = String(payload.sub ?? '').trim();
    if (subject === '') {
      throw authError('OAuth access token is missing the subject claim.', {
        code: 'oauth_subject_missing',
      });
    }

    // JIT provisioning — the old backend `ResolveMcpOAuthPrincipal` parity.
    const user = await deps.users.ensureFromClaims(extractClaims(payload));
    const displayName =
      (typeof payload.name === 'string' && payload.name) ||
      (typeof payload.nickname === 'string' && payload.nickname) ||
      (typeof payload.email === 'string' && payload.email) ||
      subject;

    return buildNormalizedPrincipal({
      subjectType: 'oauth_access_token',
      lifelineUserId: user.id,
      authMethod: 'auth0_oauth',
      scopes: buildScopeList(payload),
      subjectId: subject,
      displayName,
    });
  }

  return {
    oauth,
    async authenticate(req: Request): Promise<McpPrincipal> {
      const xApiKey = req.get('x-api-key');
      if (xApiKey && xApiKey.trim() !== '') {
        return authenticateApiKey(req, xApiKey.trim());
      }

      const bearerToken = extractBearerToken(req.get('authorization'));
      if (bearerToken === null) {
        if (oauth.enabled) {
          throw new McpAuthError(
            'Missing credentials. Provide an Auth0 Bearer token or an MCP API key.',
            {
              code: 'missing_auth',
              headers: {
                'WWW-Authenticate': buildWwwAuthenticateHeader({
                  code: 'invalid_token',
                  description: 'Missing bearer token.',
                  resourceMetadataUrl,
                }),
              },
            },
          );
        }
        throw new McpAuthError('Missing API key. Provide a Bearer token or x-api-key header.', {
          code: 'missing_api_key',
        });
      }

      if (oauth.enabled && looksLikeJwt(bearerToken)) {
        return authenticateOAuth(bearerToken);
      }

      return authenticateApiKey(req, bearerToken);
    },
  };
}
