class DeleteTodo {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute(id) {
        await this.todoRepository.delete(id);
    }
}
module.exports = DeleteTodo;
