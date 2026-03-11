const { ValidationError } = require('../../utils/errors');
const { normalizeDateOnly, normalizeTaskForInternalMcp, normalizeTaskListForInternalMcp } = require('./taskPayloads');
const {
  ISO_DATE_TOKEN_PATTERN,
  compareTasksForUpcoming,
  doesTaskOccurInRange,
  doesTaskOccurOnDate,
  isTaskEligibleForUpcoming,
  resolveDateToken,
  resolveWindowToken,
} = require('./taskDateFilters');
const { parsePositiveInteger, resolveTaskForUser } = require('./taskResolution');

const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high']);
const ALLOWED_STATUSES = new Set(['active', 'completed']);
const ALLOWED_SORT_VALUES = new Set(['priority', 'duration', 'name', 'date_desc']);
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function parseBooleanQueryValue(value, fieldName) {
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;

  throw new ValidationError(`Invalid ${fieldName}.`);
}

function parseOptionalPositiveInteger(value, fieldName) {
  if (typeof value === 'undefined' || value === null || value === '') return null;
  return parsePositiveInteger(value, fieldName);
}

function normalizeTagsQueryValue(value) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseSearchFilters(query = {}) {
  const priority = query.priority ? String(query.priority).trim().toLowerCase() : null;
  if (priority && !ALLOWED_PRIORITIES.has(priority)) {
    throw new ValidationError('Invalid priority filter.');
  }

  const status = query.status ? String(query.status).trim().toLowerCase() : null;
  if (status && !ALLOWED_STATUSES.has(status)) {
    throw new ValidationError('Invalid status filter.');
  }

  const sortBy = query.sortBy ? String(query.sortBy).trim() : null;
  if (sortBy && !ALLOWED_SORT_VALUES.has(sortBy)) {
    throw new ValidationError('Invalid sortBy filter.');
  }

  const page = parseOptionalPositiveInteger(query.page, 'page') || 1;
  const rawLimit = parseOptionalPositiveInteger(query.limit || query.pageSize, 'limit') || DEFAULT_LIMIT;
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const taskNumber = parseOptionalPositiveInteger(query.taskNumber, 'taskNumber');
  const minDuration = parseOptionalPositiveInteger(query.minDuration, 'minDuration');
  const maxDuration = parseOptionalPositiveInteger(query.maxDuration, 'maxDuration');

  if (minDuration !== null && maxDuration !== null && minDuration > maxDuration) {
    throw new ValidationError('minDuration cannot be greater than maxDuration.');
  }

  const startDate = query.startDate || query.dueDateFrom || null;
  const endDate = query.endDate || query.dueDateTo || null;

  if (startDate && !ISO_DATE_TOKEN_PATTERN.test(startDate)) {
    throw new ValidationError('Invalid startDate. Use YYYY-MM-DD format.');
  }
  if (endDate && !ISO_DATE_TOKEN_PATTERN.test(endDate)) {
    throw new ValidationError('Invalid endDate. Use YYYY-MM-DD format.');
  }

  return {
    q: String(query.query || query.q || '').trim(),
    tags: normalizeTagsQueryValue(query.tags || query.tag),
    priority,
    status,
    startDate,
    endDate,
    flagged: parseBooleanQueryValue(query.flagged, 'flagged'),
    includeArchived: parseBooleanQueryValue(query.includeArchived, 'includeArchived') || false,
    minDuration,
    maxDuration,
    sortBy,
    page,
    limit,
    offset: (page - 1) * limit,
    taskNumber,
  };
}

