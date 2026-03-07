const { AppError } = require('../../utils/errors');
const { getNormalizedMcpPrincipalFromHeaders } = require('./principal');

function requireInternalMcpPrincipal() {
  return function internalMcpPrincipalMiddleware(req, res, next) {
    try {
      const principal = getNormalizedMcpPrincipalFromHeaders(req.headers || {});
      if (!principal || !principal.lifelineUserId) {
        return next(new AppError('Missing internal principal context.', 401));
      }

      req.mcpPrincipal = principal;
      return next();
    } catch (_error) {
      return next(new AppError('Invalid internal principal context.', 400));
    }
  };
}

module.exports = {
  requireInternalMcpPrincipal,
};
