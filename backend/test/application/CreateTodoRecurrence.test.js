const CreateTodo = require('../../src/application/CreateTodo');
const SQLiteTodoRepository = require('../../src/infrastructure/SQLiteTodoRepository');
const Todo = require('../../src/domain/Todo');
const sqlite3 = require('sqlite3').verbose();

describe('CreateTodo Recurrence Integration', () => {
    let db;
    let repo;
    let createTodo;

    beforeEach((done) => {
        db = new sqlite3.Database(':memory:');
        repo = new SQLiteTodoRepository(db);
        createTodo = new CreateTodo(repo);
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

    it('should create multiple todos for daily recurrence (dateRange)', async () => {
        const recurrence = {
            mode: 'dateRange',
            startDate: '2025-11-24',
            endDate: '2025-11-27'
        };
        await createTodo.execute('userR', 'Test Recurring', '2025-11-24', [], false, 0, 'medium', null, [], '', recurrence);
        const all = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM todos ORDER BY due_date ASC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        expect(all).toHaveLength(4);
        expect(all.map(t => t.due_date)).toEqual([
            '2025-11-24',
            '2025-11-25',
            '2025-11-26',
            '2025-11-27'
        ]);
    });

    it('should create todos only on selected days for specificDays recurrence', async () => {
        const recurrence = {
            mode: 'specificDays',
            startDate: '2025-11-24',
            endDate: '2025-11-30',
            selectedDays: ['Monday', 'Wednesday', 'Friday']
        };
        await createTodo.execute('userR', 'MWF Recurring', '2025-11-24', [], false, 0, 'medium', null, [], '', recurrence);
        const all = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM todos ORDER BY due_date ASC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        // Debug: print actual days and their names
        const RecurrenceService = require('../../src/application/RecurrenceService');
        expect(all.map(t => t.due_date)).toEqual([
            '2025-11-24',
            '2025-11-26',
            '2025-11-28'
        ]);
    });

    it('should create todos for legacy daily recurrence with interval', async () => {
        const recurrence = {
            type: 'daily',
            interval: 2,
            endDate: '2025-11-28'
        };
        await createTodo.execute('userR', 'Legacy Daily', '2025-11-24', [], false, 0, 'medium', null, [], '', recurrence);
        const all = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM todos ORDER BY due_date ASC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        expect(all.map(t => t.due_date)).toEqual([
            '2025-11-24',
            '2025-11-26',
            '2025-11-28'
        ]);
    });
});
