class DeleteTodo {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute(userId, id) {
        await this.todoRepository.delete(id, userId);
    }
}
module.exports = DeleteTodo;
