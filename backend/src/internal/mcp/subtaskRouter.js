const express = require('express');
const { requireInternalMcpPrincipal } = require('./principalMiddleware');
const { createInternalSubtaskHandlers } = require('./subtaskHandlers');

function createInternalMcpSubtaskRouter(dependencies) {
  const router = express.Router({ mergeParams: true });
  const handlers = createInternalSubtaskHandlers(dependencies);

  router.use(requireInternalMcpPrincipal());

  router.post('/', handlers.addSubtask);
  router.post('/:subtaskId/complete', handlers.completeSubtask);
  router.post('/:subtaskId/uncomplete', handlers.uncompleteSubtask);
  router.patch('/:subtaskId', handlers.updateSubtask);
  router.delete('/:subtaskId', handlers.removeSubtask);

  return router;
}

module.exports = { createInternalMcpSubtaskRouter };
