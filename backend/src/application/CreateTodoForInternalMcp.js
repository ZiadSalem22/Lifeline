const { AppError } = require('../utils/errors');

const MAX_FREE_TASKS = 200;

class CreateTodoForInternalMcp {
  constructor({ userRepository, todoRepository, createTodo }) {
    this.userRepository = userRepository;
    this.todoRepository = todoRepository;
    this.createTodo = createTodo;
  }

  async execute(userId, payload) {
    const user = await this.userRepository.findById(userId);
    const role = user?.role || 'free';

    if (role === 'free') {
      const currentCount = await this.todoRepository.countByUser(userId);
      if (currentCount >= MAX_FREE_TASKS) {
        throw new AppError('Free tier max tasks reached.', 403);
      }
    }

    const {
      title,
      dueDate,
      tags,
      isFlagged,
      duration,
      priority,
      dueTime,
      subtasks,
      description,
      recurrence,
    } = payload;

    return this.createTodo.execute(
      userId,
      title,
      dueDate,
      tags,
      isFlagged,
      duration,
      priority || 'medium',
      dueTime || null,
      subtasks || [],
      description || '',
      recurrence || null,
    );
  }
}

module.exports = {
  CreateTodoForInternalMcp,
  MAX_FREE_TASKS,
};
