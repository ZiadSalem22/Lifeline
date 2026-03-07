const { buildNormalizedMcpPrincipal, MCP_AUTH_METHODS, MCP_SUBJECT_TYPES } = require('./principal');

function getClientIp(req) {
  const forwardedFor = req.get('x-forwarded-for');
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim() || null;
  }

  return req.ip || req.socket?.remoteAddress || null;
}

function createInternalMcpAuthHandlers({ resolveMcpApiKeyPrincipal }) {
  if (!resolveMcpApiKeyPrincipal) {
    throw new Error('resolveMcpApiKeyPrincipal is required for internal MCP auth handlers');
  }

  return {
    async resolveApiKey(req, res, next) {
      try {
        const observedClientIp = getClientIp(req);
        const observedClientUserAgent = req.get('user-agent') || null;

        const resolved = await resolveMcpApiKeyPrincipal.execute({
          apiKey: req.body?.apiKey || req.get('authorization') || req.get('x-api-key') || '',
          clientIp: observedClientIp,
          clientUserAgent: observedClientUserAgent,
        });

        const principal = buildNormalizedMcpPrincipal({
          subjectType: resolved.subjectType || MCP_SUBJECT_TYPES.API_KEY,
          lifelineUserId: resolved.lifelineUserId,
          authMethod: resolved.authMethod || MCP_AUTH_METHODS.API_KEY,
          scopes: resolved.scopes || [],
          subjectId: resolved.subjectId,
          displayName: resolved.displayName || null,
        });

        return res.json({
          principal,
          apiKey: {
            id: resolved.apiKeyId,
            name: resolved.apiKeyName,
            keyPrefix: resolved.keyPrefix,
            scopes: principal.scopes,
          },
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createInternalMcpAuthHandlers,
};
