const RecurrenceService = require('./RecurrenceService');

class CompleteRecurringTodo {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    /**
     * Toggle a todo and if it's recurring, create the next occurrence
     */
    async execute(todoId) {
        const todo = await this.todoRepository.findById(todoId);
        if (!todo) throw new Error('Todo not found');

        // Toggle the todo
        todo.toggle();

        // Save the toggled todo
        await this.todoRepository.save(todo);

            // If this task is now completed and is recurring, create the next occurrence
            // Special-case: dateRange represents a single logical task across a span — do NOT create next occurrences
            if (todo.isCompleted && todo.recurrence) {
                if (todo.recurrence.mode && todo.recurrence.mode === 'dateRange') {
                    // Date range logical task: completing it marks the whole range complete; don't create next
                    return todo;
                }

                const nextTodo = RecurrenceService.createNextOccurrence(todo);
                if (nextTodo) {
                    // Save the new recurring instance
                    const NextTodoClass = require('../domain/Todo');
                    const newTodo = new NextTodoClass(
                        nextTodo.id,
                        nextTodo.title,
                        nextTodo.isCompleted,
                        nextTodo.dueDate,
                        nextTodo.tags,
                        nextTodo.isFlagged,
                        nextTodo.duration,
                        nextTodo.priority,
                        nextTodo.dueTime,
                        nextTodo.subtasks,
                        0,
                        nextTodo.description,
                        nextTodo.recurrence,
                        nextTodo.nextRecurrenceDue,
                        nextTodo.originalId
                    );
                    await this.todoRepository.save(newTodo);
                }
        }

        return todo;
    }
}

module.exports = CompleteRecurringTodo;
