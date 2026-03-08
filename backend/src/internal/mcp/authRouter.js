const express = require('express');
const { createInternalMcpAuthHandlers } = require('./authHandlers');

function createInternalMcpAuthRouter(dependencies) {
  const router = express.Router();
  const handlers = createInternalMcpAuthHandlers(dependencies);

  router.post('/resolve-api-key', handlers.resolveApiKey);
  router.post('/resolve-oauth-principal', handlers.resolveOAuthPrincipal);

  return router;
}

module.exports = {
  createInternalMcpAuthRouter,
};
