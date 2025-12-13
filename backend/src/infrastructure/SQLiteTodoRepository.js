const ITodoRepository = require('../domain/ITodoRepository');
const Todo = require('../domain/Todo');
const Tag = require('../domain/Tag');

class SQLiteTodoRepository extends ITodoRepository {
    constructor(db) {
        super();
        this.db = db;
    }

    async save(todo) {
        // Ensure taskNumber is present for user to avoid NULL insert causing unique index conflicts
        if ((typeof todo.taskNumber === 'undefined' || todo.taskNumber === null) && todo.userId) {
            try {
                const max = await this.getMaxTaskNumber(todo.userId);
                todo.taskNumber = (max || 0) + 1;
            } catch (e) {
                // ignore; proceed with null if unable to compute
            }
        }

        // Defensive fallback: ensure todo.taskNumber is set to a non-null number before attempting to insert
        if ((typeof todo.taskNumber === 'undefined' || todo.taskNumber === null || Number.isNaN(parseInt(todo.taskNumber, 10))) && todo.userId) {
            try {
                // attempt to compute a value; if that fails we'll set 1
                const max = await this.getMaxTaskNumber(todo.userId);
                todo.taskNumber = (max || 0) + 1;
            } catch (e) {
                todo.taskNumber = 1;
            }
        }

        return new Promise((resolve, reject) => {
            const subtasksJson = JSON.stringify(todo.subtasks || []);
            const recurrenceJson = todo.recurrence ? JSON.stringify(todo.recurrence) : null;
            const stmt = this.db.prepare('INSERT OR REPLACE INTO todos (id, title, description, is_completed, due_date, is_flagged, duration, priority, due_time, subtasks, `order`, recurrence, next_recurrence_due, original_id, task_number, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            stmt.run(
                todo.id,
                todo.title,
                todo.description || '',
                todo.isCompleted ? 1 : 0,
                todo.dueDate,
                todo.isFlagged ? 1 : 0,
                todo.duration,
                todo.priority || 'medium',
                todo.dueTime || null,
                subtasksJson,
                todo.order || 0,
                recurrenceJson,
                todo.nextRecurrenceDue || null,
                todo.originalId || null,
                typeof todo.taskNumber !== 'undefined' ? todo.taskNumber : null,
                todo.userId || null,
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Handle Tags (Delete existing links and re-add)
                    this.db.run('DELETE FROM todo_tags WHERE todo_id = ?', [todo.id], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        if (todo.tags.length > 0) {
                            const tagStmt = this.db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
                            todo.tags.forEach(tag => {
                                tagStmt.run(todo.id, tag.id);
                            });
                            tagStmt.finalize();
                        }
                        resolve();
                    });
                }
            );
            stmt.finalize();
        });
    }

    findById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM todos WHERE id = ?', [id], async (err, row) => {
                if (err) reject(err);
                else if (!row) resolve(null);
                else {
                    const tags = await this.getTagsForTodo(row.id);
                    const subtasks = row.subtasks ? JSON.parse(row.subtasks) : [];
                    const recurrence = row.recurrence ? JSON.parse(row.recurrence) : null;
                    resolve(new Todo(
                        row.id,
                        row.title,
                        !!row.is_completed,
                        row.due_date,
                        tags,
                        !!row.is_flagged,
                        row.duration,
                        row.priority || 'medium',
                        row.due_time || null,
                        subtasks,
                        row.order || 0,
                        row.description || '',
                        recurrence,
                        row.next_recurrence_due || null,
                        row.original_id || null,
                        row.task_number || null,
                        row.user_id || null
                    ));
                }
            });
        });
    }

    findAll() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM todos', async (err, rows) => {
                if (err) reject(err);
                else {
                    const todos = await Promise.all(rows.map(async row => {
                        const tags = await this.getTagsForTodo(row.id);
                        const subtasks = row.subtasks ? JSON.parse(row.subtasks) : [];
                        const recurrence = row.recurrence ? JSON.parse(row.recurrence) : null;
                        return new Todo(
                            row.id,
                            row.title,
                            !!row.is_completed,
                            row.due_date,
                            tags,
                            !!row.is_flagged,
                            row.duration,
                            row.priority || 'medium',
                            row.due_time || null,
                            subtasks,
                            row.order || 0,
                            row.description || '',
                            recurrence,
                            row.next_recurrence_due || null,
                            row.original_id || null,
                            row.task_number || null,
                            row.user_id || null
                        );
                    }));
                    resolve(todos);
                }
            });
        });
    }

    /**
     * Find todos by filters. Supported filters (all optional):
     * q (text search on title and description), tags (array of tag ids), priority, status ('completed'|'active'), startDate, endDate, minDuration, maxDuration, flagged (boolean), sortBy
     */
    findByFilters(filters = {}) {
        const {
            q,
            tags,
            priority,
            status,
            startDate,
            endDate,
            minDuration,
            maxDuration,
            flagged,
            sortBy,
            limit = 20,
            offset = 0
        } = filters;

        return new Promise((resolve, reject) => {
            const clauses = [];
            const params = [];

            if (q) {
                const cleanQ = q.trim().replace(/^#/, '').trim();
                const asNum = parseInt(cleanQ, 10);
                const isNum = !Number.isNaN(asNum) && String(asNum) === cleanQ;

                if (isNum) {
                    clauses.push("(title LIKE ? OR description LIKE ? OR subtasks LIKE ? OR task_number = ?)");
                    const like = `%${q}%`;
                    params.push(like, like, like, asNum);
                } else {
                    clauses.push("(title LIKE ? OR description LIKE ? OR subtasks LIKE ?)");
                    const like = `%${q}%`;
                    params.push(like, like, like);
                }
            }

            if (priority) {
                clauses.push('priority = ?');
                params.push(priority);
            }

            if (typeof flagged !== 'undefined') {
                clauses.push('is_flagged = ?');
                params.push(flagged ? 1 : 0);
            }

            if (status === 'completed') {
                clauses.push('is_completed = 1');
            } else if (status === 'active') {
                clauses.push('is_completed = 0');
            }

            if (startDate) {
                clauses.push('due_date >= ?');
                params.push(startDate);
            }

            if (endDate) {
                clauses.push('due_date <= ?');
                params.push(endDate);
            }

            if (minDuration) {
                clauses.push('duration >= ?');
                params.push(parseInt(minDuration));
            }

            if (maxDuration) {
                clauses.push('duration <= ?');
                params.push(parseInt(maxDuration));
            }

            // Tags handled as EXISTS clause to avoid duplicates
            if (tags && Array.isArray(tags) && tags.length > 0) {
                const placeholders = tags.map(() => '?').join(',');
                clauses.push(`EXISTS (SELECT 1 FROM todo_tags tt WHERE tt.todo_id = todos.id AND tt.tag_id IN (${placeholders}))`);
                params.push(...tags);
            }

            const where = clauses.length > 0 ? (' WHERE ' + clauses.join(' AND ')) : '';

            // Count query for total
            const countSql = `SELECT COUNT(*) as cnt FROM todos ${where}`;

            // Sorting
            let orderSql = '';
            if (sortBy === 'priority') {
                orderSql = " ORDER BY CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 2 END DESC";
            } else if (sortBy === 'duration') {
                orderSql = ' ORDER BY duration DESC';
            } else if (sortBy === 'name') {
                orderSql = ' ORDER BY title COLLATE NOCASE ASC';
            } else {
                orderSql = ' ORDER BY due_date IS NULL, due_date ASC';
            }

            const sql = `SELECT * FROM todos ${where} ${orderSql} LIMIT ? OFFSET ?`;
            const queryParams = params.concat([limit, offset]);

            // Run count and data queries
            this.db.get(countSql, params, (cErr, row) => {
                if (cErr) return reject(cErr);
                const total = row ? row.cnt : 0;
                this.db.all(sql, queryParams, async (err, rows) => {
                    if (err) return reject(err);
                    try {
                        const todos = await Promise.all(rows.map(async row => {
                            const tags = await this.getTagsForTodo(row.id);
                            const subtasks = row.subtasks ? JSON.parse(row.subtasks) : [];
                            const recurrence = row.recurrence ? JSON.parse(row.recurrence) : null;
                            return new Todo(
                                row.id,
                                row.title,
                                !!row.is_completed,
                                row.due_date,
                                tags,
                                !!row.is_flagged,
                                row.duration,
                                row.priority || 'medium',
                                row.due_time || null,
                                subtasks,
                                row.order || 0,
                                row.description || '',
                                recurrence,
                                row.next_recurrence_due || null,
                                row.original_id || null,
                                row.task_number || null,
                                row.user_id || null
                            );
                        }));
                        resolve({ todos, total });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
    }

    getTagsForTodo(todoId) {
        return new Promise((resolve, reject) => {
            const query = `
        SELECT t.* FROM tags t
        JOIN todo_tags tt ON t.id = tt.tag_id
        WHERE tt.todo_id = ?
      `;
            this.db.all(query, [todoId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => new Tag(row.id, row.name, row.color)));
            });
        });
    }

    getMaxTaskNumber(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT MAX(task_number) as maxNum FROM todos WHERE user_id = ?', [userId], (err, row) => {
                if (err) return reject(err);
                const v = row && row.maxNum ? parseInt(row.maxNum, 10) : 0;
                resolve(v || 0);
            });
        });
    }

    findByTaskNumber(userId, taskNumber) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM todos WHERE user_id = ? AND task_number = ?', [userId, taskNumber], async (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                const tags = await this.getTagsForTodo(row.id);
                const subtasks = row.subtasks ? JSON.parse(row.subtasks) : [];
                const recurrence = row.recurrence ? JSON.parse(row.recurrence) : null;
                resolve(new Todo(
                    row.id,
                    row.title,
                    !!row.is_completed,
                    row.due_date,
                    tags,
                    !!row.is_flagged,
                    row.duration,
                    row.priority || 'medium',
                    row.due_time || null,
                    subtasks,
                    row.order || 0,
                    row.description || '',
                    recurrence,
                    row.next_recurrence_due || null,
                    row.original_id || null,
                    row.task_number || null,
                    row.user_id || null
                ));
            });
        });
    }

    getStatistics() {
        return new Promise((resolve, reject) => {
            try {
                const stats = {};
                // total todos
                this.db.get('SELECT COUNT(*) as cnt FROM todos', [], (err, row) => {
                    if (err) return reject(err);
                    stats.totalTodos = row ? row.cnt : 0;
                    // completed count
                    this.db.get('SELECT COUNT(*) as cnt FROM todos WHERE is_completed = 1', [], (err2, row2) => {
                        if (err2) return reject(err2);
                        stats.completedCount = row2 ? row2.cnt : 0;
                        stats.completionRate = stats.totalTodos > 0 ? Math.round((stats.completedCount / stats.totalTodos) * 100) : 0;

                        // average duration (minutes)
                        this.db.get('SELECT AVG(duration) as avgDur FROM todos WHERE duration > 0', [], (err3, row3) => {
                            if (err3) return reject(err3);
                            stats.avgDuration = row3 && row3.avgDur ? Math.round(row3.avgDur) : 0;

                            // total time spent (sum of duration of completed tasks)
                            this.db.get('SELECT SUM(duration) as sumDur FROM todos WHERE is_completed = 1', [], (err4, row4) => {
                                if (err4) return reject(err4);
                                stats.timeSpentTotal = row4 && row4.sumDur ? row4.sumDur : 0;

                                // top tags
                                const tagsSql = `SELECT t.id, t.name, t.color, COUNT(*) as cnt FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id JOIN todos ON todos.id = tt.todo_id GROUP BY t.id ORDER BY cnt DESC LIMIT 10`;
                                this.db.all(tagsSql, [], (tErr, tRows) => {
                                    if (tErr) return reject(tErr);
                                    stats.topTags = (tRows || []).map(r => ({ id: r.id, name: r.name, color: r.color, count: r.cnt }));

                                    // tasks per day (last 30 days) based on due_date
                                    const today = new Date();
                                    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                    const start = new Date(end.getTime() - (29 * 24 * 60 * 60 * 1000));
                                    const fmt = (d) => d.toISOString().slice(0, 10);
                                    const startStr = fmt(start);
                                    const endStr = fmt(end);
                                    const perDaySql = `SELECT due_date as day, COUNT(*) as cnt FROM todos WHERE due_date BETWEEN ? AND ? GROUP BY due_date ORDER BY due_date ASC`;
                                    this.db.all(perDaySql, [startStr, endStr], (pErr, pRows) => {
                                        if (pErr) return reject(pErr);
                                        // build full array for last 30 days
                                        const map = {};
                                        (pRows || []).forEach(r => { if (r.day) map[r.day] = r.cnt; });
                                        const days = [];
                                        for (let i = 0; i < 30; i++) {
                                            const d = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
                                            const key = fmt(d);
                                            days.push({ day: key, count: map[key] || 0 });
                                        }
                                        stats.tasksPerDay = days;
                                        resolve(stats);
                                    });
                                });
                            });
                        });
                    });
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Aggregated statistics for a user by period: 'day' | 'week' | 'month' | 'year'
     * Returns { totalTodos, completedCount, completionRate, groups: Array<{ period: string, count: number }> }
     */
    getStatisticsAggregated(userId, period = 'day') {
        return new Promise((resolve, reject) => {
            try {
                const fmtMap = {
                    day: "%Y-%m-%d",
                    week: "%Y-%W",
                    month: "%Y-%m",
                    year: "%Y",
                };
                const fmt = fmtMap[period] || fmtMap.day;
                // Select a reasonable recent window for each period to keep payload compact
                const windowMapDays = {
                    day: 30,      // last 30 days
                    week: 84,     // ~12 weeks
                    month: 365,   // last 12 months
                    year: 1825,   // last 5 years
                };
                const daysWindow = windowMapDays[period] || windowMapDays.day;
                const windowFilter = `AND due_date >= DATE('now', '-${daysWindow} day')`;

                const groupsSql = `SELECT strftime('${fmt}', due_date) AS bucket, COUNT(*) as cnt FROM todos WHERE user_id = ? AND due_date IS NOT NULL ${windowFilter} GROUP BY bucket ORDER BY bucket ASC`;

                const totalSql = 'SELECT COUNT(*) as cnt FROM todos WHERE user_id = ?';
                const completedSql = 'SELECT COUNT(*) as cnt FROM todos WHERE user_id = ? AND is_completed = 1';
                const periodTotalSql = `SELECT COUNT(*) as cnt FROM todos WHERE user_id = ? AND due_date IS NOT NULL ${windowFilter}`;
                const periodCompletedSql = `SELECT COUNT(*) as cnt FROM todos WHERE user_id = ? AND is_completed = 1 AND due_date IS NOT NULL ${windowFilter}`;
                const avgDurationSql = `SELECT AVG(duration) as avgDur FROM todos WHERE user_id = ? AND duration > 0 AND due_date IS NOT NULL ${windowFilter}`;
                const timeSpentSql = `SELECT SUM(duration) as sumDur FROM todos WHERE user_id = ? AND is_completed = 1 AND due_date IS NOT NULL ${windowFilter}`;
                const topTagsSql = `SELECT t.id, t.name, t.color, COUNT(*) as cnt
                                    FROM tags t
                                    JOIN todo_tags tt ON t.id = tt.tag_id
                                    JOIN todos td ON td.id = tt.todo_id
                                    WHERE td.user_id = ? AND td.due_date IS NOT NULL ${windowFilter}
                                    GROUP BY t.id
                                    ORDER BY cnt DESC
                                    LIMIT 10`;

                const result = { totalTodos: 0, completedCount: 0, completionRate: 0, groups: [], periodTotals: {}, topTagsInPeriod: [] };
                this.db.get(totalSql, [userId], (tErr, tRow) => {
                    if (tErr) return reject(tErr);
                    result.totalTodos = tRow ? tRow.cnt : 0;
                    this.db.get(completedSql, [userId], (cErr, cRow) => {
                        if (cErr) return reject(cErr);
                        result.completedCount = cRow ? cRow.cnt : 0;
                        result.completionRate = result.totalTodos > 0 ? Math.round((result.completedCount / result.totalTodos) * 100) : 0;
                        // Compute period totals and top tags within window
                        this.db.get(periodTotalSql, [userId], (ptErr, ptRow) => {
                            if (ptErr) return reject(ptErr);
                            const totalP = ptRow ? ptRow.cnt : 0;
                            this.db.get(periodCompletedSql, [userId], (pcErr, pcRow) => {
                                if (pcErr) return reject(pcErr);
                                const completedP = pcRow ? pcRow.cnt : 0;
                                this.db.get(avgDurationSql, [userId], (adErr, adRow) => {
                                    if (adErr) return reject(adErr);
                                    const avgDurP = adRow && adRow.avgDur ? Math.round(adRow.avgDur) : 0;
                                    this.db.get(timeSpentSql, [userId], (tsErr, tsRow) => {
                                        if (tsErr) return reject(tsErr);
                                        const sumDurP = tsRow && tsRow.sumDur ? tsRow.sumDur : 0;
                                        result.periodTotals = {
                                            totalTodos: totalP,
                                            completedCount: completedP,
                                            completionRate: totalP > 0 ? Math.round((completedP / totalP) * 100) : 0,
                                            avgDuration: avgDurP,
                                            timeSpentTotal: sumDurP,
                                        };
                                        this.db.all(topTagsSql, [userId], (ttErr, ttRows) => {
                                            if (ttErr) return reject(ttErr);
                                            result.topTagsInPeriod = (ttRows || []).map(r => ({ id: r.id, name: r.name, color: r.color, count: r.cnt }));
                                            // Finally groups
                                            this.db.all(groupsSql, [userId], (gErr, gRows) => {
                                                if (gErr) return reject(gErr);
                                                result.groups = (gRows || []).filter(r => r.bucket).map(r => ({ period: r.bucket, count: r.cnt }));
                                                resolve(result);
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Statistics for a specific date range [startDate, endDate] inclusive (YYYY-MM-DD strings).
     * Returns { totalTodos, completedCount, completionRate, avgDuration, timeSpentTotal, topTags, groups }
     */
    getStatisticsForUserInRange(userId, startDate, endDate) {
        return new Promise((resolve, reject) => {
            try {
                const stats = { totalTodos: 0, completedCount: 0, completionRate: 0, avgDuration: 0, timeSpentTotal: 0, topTags: [], groups: [] };
                const rangeFilter = 'AND due_date BETWEEN ? AND ?';
                const params = [userId, startDate, endDate];

                // totals in range
                const totalSql = `SELECT COUNT(*) as cnt FROM todos WHERE user_id = ? AND due_date IS NOT NULL ${rangeFilter}`;
                const completedSql = `SELECT COUNT(*) as cnt FROM todos WHERE user_id = ? AND is_completed = 1 AND due_date IS NOT NULL ${rangeFilter}`;
                const avgDurationSql = `SELECT AVG(duration) as avgDur FROM todos WHERE user_id = ? AND duration > 0 AND due_date IS NOT NULL ${rangeFilter}`;
                const timeSpentSql = `SELECT SUM(duration) as sumDur FROM todos WHERE user_id = ? AND is_completed = 1 AND due_date IS NOT NULL ${rangeFilter}`;
                const topTagsSql = `SELECT t.id, t.name, t.color, COUNT(*) as cnt
                                    FROM tags t
                                    JOIN todo_tags tt ON t.id = tt.tag_id
                                    JOIN todos td ON td.id = tt.todo_id
                                    WHERE td.user_id = ? AND td.due_date IS NOT NULL ${rangeFilter}
                                    GROUP BY t.id
                                    ORDER BY cnt DESC
                                    LIMIT 10`;
                const groupsSql = `SELECT due_date as day, COUNT(*) as cnt FROM todos WHERE user_id = ? AND due_date IS NOT NULL ${rangeFilter} GROUP BY due_date ORDER BY due_date ASC`;

                this.db.get(totalSql, params, (tErr, tRow) => {
                    if (tErr) return reject(tErr);
                    stats.totalTodos = tRow ? tRow.cnt : 0;
                    this.db.get(completedSql, params, (cErr, cRow) => {
                        if (cErr) return reject(cErr);
                        stats.completedCount = cRow ? cRow.cnt : 0;
                        stats.completionRate = stats.totalTodos > 0 ? Math.round((stats.completedCount / stats.totalTodos) * 100) : 0;
                        this.db.get(avgDurationSql, params, (aErr, aRow) => {
                            if (aErr) return reject(aErr);
                            stats.avgDuration = aRow && aRow.avgDur ? Math.round(aRow.avgDur) : 0;
                            this.db.get(timeSpentSql, params, (sErr, sRow) => {
                                if (sErr) return reject(sErr);
                                stats.timeSpentTotal = sRow && sRow.sumDur ? sRow.sumDur : 0;
                                this.db.all(topTagsSql, params, (ttErr, ttRows) => {
                                    if (ttErr) return reject(ttErr);
                                    stats.topTags = (ttRows || []).map(r => ({ id: r.id, name: r.name, color: r.color, count: r.cnt }));
                                    this.db.all(groupsSql, params, (gErr, gRows) => {
                                        if (gErr) return reject(gErr);
                                        stats.groups = (gRows || []).map(r => ({ period: r.day, count: r.cnt }));
                                        resolve(stats);
                                    });
                                });
                            });
                        });
                    });
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    delete(id) {
        // Delete todo and its todo_tags in a transaction
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                this.db.run('DELETE FROM todo_tags WHERE todo_id = ?', [id], (err1) => {
                    if (err1) {
                        this.db.run('ROLLBACK');
                        return reject(err1);
                    }
                    this.db.run('DELETE FROM todos WHERE id = ?', [id], (err2) => {
                        if (err2) {
                            this.db.run('ROLLBACK');
                            return reject(err2);
                        }
                        this.db.run('COMMIT', (err3) => {
                            if (err3) return reject(err3);
                            resolve();
                        });
                    });
                });
            });
        });
    }

    // Helper to prune orphaned todo_tags
    pruneOrphanTodoTags() {
        return new Promise((resolve, reject) => {
            // Delete todo_tags where todo_id does not exist in todos
            const sql1 = 'DELETE FROM todo_tags WHERE todo_id NOT IN (SELECT id FROM todos)';
            // Delete todo_tags where tag_id does not exist in tags
            const sql2 = 'DELETE FROM todo_tags WHERE tag_id NOT IN (SELECT id FROM tags)';
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                this.db.run(sql1, (err1) => {
                    if (err1) {
                        this.db.run('ROLLBACK');
                        return reject(err1);
                    }
                    this.db.run(sql2, (err2) => {
                        if (err2) {
                            this.db.run('ROLLBACK');
                            return reject(err2);
                        }
                        this.db.run('COMMIT', (err3) => {
                            if (err3) return reject(err3);
                            resolve();
                        });
                    });
                });
            });
        });
    }
}

module.exports = SQLiteTodoRepository;
