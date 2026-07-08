import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { createDb, createPool, type Db } from '../../src/infrastructure/db/client.js';
import { users } from '../../src/infrastructure/db/schema.js';
import { DrizzleMcpKeyRepository } from '../../src/infrastructure/repositories/mcp-key-repository.js';
import { hashSecret } from '../../src/utils/mcp-key-crypto.js';
import { ConflictError, NotFoundError } from '../../src/domain/errors.js';

/** Real-PG round-trip for the MCP key repository. Skipped without TEST_DATABASE_URL. */
const DATABASE_URL = process.env.TEST_DATABASE_URL;
const PEPPER = 'integration-pepper';

describe.skipIf(DATABASE_URL === undefined)('DrizzleMcpKeyRepository (real PG)', () => {
  let pool: pg.Pool;
  let db: Db;
  let repo: DrizzleMcpKeyRepository;
  let userId: string;

  function keyData(overrides: { keyPrefix?: string; expiresAt?: Date | null } = {}) {
    return {
      id: randomUUID(),
      userId,
      name: 'integration key',
      keyPrefix: overrides.keyPrefix ?? `lk_${randomBytes(4).toString('hex')}`,
      keyHash: hashSecret('integration-secret', PEPPER),
      scopes: ['tasks:read', 'tasks:write'],
      expiresAt: overrides.expiresAt ?? null,
    };
  }

  beforeAll(async () => {
    pool = createPool(DATABASE_URL as string);
    db = createDb(pool);
    repo = new DrizzleMcpKeyRepository(db);
    userId = `it-keys-${randomUUID()}`;
    await db.insert(users).values({ id: userId, auth0Sub: userId });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId)); // FK cascade wipes the keys
    await pool.end();
  });

  it('create → findByPrefix round-trip preserves hash, scopes, and status', async () => {
    const data = keyData();
    const created = await repo.create(data);
    expect(created).toMatchObject({
      id: data.id,
      userId,
      keyPrefix: data.keyPrefix,
      keyHash: data.keyHash,
      scopes: ['tasks:read', 'tasks:write'],
      status: 'active',
      expiresAt: null,
      revokedAt: null,
    });
    const found = await repo.findByPrefix(data.keyPrefix);
    expect(found?.id).toBe(data.id);
    expect(found?.keyHash).toBe(data.keyHash);
    expect(await repo.findByPrefix('lk_00000000')).toBeNull();
  });

  it('duplicate prefixes violate ux_mcp_api_keys_prefix → ConflictError', async () => {
    const data = keyData();
    await repo.create(data);
    await expect(repo.create({ ...keyData(), keyPrefix: data.keyPrefix })).rejects.toThrow(
      ConflictError,
    );
  });

  it('revoke stamps status/reason/revokedAt, is idempotent, 404s foreign keys', async () => {
    const created = await repo.create(keyData());
    const revoked = await repo.revoke(userId, created.id, 'user_self_service');
    expect(revoked.status).toBe('revoked');
    expect(revoked.revocationReason).toBe('user_self_service');
    expect(revoked.revokedAt).not.toBeNull();

    const again = await repo.revoke(userId, created.id, 'user_self_service');
    expect(again.revokedAt?.getTime()).toBe(revoked.revokedAt?.getTime()); // unchanged

    await expect(repo.revoke('someone-else', created.id, 'x')).rejects.toThrow(NotFoundError);
    await expect(repo.revoke(userId, randomUUID(), 'x')).rejects.toThrow(NotFoundError);
  });

  it('recordUsage persists lastUsedAt/ip/userAgent', async () => {
    const created = await repo.create(keyData());
    const at = new Date('2026-07-06T10:00:00.000Z');
    await repo.recordUsage(created.id, { at, ip: '10.1.2.3', userAgent: 'vitest-integration' });
    const stored = await repo.findById(userId, created.id);
    expect(stored?.lastUsedAt?.toISOString()).toBe(at.toISOString());
    expect(stored?.lastUsedIp).toBe('10.1.2.3');
    expect(stored?.lastUsedUserAgent).toBe('vitest-integration');
  });

  it('list returns the user’s keys newest first, honoring the limit', async () => {
    const listed = await repo.list(userId, 50);
    expect(listed.length).toBeGreaterThanOrEqual(4);
    const times = listed.map((key) => key.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    const limited = await repo.list(userId, 2);
    expect(limited).toHaveLength(2);
    // User-scoped only.
    expect(listed.every((key) => key.userId === userId)).toBe(true);
  });
});
