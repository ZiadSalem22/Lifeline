const express = require('express');
const request = require('supertest');
const { requireAuth } = require('../../src/middleware/roles');
const { errorHandler } = require('../../src/middleware/errorHandler');
const McpApiKeyController = require('../../src/controllers/McpApiKeyController');
const createMcpApiKeyRoutes = require('../../src/routes/mcpApiKeyRoutes');

function buildApp(currentUser, overrides = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.currentUser = currentUser;
    next();
  });

  const controller = new McpApiKeyController({
    listCurrentUserMcpApiKeys: {
      execute: overrides.listExecute || jest.fn(async ({ userId }) => ([{ id: 'key-1', name: userId }])),
    },
    createSelfServeMcpApiKey: {
      execute: overrides.createExecute || jest.fn(async ({ userId, name }) => ({
        apiKey: {
          id: 'key-1',
          name,
          keyPrefix: 'lk_key1',
          scopes: ['tasks:read'],
          status: 'active',
          createdAt: '2026-03-07T12:00:00.000Z',
          expiresAt: null,
          lastUsedAt: null,
          revokedAt: null,
        },
        plaintextKey: `lk_key1.${userId}`,
      })),
    },
    revokeCurrentUserMcpApiKey: {
      execute: overrides.revokeExecute || jest.fn(async ({ apiKeyId }) => ({
        id: apiKeyId,
        name: 'CLI key',
        keyPrefix: 'lk_key1',
        scopes: ['tasks:read'],
        status: 'revoked',
        createdAt: '2026-03-07T12:00:00.000Z',
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: '2026-03-07T12:30:00.000Z',
      })),
    },
  });

  app.use('/api/mcp-api-keys', requireAuth(), createMcpApiKeyRoutes(controller));
  app.use(errorHandler);
  return app;
}

describe('MCP API key routes', () => {
  it('lists keys for the authenticated user', async () => {
    const listExecute = jest.fn(async ({ userId }) => [{ id: 'key-1', name: userId }]);
    const app = buildApp({ id: 'user-1', roles: ['free'] }, { listExecute });

    const response = await request(app).get('/api/mcp-api-keys');

    expect(response.status).toBe(200);
    expect(listExecute).toHaveBeenCalledWith({ userId: 'user-1', limit: 25 });
    expect(response.body.apiKeys).toEqual([{ id: 'key-1', name: 'user-1' }]);
    expect(response.body.limit).toBe(25);
  });

  it('validates create input and returns 400 for invalid presets', async () => {
    const app = buildApp({ id: 'user-1', roles: ['free'] });

    const response = await request(app)
      .post('/api/mcp-api-keys')
      .send({ name: '', scopePreset: 'all', expiryPreset: 'custom' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/API key name cannot be empty/);
  });

  it('creates a key for the authenticated user', async () => {
    const createExecute = jest.fn(async ({ userId, name, scopePreset, expiryPreset }) => ({
      apiKey: { id: 'key-1', name, keyPrefix: 'lk_key1', scopes: ['tasks:read'], status: 'active', createdAt: '2026-03-07T12:00:00.000Z', expiresAt: null, lastUsedAt: null, revokedAt: null },
      plaintextKey: `lk_key1.${userId}`,
      scopePreset,
      expiryPreset,
    }));
    const app = buildApp({ id: 'user-1', roles: ['free'] }, { createExecute });

    const response = await request(app)
      .post('/api/mcp-api-keys')
      .send({ name: 'Desktop CLI', scopePreset: 'read_only', expiryPreset: 'never' });

    expect(response.status).toBe(201);
    expect(createExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Desktop CLI',
      scopePreset: 'read_only',
      expiryPreset: 'never',
    });
    expect(response.body.plaintextKey).toBe('lk_key1.user-1');
  });

  it('revokes a key for the authenticated user', async () => {
    const revokeExecute = jest.fn(async ({ userId, apiKeyId }) => ({ id: apiKeyId, name: userId, status: 'revoked' }));
    const app = buildApp({ id: 'user-1', roles: ['free'] }, { revokeExecute });

    const response = await request(app).post('/api/mcp-api-keys/0fba7f31-f882-4d90-a532-b3e37647ad6d/revoke');

    expect(response.status).toBe(200);
    expect(revokeExecute).toHaveBeenCalledWith({ userId: 'user-1', apiKeyId: '0fba7f31-f882-4d90-a532-b3e37647ad6d' });
    expect(response.body.apiKey).toEqual({ id: '0fba7f31-f882-4d90-a532-b3e37647ad6d', name: 'user-1', status: 'revoked' });
  });

  it('blocks unauthenticated access', async () => {
    const app = buildApp(null);

    const response = await request(app).get('/api/mcp-api-keys');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/Please log in/);
  });
});
