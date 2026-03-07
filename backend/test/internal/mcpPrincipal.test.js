const {
  MCP_SUBJECT_TYPES,
  MCP_AUTH_METHODS,
  buildNormalizedMcpPrincipal,
  getNormalizedMcpPrincipalFromHeaders,
} = require('../../src/internal/mcp/principal');
const { MCP_PRINCIPAL_HEADERS } = require('../../src/internal/mcp/constants');

describe('normalized MCP principal contract', () => {
  it('builds a normalized principal with stable fields', () => {
    const principal = buildNormalizedMcpPrincipal({
      subjectType: MCP_SUBJECT_TYPES.API_KEY,
      lifelineUserId: 'user-123',
      authMethod: MCP_AUTH_METHODS.API_KEY,
      scopes: ['tasks:read', 'tasks:write'],
      subjectId: 'key-123',
      displayName: 'Desktop CLI key',
    });

    expect(principal.subjectType).toBe('api_key');
    expect(principal.lifelineUserId).toBe('user-123');
    expect(principal.authMethod).toBe('api_key');
    expect(principal.scopes).toEqual(['tasks:read', 'tasks:write']);
    expect(principal.subjectId).toBe('key-123');
    expect(principal.displayName).toBe('Desktop CLI key');
  });

  it('can derive a normalized principal from internal headers', () => {
    const principal = getNormalizedMcpPrincipalFromHeaders({
      [MCP_PRINCIPAL_HEADERS.subjectType]: MCP_SUBJECT_TYPES.OAUTH_ACCESS_TOKEN,
      [MCP_PRINCIPAL_HEADERS.lifelineUserId]: 'user-456',
      [MCP_PRINCIPAL_HEADERS.authMethod]: MCP_AUTH_METHODS.AUTH0_OAUTH,
      [MCP_PRINCIPAL_HEADERS.scopes]: 'tasks:read,tasks:write',
      [MCP_PRINCIPAL_HEADERS.subjectId]: 'oauth-subject-1',
      [MCP_PRINCIPAL_HEADERS.displayName]: 'Auth0 token subject',
    });

    expect(principal).toEqual({
      subjectType: 'oauth_access_token',
      lifelineUserId: 'user-456',
      authMethod: 'auth0_oauth',
      scopes: ['tasks:read', 'tasks:write'],
      subjectId: 'oauth-subject-1',
      displayName: 'Auth0 token subject',
    });
  });

  it('returns null when no Lifeline user id header is present', () => {
    expect(getNormalizedMcpPrincipalFromHeaders({})).toBeNull();
  });
});
