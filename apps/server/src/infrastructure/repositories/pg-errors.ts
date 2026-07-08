/** Postgres error-code helpers shared by the drizzle repositories. */

export const PG_UNIQUE_VIOLATION = '23505';

function codeOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** True when the error (or its cause chain) is a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && current !== undefined; depth += 1) {
    if (codeOf(current) === PG_UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * The constraint/index name a 23505 fired on, walking the cause chain — lets
 * callers branch by WHICH unique index was hit (e.g. email vs auth0_sub).
 * Returns null when the error is not a unique violation or carries no name.
 */
export function uniqueViolationConstraint(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && current !== undefined; depth += 1) {
    if (codeOf(current) === PG_UNIQUE_VIOLATION) {
      const constraint = (current as { constraint?: unknown }).constraint;
      return typeof constraint === 'string' ? constraint : null;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}
