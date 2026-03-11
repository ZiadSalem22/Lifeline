const { NotFoundError, ValidationError } = require('../utils/errors');

class FindSimilarTasks {
  constructor(todoRepository) {
    if (!todoRepository) throw new Error('todoRepository is required');
    this.todoRepository = todoRepository;
  }

  async execute(userId, { title, limit = 5, threshold = 0.3 }) {
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new ValidationError('title is required for similarity search.');
    }
    if (limit < 1 || limit > 20) {
      throw new ValidationError('limit must be between 1 and 20.');
    }
    if (threshold < 0.1 || threshold > 1.0) {
      throw new ValidationError('threshold must be between 0.1 and 1.0.');
    }

    return this.todoRepository.findSimilarByTitle(userId, title.trim(), { limit, threshold });
  }
}

module.exports = { FindSimilarTasks };
