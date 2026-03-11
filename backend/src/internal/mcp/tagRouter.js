const express = require('express');
const { requireInternalMcpPrincipal } = require('./principalMiddleware');
const { createInternalTagHandlers } = require('./tagHandlers');

function createInternalMcpTagRouter(dependencies) {
  const router = express.Router();
  const handlers = createInternalTagHandlers(dependencies);

  router.use(requireInternalMcpPrincipal());

  router.get('/', handlers.listTags);
  router.post('/', handlers.createTag);
  router.patch('/:id', handlers.updateTag);
  router.delete('/:id', handlers.deleteTag);

  return router;
}

module.exports = {
  createInternalMcpTagRouter,
};
