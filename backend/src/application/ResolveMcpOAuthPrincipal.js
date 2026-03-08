const { AppError } = require('../utils/errors');
const {
  buildNormalizedMcpPrincipal,
  MCP_AUTH_METHODS,
  MCP_SUBJECT_TYPES,
  normalizePrincipalScopes,
} = require('../internal/mcp/principal');

class ResolveMcpOAuthPrincipal {
  constructor({ userRepository }) {
    if (!userRepository) {
      throw new Error('userRepository is required');
    }

    this.userRepository = userRepository;
  }

  async execute({ claims, scopes = [] }) {
    const normalizedClaims = claims && typeof claims === 'object' && !Array.isArray(claims)
      ? { ...claims }
      : null;

    if (!normalizedClaims) {
      throw new AppError('OAuth claims payload is required.', 400);
    }

    const subjectId = String(normalizedClaims.sub || '').trim();
    if (!subjectId) {
      throw new AppError('OAuth token subject is required.', 400);
    }

    const user = await this.userRepository.ensureUserFromAuth0Claims({
      ...normalizedClaims,
      sub: subjectId,
    });

    const lifelineUserId = user?.id || subjectId;
    const displayName = user?.name || normalizedClaims.name || normalizedClaims.email || subjectId;

    return buildNormalizedMcpPrincipal({
      subjectType: MCP_SUBJECT_TYPES.OAUTH_ACCESS_TOKEN,
      lifelineUserId,
      authMethod: MCP_AUTH_METHODS.AUTH0_OAUTH,
      scopes: normalizePrincipalScopes(scopes),
      subjectId,
      displayName,
    });
  }
}

module.exports = {
  ResolveMcpOAuthPrincipal,
};
