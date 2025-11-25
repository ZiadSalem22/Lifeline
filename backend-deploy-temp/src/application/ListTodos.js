class ListTodos {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute() {
        return this.todoRepository.findAll();
    }
}
module.exports = ListTodos;
