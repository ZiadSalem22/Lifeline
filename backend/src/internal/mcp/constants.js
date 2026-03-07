const INTERNAL_MCP_SHARED_SECRET_HEADER = 'x-lifeline-internal-service-secret';
const INTERNAL_MCP_SERVICE_NAME = 'lifeline-mcp';
const MCP_INTERNAL_SHARED_SECRET_ENV = 'MCP_INTERNAL_SHARED_SECRET';

const MCP_PRINCIPAL_HEADERS = Object.freeze({
  subjectType: 'x-lifeline-principal-subject-type',
  lifelineUserId: 'x-lifeline-principal-user-id',
  authMethod: 'x-lifeline-principal-auth-method',
  scopes: 'x-lifeline-principal-scopes',
  subjectId: 'x-lifeline-principal-subject-id',
  displayName: 'x-lifeline-principal-display-name',
});

module.exports = {
  INTERNAL_MCP_SHARED_SECRET_HEADER,
  INTERNAL_MCP_SERVICE_NAME,
  MCP_INTERNAL_SHARED_SECRET_ENV,
  MCP_PRINCIPAL_HEADERS,
};
