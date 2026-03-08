import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthError } from '../errors.js';

function logOAuthValidationFailure(message, details = null) {
  console.warn('[lifeline-mcp] oauth_access_token_validation_failed', {
    message,
    details,
  });
}

function normalizeScopeValues(value, separator = ' ') {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(separator)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function toPlainClaims(payload = {}) {
  return JSON.parse(JSON.stringify(payload));
}

function buildScopeList(payload = {}) {
  return Array.from(new Set([
    ...normalizeScopeValues(payload.scope, ' '),
    ...normalizeScopeValues(payload.permissions, ','),
  ]));
}

function buildTokenError(error) {
  if (error?.code === 'ERR_JWT_EXPIRED') {
    return new AuthError('OAuth access token has expired.', {
      code: 'oauth_token_expired',
    });
  }

  return new AuthError('Invalid OAuth access token.', {
    code: 'invalid_oauth_token',
    details: {
      reason: error?.message || null,
    },
  });
}

export function looksLikeJwt(token) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(token || '').trim());
}

export function createAuth0TokenVerifier({ config }) {
  if (!config?.auth0?.enabled) {
    throw new Error('Auth0 configuration is required to create the OAuth token verifier');
  }

  const jwks = createRemoteJWKSet(new URL(config.auth0.jwksUri), {
    timeoutDuration: Math.max(Number(config.requestTimeoutMs) || 5000, 1000),
  });

  return {
    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(String(token || '').trim(), jwks, {
          issuer: config.auth0.issuerUrl,
          audience: config.auth0.audiences.length <= 1 ? config.auth0.audiences[0] : config.auth0.audiences,
          algorithms: ['RS256'],
        });

        const claims = toPlainClaims(payload);
        const scopes = buildScopeList(payload);
        const subject = String(payload.sub || '').trim();
        if (!subject) {
          throw new AuthError('OAuth access token is missing the subject claim.', {
            code: 'oauth_subject_missing',
          });
        }

        return {
          token: String(token || '').trim(),
          claims,
          scopes,
          subject,
          expiresAt: typeof payload.exp === 'number' ? payload.exp : null,
          displayName: payload.name || payload.nickname || payload.email || subject,
        };
      } catch (error) {
        if (error instanceof AuthError) {
          logOAuthValidationFailure(error.code || 'auth_error', error.details || null);
          throw error;
        }

        logOAuthValidationFailure('invalid_oauth_token', {
          reason: error?.message || null,
        });
        throw buildTokenError(error);
      }
    },
  };
}
