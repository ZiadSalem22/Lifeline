const { CreateSelfServeMcpApiKey } = require('../../src/application/mcpApiKeys/CreateSelfServeMcpApiKey');

describe('CreateSelfServeMcpApiKey', () => {
  it('maps the self-serve presets to bounded scopes and returns plaintext once', async () => {
    const issueMcpApiKey = {
      execute: jest.fn(async ({ userId, name, scopes, expiresAt }) => ({
        apiKey: 'lk_selfserve.secret-value',
        apiKeyId: 'api-key-1',
        keyPrefix: 'lk_selfserve',
        userId,
        name,
        scopes,
        expiresAt,
        createdAt: '2026-03-07T12:00:00.000Z',
      })),
    };

    const createSelfServeMcpApiKey = new CreateSelfServeMcpApiKey({
      issueMcpApiKey,
      now: () => new Date('2026-03-07T12:00:00.000Z'),
    });

    const created = await createSelfServeMcpApiKey.execute({
      userId: 'user-1',
      name: 'Desktop CLI',
      scopePreset: 'read_write',
      expiryPreset: '30_days',
    });

    expect(issueMcpApiKey.execute).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Desktop CLI',
      scopes: ['tasks:read', 'tasks:write'],
      expiresAt: '2026-04-06T12:00:00.000Z',
    });
    expect(created.plaintextKey).toBe('lk_selfserve.secret-value');
    expect(created.apiKey).toMatchObject({
      id: 'api-key-1',
      keyPrefix: 'lk_selfserve',
      name: 'Desktop CLI',
      scopes: ['tasks:read', 'tasks:write'],
      status: 'active',
      createdAt: '2026-03-07T12:00:00.000Z',
      expiresAt: '2026-04-06T12:00:00.000Z',
      lastUsedAt: null,
      revokedAt: null,
    });
  });

  it('rejects invalid self-serve presets', async () => {
    const createSelfServeMcpApiKey = new CreateSelfServeMcpApiKey({
      issueMcpApiKey: { execute: jest.fn() },
    });

    await expect(createSelfServeMcpApiKey.execute({
      userId: 'user-1',
      name: 'Bad Key',
      scopePreset: 'admin',
      expiryPreset: '30_days',
    })).rejects.toMatchObject({ statusCode: 400 });

    await expect(createSelfServeMcpApiKey.execute({
      userId: 'user-1',
      name: 'Bad Key',
      scopePreset: 'read_only',
      expiryPreset: 'custom',
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});
