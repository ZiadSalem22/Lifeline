const Todo = require('../domain/Todo');

class UpdateTodo {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute(id, updates) {
        const todo = await this.todoRepository.findById(id);
        if (!todo) {
            throw new Error('Todo not found');
        }

        // Update fields
        if (updates.title !== undefined) todo.title = updates.title;
        if (updates.priority !== undefined) todo.priority = updates.priority;
        if (updates.dueDate !== undefined) todo.dueDate = updates.dueDate;
        if (updates.dueTime !== undefined) todo.dueTime = updates.dueTime;
        if (updates.tags !== undefined) todo.tags = updates.tags;
        if (updates.isFlagged !== undefined) todo.isFlagged = updates.isFlagged;
        if (updates.duration !== undefined) todo.duration = updates.duration;
        if (updates.subtasks !== undefined) todo.subtasks = updates.subtasks;
        if (updates.description !== undefined) todo.description = updates.description;

        await this.todoRepository.save(todo);
        return todo;
    }
}

module.exports = UpdateTodo;

