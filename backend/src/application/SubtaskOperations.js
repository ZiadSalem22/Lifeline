const { normalizeSubtasks, isValidSubtaskId } = require('../domain/SubtaskContract');
const { NotFoundError, ValidationError } = require('../utils/errors');

class SubtaskOperations {
  constructor(todoRepository) {
    if (!todoRepository) throw new Error('todoRepository is required');
    this.todoRepository = todoRepository;
  }

  async _loadTask(userId, taskId) {
    const task = await this.todoRepository.findById(taskId, userId);
    if (!task) throw new NotFoundError('Task not found.');
    if (task.archived) throw new ValidationError('Cannot modify subtasks on an archived task. Restore it first.');
    return task;
  }

  async addSubtask(userId, taskId, { title }) {
    const task = await this._loadTask(userId, taskId);
    const subtasks = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
    subtasks.push({ title, isCompleted: false });
    task.subtasks = normalizeSubtasks(subtasks);
    await this.todoRepository.save(task);
    return task;
  }

  async completeSubtask(userId, taskId, subtaskId) {
    return this._setSubtaskCompletion(userId, taskId, subtaskId, true);
  }

  async uncompleteSubtask(userId, taskId, subtaskId) {
    return this._setSubtaskCompletion(userId, taskId, subtaskId, false);
  }

  async updateSubtask(userId, taskId, subtaskId, updates) {
    if (!isValidSubtaskId(subtaskId)) throw new ValidationError('Invalid subtaskId.');
    const task = await this._loadTask(userId, taskId);
    const subtasks = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
    const index = subtasks.findIndex((s) => s.subtaskId === subtaskId);
    if (index === -1) throw new NotFoundError('Subtask not found.');

    if (updates.title !== undefined) {
      const title = String(updates.title).trim();
      if (!title) throw new ValidationError('Subtask title cannot be empty.');
      subtasks[index] = { ...subtasks[index], title };
    }

    if (typeof updates.isCompleted === 'boolean') {
      subtasks[index] = { ...subtasks[index], isCompleted: updates.isCompleted };
    }

    task.subtasks = normalizeSubtasks(subtasks);
    await this.todoRepository.save(task);
    return task;
  }

  async removeSubtask(userId, taskId, subtaskId) {
    if (!isValidSubtaskId(subtaskId)) throw new ValidationError('Invalid subtaskId.');
    const task = await this._loadTask(userId, taskId);
    const subtasks = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
    const index = subtasks.findIndex((s) => s.subtaskId === subtaskId);
    if (index === -1) throw new NotFoundError('Subtask not found.');
    subtasks.splice(index, 1);
    task.subtasks = normalizeSubtasks(subtasks);
    await this.todoRepository.save(task);
    return task;
  }

  async _setSubtaskCompletion(userId, taskId, subtaskId, isCompleted) {
    if (!isValidSubtaskId(subtaskId)) throw new ValidationError('Invalid subtaskId.');
    const task = await this._loadTask(userId, taskId);
    const subtasks = Array.isArray(task.subtasks) ? [...task.subtasks] : [];
    const index = subtasks.findIndex((s) => s.subtaskId === subtaskId);
    if (index === -1) throw new NotFoundError('Subtask not found.');
    subtasks[index] = { ...subtasks[index], isCompleted };
    task.subtasks = normalizeSubtasks(subtasks);
    await this.todoRepository.save(task);
    return task;
  }
}

module.exports = { SubtaskOperations };
