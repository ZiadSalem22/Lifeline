const { MCP_PRINCIPAL_HEADERS } = require('./constants');

const MCP_SUBJECT_TYPES = Object.freeze({
  API_KEY: 'api_key',
  OAUTH_ACCESS_TOKEN: 'oauth_access_token',
});

const MCP_AUTH_METHODS = Object.freeze({
  API_KEY: 'api_key',
  AUTH0_OAUTH: 'auth0_oauth',
});

function normalizePrincipalScopes(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((scope) => String(scope || '').trim()).filter(Boolean)));
  }

  if (typeof value === 'string') {
    return Array.from(new Set(value.split(',').map((scope) => scope.trim()).filter(Boolean)));
  }

  return [];
}

function buildNormalizedMcpPrincipal({
  subjectType,
  lifelineUserId,
  authMethod,
  scopes = [],
  subjectId,
  displayName = null,
}) {
  if (!subjectType || !lifelineUserId || !authMethod || !subjectId) {
    throw new Error('subjectType, lifelineUserId, authMethod, and subjectId are required to build an MCP principal');
  }

  return Object.freeze({
    subjectType: String(subjectType),
    lifelineUserId: String(lifelineUserId),
    authMethod: String(authMethod),
    scopes: normalizePrincipalScopes(scopes),
    subjectId: String(subjectId),
    displayName: displayName ? String(displayName) : null,
  });
}

function getNormalizedMcpPrincipalFromHeaders(headers = {}) {
  const lifelineUserId = headers[MCP_PRINCIPAL_HEADERS.lifelineUserId];
  if (!lifelineUserId) return null;

  return buildNormalizedMcpPrincipal({
    subjectType: headers[MCP_PRINCIPAL_HEADERS.subjectType] || MCP_SUBJECT_TYPES.API_KEY,
    lifelineUserId,
    authMethod: headers[MCP_PRINCIPAL_HEADERS.authMethod] || MCP_AUTH_METHODS.API_KEY,
    scopes: headers[MCP_PRINCIPAL_HEADERS.scopes] || '',
    subjectId: headers[MCP_PRINCIPAL_HEADERS.subjectId] || lifelineUserId,
    displayName: headers[MCP_PRINCIPAL_HEADERS.displayName] || null,
  });
}

module.exports = {
  MCP_SUBJECT_TYPES,
  MCP_AUTH_METHODS,
  buildNormalizedMcpPrincipal,
  getNormalizedMcpPrincipalFromHeaders,
  normalizePrincipalScopes,
};
