import express from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { getOAuthProtectedResourceMetadataUrl, mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createApiKeyAuthenticator } from './auth/apiKeyAuth.js';
import { createOAuthAuthenticator } from './auth/oauthAuth.js';
import { createRequestAuthenticator } from './auth/requestAuthenticator.js';
import { createAuth0TokenVerifier } from './auth/auth0TokenVerifier.js';
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

  if (error instanceof LifelineMcpError && error.headers) {
    Object.entries(error.headers).forEach(([headerName, headerValue]) => {
      if (headerValue) {
        res.set(headerName, headerValue);
      }
    });
  }

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

function buildPublicBaseUrl(config) {
  if (config.publicBaseUrl) {
    return config.publicBaseUrl;
  }

  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  return `http://${host}:${config.port}`;
}

export function createApp({
  config = loadConfig(),
  backendClient = new LifelineBackendClient(config),
  apiKeyAuthenticator = null,
  tokenVerifier = null,
  oauthAuthenticator = null,
  authenticator = null,
  serverFactory = createLifelineMcpServer,
} = {}) {
  const oauthEnabled = Boolean(config.auth0?.enabled);
  const publicBaseUrl = buildPublicBaseUrl(config);
  const resourceServerUrl = new URL('/mcp', publicBaseUrl);
  const resourceMetadataUrl = oauthEnabled
    ? getOAuthProtectedResourceMetadataUrl(resourceServerUrl)
    : null;
  const resolvedApiKeyAuthenticator = apiKeyAuthenticator || createApiKeyAuthenticator({ backendClient });
  const resolvedTokenVerifier = tokenVerifier || (oauthEnabled ? createAuth0TokenVerifier({ config }) : null);
  const resolvedOauthAuthenticator = oauthAuthenticator || (oauthEnabled
    ? createOAuthAuthenticator({
      backendClient,
      tokenVerifier: resolvedTokenVerifier,
      resourceMetadataUrl,
    })
    : null);
  const resolvedAuthenticator = authenticator || createRequestAuthenticator({
    config,
    backendClient,
    apiKeyAuthenticator: resolvedApiKeyAuthenticator,
    oauthAuthenticator: resolvedOauthAuthenticator,
    resourceMetadataUrl,
  });
  const app = createMcpExpressApp({
    host: config.host,
    allowedHosts: config.allowedHosts.length > 0 ? config.allowedHosts : undefined,
  });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  if (oauthEnabled && config.auth0.oauthMetadata) {
    app.use(mcpAuthMetadataRouter({
      oauthMetadata: config.auth0.oauthMetadata,
      resourceServerUrl,
      scopesSupported: config.auth0.supportedScopes,
      resourceName: config.auth0.resourceName,
      serviceDocumentationUrl: config.auth0.serviceDocumentationUrl
        ? new URL(config.auth0.serviceDocumentationUrl)
        : undefined,
    }));
  }

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: config.serviceName,
      publicBaseUrl: config.publicBaseUrl,
      transport: 'streamable-http',
      auth: oauthEnabled ? ['api-key', 'auth0-oauth'] : ['api-key'],
      oauth: oauthEnabled
        ? {
          issuer: config.auth0.issuerUrl,
          audiences: config.auth0.audiences,
          resourceMetadataUrl,
        }
        : null,
      mode: 'stateless',
    });
  });

  app.post('/mcp', async (req, res) => {
    let server = null;
    let transport = null;

    try {
      const { principal } = await resolvedAuthenticator.authenticateRequest(req);
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
