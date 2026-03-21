const CreateTodo = require('../../src/application/CreateTodo');
const Todo = require('../../src/domain/Todo');

// Mock Repository
class MockTodoRepository {
    constructor() {
        this.todos = [];
    }
    save(todo) {
        this.todos.push(todo);
        return Promise.resolve();
    }
}

describe('CreateTodo Use Case', () => {
    it('should create and save a todo', async () => {
        const mockRepo = new MockTodoRepository();
        const createTodo = new CreateTodo(mockRepo);

        const todo = await createTodo.execute('user123', 'Buy milk', '2023-10-27');

        expect(todo).toBeInstanceOf(Todo);
        expect(todo.title).toBe('Buy milk');
        expect(todo.dueDate).toBe('2023-10-27');
        expect(mockRepo.todos).toHaveLength(1);
        expect(mockRepo.todos[0]).toBe(todo);
    });

    it('assigns stable subtask ids during creation when only titles are provided', async () => {
        const mockRepo = new MockTodoRepository();
        const createTodo = new CreateTodo(mockRepo);

        const todo = await createTodo.execute(
            'user123',
            'Wash up',
            '2023-10-27',
            [],
            false,
            0,
            'medium',
            null,
            [{ title: 'Wash hair' }, { title: 'Buy shampoo' }],
        );

        expect(todo.subtasks).toHaveLength(2);
        expect(todo.subtasks[0].subtaskId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(todo.subtasks[1].subtaskId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(todo.subtasks[0].id).toBe(todo.subtasks[0].subtaskId);
        expect(todo.subtasks[1].id).toBe(todo.subtasks[1].subtaskId);
        expect(todo.subtasks[0].id).not.toBe(todo.subtasks[1].id);
    });
});
