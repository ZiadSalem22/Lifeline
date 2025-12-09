const sqlite3 = require('sqlite3').verbose();
const SQLiteTodoRepository = require('../../src/infrastructure/SQLiteTodoRepository');
const CreateTodo = require('../../src/application/CreateTodo');

describe('Smoke: per-user sequential task_number assignment', () => {
  it('creates 5 todos for a user and assigns sequential task_number values', async () => {
    const db = new sqlite3.Database(':memory:');
    await new Promise(res => db.serialize(res));

    // Create tables needed for the repository
    await new Promise((res, rej) => db.run(`
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
        original_id TEXT,
        task_number INTEGER,
        user_id TEXT
      )
    `, (e) => e ? rej(e) : res()));

    await new Promise((res, rej) => db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL
      )
    `, (e) => e ? rej(e) : res()));
    await new Promise((res, rej) => db.run(`
      CREATE TABLE IF NOT EXISTS todo_tags (
        todo_id TEXT,
        tag_id TEXT,
        PRIMARY KEY (todo_id, tag_id)
      )
    `, (e) => e ? rej(e) : res()));

    const repo = new SQLiteTodoRepository(db);
    const create = new CreateTodo(repo);

    const userId = 'smoke-user-1';
    const created = [];
    for (let i = 0; i < 5; i++) {
      const t = await create.execute(userId, `Smoke Task ${i+1}`, null, [], false, 0);
      created.push(t);
    }

    // Read back all task_numbers for the user ordered by task_number
    const rows = await new Promise((res, rej) => db.all('SELECT id, task_number FROM todos WHERE user_id = ? ORDER BY task_number ASC', [userId], (e, r) => e ? rej(e) : res(r)));
    expect(rows.length).toBe(5);
    // Ensure task_numbers are sequential 1..5
    const nums = rows.map(r => r.task_number);
    expect(nums).toEqual([1,2,3,4,5]);

    db.close();
  });
});
