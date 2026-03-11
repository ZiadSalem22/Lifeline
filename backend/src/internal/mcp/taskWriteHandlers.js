const { ValidationError } = require('../../utils/errors');
const { normalizeTaskForInternalMcp } = require('./taskPayloads');
const { resolveTaskForUser } = require('./taskResolution');

const MUTABLE_UPDATE_FIELDS = Object.freeze([
  'title',
  'description',
  'dueDate',
  'dueTime',
  'tags',
  'isFlagged',
  'duration',
  'priority',
  'subtasks',
]);

function assertNoUnsupportedTodoUpdateFields(payload = {}) {
  const unsupportedFields = Object.keys(payload).filter((fieldName) => !MUTABLE_UPDATE_FIELDS.includes(fieldName));
  if (unsupportedFields.length > 0) {
    throw new ValidationError(`Unsupported update fields: ${unsupportedFields.join(', ')}.`);
  }
}

function pickAllowedTodoUpdates(payload = {}) {
  return MUTABLE_UPDATE_FIELDS.reduce((updates, fieldName) => {
    if (Object.prototype.hasOwnProperty.call(payload, fieldName)) {
      updates[fieldName] = payload[fieldName];
    }
    return updates;
  }, {});
}

function buildDeleteResult(task) {
  return {
    id: task.id,
    taskNumber: task.taskNumber ?? null,
    deleted: true,
    deleteMode: 'archived',
  };
}

function createInternalTaskWriteHandlers({
  todoRepository,
  createTodoForInternalMcp,
  updateTodo,
  deleteTodo,
  setTodoCompletion,
}) {
  if (!todoRepository || !createTodoForInternalMcp || !updateTodo || !deleteTodo || !setTodoCompletion) {
    throw new Error('todoRepository, createTodoForInternalMcp, updateTodo, deleteTodo, and setTodoCompletion are required for internal MCP task write handlers');
  }

  return {
    async createTask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const task = await createTodoForInternalMcp.execute(userId, req.body);

        return res.status(201).json({
          task: normalizeTaskForInternalMcp(task),
        });
      } catch (error) {
        return next(error);
      }
    },

    async updateTask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({
          todoRepository,
          userId,
          id: req.params.id,
        });

        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        assertNoUnsupportedTodoUpdateFields(req.body);
        const updates = pickAllowedTodoUpdates(req.body);
        const task = await updateTodo.execute(userId, existingTask.id, updates);

        return res.json({
          task: normalizeTaskForInternalMcp(task),
        });
      } catch (error) {
        if (error?.message === 'Todo not found') {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }
        return next(error);
      }
    },

    async completeTask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({
          todoRepository,
          userId,
          id: req.params.id,
        });

        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        const task = await setTodoCompletion.execute(userId, existingTask.id, true);
        return res.json({
          task: normalizeTaskForInternalMcp(task),
          completed: true,
        });
      } catch (error) {
        return next(error);
      }
    },

    async uncompleteTask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({
          todoRepository,
          userId,
          id: req.params.id,
        });

        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        const task = await setTodoCompletion.execute(userId, existingTask.id, false);
        return res.json({
          task: normalizeTaskForInternalMcp(task),
          completed: false,
        });
      } catch (error) {
        return next(error);
      }
    },

    async deleteTask(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const existingTask = await resolveTaskForUser({
          todoRepository,
          userId,
          id: req.params.id,
        });

        if (!existingTask) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        await deleteTodo.execute(userId, existingTask.id);
        return res.json(buildDeleteResult(existingTask));
      } catch (error) {
        return next(error);
      }
    },

    async batchAction(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const { action, taskNumbers } = req.body;
        const ALLOWED_ACTIONS = ['complete', 'uncomplete', 'delete'];
        if (!ALLOWED_ACTIONS.includes(action)) {
          return res.status(400).json({ status: 'error', message: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(', ')}` });
        }
        if (!Array.isArray(taskNumbers) || taskNumbers.length === 0 || taskNumbers.length > 50) {
          return res.status(400).json({ status: 'error', message: 'taskNumbers must be an array of 1-50 task numbers.' });
        }

        const results = [];
        for (const num of taskNumbers) {
          try {
            const task = await resolveTaskForUser({ todoRepository, userId, taskNumber: num });
            if (!task) {
              results.push({ taskNumber: num, status: 'not_found' });
              continue;
            }
            if (action === 'complete') {
              await setTodoCompletion.execute(userId, task.id, true);
              results.push({ taskNumber: num, status: 'completed' });
            } else if (action === 'uncomplete') {
              await setTodoCompletion.execute(userId, task.id, false);
              results.push({ taskNumber: num, status: 'uncompleted' });
            } else if (action === 'delete') {
              await deleteTodo.execute(userId, task.id);
              results.push({ taskNumber: num, status: 'archived' });
            }
          } catch (itemError) {
            results.push({ taskNumber: num, status: 'error', reason: itemError.message || 'Unknown error' });
          }
        }

        return res.json({ action, results });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  MUTABLE_UPDATE_FIELDS,
  assertNoUnsupportedTodoUpdateFields,
  buildDeleteResult,
  createInternalTaskWriteHandlers,
  pickAllowedTodoUpdates,
};
