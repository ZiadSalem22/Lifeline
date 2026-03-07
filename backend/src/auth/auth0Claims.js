const AUTH0_ROLE_CLAIM_NAMESPACE = 'https://lifeline-api/roles';
const LEGACY_AUTH0_ROLE_CLAIM_NAMESPACE = 'https://lifeline.app/roles';
const AUTH0_ROLE_CLAIM_NAMESPACES = [AUTH0_ROLE_CLAIM_NAMESPACE, LEGACY_AUTH0_ROLE_CLAIM_NAMESPACE];

function normalizeRoles(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((role) => String(role || '').trim()).filter(Boolean)));
}

function getAuth0RolesFromClaims(claims = {}) {
  const merged = [];
  for (const claimName of AUTH0_ROLE_CLAIM_NAMESPACES) {
    merged.push(...normalizeRoles(claims[claimName]));
  }
  return Array.from(new Set(merged));
}

function getPrimaryRoleFromRoles(roles = []) {
  const normalizedRoles = normalizeRoles(roles);
  if (normalizedRoles.includes('admin')) return 'admin';
  if (normalizedRoles.includes('paid')) return 'paid';
  if (normalizedRoles.includes('free')) return 'free';
  return 'free';
}

module.exports = {
  AUTH0_ROLE_CLAIM_NAMESPACE,
  LEGACY_AUTH0_ROLE_CLAIM_NAMESPACE,
  AUTH0_ROLE_CLAIM_NAMESPACES,
  getAuth0RolesFromClaims,
  getPrimaryRoleFromRoles,
  normalizeRoles,
};
