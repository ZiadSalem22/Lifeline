const express = require('express');
const validate = require('../middleware/validate');
const { createMcpApiKeySchema, listMcpApiKeysQuerySchema, uuidParamSchema } = require('../validators');

function createMcpApiKeyRoutes(mcpApiKeyController, { writeLimiter = null } = {}) {
  const router = express.Router();

  /**
   * @openapi
   * /api/mcp-api-keys:
   *   get:
   *     summary: List the current user's MCP API keys
   *     tags: [Auth]
   */
  router.get('/', validate(listMcpApiKeysQuerySchema, 'query'), mcpApiKeyController.list.bind(mcpApiKeyController));

  const writeMiddlewares = [];
  if (writeLimiter) {
    writeMiddlewares.push(writeLimiter);
  }

  /**
   * @openapi
   * /api/mcp-api-keys:
   *   post:
   *     summary: Create a self-serve MCP API key for the current user
   *     tags: [Auth]
   */
  router.post(
    '/',
    ...writeMiddlewares,
    validate(createMcpApiKeySchema, 'body'),
    mcpApiKeyController.create.bind(mcpApiKeyController),
  );

  /**
   * @openapi
   * /api/mcp-api-keys/{id}/revoke:
   *   post:
   *     summary: Revoke one of the current user's MCP API keys
   *     tags: [Auth]
   */
  router.post(
    '/:id/revoke',
    ...writeMiddlewares,
    validate(uuidParamSchema, 'params'),
    mcpApiKeyController.revoke.bind(mcpApiKeyController),
  );

  return router;
}

module.exports = createMcpApiKeyRoutes;
