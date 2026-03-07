const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { createInternalMcpRouter } = require('../../src/internal/mcp/router');
const {
  INTERNAL_MCP_SHARED_SECRET_HEADER,
  MCP_PRINCIPAL_HEADERS,
} = require('../../src/internal/mcp/constants');

describe('internal MCP route foundation', () => {
  const originalSecret = process.env.MCP_INTERNAL_SHARED_SECRET;

  beforeEach(() => {
    process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
  });

  afterEach(() => {
    if (typeof originalSecret === 'undefined') {
      delete process.env.MCP_INTERNAL_SHARED_SECRET;
    } else {
      process.env.MCP_INTERNAL_SHARED_SECRET = originalSecret;
    }
  });

  function makeApp() {
    const app = express();
    app.use('/internal/mcp', createInternalMcpRouter());
    app.use(errorHandler);
    return app;
  }

  it('rejects requests without the internal shared secret', async () => {
    const app = makeApp();
    const res = await request(app).get('/internal/mcp/health');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing internal service authentication/i);
  });

  it('rejects requests with only user-principal headers and no service auth', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/internal/mcp/health')
      .set(MCP_PRINCIPAL_HEADERS.lifelineUserId, 'user-123');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing internal service authentication/i);
  });

  it('rejects requests with an invalid internal shared secret', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/internal/mcp/health')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'wrong-secret');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid internal service authentication/i);
  });

  it('allows requests with a valid internal shared secret', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/internal/mcp/health')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.authenticatedService).toBe('lifeline-mcp');
  });
});
