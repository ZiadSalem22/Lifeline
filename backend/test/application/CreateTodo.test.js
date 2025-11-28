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
});
