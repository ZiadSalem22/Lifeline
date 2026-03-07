const { IssueMcpApiKey } = require('../../src/application/IssueMcpApiKey');

describe('IssueMcpApiKey', () => {
  it('issues a plaintext key once while persisting only the hashed secret and prefix', async () => {
    const savedRecords = [];
    const issueMcpApiKey = new IssueMcpApiKey({
      mcpApiKeyRepository: {
        async findByKeyPrefix() {
          return null;
        },
        async save(record) {
          savedRecords.push(record);
          return record;
        },
      },
      userRepository: {
        async findById(id) {
          return { id, email: 'user@example.com', name: 'User One' };
        },
      },
      now: () => new Date('2026-03-07T12:00:00.000Z'),
      generateId: () => 'api-key-1',
      generateKeyPrefix: () => 'lk_abcd1234',
      generateSecret: () => 'plain-secret',
      hashSecret: (secret) => `hashed:${secret}`,
    });

    const issued = await issueMcpApiKey.execute({
      userId: 'user-1',
      name: 'CLI validation key',
    });

    expect(issued.apiKey).toBe('lk_abcd1234.plain-secret');
    expect(issued.scopes).toEqual(['tasks:read', 'tasks:write']);
    expect(savedRecords).toHaveLength(1);
    expect(savedRecords[0]).toMatchObject({
      id: 'api-key-1',
      userId: 'user-1',
      keyPrefix: 'lk_abcd1234',
      keyHash: 'hashed:plain-secret',
      name: 'CLI validation key',
      scopes: ['tasks:read', 'tasks:write'],
      status: 'active',
    });
    expect(savedRecords[0].keyHash).not.toContain('lk_abcd1234.');
  });

  it('rejects unsupported scopes', async () => {
    const issueMcpApiKey = new IssueMcpApiKey({
      mcpApiKeyRepository: {
        async findByKeyPrefix() {
          return null;
        },
        async save(record) {
          return record;
        },
      },
      userRepository: {
        async findById(id) {
          return { id, email: 'user@example.com', name: 'User One' };
        },
      },
    });

    await expect(issueMcpApiKey.execute({
      userId: 'user-1',
      name: 'Bad scope key',
      scopes: ['tasks:read', 'admin:all'],
    })).rejects.toThrow(/Unsupported MCP API key scope/i);
  });

  it('rejects issuance for an unknown user', async () => {
    const issueMcpApiKey = new IssueMcpApiKey({
      mcpApiKeyRepository: {
        async findByKeyPrefix() {
          return null;
        },
        async save(record) {
          return record;
        },
      },
      userRepository: {
        async findById() {
          return null;
        },
      },
    });

    await expect(issueMcpApiKey.execute({
      userId: 'missing-user',
      name: 'Missing user key',
    })).rejects.toThrow(/User not found for MCP API key issuance/i);
  });
});
