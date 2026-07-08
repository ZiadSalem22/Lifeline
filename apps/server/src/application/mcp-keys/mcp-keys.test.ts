import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../domain/errors.js';
import {
  MCP_KEY_PREFIX_PATTERN,
  generateKey,
  hashSecret,
  parsePlaintextKey,
  verifySecret,
} from '../../utils/mcp-key-crypto.js';
import { InMemoryMcpKeyRepository } from '../../../test/helpers/feature-fakes.js';
import { InMemoryUserRepository } from '../../../test/helpers/in-memory.js';
import { IssueMcpKey } from './issue-key.js';
import { ListMcpKeys } from './list-keys.js';
import { RevokeMcpKey } from './revoke-key.js';
import { ResolveKeyPrincipal } from './resolve-key-principal.js';
import { deriveMcpKeyStatus, toMcpKeyDto } from './metadata.js';

const PEPPER = 'test-pepper';
const NOW = new Date('2026-07-06T12:00:00.000Z');

describe('mcp-key-crypto — frozen algorithm (audit-auth §4)', () => {
  it('GOLDEN: hashSecret is HMAC-SHA256(secret, key=pepper) hex', () => {
    expect(hashSecret('test-secret', 'test-pepper')).toBe(
      createHmac('sha256', 'test-pepper').update('test-secret').digest('hex'),
    );
  });

  it('generateKey: prefix ^lk_[0-9a-f]{8}$, 24-byte base64url secret, prefix.secret plaintext', () => {
    const material = generateKey();
    expect(material.keyPrefix).toMatch(/^lk_[0-9a-f]{8}$/);
    expect(material.keyPrefix).toMatch(MCP_KEY_PREFIX_PATTERN);
    expect(material.secret).toMatch(/^[A-Za-z0-9_-]{32}$/); // 24 bytes → 32 base64url chars
    expect(material.plaintext).toBe(`${material.keyPrefix}.${material.secret}`);
  });

  it('verifySecret round-trips and rejects a wrong secret', () => {
    const hash = hashSecret('right-secret', PEPPER);
    expect(verifySecret('right-secret', hash, PEPPER)).toBe(true);
    expect(verifySecret('wrong-secret', hash, PEPPER)).toBe(false);
    expect(verifySecret('right-secret', hash, 'other-pepper')).toBe(false);
    expect(verifySecret('', hash, PEPPER)).toBe(false);
  });

  it('parsePlaintextKey splits at the FIRST dot and strips a Bearer prefix', () => {
    expect(parsePlaintextKey('lk_abc.se.cret')).toEqual({
      keyPrefix: 'lk_abc',
      secret: 'se.cret',
    });
    expect(parsePlaintextKey('Bearer lk_abc.secret')).toEqual({
      keyPrefix: 'lk_abc',
      secret: 'secret',
    });
    expect(parsePlaintextKey('no-delimiter')).toBeNull();
    expect(parsePlaintextKey('.starts-with-dot')).toBeNull();
    expect(parsePlaintextKey('ends-with-dot.')).toBeNull();
    expect(parsePlaintextKey('')).toBeNull();
  });
});

describe('IssueMcpKey — presets', () => {
  function build() {
    const keys = new InMemoryMcpKeyRepository();
    const issue = new IssueMcpKey({ keys }, { pepper: PEPPER, now: () => NOW });
    return { keys, issue };
  }

  it("scopePreset read_only → ['tasks:read']; read_write → both", async () => {
    const { issue } = build();
    const readOnly = await issue.execute('u1', {
      name: 'ro',
      scopePreset: 'read_only',
      expiryPreset: 'never',
    });
    expect(readOnly.apiKey.scopes).toEqual(['tasks:read']);
    const readWrite = await issue.execute('u1', {
      name: 'rw',
      scopePreset: 'read_write',
      expiryPreset: 'never',
    });
    expect(readWrite.apiKey.scopes).toEqual(['tasks:read', 'tasks:write']);
  });

  it('expiryPreset 30_days → now + 30×24h; never → null', async () => {
    const { issue } = build();
    const dated = await issue.execute('u1', {
      name: 'dated',
      scopePreset: 'read_only',
      expiryPreset: '30_days',
    });
    expect(dated.apiKey.expiresAt).toBe(new Date(NOW.getTime() + 30 * 86_400_000).toISOString());
    const never = await issue.execute('u1', {
      name: 'never',
      scopePreset: 'read_only',
      expiryPreset: 'never',
    });
    expect(never.apiKey.expiresAt).toBeNull();
  });

  it('returns the plaintext exactly once; only the HMAC hash is persisted', async () => {
    const { keys, issue } = build();
    const issued = await issue.execute('u1', {
      name: 'mine',
      scopePreset: 'read_write',
      expiryPreset: 'never',
    });
    expect(issued.plaintextKey).toMatch(/^lk_[0-9a-f]{8}\.[A-Za-z0-9_-]{32}$/);
    expect(issued.apiKey).toEqual({
      id: expect.any(String),
      name: 'mine',
      keyPrefix: issued.plaintextKey.split('.')[0],
      scopes: ['tasks:read', 'tasks:write'],
      status: 'active',
      createdAt: expect.any(String),
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
    });
    const parsed = parsePlaintextKey(issued.plaintextKey);
    const stored = await keys.findByPrefix(parsed?.keyPrefix ?? '');
    expect(stored?.keyHash).toBe(hashSecret(parsed?.secret ?? '', PEPPER));
    expect(JSON.stringify(stored)).not.toContain(parsed?.secret);
  });

  it('retries with fresh material on a prefix collision', async () => {
    const keys = new InMemoryMcpKeyRepository();
    keys.seed({ userId: 'other', keyPrefix: 'lk_aaaaaaaa' });
    const materials = [
      { keyPrefix: 'lk_aaaaaaaa', secret: 's1', plaintext: 'lk_aaaaaaaa.s1' },
      { keyPrefix: 'lk_bbbbbbbb', secret: 's2', plaintext: 'lk_bbbbbbbb.s2' },
    ];
    let call = 0;
    const issue = new IssueMcpKey(
      { keys },
      {
        pepper: PEPPER,
        generateKeyMaterial: () => materials[Math.min(call++, 1)] ?? materials[1]!,
      },
    );
    const issued = await issue.execute('u1', {
      name: 'retry',
      scopePreset: 'read_only',
      expiryPreset: 'never',
    });
    expect(issued.apiKey.keyPrefix).toBe('lk_bbbbbbbb');
    expect(call).toBe(2);
  });
});

