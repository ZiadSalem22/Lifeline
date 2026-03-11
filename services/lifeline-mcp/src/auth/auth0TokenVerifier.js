import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
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

function buildUntrustedTokenSummary(token) {
  if (!looksLikeJwt(token)) return null;

  try {
    const payload = decodeJwt(String(token || '').trim());

    return {
      issuer: typeof payload.iss === 'string' ? payload.iss : null,
      audience: Array.isArray(payload.aud)
        ? payload.aud.map((entry) => String(entry || '').trim()).filter(Boolean)
        : (payload.aud ? [String(payload.aud).trim()] : []),
      authorizedParty: typeof payload.azp === 'string' ? payload.azp : null,
      scope: typeof payload.scope === 'string' ? payload.scope : null,
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [],
      hasSubject: Boolean(payload.sub),
    };
  } catch {
    return null;
  }
}

function buildTokenError(error, { token, config }) {
  const reason = error?.message || null;
  const details = {
    reason,
    expectedIssuer: config?.auth0?.issuerUrl || null,
    expectedAudiences: Array.isArray(config?.auth0?.audiences) ? config.auth0.audiences : [],
    untrustedToken: buildUntrustedTokenSummary(token),
  };

  if (error?.code === 'ERR_JWT_EXPIRED') {
    return new AuthError('OAuth access token has expired.', {
      code: 'oauth_token_expired',
      details,
    });
  }

  if (/unexpected\s+"aud"\s+claim\s+value/i.test(reason || '')) {
    return new AuthError('OAuth access token audience does not match the Lifeline API.', {
      code: 'invalid_oauth_token',
      details,
    });
  }

  if (/unexpected\s+"iss"\s+claim\s+value/i.test(reason || '')) {
    return new AuthError('OAuth access token issuer does not match the configured Auth0 tenant.', {
      code: 'invalid_oauth_token',
      details,
    });
  }

  return new AuthError('Invalid OAuth access token.', {
    code: 'invalid_oauth_token',
    details,
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

        const tokenError = buildTokenError(error, { token, config });
        logOAuthValidationFailure(tokenError.code || 'invalid_oauth_token', tokenError.details || null);
        throw tokenError;
      }
    },
  };
}
