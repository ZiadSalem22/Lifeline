import { LIFELINE_MCP_SCOPES } from '../constants.js';
import { AuthError, ScopeError } from '../errors.js';

export function normalizePrincipalScopes(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((scope) => String(scope || '').trim()).filter(Boolean)));
  }

  if (typeof value === 'string') {
    return Array.from(new Set(value.split(',').map((scope) => scope.trim()).filter(Boolean)));
  }

  return [];
}

export function buildNormalizedLifelinePrincipal({
  subjectType,
  lifelineUserId,
  authMethod,
  scopes = [],
  subjectId,
  displayName = null,
}) {
  if (!subjectType || !lifelineUserId || !authMethod || !subjectId) {
    throw new AuthError('Resolved principal is incomplete.', {
      status: 500,
      code: 'principal_invalid',
    });
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

function matchesScope(grantedScope, requiredScope) {
  if (!grantedScope || !requiredScope) return false;
  if (grantedScope === requiredScope) return true;
  if (grantedScope === LIFELINE_MCP_SCOPES.ALL) return true;
  if (grantedScope === LIFELINE_MCP_SCOPES.TASKS_ALL && requiredScope.startsWith('tasks:')) return true;
  return false;
}

export function hasRequiredScope(principal, requiredScopes = []) {
  const normalizedRequiredScopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
  const grantedScopes = normalizePrincipalScopes(principal?.scopes || []);

  return normalizedRequiredScopes.some((requiredScope) => grantedScopes.some((grantedScope) => matchesScope(grantedScope, requiredScope)));
}

export function assertPrincipalScopes(principal, requiredScopes = []) {
  const normalizedRequiredScopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
  if (normalizedRequiredScopes.length === 0) return;

  if (!hasRequiredScope(principal, normalizedRequiredScopes)) {
    throw new ScopeError(`API key is missing required scope: ${normalizedRequiredScopes.join(' or ')}.`);
  }
}
