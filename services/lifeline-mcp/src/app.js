import express from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createApiKeyAuthenticator } from './auth/apiKeyAuth.js';
import { LifelineBackendClient } from './backend/internalBackendClient.js';
import { loadConfig } from './config.js';
import { LifelineMcpError } from './errors.js';
import { createLifelineMcpServer } from './mcp/serverFactory.js';

function toJsonRpcErrorCode(status) {
  if (status === 400) return -32602;
  if (status === 401) return -32001;
  if (status === 403) return -32003;
  if (status === 404) return -32004;
  return -32603;
}

function writeHttpError(res, error) {
  if (res.headersSent) return;

  const status = error instanceof LifelineMcpError ? error.status : 500;
  const code = error instanceof LifelineMcpError ? error.code : 'internal_error';
  const message = error?.message || 'Internal server error';

  res.status(status).json({
    jsonrpc: '2.0',
    error: {
      code: toJsonRpcErrorCode(status),
      message,
      data: {
        code,
        status,
      },
    },
    id: null,
  });
}

export function createApp({
  config = loadConfig(),
  backendClient = new LifelineBackendClient(config),
  authenticator = createApiKeyAuthenticator({ backendClient }),
  serverFactory = createLifelineMcpServer,
} = {}) {
  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts.length > 0 ? config.allowedHosts : undefined,
  });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: config.serviceName,
      publicBaseUrl: config.publicBaseUrl,
      transport: 'streamable-http',
      auth: 'api-key',
      mode: 'stateless',
    });
  });

  app.post('/mcp', async (req, res) => {
    let server = null;
    let transport = null;

    try {
      const { principal } = await authenticator.authenticateRequest(req);
      server = serverFactory({ principal, backendClient, config });
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      writeHttpError(res, error);
    } finally {
      if (transport) {
        await transport.close().catch(() => undefined);
      }
      if (server) {
        await server.close().catch(() => undefined);
      }
    }
  });

  app.all('/mcp', (req, res) => {
    res.status(405)
      .set('Allow', 'POST')
      .json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: `Method ${req.method} not allowed.`,
          data: {
            code: 'method_not_allowed',
            status: 405,
          },
        },
        id: null,
      });
  });

  return app;
}
