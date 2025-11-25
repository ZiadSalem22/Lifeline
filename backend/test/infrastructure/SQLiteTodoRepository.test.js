const sqlite3 = require('sqlite3').verbose();
const SQLiteTodoRepository = require('../../src/infrastructure/SQLiteTodoRepository');
const Todo = require('../../src/domain/Todo');
const Tag = require('../../src/domain/Tag');

describe('SQLiteTodoRepository', () => {
    let db;
    let repo;

    beforeEach((done) => {
        db = new sqlite3.Database(':memory:');
        repo = new SQLiteTodoRepository(db);
        db.serialize(() => {
            db.run(`
        CREATE TABLE todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          is_completed INTEGER DEFAULT 0,
          due_date TEXT,
          is_flagged INTEGER DEFAULT 0,
          duration INTEGER DEFAULT 0,
          priority TEXT DEFAULT 'medium',
          due_time TEXT,
          subtasks TEXT,
          "order" INTEGER DEFAULT 0,
          recurrence TEXT,
          next_recurrence_due TEXT,
          original_id TEXT
        )
      `);
            db.run(`
        CREATE TABLE tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL
        )
      `);
            db.run(`
        CREATE TABLE todo_tags (
          todo_id TEXT,
          tag_id TEXT,
          FOREIGN KEY(todo_id) REFERENCES todos(id),
          FOREIGN KEY(tag_id) REFERENCES tags(id),
          PRIMARY KEY (todo_id, tag_id)
        )
      `, done);
        });
    });

    afterEach((done) => {
        db.close(done);
    });

    it('should save and find a todo with tags and flags', async () => {
        // Insert tag into DB first
        await new Promise((resolve, reject) => {
            db.run("INSERT INTO tags (id, name, color) VALUES ('t1', 'Work', '#ff0000')", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const tags = [new Tag('t1', 'Work', '#ff0000')];
        const todo = new Todo('1', 'Test Todo', false, '2023-10-27', tags, true);
        await repo.save(todo);

        const found = await repo.findById('1');
        expect(found).toBeInstanceOf(Todo);
        expect(found.id).toBe('1');
        expect(found.title).toBe('Test Todo');
        expect(found.dueDate).toBe('2023-10-27');
        expect(found.isCompleted).toBe(false);
        expect(found.isFlagged).toBe(true);
        expect(found.tags).toHaveLength(1);
        expect(found.tags[0].name).toBe('Work');
    });

    it('should find all todos', async () => {
        await repo.save(new Todo('1', 'T1', false, '2023-10-27'));
        await repo.save(new Todo('2', 'T2', false, '2023-10-28'));

        const todos = await repo.findAll();
        expect(todos).toHaveLength(2);
    });

    it('should update a todo', async () => {
        const todo = new Todo('1', 'Test', false, '2023-10-27');
        await repo.save(todo);

        todo.toggle();
        await repo.save(todo);

        const found = await repo.findById('1');
        expect(found.isCompleted).toBe(true);
    });

    it('should delete a todo', async () => {
        await repo.save(new Todo('1', 'Test', false, '2023-10-27'));
        await repo.delete('1');
        const found = await repo.findById('1');
        expect(found).toBeNull();
    });
});
