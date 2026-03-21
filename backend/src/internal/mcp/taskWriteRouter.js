const express = require('express');
const { validateTodoCreate, validateTodoUpdate } = require('../../middleware/validateTodo');
const { requireInternalMcpPrincipal } = require('./principalMiddleware');
const { createInternalTaskWriteHandlers } = require('./taskWriteHandlers');
const { normalizeMcpCreateDueDate, normalizeMcpUpdateDueDate } = require('./taskDueDate');
const { resolveMcpTaskTags } = require('./taskTags');

function normalizeCreateDueDate(req, _res, next) {
  req.body = normalizeMcpCreateDueDate(req.body);
  next();
}

function createNormalizeUpdateDueDate(todoRepository) {
  return async function normalizeUpdateDueDate(req, _res, next) {
    try {
      const userId = req.mcpPrincipal?.lifelineUserId;
      const existingTask = userId && todoRepository?.findById
        ? await todoRepository.findById(req.params.id, userId)
        : null;

      req.body = normalizeMcpUpdateDueDate(req.body, existingTask);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function createNormalizeTaskTags(listTags) {
  return async function normalizeTaskTags(req, _res, next) {
    try {
      if (!Object.prototype.hasOwnProperty.call(req.body, 'tags')) {
        next();
        return;
      }

      req.body = {
        ...req.body,
        tags: await resolveMcpTaskTags(req.body.tags, {
          userId: req.mcpPrincipal?.lifelineUserId,
          listTags,
        }),
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function createInternalMcpTaskWriteRouter(dependencies) {
  const router = express.Router();
  const handlers = createInternalTaskWriteHandlers(dependencies);
  const normalizeUpdateDueDate = createNormalizeUpdateDueDate(dependencies?.todoRepository);
  const normalizeTaskTags = createNormalizeTaskTags(dependencies?.listTags);

  router.use(requireInternalMcpPrincipal());

  router.post('/', normalizeTaskTags, normalizeCreateDueDate, validateTodoCreate, handlers.createTask);
  router.post('/batch', handlers.batchAction);
  router.patch('/:id', normalizeTaskTags, normalizeUpdateDueDate, validateTodoUpdate, handlers.updateTask);
  router.post('/:id/complete', handlers.completeTask);
  router.post('/:id/uncomplete', handlers.uncompleteTask);
  router.post('/:id/restore', handlers.restoreTask);
  router.delete('/:id', handlers.deleteTask);

  return router;
}

module.exports = {
  createInternalMcpTaskWriteRouter,
};
