const sqlite3 = require('sqlite3').verbose();
const Migration = require('../../src/migrations/1669999999000-AddTaskNumberToTodos');

describe('AddTaskNumberToTodos migration (backfill)', () => {
  it('assigns sequential task_number per user ordered by due_date', async () => {
    const db = new sqlite3.Database(':memory:');

    await new Promise((resolve, reject) => db.serialize(resolve));

    // Create todos table WITHOUT task_number (migration should add it)
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE todos (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          due_date TEXT,
          title TEXT
        )
      `, (err) => err ? reject(err) : resolve());
    });

    // Insert sample todos for user u1 out-of-order insert but with due_date ordering
    const rows = [
      ['t1', 'u1', '2025-12-02', 'A'],
      ['t2', 'u1', '2025-12-01', 'B'],
      ['t3', 'u1', '2025-12-03', 'C']
    ];
    for (const r of rows) {
      await new Promise((res, rej) => db.run(`INSERT INTO todos (id, user_id, due_date, title) VALUES (?, ?, ?, ?)`, r, (e) => e ? rej(e) : res()));
    }

    // Build a simple queryRunner shim that the migration expects
    const queryRunner = {
      query(sql, params) {
        return new Promise((resolve, reject) => {
          // INFORMATION_SCHEMA queries -> return empty (no columns)
          if (/INFORMATION_SCHEMA/i.test(sql) || /sys\.indexes/i.test(sql)) return resolve([]);

          // Replace @0, @1 placeholders with ? for sqlite
          const pSql = sql.replace(/@\d+/g, '?');
          const method = /^\s*select/i.test(sql) ? 'all' : 'run';
          if (method === 'all') {
            db.all(pSql, params || [], (err, rows) => err ? reject(err) : resolve(rows));
          } else {
            db.run(pSql, params || [], function (err) { if (err) return reject(err); resolve({ lastID: this.lastID, changes: this.changes }); });
          }
        });
      }
    };

    const mig = new Migration();
    await mig.up(queryRunner);

    // Verify task_number assigned 1..N ordered by due_date asc
    const all = await new Promise((res, rej) => db.all('SELECT id, task_number, due_date FROM todos WHERE user_id = ? ORDER BY due_date ASC', ['u1'], (e, rows) => e ? rej(e) : res(rows)));
    expect(all.map(r => r.task_number)).toEqual([1, 2, 3]);
    expect(all.map(r => r.id)).toEqual(['t2', 't1', 't3']);

    db.close();
  });
});