describe('metadata — derived status precedence revoked > expired(by date) > active', () => {
  const base = { status: 'active' as const, revokedAt: null, expiresAt: null };

  it.each([
    [{ ...base, status: 'revoked' as const }, 'revoked'],
    [{ ...base, revokedAt: NOW }, 'revoked'],
    [{ ...base, status: 'expired' as const }, 'expired'],
    [{ ...base, expiresAt: new Date(NOW.getTime() - 1) }, 'expired'],
    [{ ...base, expiresAt: NOW }, 'expired'], // expires_at <= now
    [{ ...base, expiresAt: new Date(NOW.getTime() + 1) }, 'active'],
    [base, 'active'],
  ])('%o → %s', (record, expected) => {
    expect(deriveMcpKeyStatus(record, NOW)).toBe(expected);
  });

  it('revoked wins over an expired date', () => {
    expect(
      deriveMcpKeyStatus(
        { status: 'active', revokedAt: NOW, expiresAt: new Date(NOW.getTime() - 1) },
        NOW,
      ),
    ).toBe('revoked');
  });

  it('toMcpKeyDto exposes ONLY public metadata (no hash, no usage ip/agent)', () => {
    const keys = new InMemoryMcpKeyRepository();
    const record = keys.seed({ userId: 'u1', lastUsedIp: '1.2.3.4', lastUsedUserAgent: 'x' });
    const dto = toMcpKeyDto(record, NOW);
    expect(Object.keys(dto).sort()).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'keyPrefix',
      'lastUsedAt',
      'name',
      'revokedAt',
      'scopes',
      'status',
    ]);
  });
});

describe('ListMcpKeys / RevokeMcpKey', () => {
  it('lists the user’s keys newest first with derived statuses', async () => {
    const keys = new InMemoryMcpKeyRepository();
    keys.seed({ userId: 'u1', name: 'older' });
    keys.seed({ userId: 'u1', name: 'newer', expiresAt: new Date(NOW.getTime() - 1) });
    keys.seed({ userId: 'other', name: 'foreign' });
    const list = new ListMcpKeys({ keys }, () => NOW);
    const items = await list.execute('u1', 25);
    expect(items.map((key) => key.name)).toEqual(['newer', 'older']);
    expect(items.map((key) => key.status)).toEqual(['expired', 'active']);
  });

  it('respects the limit', async () => {
    const keys = new InMemoryMcpKeyRepository();
    for (let i = 0; i < 5; i += 1) keys.seed({ userId: 'u1' });
    const items = await new ListMcpKeys({ keys }, () => NOW).execute('u1', 2);
    expect(items).toHaveLength(2);
  });

  it("revoke is idempotent, stamps reason 'user_self_service', 404s foreign keys", async () => {
    const keys = new InMemoryMcpKeyRepository();
    const mine = keys.seed({ userId: 'u1' });
    const foreign = keys.seed({ userId: 'other' });
    const revoke = new RevokeMcpKey({ keys }, () => NOW);

    const revoked = await revoke.execute('u1', mine.id);
    expect(revoked.status).toBe('revoked');
    expect(keys.rows.get(mine.id)).toMatchObject({
      status: 'revoked',
      revocationReason: 'user_self_service',
    });
    const firstRevokedAt = keys.rows.get(mine.id)?.revokedAt;

    const again = await revoke.execute('u1', mine.id);
    expect(again.status).toBe('revoked');
    expect(keys.rows.get(mine.id)?.revokedAt).toEqual(firstRevokedAt); // unchanged

    await expect(revoke.execute('u1', foreign.id)).rejects.toThrow(
      new NotFoundError('API key not found.'),
    );
    await expect(revoke.execute('u1', 'ghost')).rejects.toThrow(NotFoundError);
  });
});

