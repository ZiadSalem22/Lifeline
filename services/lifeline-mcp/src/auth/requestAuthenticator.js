import { AuthError } from '../errors.js';
import { createApiKeyAuthenticator, extractBearerToken } from './apiKeyAuth.js';
import { looksLikeJwt } from './auth0TokenVerifier.js';
import { buildOAuthMissingAuthError } from './oauthAuth.js';

function extractAuthorizationToken(req) {
  return extractBearerToken(req.get('authorization'));
}

export function createRequestAuthenticator({
  config,
  backendClient,
  apiKeyAuthenticator = createApiKeyAuthenticator({ backendClient }),
  oauthAuthenticator = null,
  resourceMetadataUrl = null,
}) {
  if (!apiKeyAuthenticator) {
    throw new Error('apiKeyAuthenticator is required to create the request authenticator');
  }

  return {
    async authenticateRequest(req) {
      const xApiKey = req.get('x-api-key');
      if (xApiKey) {
        return apiKeyAuthenticator.authenticateRequest(req);
      }

      const authorizationToken = extractAuthorizationToken(req);
      if (!authorizationToken) {
        if (config?.auth0?.enabled) {
          throw buildOAuthMissingAuthError(resourceMetadataUrl);
        }

        throw new AuthError('Missing API key. Provide a Bearer token or x-api-key header.', {
          code: 'missing_api_key',
        });
      }

      if (config?.auth0?.enabled && oauthAuthenticator && looksLikeJwt(authorizationToken)) {
        return oauthAuthenticator.authenticateAccessToken(authorizationToken);
      }

      return apiKeyAuthenticator.authenticateRequest(req);
    },
  };
}
