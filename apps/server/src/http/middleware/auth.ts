import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { GUEST_LOGIN_REQUIRED_MESSAGE } from '@lifeline/shared';
import { AppError, ForbiddenError, UnauthorizedError } from '../../domain/errors.js';
import { extractClaims } from '../../application/identity/claims.js';
import type {
  AuthClaims,
  CurrentUser,
  ProfileRepository,
  SettingsRepository,
  UserRepository,
} from '../../application/ports.js';
import type { Env } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';

/**
 * Authentication middleware (audit-auth.md semantics, jose-based):
 * - AUTH_DISABLED='1' → attach a deterministic local user (guest/compose mode).
 * - Otherwise verify the Bearer JWT against the Auth0 JWKS (RS256, issuer
 *   `https://{domain}/`, configured audiences) with an AbortSignal timeout of
 *   AUTH_TIMEOUT_MS → 503 on timeout, 401 on invalid, 401 + guest message on
 *   missing.
 * - On success the user row is upserted from claims (role synced only when
 *   the token carries role claims — decisions #5), profile + settings loaded,
 *   and `req.currentUser` attached.
 */

export interface TokenVerifier {
  verify(token: string): Promise<JWTPayload>;
}

export interface AuthDeps {
  users: UserRepository;
  profiles: ProfileRepository;
  settings: SettingsRepository;
  logger: Logger;
  /** Injectable for tests; defaults to the jose remote-JWKS verifier. */
  verifier?: TokenVerifier | undefined;
}

class AuthTimeoutError extends Error {
  constructor() {
    super('Authentication timed out');
    this.name = 'AuthTimeoutError';
  }
}

const AUTH_UNAVAILABLE = 'Authentication service temporarily unavailable';

export function createJoseVerifier(
  env: Pick<Env, 'AUTH0_DOMAIN' | 'AUTH0_AUDIENCES' | 'AUTH_TIMEOUT_MS'>,
): TokenVerifier {
  if (env.AUTH0_DOMAIN === null) {
    throw new Error('createJoseVerifier requires AUTH0_DOMAIN');
  }
  const domain = env.AUTH0_DOMAIN;
  const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`), {
    timeoutDuration: env.AUTH_TIMEOUT_MS,
  });
  return {
    async verify(token: string): Promise<JWTPayload> {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `https://${domain}/`,
        algorithms: ['RS256'],
        ...(env.AUTH0_AUDIENCES.length > 0 ? { audience: env.AUTH0_AUDIENCES } : {}),
      });
      return payload;
    },
  };
}