describe('ResolveKeyPrincipal — every branch (audit-auth §4 order)', () => {
  function build() {
    const keys = new InMemoryMcpKeyRepository();
    const users = new InMemoryUserRepository();
    users.seed({ id: 'u1', name: 'Ada' });
    const resolve = new ResolveKeyPrincipal({ keys, users }, { pepper: PEPPER, now: () => NOW });
    const seedKey = (overrides: Parameters<InMemoryMcpKeyRepository['seed']>[0]) =>
      keys.seed({
        keyHash: hashSecret('good-secret', PEPPER),
        scopes: ['tasks:read', 'tasks:write'],
        ...overrides,
      });
    return { keys, users, resolve, seedKey };
  }

  it("401 'Missing API key.' for blank input", async () => {
    const { resolve } = build();
    await expect(resolve.execute({ apiKey: '   ' })).rejects.toThrow(
      new UnauthorizedError('Missing API key.'),
    );
  });

  it("401 'Invalid API key.' for malformed keys and unknown prefixes", async () => {
    const { resolve } = build();
    await expect(resolve.execute({ apiKey: 'no-delimiter' })).rejects.toThrow(
      new UnauthorizedError('Invalid API key.'),
    );
    await expect(resolve.execute({ apiKey: 'lk_ffffffff.whatever' })).rejects.toThrow(
      new UnauthorizedError('Invalid API key.'),
    );
  });

  it("403 'API key revoked.' before the secret is even checked", async () => {
    const { resolve, seedKey } = build();
    const key = seedKey({ userId: 'u1', revokedAt: NOW });
    await expect(resolve.execute({ apiKey: `${key.keyPrefix}.good-secret` })).rejects.toThrow(
      new ForbiddenError('API key revoked.'),
    );
  });

  it("403 'API key expired.' by date or stored status", async () => {
    const { resolve, seedKey } = build();
    const byDate = seedKey({ userId: 'u1', expiresAt: new Date(NOW.getTime() - 1) });
    await expect(resolve.execute({ apiKey: `${byDate.keyPrefix}.good-secret` })).rejects.toThrow(
      new ForbiddenError('API key expired.'),
    );
    const byStatus = seedKey({ userId: 'u1', status: 'expired' });
    await expect(resolve.execute({ apiKey: `${byStatus.keyPrefix}.good-secret` })).rejects.toThrow(
      new ForbiddenError('API key expired.'),
    );
  });

  it("401 'Invalid API key.' on an HMAC mismatch (no usage recorded)", async () => {
    const { keys, resolve, seedKey } = build();
    const key = seedKey({ userId: 'u1' });
    await expect(resolve.execute({ apiKey: `${key.keyPrefix}.wrong-secret` })).rejects.toThrow(
      new UnauthorizedError('Invalid API key.'),
    );
    expect(keys.usageCalls).toHaveLength(0);
  });

  it("404 'API key user not found.' when the user row is gone", async () => {
    const { resolve, seedKey } = build();
    const key = seedKey({ userId: 'deleted-user' });
    await expect(resolve.execute({ apiKey: `${key.keyPrefix}.good-secret` })).rejects.toThrow(
      new NotFoundError('API key user not found.'),
    );
  });

  it('success: principal shape + recordUsage called with request metadata', async () => {
    const { keys, resolve, seedKey } = build();
    const key = seedKey({ userId: 'u1', name: 'CLI key' });
    const result = await resolve.execute({
      apiKey: `${key.keyPrefix}.good-secret`,
      ip: '10.0.0.1',
      userAgent: 'vitest',
    });
    expect(result).toEqual({
      principal: {
        subjectType: 'api_key',
        lifelineUserId: 'u1',
        authMethod: 'api_key',
        scopes: ['tasks:read', 'tasks:write'],
        subjectId: key.id,
        displayName: 'Ada',
      },
      apiKey: {
        id: key.id,
        name: 'CLI key',
        keyPrefix: key.keyPrefix,
        scopes: ['tasks:read', 'tasks:write'],
      },
    });
    expect(keys.usageCalls).toEqual([
      { keyId: key.id, at: NOW, ip: '10.0.0.1', userAgent: 'vitest' },
    ]);
  });

  it('recordUsage failures never block valid auth (best-effort)', async () => {
    const { keys, resolve, seedKey } = build();
    keys.failRecordUsage = true;
    const key = seedKey({ userId: 'u1' });
    await expect(
      resolve.execute({ apiKey: `${key.keyPrefix}.good-secret` }),
    ).resolves.toMatchObject({ principal: { lifelineUserId: 'u1' } });
  });

  it('accepts a Bearer-prefixed presentation (parser parity)', async () => {
    const { resolve, seedKey } = build();
    const key = seedKey({ userId: 'u1' });
    await expect(
      resolve.execute({ apiKey: `Bearer ${key.keyPrefix}.good-secret` }),
    ).resolves.toBeDefined();
  });
});
