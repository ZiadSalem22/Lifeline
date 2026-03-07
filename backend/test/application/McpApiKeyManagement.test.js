const { ListCurrentUserMcpApiKeys } = require('../../src/application/mcpApiKeys/ListCurrentUserMcpApiKeys');
const { RevokeCurrentUserMcpApiKey } = require('../../src/application/mcpApiKeys/RevokeCurrentUserMcpApiKey');

describe('MCP API key self-serve management use-cases', () => {
  it('lists only the current user keys and derives expired status from expiry time', async () => {
    const listCurrentUserMcpApiKeys = new ListCurrentUserMcpApiKeys({
      mcpApiKeyRepository: {
        async listByUserId(userId, options) {
          expect(userId).toBe('user-1');
          expect(options).toEqual({ limit: 25 });
          return [
            {
              id: 'key-active',
              name: 'Active key',
              keyPrefix: 'lk_active',
              scopes: ['tasks:read'],
              status: 'active',
              createdAt: '2026-03-07T10:00:00.000Z',
              expiresAt: null,
              lastUsedAt: null,
              revokedAt: null,
            },
            {
              id: 'key-expired',
              name: 'Expired key',
              keyPrefix: 'lk_expired',
              scopes: ['tasks:read', 'tasks:write'],
              status: 'active',
              createdAt: '2026-03-05T10:00:00.000Z',
              expiresAt: '2026-03-06T10:00:00.000Z',
              lastUsedAt: '2026-03-05T11:00:00.000Z',
              revokedAt: null,
            },
          ];
        },
      },
      now: () => new Date('2026-03-07T12:00:00.000Z'),
    });

    const apiKeys = await listCurrentUserMcpApiKeys.execute({ userId: 'user-1' });

    expect(apiKeys).toEqual([
      expect.objectContaining({ id: 'key-active', status: 'active' }),
      expect.objectContaining({ id: 'key-expired', status: 'expired' }),
    ]);
  });

  it('revokes only keys owned by the current user', async () => {
    const repository = {
      findByIdForUser: jest.fn(async (id, userId) => {
        if (id === 'key-1' && userId === 'user-1') {
          return {
            id,
            name: 'CLI key',
            keyPrefix: 'lk_owned',
            scopes: ['tasks:read'],
            status: 'active',
            createdAt: '2026-03-07T10:00:00.000Z',
            expiresAt: null,
            lastUsedAt: null,
            revokedAt: null,
          };
        }
        return null;
      }),
      revokeByIdForUser: jest.fn(async (id, userId, details) => ({
        id,
        userId,
        name: 'CLI key',
        keyPrefix: 'lk_owned',
        scopes: ['tasks:read'],
        status: 'revoked',
        createdAt: '2026-03-07T10:00:00.000Z',
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: details.revokedAt,
      })),
    };

    const revokeCurrentUserMcpApiKey = new RevokeCurrentUserMcpApiKey({
      mcpApiKeyRepository: repository,
      now: () => new Date('2026-03-07T12:30:00.000Z'),
    });

    const revoked = await revokeCurrentUserMcpApiKey.execute({
      userId: 'user-1',
      apiKeyId: 'key-1',
    });

    expect(repository.findByIdForUser).toHaveBeenCalledWith('key-1', 'user-1');
    expect(repository.revokeByIdForUser).toHaveBeenCalledWith('key-1', 'user-1', {
      revokedAt: '2026-03-07T12:30:00.000Z',
      revocationReason: 'user_self_service',
    });
    expect(revoked).toMatchObject({ id: 'key-1', status: 'revoked' });

    await expect(revokeCurrentUserMcpApiKey.execute({
      userId: 'user-1',
      apiKeyId: 'other-users-key',
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});
