export const INTERNAL_MCP_SHARED_SECRET_HEADER = 'x-lifeline-internal-service-secret';

export const MCP_PRINCIPAL_HEADERS = Object.freeze({
  subjectType: 'x-lifeline-principal-subject-type',
  lifelineUserId: 'x-lifeline-principal-user-id',
  authMethod: 'x-lifeline-principal-auth-method',
  scopes: 'x-lifeline-principal-scopes',
  subjectId: 'x-lifeline-principal-subject-id',
  displayName: 'x-lifeline-principal-display-name',
});

export const LIFELINE_MCP_SCOPES = Object.freeze({
  TASKS_READ: 'tasks:read',
  TASKS_WRITE: 'tasks:write',
  TASKS_ALL: 'tasks:*',
  ALL: '*',
});
