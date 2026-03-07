const { ValidationError } = require('../../utils/errors');

function parsePositiveInteger(value, fieldName) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new ValidationError(`Invalid ${fieldName}.`);
  }
  return parsed;
}

async function resolveTaskForUser({ todoRepository, userId, taskNumber = null, id = null }) {
  if (!todoRepository) {
    throw new ValidationError('Todo repository is required for task resolution.');
  }

  if (!userId) {
    throw new ValidationError('A Lifeline user id is required for task resolution.');
  }

  if (!taskNumber && !id) {
    throw new ValidationError('Provide taskNumber or id to resolve a task.');
  }

  let taskByNumber = null;
  if (taskNumber !== null && typeof taskNumber !== 'undefined' && taskNumber !== '') {
    const parsedTaskNumber = parsePositiveInteger(taskNumber, 'taskNumber');
    taskByNumber = await todoRepository.findByTaskNumber(userId, parsedTaskNumber);
  }

  let taskById = null;
  if (id) {
    taskById = await todoRepository.findById(id, userId);
  }

  if (taskById && taskByNumber && taskById.id !== taskByNumber.id) {
    throw new ValidationError('Provided task selectors do not resolve to the same task.');
  }

  return taskById || taskByNumber || null;
}

module.exports = {
  parsePositiveInteger,
  resolveTaskForUser,
};
