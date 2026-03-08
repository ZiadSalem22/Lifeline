import { AuthError, BackendAdapterError } from '../errors.js';
import { buildNormalizedLifelinePrincipal } from './principal.js';

export function extractBearerToken(headerValue) {
  if (!headerValue) return null;
  const normalized = String(headerValue).trim();
  if (!normalized) return null;

  const match = /^Bearer\s+(.+)$/i.exec(normalized);
  return match ? match[1].trim() : normalized;
}

export function extractClientIp(req) {
  const forwardedFor = req.get('x-forwarded-for');
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim() || null;
  }

  return req.ip || req.socket?.remoteAddress || null;
}

export function extractPresentedApiKey(req) {
  const authorization = req.get('authorization');
  const xApiKey = req.get('x-api-key');
  return extractBearerToken(authorization) || (xApiKey ? String(xApiKey).trim() : null);
}

export function createApiKeyAuthenticator({ backendClient }) {
  if (!backendClient) {
    throw new Error('backendClient is required to create the API key authenticator');
  }

  return {
    async authenticateRequest(req) {
      const presentedApiKey = extractPresentedApiKey(req);
      if (!presentedApiKey) {
        throw new AuthError('Missing API key. Provide a Bearer token or x-api-key header.', {
          code: 'missing_api_key',
        });
      }

      try {
        const resolved = await backendClient.resolveApiKey(presentedApiKey, {
          clientIp: extractClientIp(req),
          clientUserAgent: req.get('user-agent') || null,
        });

        return {
          principal: buildNormalizedLifelinePrincipal(resolved.principal || resolved),
          apiKey: resolved.apiKey || null,
        };
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }

        if (error instanceof BackendAdapterError) {
          if (error.status === 401 || error.status === 403 || error.status === 404) {
            throw new AuthError(error.message, {
              status: error.status,
              code: error.code || 'api_key_rejected',
              details: error.details,
            });
          }
        }

        throw new AuthError('Failed to resolve API key.', {
          status: 502,
          code: 'api_key_resolution_failed',
          details: error?.details || null,
          cause: error,
        });
      }
    },
  };
}
