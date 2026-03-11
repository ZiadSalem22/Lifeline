const { normalizeTaskForInternalMcp } = require('./taskPayloads');
const { resolveTaskForUser } = require('./taskResolution');
const { ValidationError } = require('../../utils/errors');

function createInternalSubtaskHandlers({ todoRepository, subtaskOperations }) {
  if (!todoRepository || !subtaskOperations) {
    throw new Error('todoRepository and subtaskOperations are required for subtask handlers');
  }

  return {
    async addSubtask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({ todoRepository, userId, id: req.params.taskId });
        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        const title = String(req.body.title || '').trim();
        if (!title) {
          return res.status(400).json({ status: 'error', message: 'Subtask title is required.' });
        }

        const task = await subtaskOperations.addSubtask(userId, existingTask.id, { title });
        return res.status(201).json({ task: normalizeTaskForInternalMcp(task) });
      } catch (error) {
        return next(error);
      }
    },

    async completeSubtask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({ todoRepository, userId, id: req.params.taskId });
        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        const task = await subtaskOperations.completeSubtask(userId, existingTask.id, req.params.subtaskId);
        return res.json({ task: normalizeTaskForInternalMcp(task) });
      } catch (error) {
        return next(error);
      }
    },

    async uncompleteSubtask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({ todoRepository, userId, id: req.params.taskId });
        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        const task = await subtaskOperations.uncompleteSubtask(userId, existingTask.id, req.params.subtaskId);
        return res.json({ task: normalizeTaskForInternalMcp(task) });
      } catch (error) {
        return next(error);
      }
    },

    async updateSubtask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({ todoRepository, userId, id: req.params.taskId });
        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        const updates = {};
        if (req.body.title !== undefined) updates.title = req.body.title;
        if (req.body.isCompleted !== undefined) updates.isCompleted = req.body.isCompleted;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ status: 'error', message: 'Provide at least one field to update (title, isCompleted).' });
        }

        const task = await subtaskOperations.updateSubtask(userId, existingTask.id, req.params.subtaskId, updates);
        return res.json({ task: normalizeTaskForInternalMcp(task) });
      } catch (error) {
        return next(error);
      }
    },

    async removeSubtask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({ todoRepository, userId, id: req.params.taskId });
        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        const task = await subtaskOperations.removeSubtask(userId, existingTask.id, req.params.subtaskId);
        return res.json({ task: normalizeTaskForInternalMcp(task), removed: true });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = { createInternalSubtaskHandlers };
