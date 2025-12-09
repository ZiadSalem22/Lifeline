const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const SQLiteTodoRepository = require('../../src/infrastructure/SQLiteTodoRepository');
const CreateTodo = require('../../src/application/CreateTodo');
const ListTodos = require('../../src/application/ListTodos');

describe('HTTP API (SQLite-backed) - todos endpoints', () => {
  let db;
  let app;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');
    // ensure serialize before running SQL
    await new Promise(res => db.serialize(res));

    // Create minimal schema required
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
    const createTodo = new CreateTodo(repo);
    const listTodos = new ListTodos(repo);

    app = express();
    app.use(bodyParser.json());

    // Simple middleware to inject a test currentUser
    app.use((req, res, next) => {
      req.currentUser = { id: 'http-test-user' };
      next();
    });

    // POST /api/todos
    app.post('/api/todos', async (req, res) => {
      try {
        const { title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence } = req.body || {};
        const t = await createTodo.execute(req.currentUser.id, title, dueDate, tags || [], isFlagged || false, duration || 0, priority || 'medium', dueTime || null, subtasks || [], description || '', recurrence || null);
        res.status(201).json(t);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // GET /api/todos
    app.get('/api/todos', async (req, res) => {
      try {
        const data = await listTodos.execute(req.currentUser.id);
        res.json(data);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // GET /api/todos/by-number/:taskNumber
    app.get('/api/todos/by-number/:taskNumber', async (req, res) => {
      try {
        const num = parseInt(req.params.taskNumber, 10);
        if (Number.isNaN(num)) return res.status(400).json({ error: 'invalid' });
        if (typeof repo.findByTaskNumber !== 'function') return res.status(500).json({ error: 'not supported' });
        const todo = await repo.findByTaskNumber(req.currentUser.id, num);
        if (!todo) return res.status(404).json({ error: 'not found' });
        res.json(todo);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  });

  afterAll(() => {
    if (db) db.close();
  });

  test('create 5 todos via POST and verify taskNumber & lookups', async () => {
    const agent = request(app);
    const created = [];
    for (let i = 0; i < 5; i++) {
      const res = await agent.post('/api/todos').send({ title: `HTTP Task ${i+1}` }).expect(201);
      expect(res.body).toHaveProperty('id');
      // taskNumber should be present and numeric
      expect(res.body).toHaveProperty('taskNumber');
      expect(typeof res.body.taskNumber).toBe('number');
      created.push(res.body);
    }

    // GET /api/todos
    const listRes = await agent.get('/api/todos').expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    // All created titles should be present
    const titles = listRes.body.map(t => t.title);
    for (const c of created) expect(titles).toContain(c.title);

    // Verify taskNumber ordering sequentially exists 1..5 via by-number lookup
    for (let n = 1; n <= 5; n++) {
      const r = await agent.get(`/api/todos/by-number/${n}`).expect(200);
      expect(r.body).toHaveProperty('taskNumber', n);
      expect(r.body).toHaveProperty('title');
    }
  });
});
