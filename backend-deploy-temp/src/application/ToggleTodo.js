class ToggleTodo {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute(id) {
        const todo = await this.todoRepository.findById(id);
        if (!todo) {
            throw new Error('Todo not found');
        }
        todo.toggle();
        await this.todoRepository.save(todo);
        return todo;
    }
}
module.exports = ToggleTodo;
