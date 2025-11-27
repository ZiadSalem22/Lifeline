class ListTodos {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute(userId) {
        return this.todoRepository.findAll(userId);
    }
}
module.exports = ListTodos;