/** Race verification against an AbortSignal timeout (full-lifecycle budget). */
async function verifyWithTimeout(
  verifier: TokenVerifier,
  token: string,
  timeoutMs: number,
): Promise<JWTPayload> {
  const signal = AbortSignal.timeout(timeoutMs);
  return await new Promise<JWTPayload>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new AuthTimeoutError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    verifier.verify(token).then(
      (payload) => {
        signal.removeEventListener('abort', onAbort);
        resolve(payload);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function buildCurrentUser(deps: AuthDeps, claims: AuthClaims): Promise<CurrentUser> {
  const row = await deps.users.ensureFromClaims(claims);
  const [profile, settings] = await Promise.all([
    deps.profiles.get(row.id),
    deps.settings.get(row.id),
  ]);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    role: row.role,
    // Claim roles when present; else surface the DB role so DB-promoted
    // admins still satisfy requireRole('admin').
    roles: claims.roles.length > 0 ? [...new Set(claims.roles)] : [row.role],
    subscriptionStatus: row.subscriptionStatus,
    profile,
    settings,
  };
}

export function buildAuthMiddleware(env: Env, deps: AuthDeps): RequestHandler {
  let verifier = deps.verifier ?? null;

  return async (req, _res, next) => {
    try {
      if (env.AUTH_DISABLED) {
        req.currentUser = await buildCurrentUser(deps, {
          sub: env.AUTH_LOCAL_USER_ID,
          email: null,
          name: 'Local User',
          picture: null,
          roles: [],
          hasRoleClaims: false,
        });
        next();
        return;
      }

      const header = req.headers.authorization;
      if (header === undefined || !header.startsWith('Bearer ') || header.slice(7).trim() === '') {
        throw new UnauthorizedError(GUEST_LOGIN_REQUIRED_MESSAGE);
      }
      const token = header.slice(7).trim();

      if (env.AUTH0_DOMAIN === null && verifier === null) {
        // Boot validation forbids this in production; dev misconfiguration.
        throw new AppError(503, 'internal', AUTH_UNAVAILABLE);
      }
      verifier ??= createJoseVerifier(env);

      let payload: JWTPayload;
      try {
        payload = await verifyWithTimeout(verifier, token, env.AUTH_TIMEOUT_MS);
      } catch (error) {
        if (error instanceof AuthTimeoutError || (error as Error).name === 'JWKSTimeout') {
          deps.logger.warn({ err: error }, 'Auth verification timed out');
          throw new AppError(503, 'internal', AUTH_UNAVAILABLE);
        }
        throw new UnauthorizedError('Invalid or expired token.');
      }

      const claims = extractClaims(payload);
      if (claims.sub === '') {
        throw new UnauthorizedError('Invalid or expired token.');
      }

      req.currentUser = await buildCurrentUser(deps, claims);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** 401 (guest message) unless an authenticated user is attached. */
export function requireAuth(): RequestHandler {
  return (req, _res, next) => {
    if (!req.currentUser?.id) {
      next(new UnauthorizedError(GUEST_LOGIN_REQUIRED_MESSAGE));
      return;
    }
    next();
  };
}

/** 403 unless the current user carries the role (claims or DB). */
export function requireRole(role: string): RequestHandler {
  return (req, _res, next) => {
    const user = req.currentUser;
    if (!user?.id) {
      next(new UnauthorizedError(GUEST_LOGIN_REQUIRED_MESSAGE));
      return;
    }
    if (user.role !== role && !user.roles.includes(role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

/** 403 unless paid or admin. */
export function requirePaid(): RequestHandler {
  return (req, _res, next) => {
    const user = req.currentUser;
    if (!user?.id) {
      next(new UnauthorizedError(GUEST_LOGIN_REQUIRED_MESSAGE));
      return;
    }
    const allowed =
      user.role === 'paid' ||
      user.role === 'admin' ||
      user.roles.includes('paid') ||
      user.roles.includes('admin');
    if (!allowed) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// JWKS warm-up + readiness (surfaced by GET /health/ready)
// ---------------------------------------------------------------------------

export interface AuthReadiness {
  ready: boolean;
  jwksWarmedUp: boolean;
  bypassed: boolean;
  configured: boolean;
  lastError: string | null;
}

export class AuthState {
  private jwksWarmedUp = false;
  private lastError: string | null = null;

  constructor(
    private readonly env: Pick<Env, 'AUTH_DISABLED' | 'AUTH0_DOMAIN' | 'AUTH_TIMEOUT_MS'>,
  ) {}

  /**
   * Fetch the OpenID configuration and JWKS once so the first authenticated
   * request doesn't pay the discovery latency. Non-fatal: failures are logged
   * and reflected in readiness, never thrown.
   */
  async warmUp(logger: Logger): Promise<void> {
    if (this.env.AUTH_DISABLED || this.env.AUTH0_DOMAIN === null) return;
    const timeout = (): AbortSignal => AbortSignal.timeout(this.env.AUTH_TIMEOUT_MS);
    try {
      const discoveryUrl = `https://${this.env.AUTH0_DOMAIN}/.well-known/openid-configuration`;
      const discoveryResponse = await fetch(discoveryUrl, { signal: timeout() });
      if (!discoveryResponse.ok) {
        throw new Error(`openid-configuration returned ${discoveryResponse.status}`);
      }
      const discovery = (await discoveryResponse.json()) as { jwks_uri?: unknown };
      const jwksUri =
        typeof discovery.jwks_uri === 'string'
          ? discovery.jwks_uri
          : `https://${this.env.AUTH0_DOMAIN}/.well-known/jwks.json`;
      const jwksResponse = await fetch(jwksUri, { signal: timeout() });
      if (!jwksResponse.ok) {
        throw new Error(`jwks fetch returned ${jwksResponse.status}`);
      }
      await jwksResponse.json();
      this.jwksWarmedUp = true;
      this.lastError = null;
      logger.info({ domain: this.env.AUTH0_DOMAIN }, 'Auth JWKS warmed up');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      logger.warn({ err: error }, 'Auth JWKS warm-up failed (non-fatal)');
    }
  }

  getReadiness(): AuthReadiness {
    if (this.env.AUTH_DISABLED) {
      return {
        ready: true,
        jwksWarmedUp: false,
        bypassed: true,
        configured: false,
        lastError: null,
      };
    }
    const configured = this.env.AUTH0_DOMAIN !== null;
    return {
      ready: configured && this.jwksWarmedUp,
      jwksWarmedUp: this.jwksWarmedUp,
      bypassed: false,
      configured,
      lastError: this.lastError,
    };
  }
}

export function createAuthState(
  env: Pick<Env, 'AUTH_DISABLED' | 'AUTH0_DOMAIN' | 'AUTH_TIMEOUT_MS'>,
): AuthState {
  return new AuthState(env);
}
