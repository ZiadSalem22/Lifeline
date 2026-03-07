class SetTodoCompletion {
  constructor(todoRepository) {
    this.todoRepository = todoRepository;
  }

  async execute(userId, id, isCompleted) {
    const todo = await this.todoRepository.findById(id, userId);
    if (!todo) {
      return null;
    }

    const normalizedCompleted = !!isCompleted;
    if (todo.isCompleted === normalizedCompleted) {
      return todo;
    }

    todo.isCompleted = normalizedCompleted;
    await this.todoRepository.save(todo);
    return todo;
  }
}

module.exports = SetTodoCompletion;