function createInternalTaskReadHandlers({ todoRepository, searchTodos, listTodos, findSimilarTasks, getNow = () => new Date() }) {
  if (!todoRepository || !searchTodos || !listTodos) {
    throw new Error('todoRepository, searchTodos, and listTodos are required for internal MCP task read handlers');
  }

  return {
    async getStatistics(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const todos = await listTodos.execute(userId);
        const tasks = Array.isArray(todos) ? todos : [];
        const now = getNow();
        const todayStr = now.toISOString().slice(0, 10);

        const total = tasks.length;
        const completed = tasks.filter((t) => t.isCompleted).length;
        const active = total - completed;
        const flagged = tasks.filter((t) => t.isFlagged && !t.isCompleted).length;
        const overdue = tasks.filter((t) => {
          if (t.isCompleted || !t.dueDate) return false;
          const due = typeof t.dueDate === 'string' ? t.dueDate.slice(0, 10) : '';
          return due < todayStr;
        }).length;
        const withDuration = tasks.filter((t) => !t.isCompleted && t.duration > 0);
        const totalMinutes = withDuration.reduce((sum, t) => sum + Number(t.duration || 0), 0);

        return res.json({
          total,
          active,
          completed,
          flagged,
          overdue,
          totalActiveMinutes: totalMinutes,
        });
      } catch (error) {
        return next(error);
      }
    },

    async searchTasks(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const filters = parseSearchFilters(req.query);
        const results = await searchTodos.execute(userId, filters);

        return res.json({
          tasks: normalizeTaskListForInternalMcp(results.todos || []),
          total: Number(results.total || 0),
          page: filters.page,
          limit: filters.limit,
        });
      } catch (error) {
        return next(error);
      }
    },

    async getTaskByNumber(req, res, next) {
      try {
        const task = await resolveTaskForUser({
          todoRepository,
          userId: req.mcpPrincipal.lifelineUserId,
          taskNumber: req.params.taskNumber,
        });

        if (!task) {
          return res.status(404).json({ status: 'error', message: 'Task not found.' });
        }

        return res.json({
          task: normalizeTaskForInternalMcp(task),
        });
      } catch (error) {
        return next(error);
      }
    },

    async listTasksByDay(req, res, next) {
      try {
        const resolvedDate = resolveDateToken(req.params.dateToken, getNow());
        const tasks = await listTodos.execute(req.mcpPrincipal.lifelineUserId);
        const matchingTasks = tasks.filter((task) => doesTaskOccurOnDate(task, resolvedDate));

        return res.json({
          dateToken: req.params.dateToken,
          resolvedDate,
          tasks: normalizeTaskListForInternalMcp(matchingTasks),
        });
      } catch (error) {
        return next(error);
      }
    },

    async listUpcomingTasks(req, res, next) {
      try {
        const fromDate = req.query.fromDate
          ? (() => {
            const value = String(req.query.fromDate || '').trim();
            if (!ISO_DATE_TOKEN_PATTERN.test(value)) {
              throw new ValidationError('Invalid fromDate. Use YYYY-MM-DD.');
            }
            return normalizeDateOnly(value);
          })()
          : resolveDateToken('today', getNow());

        if (!fromDate) {
          throw new ValidationError('Invalid fromDate.');
        }

        const limit = parseOptionalPositiveInteger(req.query.limit, 'limit') || DEFAULT_LIMIT;
        const tasks = await listTodos.execute(req.mcpPrincipal.lifelineUserId);
        const upcomingTasks = tasks
          .filter((task) => isTaskEligibleForUpcoming(task, fromDate))
          .sort((left, right) => compareTasksForUpcoming(left, right, fromDate))
          .slice(0, Math.min(limit, MAX_LIMIT));

        return res.json({
          fromDate,
          includesUnscheduled: false,
          ordering: 'effectiveDateAsc,orderAsc,taskNumberAsc',
          tasks: normalizeTaskListForInternalMcp(upcomingTasks),
          count: upcomingTasks.length,
        });
      } catch (error) {
        return next(error);
      }
    },

    async exportData(req, res, next) {
      try {
        const userId = req.mcpPrincipal.lifelineUserId;
        const todos = await listTodos.execute(userId);
        const tasks = Array.isArray(todos) ? todos : [];

        const total = tasks.length;
        const completedCount = tasks.filter((t) => t.isCompleted).length;
        const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

        return res.json({
          exported_at: new Date().toISOString(),
          todos: normalizeTaskListForInternalMcp(tasks),
          stats: { totalTodos: total, completedCount, completionRate },
        });
      } catch (error) {
        return next(error);
      }
    },

    async listTasksByWindow(req, res, next) {
      try {
        const windowToken = req.params.windowToken;
        const includeCompleted = req.query.includeCompleted === 'true';
        const window = resolveWindowToken(windowToken, getNow());
        const tasks = await listTodos.execute(req.mcpPrincipal.lifelineUserId);
        let matched = tasks.filter((task) => doesTaskOccurInRange(task, window.start, window.end));

        if (!includeCompleted) {
          matched = matched.filter((task) => !task.isCompleted);
        }

        // Also include overdue active tasks for overdue window
        if (windowToken === 'overdue') {
          matched = matched.filter((task) => !task.isCompleted);
        }

        return res.json({
          windowToken,
          resolvedStart: window.start,
          resolvedEnd: window.end,
          tasks: normalizeTaskListForInternalMcp(matched),
          count: matched.length,
        });
      } catch (error) {
        return next(error);
      }
    },

    async findSimilarTasksHandler(req, res, next) {
      try {
        if (!findSimilarTasks) {
          return res.status(501).json({ status: 'error', message: 'Similarity search not available.' });
        }
        const userId = req.mcpPrincipal.lifelineUserId;
        const title = String(req.query.title || '').trim();
        if (!title) {
          return res.status(400).json({ status: 'error', message: 'title query parameter is required.' });
        }
        const limit = parseOptionalPositiveInteger(req.query.limit, 'limit') || 5;
        const threshold = req.query.threshold ? parseFloat(req.query.threshold) : 0.3;

        const tasks = await findSimilarTasks.execute(userId, { title, limit, threshold });
        return res.json({
          query: title,
          tasks: normalizeTaskListForInternalMcp(tasks),
          count: tasks.length,
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createInternalTaskReadHandlers,
  parseSearchFilters,
};
