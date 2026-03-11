const { randomUUID } = require('crypto');

const MAX_TITLE_LENGTH = 500;
const MAX_SUBTASKS_PER_TASK = 50;

/**
 * Validates and normalizes a single subtask shape.
 * Ensures subtaskId (UUID) and position (1-based int) are present.
 */
function normalizeSubtask(raw, position) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Each subtask must be an object.');
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Subtask title is required and must be at most ${MAX_TITLE_LENGTH} characters.`);
  }

  return {
    subtaskId: typeof raw.subtaskId === 'string' && raw.subtaskId.length > 0 ? raw.subtaskId : randomUUID(),
    title,
    isCompleted: typeof raw.isCompleted === 'boolean' ? raw.isCompleted : false,
    position,
    ...(raw.id !== undefined ? { id: raw.id } : {}),
  };
}

/**
 * Normalizes an entire subtask array: validates shapes, assigns subtaskIds where
 * missing, and re-sequences positions to a contiguous 1-based series.
 */
function normalizeSubtasks(subtasks) {
  if (!Array.isArray(subtasks)) return [];
  if (subtasks.length > MAX_SUBTASKS_PER_TASK) {
    throw new Error(`A task may have at most ${MAX_SUBTASKS_PER_TASK} subtasks.`);
  }
  return subtasks.map((raw, index) => normalizeSubtask(raw, index + 1));
}

/**
 * Validates that a subtaskId looks like a valid UUID string.
 */
function isValidSubtaskId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

module.exports = {
  normalizeSubtask,
  normalizeSubtasks,
  isValidSubtaskId,
  MAX_SUBTASKS_PER_TASK,
  MAX_TITLE_LENGTH,
};
