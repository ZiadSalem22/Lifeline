const CreateTodo = require('../../src/application/CreateTodo');
const SQLiteTodoRepository = require('../../src/infrastructure/SQLiteTodoRepository');
const CompleteRecurringTodo = require('../../src/application/CompleteRecurringTodo');
const sqlite3 = require('sqlite3').verbose();

describe('Complete dateRange behavior', () => {
    let db;
    let repo;
    let createTodo;
    let completeRec;

    beforeEach((done) => {
        db = new sqlite3.Database(':memory:');
        repo = new SQLiteTodoRepository(db);
        createTodo = new CreateTodo(repo);
        completeRec = new CompleteRecurringTodo(repo);
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

    it('completing a dateRange todo marks it completed and removes it from future-day queries', async () => {
        const recurrence = {
            mode: 'dateRange',
            startDate: '2025-12-07',
            endDate: '2025-12-09'
        };

        // Create the logical dateRange todo
        const todo = await createTodo.execute('u1', 'Holiday span', '2025-12-07', [], false, 0, 'medium', null, [], '', recurrence);

        // Ensure it's stored as a single logical todo
        const allBefore = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM todos ORDER BY due_date ASC', (err, rows) => err ? reject(err) : resolve(rows));
        });
        expect(allBefore).toHaveLength(1);

        // Now complete it (simulate completing on middle day 2025-12-08 via the use case)
        // The CompleteRecurringTodo use case toggles by id; this should mark the todo completed and NOT create next occurrences for dateRange
        await completeRec.execute(todo.id);

        // Verify the stored todo is completed
        const stored = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM todos WHERE id = ?', [todo.id], (err, row) => err ? reject(err) : resolve(row));
        });
        expect(stored).not.toBeNull();
        expect(stored.is_completed).toBe(1);

        // Verify there are no active todos for future days within the original span (Dec 8..Dec 9)
        const futureActive = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM todos WHERE is_completed = 0 AND due_date BETWEEN ? AND ? ORDER BY due_date ASC', ['2025-12-08', '2025-12-09'], (err, rows) => err ? reject(err) : resolve(rows));
        });
        expect(futureActive).toHaveLength(0);
    });
});
