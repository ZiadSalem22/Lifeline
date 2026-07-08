import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import type pg from 'pg';
import { createDb, createPool, type Db } from '../../src/infrastructure/db/client.js';
import { users } from '../../src/infrastructure/db/schema.js';
import { DrizzleUserRepository } from '../../src/infrastructure/repositories/user-repository.js';
import type { AuthClaims } from '../../src/application/ports.js';

/**
 * Integration suite for ensureFromClaims unique-violation recovery
 * (confirmed-findings-round2 #2) against a REAL Postgres. Run with:
 *   TEST_DATABASE_URL=postgres://lifeline:lifeline@localhost:15432/lifeline
 */
const DATABASE_URL = process.env.TEST_DATABASE_URL;

function claims(over: Partial<AuthClaims> = {}): AuthClaims {
  return {
    sub: `it-user-${randomUUID()}`,
    email: null,
    name: null,
    picture: null,
    roles: [],
    hasRoleClaims: false,
    ...over,
  };
}

describe.skipIf(DATABASE_URL === undefined)(
  'DrizzleUserRepository.ensureFromClaims (real PG)',
  () => {
    let pool: pg.Pool;
    let db: Db;
    let repo: DrizzleUserRepository;
    const createdIds: string[] = [];

    beforeAll(() => {
      pool = createPool(DATABASE_URL as string);
      db = createDb(pool);
      repo = new DrizzleUserRepository(db, { warn: () => undefined });
    });

    afterAll(async () => {
      if (createdIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdIds));
      }
      await pool.end();
    });

    it('two identities with the same email: the second succeeds with email=null (no 500)', async () => {
      const email = `dup-${randomUUID().slice(0, 8)}@example.com`;
      const first = claims({ email });
      const second = claims({ email });
      createdIds.push(first.sub, second.sub);

      // First identity claims the email.
      const a = await repo.ensureFromClaims(first);
      expect(a.email).toBe(email);

      // Second identity, SAME email — used to 500 on ux_users_email_not_null.
      const b = await repo.ensureFromClaims(second);
      expect(b.id).toBe(second.sub); // its own row was created
      expect(b.email).toBeNull(); // email dropped to dodge the unique index

      // The email still belongs to the first account, untouched.
      const rows = await db.select().from(users).where(eq(users.email, email));
      expect(rows.map((row) => row.id)).toEqual([first.sub]);
    });

    it('is idempotent: re-running the second identity still succeeds', async () => {
      const email = `dup2-${randomUUID().slice(0, 8)}@example.com`;
      const first = claims({ email });
      const second = claims({ email });
      createdIds.push(first.sub, second.sub);

      await repo.ensureFromClaims(first);
      await repo.ensureFromClaims(second);
      // Second request from the same identity must not throw.
      const again = await repo.ensureFromClaims(second);
      expect(again.id).toBe(second.sub);
      expect(again.email).toBeNull();
    });

    it('a normal unique email round-trips unchanged', async () => {
      const email = `solo-${randomUUID().slice(0, 8)}@example.com`;
      const only = claims({ email });
      createdIds.push(only.sub);
      const record = await repo.ensureFromClaims(only);
      expect(record.email).toBe(email);
    });
  },
);
