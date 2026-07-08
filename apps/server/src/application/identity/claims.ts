import { ROLES, type Role } from '@lifeline/shared';
import type { AuthClaims } from '../ports.js';

/**
 * Auth0 claim extraction (audit-auth.md §1). Role claims live in two custom
 * namespaces (primary + legacy), merged and deduped. Role precedence:
 * admin > paid > free (default free).
 */

export const ROLE_CLAIM_NAMESPACES = [
  'https://lifeline-api/roles',
  'https://lifeline.app/roles',
] as const;

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry !== '');
}

/** Highest-precedence role carried by the claims; 'free' when none match. */
export function pickPrimaryRole(roles: readonly string[]): Role {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('paid')) return 'paid';
  return 'free';
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Extract identity claims from a verified JWT payload. `hasRoleClaims` is true
 * only when at least one role is present — an absent (or empty) roles claim
 * must NOT clobber a DB-promoted role (decisions #5).
 */
export function extractClaims(payload: Record<string, unknown>): AuthClaims {
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const roles = [
    ...new Set(ROLE_CLAIM_NAMESPACES.flatMap((namespace) => stringArray(payload[namespace]))),
  ];
  return {
    sub,
    email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
    name: typeof payload.name === 'string' ? payload.name : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
    roles,
    hasRoleClaims: roles.length > 0,
  };
}
