const Todo = require('../../src/domain/Todo');

describe('Todo Entity', () => {
    it('should create a valid todo', () => {
        const tags = [{ id: '1', name: 'Work', color: '#ff0000' }];
        // Constructor: id, title, isCompleted, dueDate, tags, isFlagged
        const todo = new Todo('123', 'Buy milk', false, '2023-10-27', tags, true);
        expect(todo.id).toBe('123');
        expect(todo.title).toBe('Buy milk');
        expect(todo.dueDate).toBe('2023-10-27');
        expect(todo.tags).toEqual(tags);
        expect(todo.isFlagged).toBe(true);
        expect(todo.isCompleted).toBe(false);
    });

    it('should toggle completion status', () => {
        const todo = new Todo('123', 'Buy milk');
        todo.toggle();
        expect(todo.isCompleted).toBe(true);
        todo.toggle();
        expect(todo.isCompleted).toBe(false);
    });

    it('should throw error if title is empty', () => {
        expect(() => new Todo('123', '')).toThrow('Title cannot be empty');
    });
});
