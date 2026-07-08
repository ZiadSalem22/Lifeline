import { Router, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Env } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import type {
  ProfileRepository,
  SettingsRepository,
  TodoRepository,
  UserRepository,
} from '../application/ports.js';
import type { ResolveKeyPrincipal } from '../application/mcp-keys/resolve-key-principal.js';
import {
  createMcpAuthenticator,
  resolveMcpOAuthConfig,
  type McpOAuthConfig,
  type McpTokenVerifier,
} from './auth.js';
import { McpError, toJsonRpcErrorCode } from './errors.js';
import { createMcpRateLimiter, type McpRateLimitOptions } from './rate-limit.js';
import { buildMcpServer } from './server.js';
import { McpToolService, type McpServiceDeps } from './service.js';

/**
 * The embedded MCP HTTP surface, ported from the old
 * `services/lifeline-mcp/src/app.js` — mounted on the MAIN server at
 * `POST /mcp` (public route with its own dual auth; NOT behind the /api/v1
 * gate):
 *
 * - Stateless streamable HTTP: per-request McpServer + transport
 *   (`sessionIdGenerator: undefined`, JSON responses), both closed in finally.
 * - authenticate → per-principal rate limit (fixes the old anonymous-bucket
 *   bug) → handle. Auth/rate-limit failures are JSON-RPC error envelopes.
 * - Non-POST /mcp → 405 JSON-RPC error (old parity).
 * - OAuth protected-resource metadata router mounted when Auth0 is configured.
 */

export interface McpRouterDeps {
  env: Env;
  logger: Logger;
  useCases: McpServiceDeps['useCases'] & { resolveKeyPrincipal: ResolveKeyPrincipal };
  repos: {
    users: Pick<UserRepository, 'findById' | 'ensureFromClaims'>;
    profiles: Pick<ProfileRepository, 'get'>;
    settings: Pick<SettingsRepository, 'get'>;
    todos: Pick<TodoRepository, 'listAll'>;
  };
}

export interface McpRouterOptions {
  rateLimit?: McpRateLimitOptions | undefined;
  /** Injectable OAuth token verifier for tests. */
  verifier?: McpTokenVerifier | undefined;
  now?: (() => Date) | undefined;
}

function writeJsonRpcError(
  res: Response,
  {
    status,
    code,
    message,
    rpcCode,
  }: { status: number; code: string; message: string; rpcCode?: number | undefined },
  headers: Record<string, string> | null = null,
): void {
  if (res.headersSent) return;
  if (headers !== null) {
    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (headerValue) res.set(headerName, headerValue);
    }
  }
  res.status(status).json({
    jsonrpc: '2.0',
    error: {
      code: rpcCode ?? toJsonRpcErrorCode(status),
      message,
      data: { code, status },
    },
    id: null,
  });
}

/** Old `config.js` buildAuth0OAuthMetadata parity (Auth0 endpoint layout). */
export function buildOAuthMetadata(oauth: McpOAuthConfig): OAuthMetadata | null {
  if (!oauth.enabled || oauth.issuerUrl === null) return null;
  const issuerUrl = new URL(oauth.issuerUrl);
  return {
    issuer: issuerUrl.href,
    authorization_endpoint: new URL('/authorize', issuerUrl).href,
    token_endpoint: new URL('/oauth/token', issuerUrl).href,
    jwks_uri: new URL('/.well-known/jwks.json', issuerUrl).href,
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    ...(oauth.supportedScopes.length > 0 ? { scopes_supported: oauth.supportedScopes } : {}),
    revocation_endpoint: new URL('/oauth/revoke', issuerUrl).href,
  };
}

/** Base URL the protected-resource metadata advertises for this server. */
export function resolveMcpPublicBaseUrl(env: Pick<Env, 'MCP_PUBLIC_BASE_URL' | 'PORT'>): string {
  return env.MCP_PUBLIC_BASE_URL ?? `http://127.0.0.1:${env.PORT}`;
}

export function buildMcpRouter(deps: McpRouterDeps, options: McpRouterOptions = {}): Router {
  const { env, logger } = deps;
  const router = Router();

  const oauth = resolveMcpOAuthConfig(env);
  const resourceServerUrl = new URL('/mcp', resolveMcpPublicBaseUrl(env));
  const resourceMetadataUrl = oauth.enabled
    ? getOAuthProtectedResourceMetadataUrl(resourceServerUrl)
    : null;

  const authenticator = createMcpAuthenticator({
    env,
    logger,
    resolveKeyPrincipal: deps.useCases.resolveKeyPrincipal,
    users: deps.repos.users,
    verifier: options.verifier,
    resourceMetadataUrl,
  });

  const rateLimiter = createMcpRateLimiter(options.rateLimit ?? {});

  const oauthMetadata = buildOAuthMetadata(oauth);
  if (oauth.enabled && oauthMetadata !== null) {
    router.use(
      mcpAuthMetadataRouter({
        oauthMetadata,
        resourceServerUrl,
        scopesSupported: oauth.supportedScopes,
        resourceName: 'Lifeline MCP',
      }),
    );
  }

  const serviceDeps: McpServiceDeps = {
    useCases: deps.useCases,
    repos: deps.repos,
    now: options.now,
  };

  router.post('/mcp', async (req, res) => {
    let server: ReturnType<typeof buildMcpServer> | null = null;
    let transport: StreamableHTTPServerTransport | null = null;

    try {
      const principal = await authenticator.authenticate(req);

      const decision = rateLimiter.hit(`${principal.subjectType}:${principal.subjectId}`);
      if (!decision.allowed) {
        res.set('Retry-After', String(decision.retryAfterSeconds ?? 1));
        // Old rateLimiter.js parity: JSON-RPC code -32000 for rate limiting.
        writeJsonRpcError(res, {
          status: 429,
          code: 'rate_limited',
          message: 'Too many requests. Please retry later.',
          rpcCode: -32000,
        });
        return;
      }

      const service = new McpToolService(serviceDeps, principal.lifelineUserId);
      server = buildMcpServer({ principal, service });
      // Stateless mode: no sessionIdGenerator (old `sessionIdGenerator: undefined`).
      transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true,
      });

      // Cast: the SDK's own Transport optionals clash with exactOptionalPropertyTypes.
      await server.connect(transport as unknown as Transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (error instanceof McpError) {
        writeJsonRpcError(
          res,
          { status: error.status, code: error.code, message: error.message },
          error.headers,
        );
      } else {
        logger.error({ err: error }, 'MCP request failed');
        writeJsonRpcError(res, {
          status: 500,
          code: 'internal_error',
          message: error instanceof Error ? error.message : 'Internal server error',
        });
      }
    } finally {
      if (transport !== null) await transport.close().catch(() => undefined);
      if (server !== null) await server.close().catch(() => undefined);
    }
  });

  router.all('/mcp', (req, res) => {
    res
      .status(405)
      .set('Allow', 'POST')
      .json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `Method ${req.method} not allowed.`,
          data: { code: 'method_not_allowed', status: 405 },
        },
        id: null,
      });
  });

  return router;
}
