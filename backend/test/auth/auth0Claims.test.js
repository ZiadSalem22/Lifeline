const {
  AUTH0_ROLE_CLAIM_NAMESPACE,
  LEGACY_AUTH0_ROLE_CLAIM_NAMESPACE,
  getAuth0RolesFromClaims,
  getPrimaryRoleFromRoles,
} = require('../../src/auth/auth0Claims');

describe('Auth0 role claim helpers', () => {
  it('reads roles from the canonical namespace', () => {
    const roles = getAuth0RolesFromClaims({
      [AUTH0_ROLE_CLAIM_NAMESPACE]: ['paid', 'admin'],
    });

    expect(roles).toEqual(['paid', 'admin']);
    expect(getPrimaryRoleFromRoles(roles)).toBe('admin');
  });

  it('reads roles from the legacy namespace for compatibility', () => {
    const roles = getAuth0RolesFromClaims({
      [LEGACY_AUTH0_ROLE_CLAIM_NAMESPACE]: ['paid'],
    });

    expect(roles).toEqual(['paid']);
    expect(getPrimaryRoleFromRoles(roles)).toBe('paid');
  });

  it('deduplicates roles across both namespaces', () => {
    const roles = getAuth0RolesFromClaims({
      [AUTH0_ROLE_CLAIM_NAMESPACE]: ['admin', 'paid'],
      [LEGACY_AUTH0_ROLE_CLAIM_NAMESPACE]: ['paid', 'free'],
    });

    expect(roles).toEqual(['admin', 'paid', 'free']);
    expect(getPrimaryRoleFromRoles(roles)).toBe('admin');
  });
});
