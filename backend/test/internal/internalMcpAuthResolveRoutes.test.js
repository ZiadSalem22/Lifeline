const express = require('express');
const request = require('supertest');
const { ResolveMcpApiKeyPrincipal } = require('../../src/application/ResolveMcpApiKeyPrincipal');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { createInternalMcpRouter } = require('../../src/internal/mcp/router');
const { INTERNAL_MCP_SHARED_SECRET_HEADER } = require('../../src/internal/mcp/constants');
const { hashMcpApiKeySecret } = require('../../src/utils/mcpApiKeys');

function makeApp({ mcpApiKeyRepository, userRepository, resolveMcpApiKeyPrincipal } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/internal/mcp', createInternalMcpRouter({
    mcpApiKeyRepository,
    userRepository,
    resolveMcpApiKeyPrincipal,
    todoRepository: {
      findById: jest.fn(),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    },
    searchTodos: {
      execute: jest.fn(async () => ({ todos: [], total: 0 })),
    },
    listTodos: {
      execute: jest.fn(async () => []),
    },
    createTodoForInternalMcp: {
      execute: jest.fn(),
    },
    updateTodo: {
      execute: jest.fn(),
    },
    deleteTodo: {
      execute: jest.fn(),
    },
    setTodoCompletion: {
      execute: jest.fn(),
    },
  }));
  app.use(errorHandler);
  return app;
}

