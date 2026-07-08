import { eq } from 'drizzle-orm';
import { ConflictError } from '../../domain/errors.js';
import { isRole, pickPrimaryRole } from '../../application/identity/claims.js';
import type {
  AuthClaims,
  EnsureFromClaimsOptions,
  UserRecord,
  UserRepository,
} from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { users } from '../db/schema.js';
import { isUniqueViolation, uniqueViolationConstraint } from './pg-errors.js';

type UserRow = typeof users.$inferSelect;

/** Partial unique index names on `users` (see db/schema.ts). */
const EMAIL_UNIQUE_INDEX = 'ux_users_email_not_null';
const AUTH0_SUB_UNIQUE_INDEX = 'ux_users_auth0_sub';

/** Minimal logger surface — satisfied by the pino Logger; optional in tests. */
export interface UserRepoLogger {
  warn(obj: unknown, msg?: string): void;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    auth0Sub: row.auth0Sub,
    email: row.email,
    name: row.name,
    picture: row.picture,
    role: isRole(row.role) ? row.role : 'free',
    subscriptionStatus: row.subscriptionStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(
    private readonly db: Db,
    private readonly logger?: UserRepoLogger,
  ) {}

  async ensureFromClaims(
    claims: AuthClaims,
    options?: EnsureFromClaimsOptions,
  ): Promise<UserRecord> {
    const syncRoleOnlyWhenPresent = options?.syncRoleOnlyWhenPresent ?? true;
    const email = claims.email === null ? null : claims.email.toLowerCase();
    const claimRole = pickPrimaryRole(claims.roles);
    const syncRole = claims.hasRoleClaims || !syncRoleOnlyWhenPresent;

    try {
      return await this.upsertById(claims, email, claimRole, syncRole);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const constraint = uniqueViolationConstraint(error);

      // Conflict target is users.id only, so a violation on either partial
      // unique index (email or auth0_sub) escapes ON CONFLICT and — left
      // unhandled — 500s EVERY request for the affected identity (login
      // lockout, round2 finding #2). Recover per index instead.
      if (constraint === EMAIL_UNIQUE_INDEX || (constraint === null && email !== null)) {
        // Two Auth0 identities share one email. Keep this row but drop the
        // email so the shared address stays on the first-seen account.
        const other = await this.findByEmail(email);
        this.logger?.warn(
          { auth0Sub: claims.sub, email, conflictingUserId: other?.id ?? null },
          'Email already owned by another account; creating/keeping this user with email=null',
        );
        return this.upsertById(claims, null, claimRole, syncRole);
      }

      if (constraint === AUTH0_SUB_UNIQUE_INDEX) {
        // A row with this auth0_sub exists under a DIFFERENT id — update it in
        // place rather than trying to insert a duplicate.
        const existing = await this.updateByAuth0Sub(claims, email, claimRole, syncRole);
        if (existing !== null) return existing;
      }

      throw error;
    }
  }

  /** The id-keyed upsert (the normal per-request path). */
  private async upsertById(
    claims: AuthClaims,
    email: string | null,
    claimRole: UserRecord['role'],
    syncRole: boolean,
  ): Promise<UserRecord> {
    const baseSet = {
      auth0Sub: claims.sub,
      email,
      name: claims.name,
      picture: claims.picture,
      updatedAt: new Date(),
    };
    // Decisions #5: write `role` only when the token actually carries role
    // claims — otherwise the DB value (e.g. promote-admin) stands.
    const set = syncRole ? { ...baseSet, role: claimRole } : baseSet;

    const rows = await this.db
      .insert(users)
      .values({
        id: claims.sub,
        auth0Sub: claims.sub,
        email,
        name: claims.name,
        picture: claims.picture,
        role: claimRole,
        subscriptionStatus: 'none',
      })
      .onConflictDoUpdate({ target: users.id, set })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('User upsert returned no row');
    return toRecord(row);
  }

  private async updateByAuth0Sub(
    claims: AuthClaims,
    email: string | null,
    claimRole: UserRecord['role'],
    syncRole: boolean,
  ): Promise<UserRecord | null> {
    const baseSet = { email, name: claims.name, picture: claims.picture, updatedAt: new Date() };
    const set = syncRole ? { ...baseSet, role: claimRole } : baseSet;
    const rows = await this.db
      .update(users)
      .set(set)
      .where(eq(users.auth0Sub, claims.sub))
      .returning();
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  private async findByEmail(email: string | null): Promise<UserRecord | null> {
    if (email === null) return null;
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async updateEmail(userId: string, email: string): Promise<void> {
    try {
      await this.db
        .update(users)
        .set({ email: email.toLowerCase(), updatedAt: new Date() })
        .where(eq(users.id, userId));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Email already in use by another account');
      }
      throw error;
    }
  }
}
