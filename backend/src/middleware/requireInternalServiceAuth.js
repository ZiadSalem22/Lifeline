const crypto = require('crypto');
const { AppError } = require('../utils/errors');
const {
  INTERNAL_MCP_SHARED_SECRET_HEADER,
  INTERNAL_MCP_SERVICE_NAME,
  MCP_INTERNAL_SHARED_SECRET_ENV,
} = require('../internal/mcp/constants');

function hasMatchingSecret(providedSecret, configuredSecret) {
  if (!providedSecret || !configuredSecret) return false;

  const provided = Buffer.from(String(providedSecret));
  const configured = Buffer.from(String(configuredSecret));
  if (provided.length !== configured.length) return false;

  return crypto.timingSafeEqual(provided, configured);
}

function requireInternalServiceAuth() {
  return function internalServiceAuthMiddleware(req, res, next) {
    const configuredSecret = process.env[MCP_INTERNAL_SHARED_SECRET_ENV] || '';
    if (!configuredSecret) {
      return next(new AppError('Internal MCP service auth is not configured.', 503));
    }

    const providedSecret = req.get(INTERNAL_MCP_SHARED_SECRET_HEADER);
    if (!providedSecret) {
      return next(new AppError('Missing internal service authentication.', 401));
    }

    if (!hasMatchingSecret(providedSecret, configuredSecret)) {
      return next(new AppError('Invalid internal service authentication.', 401));
    }

    req.internalServiceAuth = Object.freeze({
      isAuthenticated: true,
      service: INTERNAL_MCP_SERVICE_NAME,
      authMethod: 'shared_secret_header',
      authenticatedAt: new Date().toISOString(),
    });

    return next();
  };
}

module.exports = {
  requireInternalServiceAuth,
  hasMatchingSecret,
};