describe('internal MCP API-key resolution routes', () => {
  const originalSecret = process.env.MCP_INTERNAL_SHARED_SECRET;
  const originalPepper = process.env.MCP_API_KEY_PEPPER;

  beforeEach(() => {
    process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
    process.env.MCP_API_KEY_PEPPER = 'pepper';
  });

  afterEach(() => {
    if (typeof originalSecret === 'undefined') {
      delete process.env.MCP_INTERNAL_SHARED_SECRET;
    } else {
      process.env.MCP_INTERNAL_SHARED_SECRET = originalSecret;
    }

    if (typeof originalPepper === 'undefined') {
      delete process.env.MCP_API_KEY_PEPPER;
    } else {
      process.env.MCP_API_KEY_PEPPER = originalPepper;
    }
  });

  it('resolves a valid API key to a normalized principal and records usage', async () => {
    const mcpApiKeyRepository = {
      findByKeyPrefix: jest.fn(async (keyPrefix) => {
        if (keyPrefix !== 'lk_live_123') return null;
        return {
          id: 'key-1',
          userId: 'user-1',
          name: 'Desktop key',
          keyPrefix: 'lk_live_123',
          keyHash: hashMcpApiKeySecret('secret-value', 'pepper'),
          scopes: ['tasks:read', 'tasks:write'],
          status: 'active',
          expiresAt: null,
          revokedAt: null,
        };
      }),
      recordUsage: jest.fn(async () => undefined),
    };
    const userRepository = {
      findById: jest.fn(async (id) => (id === 'user-1' ? { id: 'user-1', name: 'Ziyad' } : null)),
    };
    const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
      mcpApiKeyRepository,
      userRepository,
      now: () => new Date('2026-03-07T12:00:00.000Z'),
    });

    const app = makeApp({ mcpApiKeyRepository, userRepository, resolveMcpApiKeyPrincipal });
    const res = await request(app)
      .post('/internal/mcp/auth/resolve-api-key')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret')
      .set('x-forwarded-for', '203.0.113.8')
      .set('User-Agent', 'lifeline-mcp-test/1.0')
      .send({
        apiKey: 'lk_live_123.secret-value',
        clientIp: '198.51.100.42',
        clientUserAgent: 'spoofed-agent/1.0',
      })
      .expect(200);

    expect(mcpApiKeyRepository.findByKeyPrefix).toHaveBeenCalledWith('lk_live_123');
    expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    expect(mcpApiKeyRepository.recordUsage).toHaveBeenCalledWith('key-1', expect.objectContaining({
      lastUsedIp: '203.0.113.8',
      lastUsedUserAgent: 'lifeline-mcp-test/1.0',
    }));
    expect(res.body.principal).toEqual({
      subjectType: 'api_key',
      lifelineUserId: 'user-1',
      authMethod: 'api_key',
      scopes: ['tasks:read', 'tasks:write'],
      subjectId: 'key-1',
      displayName: 'Ziyad',
    });
  });

  it('still resolves a valid API key when usage recording fails', async () => {
    const mcpApiKeyRepository = {
      findByKeyPrefix: jest.fn(async () => ({
        id: 'key-usage-fail',
        userId: 'user-1',
        name: 'Desktop key',
        keyPrefix: 'lk_live_usage',
        keyHash: hashMcpApiKeySecret('secret-value', 'pepper'),
        scopes: ['tasks:read'],
        status: 'active',
        expiresAt: null,
        revokedAt: null,
      })),
      recordUsage: jest.fn(async () => {
        throw new Error('usage write unavailable');
      }),
    };
    const userRepository = {
      findById: jest.fn(async () => ({ id: 'user-1', name: 'Ziyad' })),
    };
    const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
      mcpApiKeyRepository,
      userRepository,
      now: () => new Date('2026-03-07T12:00:00.000Z'),
    });

    const app = makeApp({ mcpApiKeyRepository, userRepository, resolveMcpApiKeyPrincipal });
    const res = await request(app)
      .post('/internal/mcp/auth/resolve-api-key')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret')
      .set('User-Agent', 'observed-agent/1.0')
      .send({
        apiKey: 'lk_live_usage.secret-value',
        clientIp: '198.51.100.20',
        clientUserAgent: 'spoofed-agent/1.0',
      })
      .expect(200);

    expect(mcpApiKeyRepository.recordUsage).toHaveBeenCalledWith('key-usage-fail', expect.objectContaining({
      lastUsedUserAgent: 'observed-agent/1.0',
    }));
    expect(res.body.principal.lifelineUserId).toBe('user-1');
  });

  it('rejects an invalid API key clearly', async () => {
    const mcpApiKeyRepository = {
      findByKeyPrefix: jest.fn(async () => ({
        id: 'key-1',
        userId: 'user-1',
        name: 'Desktop key',
        keyPrefix: 'lk_live_123',
        keyHash: hashMcpApiKeySecret('secret-value', 'pepper'),
        scopes: ['tasks:read'],
        status: 'active',
        expiresAt: null,
        revokedAt: null,
      })),
      recordUsage: jest.fn(async () => undefined),
    };
    const userRepository = {
      findById: jest.fn(async () => ({ id: 'user-1', name: 'Ziyad' })),
    };
    const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
      mcpApiKeyRepository,
      userRepository,
      now: () => new Date('2026-03-07T12:00:00.000Z'),
    });

    const app = makeApp({ mcpApiKeyRepository, userRepository, resolveMcpApiKeyPrincipal });
    const res = await request(app)
      .post('/internal/mcp/auth/resolve-api-key')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret')
      .send({ apiKey: 'lk_live_123.wrong-secret' })
      .expect(401);

    expect(mcpApiKeyRepository.recordUsage).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/Invalid API key/i);
  });

  it('rejects a revoked API key clearly', async () => {
    const mcpApiKeyRepository = {
      findByKeyPrefix: jest.fn(async () => ({
        id: 'key-1',
        userId: 'user-1',
        name: 'Desktop key',
        keyPrefix: 'lk_live_123',
        keyHash: hashMcpApiKeySecret('secret-value', 'pepper'),
        scopes: ['tasks:read'],
        status: 'revoked',
        expiresAt: null,
        revokedAt: '2026-03-01T00:00:00.000Z',
      })),
      recordUsage: jest.fn(async () => undefined),
    };
    const userRepository = {
      findById: jest.fn(async () => ({ id: 'user-1', name: 'Ziyad' })),
    };
    const resolveMcpApiKeyPrincipal = new ResolveMcpApiKeyPrincipal({
      mcpApiKeyRepository,
      userRepository,
      now: () => new Date('2026-03-07T12:00:00.000Z'),
    });

    const app = makeApp({ mcpApiKeyRepository, userRepository, resolveMcpApiKeyPrincipal });
    const res = await request(app)
      .post('/internal/mcp/auth/resolve-api-key')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret')
      .send({ apiKey: 'lk_live_123.secret-value' })
      .expect(403);

    expect(mcpApiKeyRepository.recordUsage).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/API key revoked/i);
  });
});
