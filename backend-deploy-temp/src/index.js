const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const SQLiteTodoRepository = require('./infrastructure/SQLiteTodoRepository');
const SQLiteTagRepository = require('./infrastructure/SQLiteTagRepository');
const NotificationService = require('./application/NotificationService');
const CreateTodo = require('./application/CreateTodo');
const ListTodos = require('./application/ListTodos');
const ToggleTodo = require('./application/ToggleTodo');
const DeleteTodo = require('./application/DeleteTodo');
const UpdateTodo = require('./application/UpdateTodo');
const CompleteRecurringTodo = require('./application/CompleteRecurringTodo');
const { CreateTag, ListTags, DeleteTag, UpdateTag } = require('./application/TagUseCases');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Swagger UI (auto-served at /api-docs)
try {
    require('./swagger')(app);
} catch (e) {
    console.warn('Swagger UI not available:', e.message);
}

// Database Setup
const dbPath = path.resolve(__dirname, '../todos_v4.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
         description TEXT,
      due_date TEXT,
      is_completed INTEGER DEFAULT 0,
      is_flagged INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      due_time TEXT,
      subtasks TEXT DEFAULT '[]',
      \`order\` INTEGER DEFAULT 0,
      recurrence TEXT,
      next_recurrence_due TEXT,
      original_id TEXT
    )
  `);
    // Add new columns if they don't exist (for existing databases)
    db.run(`ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium'`, (err) => {});
    db.run(`ALTER TABLE todos ADD COLUMN due_time TEXT`, (err) => {});
    db.run(`ALTER TABLE todos ADD COLUMN subtasks TEXT DEFAULT '[]'`, (err) => {});
    db.run(`ALTER TABLE todos ADD COLUMN \`order\` INTEGER DEFAULT 0`, (err) => {});
    db.run(`ALTER TABLE todos ADD COLUMN description TEXT`, (err) => {});
    db.run(`ALTER TABLE todos ADD COLUMN recurrence TEXT`, (err) => {});
    db.run(`ALTER TABLE todos ADD COLUMN next_recurrence_due TEXT`, (err) => {});
    db.run(`ALTER TABLE todos ADD COLUMN original_id TEXT`, (err) => {});
    db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id TEXT,
      tag_id TEXT,
      FOREIGN KEY(todo_id) REFERENCES todos(id),
      FOREIGN KEY(tag_id) REFERENCES tags(id),
      PRIMARY KEY (todo_id, tag_id)
    )
  `);
});

// Repository & Use Cases
const todoRepository = new SQLiteTodoRepository(db);
const tagRepository = new SQLiteTagRepository(db);
const notificationService = new NotificationService(db);

const createTodo = new CreateTodo(todoRepository);
const listTodos = new ListTodos(todoRepository);
const toggleTodo = new ToggleTodo(todoRepository);
const completeRecurringTodo = new CompleteRecurringTodo(todoRepository);
const deleteTodo = new DeleteTodo(todoRepository);
const updateTodo = new UpdateTodo(todoRepository);
const searchTodos = new (require('./application/SearchTodos'))(todoRepository);

const getStatistics = new (require('./application/GetStatistics'))(todoRepository);
const createTag = new CreateTag(tagRepository);
const listTags = new ListTags(tagRepository);
const deleteTag = new DeleteTag(tagRepository);
const updateTag = new UpdateTag(tagRepository);

// Todo Routes
app.get('/api/todos', async (req, res) => {
    try {
        const todos = await listTodos.execute();
        res.json(todos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/todos', async (req, res) => {
    try {
        const { title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence } = req.body;
        const todo = await createTodo.execute(title, dueDate, tags, isFlagged, duration, priority || 'medium', dueTime || null, subtasks || [], description || '', recurrence || null);
        res.status(201).json(todo);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.patch('/api/todos/:id/reorder', async (req, res) => {
    try {
        const { id } = req.params;
        const { order } = req.body;
        const todo = await todoRepository.findById(id);
        if (!todo) return res.status(404).json({ error: 'Todo not found' });
        todo.order = order;
        await todoRepository.save(todo);
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const todo = await updateTodo.execute(id, updates);
        res.json(todo);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// Server-side search endpoint
app.get('/api/todos/search', async (req, res) => {
    try {
        // parse query params
        const q = req.query.q || '';
        const tags = req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : req.query.tags.split(',')) : [];
        const priority = req.query.priority || null;
        const status = req.query.status || null;
        const startDate = req.query.startDate || null;
        const endDate = req.query.endDate || null;
        const minDuration = req.query.minDuration || null;
        const maxDuration = req.query.maxDuration || null;
        const flagged = typeof req.query.flagged !== 'undefined' ? (req.query.flagged === '1' || req.query.flagged === 'true') : undefined;
        const sortBy = req.query.sortBy || null;

        const page = parseInt(req.query.page || '1', 10) || 1;
        const limit = parseInt(req.query.limit || '30', 10) || 30;
        const offset = (page - 1) * limit;

        const filters = { q, tags, priority, status, startDate, endDate, minDuration, maxDuration, flagged, sortBy, limit, offset };
        const results = await searchTodos.execute(filters);
        // results is { todos, total }
        res.json({ todos: results.todos || [], total: results.total || 0, page, limit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/todos/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const todo = await toggleTodo.execute(id);
        res.json(todo);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

app.patch('/api/todos/:id/flag', async (req, res) => {
    try {
        const { id } = req.params;
        const todo = await todoRepository.findById(id);
        if (!todo) return res.status(404).json({ error: 'Todo not found' });

        todo.toggleFlag();
        await todoRepository.save(todo);
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/todos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteTodo.execute(id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tag Routes
app.get('/api/tags', async (req, res) => {
    try {
        const tags = await listTags.execute();
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tags', async (req, res) => {
    try {
        const { name, color } = req.body;
        const tag = await createTag.execute(name, color);
        res.status(201).json(tag);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.patch('/api/tags/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;
        const tag = await updateTag.execute(id, name, color);
        res.json(tag);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tags/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteTag.execute(id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await getStatistics.execute();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export endpoint
app.get('/api/export', async (req, res) => {
    try {
        const format = req.query.format || 'json'; // json or csv
        const todos = await listTodos.execute();
        const tags = await listTags.execute();

        if (format === 'csv') {
            // Export as CSV
            let csv = 'id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags,subtasks,recurrence\n';
            todos.forEach(todo => {
                const tagsStr = (todo.tags || []).map(t => t.name).join(';');
                const subtasksStr = (todo.subtasks || []).map(s => `${s.title}(${s.isCompleted ? 'done' : 'pending'})`).join(';');
                const recurrenceStr = todo.recurrence ? JSON.stringify(todo.recurrence).replace(/"/g, '\\"') : '';
                csv += `"${todo.id}","${todo.title.replace(/"/g, '\\"')}","${(todo.description || '').replace(/"/g, '\\"')}","${todo.dueDate || ''}","${todo.dueTime || ''}",${todo.isCompleted ? 1 : 0},${todo.isFlagged ? 1 : 0},"${todo.priority}",${todo.duration},"${tagsStr}","${subtasksStr}","${recurrenceStr}"\n`;
            });
            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', 'attachment; filename="todos_export.csv"');
            res.send(csv);
        } else {
            // Export as JSON (default)
            const exportData = {
                version: 1,
                exportDate: new Date().toISOString(),
                todos: todos.map(todo => ({
                    id: todo.id,
                    title: todo.title,
                    description: todo.description,
                    dueDate: todo.dueDate,
                    dueTime: todo.dueTime,
                    isCompleted: todo.isCompleted,
                    isFlagged: todo.isFlagged,
                    priority: todo.priority,
                    duration: todo.duration,
                    tags: todo.tags.map(t => ({ id: t.id, name: t.name, color: t.color })),
                    subtasks: todo.subtasks,
                    recurrence: todo.recurrence,
                    originalId: todo.originalId
                })),
                tags: tags.map(tag => ({ id: tag.id, name: tag.name, color: tag.color }))
            };
            res.header('Content-Type', 'application/json');
            res.header('Content-Disposition', 'attachment; filename="todos_export.json"');
            res.send(JSON.stringify(exportData, null, 2));
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import endpoint
app.post('/api/import', async (req, res) => {
    try {
        const { data, mode } = req.body; // mode: 'merge' or 'replace'

        if (!data || typeof data !== 'string') {
            return res.status(400).json({ error: 'No data provided' });
        }

        let importedData;
        try {
            importedData = JSON.parse(data);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON format' });
        }

        if (!importedData.todos || !Array.isArray(importedData.todos)) {
            return res.status(400).json({ error: 'Invalid import format: missing todos array' });
        }

        // If mode is 'replace', clear existing data
        if (mode === 'replace') {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM todo_tags', (err) => {
                    if (err) reject(err);
                    else {
                        db.run('DELETE FROM todos', (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    }
                });
            });
        }

        // Import tags first
        const tagMap = {}; // Map old tag IDs to new ones
        if (importedData.tags && Array.isArray(importedData.tags)) {
            for (const tag of importedData.tags) {
                const existingTag = await tagRepository.findByName(tag.name);
                if (existingTag) {
                    tagMap[tag.id] = existingTag.id;
                } else {
                    const newTag = await createTag.execute(tag.name, tag.color);
                    tagMap[tag.id] = newTag.id;
                }
            }
        }

        // Import todos
        let importedCount = 0;
        for (const todoData of importedData.todos) {
            const Todo = require('./domain/Todo');
            const mappedTags = (todoData.tags || []).map(tag => {
                if (typeof tag === 'string') {
                    // If tag is just an ID string, try to find it
                    return tagMap[tag] ? { id: tagMap[tag], name: '', color: '' } : null;
                }
                // If tag is an object, map its ID
                return tagMap[tag.id] ? { id: tagMap[tag.id], name: tag.name, color: tag.color } : null;
            }).filter(t => t !== null);

            const todo = new Todo(
                todoData.id || require('uuid').v4(),
                todoData.title,
                todoData.isCompleted || false,
                todoData.dueDate || null,
                mappedTags,
                todoData.isFlagged || false,
                todoData.duration || 0,
                todoData.priority || 'medium',
                todoData.dueTime || null,
                todoData.subtasks || [],
                0,
                todoData.description || '',
                todoData.recurrence || null,
                todoData.nextRecurrenceDue || null,
                todoData.originalId || null
            );

            await todoRepository.save(todo);
            importedCount++;
        }

        res.json({
            success: true,
            message: `Successfully imported ${importedCount} todos`,
            importedCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Notification endpoints
// Get pending notifications
app.get('/api/notifications/pending', async (req, res) => {
    try {
        const notifications = await notificationService.getPendingNotifications();
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Schedule notification for a todo
app.post('/api/notifications/schedule', async (req, res) => {
    try {
        const { todoId, minutesBefore = 0 } = req.body;
        const todo = await todoRepository.findById(todoId);

        if (!todo) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        const notificationInfo = notificationService.scheduleNotification(todo, minutesBefore);
        if (!notificationInfo) {
            return res.status(400).json({ error: 'Cannot schedule notification - due date is in the past' });
        }

        const message = notificationService.getNotificationMessage(todo);
        const notificationId = await notificationService.saveNotification(todoId, message, notificationInfo.scheduledTime);

        res.json({
            id: notificationId,
            todoId,
            message,
            scheduledTime: notificationInfo.scheduledTime,
            delayMs: notificationInfo.delayMs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark notification as sent
app.patch('/api/notifications/:id/sent', async (req, res) => {
    try {
        const { id } = req.params;
        await notificationService.markNotificationSent(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete notification
app.delete('/api/notifications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await notificationService.deleteNotification(id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
});
