const ListTodos = require('../../src/application/ListTodos');
const ToggleTodo = require('../../src/application/ToggleTodo');
const DeleteTodo = require('../../src/application/DeleteTodo');
const Todo = require('../../src/domain/Todo');

class MockTodoRepository {
    constructor() {
        this.todos = [];
    }
    save(todo) {
        const index = this.todos.findIndex(t => t.id === todo.id);
        if (index !== -1) {
            this.todos[index] = todo;
        } else {
            this.todos.push(todo);
        }
        return Promise.resolve();
    }
    findAll() {
        return Promise.resolve(this.todos);
    }
    findById(id) {
        return Promise.resolve(this.todos.find(t => t.id === id));
    }
    delete(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        return Promise.resolve();
    }
}

describe('Application Use Cases', () => {
    let mockRepo;

    beforeEach(() => {
        mockRepo = new MockTodoRepository();
    });

    it('should list all todos', async () => {
        mockRepo.todos = [new Todo('1', 'Test 1'), new Todo('2', 'Test 2')];
        const listTodos = new ListTodos(mockRepo);
        const todos = await listTodos.execute('userX');
        expect(todos).toHaveLength(2);
    });

    it('should toggle a todo', async () => {
        const todo = new Todo('1', 'Test');
        mockRepo.todos = [todo];
        const toggleTodo = new ToggleTodo(mockRepo);
        await toggleTodo.execute('userX', '1');
        expect(mockRepo.todos[0].isCompleted).toBe(true);
    });

    it('should delete a todo', async () => {
        mockRepo.todos = [new Todo('1', 'Test')];
        const deleteTodo = new DeleteTodo(mockRepo);
        await deleteTodo.execute('userX', '1');
        expect(mockRepo.todos).toHaveLength(0);
    });
});
