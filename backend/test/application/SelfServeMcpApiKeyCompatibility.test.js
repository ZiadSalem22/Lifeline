const { IssueMcpApiKey } = require('../../src/application/IssueMcpApiKey');
const { CreateSelfServeMcpApiKey } = require('../../src/application/mcpApiKeys/CreateSelfServeMcpApiKey');
const { RevokeCurrentUserMcpApiKey } = require('../../src/application/mcpApiKeys/RevokeCurrentUserMcpApiKey');
const { ResolveMcpApiKeyPrincipal } = require('../../src/application/ResolveMcpApiKeyPrincipal');

describe('Self-serve MCP API key compatibility', () => {
  function createInMemoryRepository() {
    const records = [];

    return {
      records,
      async listByUserId(userId) {
        return records.filter((record) => record.userId === userId);
      },
      async findByIdForUser(id, userId) {
        return records.find((record) => record.id === id && record.userId === userId) || null;
      },
      async findByKeyPrefix(keyPrefix) {
        return records.find((record) => record.keyPrefix === keyPrefix) || null;
      },
      async save(record) {
        const normalizedRecord = {
          ...record,
          createdAt: record.createdAt || '2026-03-07T12:00:00.000Z',
          updatedAt: record.updatedAt || '2026-03-07T12:00:00.000Z',
        };
        records.push(normalizedRecord);
        return normalizedRecord;
      },
      async recordUsage(id, usage) {
        const record = records.find((candidate) => candidate.id === id);
        if (!record) return null;
        record.lastUsedAt = usage.lastUsedAt;
        record.lastUsedIp = usage.lastUsedIp;
        record.lastUsedUserAgent = usage.lastUsedUserAgent;
        return record;
      },
      async revokeByIdForUser(id, userId, details) {
        const record = records.find((candidate) => candidate.id === id && candidate.userId === userId);
        if (!record) return null;
        record.status = 'revoked';
        record.revokedAt = details.revokedAt;
        record.revocationReason = details.revocationReason;
        return record;
      },
    };
  }

  it('resolves a newly self-served key through the MCP auth path and blocks it after revocation', async () => {
    const repository = createInMemoryRepository();
    const userRepository = {
      async findById(id) {
        return { id, email: 'user@example.com', name: 'User One' };
      },
    };

    const issueMcpApiKey = new IssueMcpApiKey({
      mcpApiKeyRepository: repository,
      userRepository,
      now: () => new Date('2026-03-07T12:00:00.000Z'),
      generateId: () => 'key-1',
      generateKeyPrefix: () => 'lk_selfserve',
      generateSecret: () => 'secret-value',
      hashSecret: (secret) => `hashed:${secret}`,
    });

    const createSelfServeMcpApiKey = new CreateSelfServeMcpApiKey({
      issueMcpApiKey,
      now: () => new Date('2026-03-07T12:00:00.000Z'),
    });

    const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
      mcpApiKeyRepository: repository,
      userRepository,
      now: () => new Date('2026-03-07T12:10:00.000Z'),
      verifySecret: (secret, hash) => hash === `hashed:${secret}`,
    });

    const revokeCurrentUserMcpApiKey = new RevokeCurrentUserMcpApiKey({
      mcpApiKeyRepository: repository,
      now: () => new Date('2026-03-07T12:20:00.000Z'),
    });

    const created = await createSelfServeMcpApiKey.execute({
      userId: 'user-1',
      name: 'Desktop CLI',
      scopePreset: 'read_write',
      expiryPreset: '30_days',
    });

    const resolved = await resolveMcpApiKeyPrincipal.execute({
      apiKey: created.plaintextKey,
      clientIp: '127.0.0.1',
      clientUserAgent: 'vitest',
    });

    expect(resolved).toMatchObject({
      lifelineUserId: 'user-1',
      authMethod: 'api_key',
      apiKeyId: 'key-1',
      scopes: ['tasks:read', 'tasks:write'],
    });
    expect(repository.records[0].lastUsedAt).toBe('2026-03-07T12:10:00.000Z');

    await revokeCurrentUserMcpApiKey.execute({
      userId: 'user-1',
      apiKeyId: 'key-1',
    });

    await expect(resolveMcpApiKeyPrincipal.execute({
      apiKey: created.plaintextKey,
      clientIp: '127.0.0.1',
      clientUserAgent: 'vitest',
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
