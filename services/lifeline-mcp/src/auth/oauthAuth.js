import { buildNormalizedLifelinePrincipal } from './principal.js';
import { AuthError, BackendAdapterError } from '../errors.js';

function logOAuthAuthFailure(message, details = null) {
  console.warn('[lifeline-mcp] oauth_principal_authentication_failed', {
    message,
    details,
  });
}

function escapeAuthenticateValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildWwwAuthenticateHeader({ code = 'invalid_token', description, resourceMetadataUrl }) {
  const parts = [`Bearer error="${escapeAuthenticateValue(code)}"`];

  if (description) {
    parts.push(`error_description="${escapeAuthenticateValue(description)}"`);
  }

  if (resourceMetadataUrl) {
    parts.push(`resource_metadata="${escapeAuthenticateValue(resourceMetadataUrl)}"`);
  }

  return parts.join(', ');
}

function toAuthError(message, { code, status = 401, details = null, resourceMetadataUrl }) {
  return new AuthError(message, {
    status,
    code,
    details,
    headers: {
      'WWW-Authenticate': buildWwwAuthenticateHeader({ code: 'invalid_token', description: message, resourceMetadataUrl }),
    },
  });
}

export function createOAuthAuthenticator({ backendClient, tokenVerifier, resourceMetadataUrl }) {
  if (!backendClient) {
    throw new Error('backendClient is required to create the OAuth authenticator');
  }

  if (!tokenVerifier) {
    throw new Error('tokenVerifier is required to create the OAuth authenticator');
  }

  return {
    async authenticateAccessToken(accessToken) {
      try {
        const verifiedToken = await tokenVerifier.verifyAccessToken(accessToken);
        const resolved = await backendClient.resolveOAuthPrincipal({
          claims: verifiedToken.claims,
          scopes: verifiedToken.scopes,
        });

        return {
          principal: buildNormalizedLifelinePrincipal(resolved.principal || resolved),
          oauth: verifiedToken,
        };
      } catch (error) {
        if (error instanceof AuthError) {
          logOAuthAuthFailure(error.code || 'invalid_oauth_token', error.details || null);
          throw toAuthError(error.message, {
            code: error.code || 'invalid_oauth_token',
            status: error.status || 401,
            details: error.details || null,
            resourceMetadataUrl,
          });
        }

        if (error instanceof BackendAdapterError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            logOAuthAuthFailure(error.code || 'oauth_principal_rejected', error.details || null);
            throw toAuthError(error.message, {
              code: error.code || 'oauth_principal_rejected',
              status: error.status,
              details: error.details || null,
              resourceMetadataUrl,
            });
          }
        }

        logOAuthAuthFailure('oauth_principal_resolution_failed', error?.details || {
          reason: error?.message || null,
        });

        throw new AuthError('Failed to resolve OAuth principal.', {
          status: 502,
          code: 'oauth_principal_resolution_failed',
          details: error?.details || null,
          cause: error,
          headers: {
            'WWW-Authenticate': buildWwwAuthenticateHeader({
              code: 'server_error',
              description: 'Failed to resolve OAuth principal.',
              resourceMetadataUrl,
            }),
          },
        });
      }
    },
  };
}

export function buildOAuthMissingAuthError(resourceMetadataUrl) {
  logOAuthAuthFailure('missing_auth');

  return new AuthError('Missing credentials. Provide an Auth0 Bearer token or an MCP API key.', {
    code: 'missing_auth',
    headers: {
      'WWW-Authenticate': buildWwwAuthenticateHeader({
        code: 'invalid_token',
        description: 'Missing bearer token.',
        resourceMetadataUrl,
      }),
    },
  });
}
