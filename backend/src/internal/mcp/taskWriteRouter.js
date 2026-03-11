const express = require('express');
const { validateTodoCreate, validateTodoUpdate } = require('../../middleware/validateTodo');
const { requireInternalMcpPrincipal } = require('./principalMiddleware');
const { createInternalTaskWriteHandlers } = require('./taskWriteHandlers');

function createInternalMcpTaskWriteRouter(dependencies) {
  const router = express.Router();
  const handlers = createInternalTaskWriteHandlers(dependencies);

  router.use(requireInternalMcpPrincipal());

  router.post('/', validateTodoCreate, handlers.createTask);
  router.post('/batch', handlers.batchAction);
  router.patch('/:id', validateTodoUpdate, handlers.updateTask);
  router.post('/:id/complete', handlers.completeTask);
  router.post('/:id/uncomplete', handlers.uncompleteTask);
  router.delete('/:id', handlers.deleteTask);

  return router;
}

module.exports = {
  createInternalMcpTaskWriteRouter,
};
