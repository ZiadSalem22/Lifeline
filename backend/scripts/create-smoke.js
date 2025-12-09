const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function run() {
  const db = new sqlite3.Database(':memory:');
  await new Promise((resolve, reject) => db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS todos (
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
    )`, (e) => e ? reject(e) : resolve());
  }));

  await new Promise((resolve, reject) => db.run(`CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL)`, (e) => e ? reject(e) : resolve()));
  await new Promise((resolve, reject) => db.run(`CREATE TABLE IF NOT EXISTS todo_tags (todo_id TEXT, tag_id TEXT, PRIMARY KEY (todo_id, tag_id))`, (e) => e ? reject(e) : resolve()));

  const SQLiteTodoRepository = require('../src/infrastructure/SQLiteTodoRepository');
  const CreateTodo = require('../src/application/CreateTodo');
  const repo = new SQLiteTodoRepository(db);
  const createTodo = new CreateTodo(repo);

  try {
    const t1 = await createTodo.execute('guest-local', 'smoke1', '2025-12-08', [], false, 0, 'medium', null, [], '');
    const t2 = await createTodo.execute('guest-local', 'smoke2', '2025-12-09', [], false, 0, 'medium', null, [], '');
    console.log('Created todos:', t1.id, 'taskNumber=', t1.taskNumber);
    console.log('Created todos:', t2.id, 'taskNumber=', t2.taskNumber);

    // Read back from DB
    db.all('SELECT id, title, task_number, user_id FROM todos WHERE user_id = ?', ['guest-local'], (err, rows) => {
      if (err) { console.error('Query failed', err); process.exit(2); }
      console.log('Rows in DB for guest-local:');
      console.table(rows);
      process.exit(0);
    });
  } catch (e) {
    console.error('Smoke failed', e && e.message ? e.message : e);
    process.exit(3);
  }
}

run();
