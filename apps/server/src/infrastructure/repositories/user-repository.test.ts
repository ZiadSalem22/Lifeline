import { describe, expect, it, vi } from 'vitest';
import type { AuthClaims } from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { DrizzleUserRepository, type UserRepoLogger } from './user-repository.js';

/**
 * Regression (confirmed-findings-round2 #2): ensureFromClaims upserts with
 * conflict target users.id only, so a 23505 on ux_users_email_not_null (two
 * Auth0 identities, same email) escaped ON CONFLICT and 500'd EVERY request
 * for the second identity (login lockout). It now recovers by re-upserting
 * with email=null and logging a warning.
 *
 * These are pure unit tests over a hand-rolled fake of the drizzle query
 * chain; the real-PG path is covered by the integration suite.
 */

function claims(overrides: Partial<AuthClaims> = {}): AuthClaims {
  return {
    sub: 'auth0|second-identity',
    email: 'shared@example.com',
    name: 'Second Identity',
    picture: null,
    roles: [],
    hasRoleClaims: false,
    ...overrides,
  };
}

function uniqueViolation(constraint: string): Error & { code: string; constraint: string } {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint,
  });
}

const now = new Date();

/** A stored `users` row shaped like `users.$inferSelect`. */
function userRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'auth0|second-identity',
    auth0Sub: 'auth0|second-identity',
    email: null,
    name: 'Second Identity',
    picture: null,
    role: 'free',
    subscriptionStatus: 'none',
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

/**
 * Minimal fake Db. `insertBehaviors` is a queue: each entry is either a row to
 * return or an Error to throw for successive insert().…returning() calls.
 */
function fakeDb(opts: {
  insertBehaviors: Array<Record<string, unknown> | Error>;
  selectRows?: Record<string, unknown>[];
  updateRows?: Record<string, unknown>[];
}): { db: Db; lastInsertValues: Array<Record<string, unknown>> } {
  const lastInsertValues: Array<Record<string, unknown>> = [];
  let insertCall = 0;

  const db = {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        lastInsertValues.push(v);
        return {
          onConflictDoUpdate: () => ({
            returning: () => {
              const behavior = opts.insertBehaviors[insertCall];
              insertCall += 1;
              if (behavior instanceof Error) return Promise.reject(behavior);
              return Promise.resolve(behavior === undefined ? [] : [behavior]);
            },
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(opts.selectRows ?? []),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(opts.updateRows ?? []),
        }),
      }),
    }),
  } as unknown as Db;

  return { db, lastInsertValues };
}

describe('DrizzleUserRepository.ensureFromClaims — unique-violation recovery', () => {
  it('happy path returns the upserted record with no retry', async () => {
    const { db, lastInsertValues } = fakeDb({
      insertBehaviors: [userRow({ email: 'shared@example.com' })],
    });
    const repo = new DrizzleUserRepository(db);
    const record = await repo.ensureFromClaims(claims());
    expect(record.email).toBe('shared@example.com');
    expect(lastInsertValues).toHaveLength(1); // single upsert, no retry
  });

  it('email-index 23505 → retries with email=null and logs a warning', async () => {
    const warn = vi.fn();
    const logger: UserRepoLogger = { warn };
    const { db, lastInsertValues } = fakeDb({
      insertBehaviors: [uniqueViolation('ux_users_email_not_null'), userRow({ email: null })],
      selectRows: [userRow({ id: 'auth0|first-identity', email: 'shared@example.com' })],
    });
    const repo = new DrizzleUserRepository(db, logger);

    const record = await repo.ensureFromClaims(claims());

    // No 500 — request survives.
    expect(record.email).toBeNull();
    // First insert carried the email, retry nulled it.
    expect(lastInsertValues).toHaveLength(2);
    expect(lastInsertValues[0]?.email).toBe('shared@example.com');
    expect(lastInsertValues[1]?.email).toBeNull();
    // Warning logs both ids.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({
      auth0Sub: 'auth0|second-identity',
      conflictingUserId: 'auth0|first-identity',
    });
  });

  it('auth0_sub-index 23505 → updates the existing row by auth0_sub', async () => {
    const { db } = fakeDb({
      insertBehaviors: [uniqueViolation('ux_users_auth0_sub')],
      updateRows: [userRow({ id: 'legacy-id', email: 'shared@example.com' })],
    });
    const repo = new DrizzleUserRepository(db);
    const record = await repo.ensureFromClaims(claims());
    expect(record.id).toBe('legacy-id');
    expect(record.email).toBe('shared@example.com');
  });

  it('a non-unique error propagates unchanged', async () => {
    const other = Object.assign(new Error('connection reset'), { code: '08006' });
    const { db } = fakeDb({ insertBehaviors: [other] });
    const repo = new DrizzleUserRepository(db);
    await expect(repo.ensureFromClaims(claims())).rejects.toThrow('connection reset');
  });
});
