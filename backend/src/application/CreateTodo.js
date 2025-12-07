
const Todo = require('../domain/Todo');
const { v4: uuidv4 } = require('uuid');
const RecurrenceService = require('./RecurrenceService');

class CreateTodo {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute(userId, title, dueDate, tags, isFlagged, duration, priority = 'medium', dueTime = null, subtasks = [], description = '', recurrence = null) {
        // If no recurrence, just create one todo as before
        if (!recurrence) {
            const todo = new Todo(
                uuidv4(),
                title,
                false,
                dueDate,
                tags,
                isFlagged,
                duration,
                priority,
                dueTime,
                subtasks,
                0,
                description,
                recurrence,
                null,
                null,
                userId
            );
            await this.todoRepository.save(todo);
            return todo;
        }

        // Recurrence: generate todos according to recurrence mode
        // Support both legacy and new recurrence modes
        if (recurrence.mode === 'daily') {
            // Daily: create todos for each day in range
            const dates = [];
            const start = new Date((recurrence.startDate || dueDate) + 'T00:00:00Z');
            const end = new Date((recurrence.endDate || dueDate) + 'T00:00:00Z');
            let current = new Date(start);
            while (current <= end) {
                dates.push(current.toISOString().slice(0, 10));
                current.setDate(current.getDate() + 1);
            }
            // Create a todo for each date
            const todos = [];
            for (const date of dates) {
                const todo = new Todo(uuidv4(), title, false, date, tags, isFlagged, duration, priority, dueTime, subtasks, 0, description, recurrence, null, null, userId);
                await this.todoRepository.save(todo);
                todos.push(todo);
            }
            return todos[0];
        } else if (recurrence.mode === 'dateRange') {
            // dateRange: create a single logical todo representing the whole span
            const start = (recurrence.startDate || dueDate);
            const todo = new Todo(uuidv4(), title, false, start, tags, isFlagged, duration, priority, dueTime, subtasks, 0, description, recurrence, null, null, userId);
            await this.todoRepository.save(todo);
            return todo;
        } else if (recurrence.mode === 'specificDays') {
            // specificDays: create todos for each selected day in range
            const dates = [];
            const start = new Date(recurrence.startDate || dueDate);
            const end = new Date(recurrence.endDate || dueDate);
            let current = new Date(start);
            const selectedDays = recurrence.selectedDays || [];
            while (current <= end) {
                const dayName = RecurrenceService.getDayName(current.getUTCDay());
                if (selectedDays.includes(dayName)) {
                    dates.push(current.toISOString().slice(0, 10));
                }
                current.setDate(current.getDate() + 1);
            }
            const todos = [];
            for (const date of dates) {
                const todo = new Todo(uuidv4(), title, false, date, tags, isFlagged, duration, priority, dueTime, subtasks, 0, description, recurrence, null, null, userId);
                await this.todoRepository.save(todo);
                todos.push(todo);
            }
            return todos[0];
        } else if (recurrence.type === 'daily' || recurrence.type === 'weekly' || recurrence.type === 'monthly' || recurrence.type === 'custom') {
            // Legacy: use interval and type
            const dates = [];
            const start = new Date(dueDate);
            const end = recurrence.endDate ? new Date(recurrence.endDate) : start;
            let current = new Date(start);
            while (current <= end) {
                dates.push(current.toISOString().slice(0, 10));
                // Advance by interval
                if (recurrence.type === 'daily' || recurrence.type === 'custom') {
                    current.setDate(current.getDate() + (recurrence.interval || 1));
                } else if (recurrence.type === 'weekly') {
                    current.setDate(current.getDate() + 7 * (recurrence.interval || 1));
                } else if (recurrence.type === 'monthly') {
                    current.setMonth(current.getMonth() + (recurrence.interval || 1));
                }
            }
            const todos = [];
            for (const date of dates) {
                const todo = new Todo(uuidv4(), title, false, date, tags, isFlagged, duration, priority, dueTime, subtasks, 0, description, recurrence, null, null, userId);
                await this.todoRepository.save(todo);
                todos.push(todo);
            }
            return todos[0];
        } else {
            // Fallback: just the dueDate
            const todo = new Todo(uuidv4(), title, false, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, 0, description, recurrence, null, null, userId);
            await this.todoRepository.save(todo);
            return todo;
        }
    }
}

module.exports = CreateTodo;
