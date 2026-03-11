const express = require('express');
const { requireInternalMcpPrincipal } = require('./principalMiddleware');
const { createInternalTaskReadHandlers } = require('./taskReadHandlers');

function createInternalMcpTaskReadRouter(dependencies) {
  const router = express.Router();
  const handlers = createInternalTaskReadHandlers(dependencies);

  router.use(requireInternalMcpPrincipal());

  router.get('/search', handlers.searchTasks);
  router.get('/statistics', handlers.getStatistics);
  router.get('/export', handlers.exportData);
  router.get('/by-number/:taskNumber', handlers.getTaskByNumber);
  router.get('/day/:dateToken', handlers.listTasksByDay);
  router.get('/upcoming', handlers.listUpcomingTasks);

  return router;
}

module.exports = {
  createInternalMcpTaskReadRouter,
};
