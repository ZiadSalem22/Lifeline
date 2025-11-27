require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { checkJwt } = require('./middleware/auth0');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { attachCurrentUser } = require('./middleware/attachCurrentUser');
const logger = require('./config/logger');

const TypeORMTodoRepository = require('./infrastructure/TypeORMTodoRepository');
const TypeORMTagRepository = require('./infrastructure/TypeORMTagRepository');
const { AppDataSource } = require('./infra/db/data-source');
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


// CORS configuration: allow Vite dev origin and Authorization header
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(
    cors({
        origin: FRONTEND_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Authorization',
            'Content-Type',
            'Accept',
            'Origin',
            'X-Requested-With',
        ],
        credentials: true,
    })
);

app.use(bodyParser.json());

// PUBLIC DB health check route (must be before checkJwt)
app.get('/api/health/db', async (req, res) => {
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
            console.log('[health/db] AppDataSource initialized');
        }

        await AppDataSource.query('SELECT 1 AS value');

        const opts = AppDataSource.options || {};
        console.log('[health/db] TypeORM status:', {
            type: opts.type,
            host: opts.host,
            database: opts.database
        });

        res.status(200).json({ db: 'ok' });
    } catch (err) {
        logger.error('[health/db] MSSQL connection error', { error: err.message });
        res.status(500).json({
            db: 'error',
            message: err.message
        });
    }
});

// INTERNAL: Schema validation endpoint for ExpressSQL (not public API, for debugging only)
app.get('/api/health/db/schema', async (req, res) => {
    // Build connection from current TypeORM DataSource options
    const sql = require('mssql');
    const opts = AppDataSource.options || {};
    const config = {
        server: opts.host || 'localhost',
        port: opts.port || 1433,
        database: opts.database,
        user: opts.username,
        password: opts.password,
        options: {
            encrypt: true,
            trustServerCertificate: true,
            instanceName: (opts.extra && opts.extra.instanceName) || process.env.MSSQL_INSTANCE || 'SQLEXPRESS'
        }
    };
    try {
        const pool = await sql.connect(config);
        const [todos, tags, todo_tags] = await Promise.all([
            pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'todos'`),
            pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tags'`),
            pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'todo_tags'`)
        ]);
        res.json({
            todos: todos.recordset,
            tags: tags.recordset,
            todo_tags: todo_tags.recordset
        });
        await pool.close();
    } catch (err) {
        logger.error('[health/db/schema] MSSQL schema check failed', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// Swagger UI (auto-served at /api-docs)
try {
    require('./swagger')(app);
} catch (e) {
    console.warn('Swagger UI not available:', e.message);
}

// Database Setup: enforce TypeORM-only mode
const USE_TYPEORM = true;
let db = null; // No SQLite in TypeORM-only mode

// Repository & Use Cases
let todoRepository;
let tagRepository;

// Ensure TypeORM is initialized before repositories are used
if (!AppDataSource.isInitialized) {
    AppDataSource.initialize()
        .then(() => {
            console.log('[TypeORM] DataSource initialized (MSSQL)');
        })
        .catch((err) => {
            console.error('[TypeORM] Failed to initialize DataSource', err);
        });
}

todoRepository = new TypeORMTodoRepository();
tagRepository = new TypeORMTagRepository();

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

// Secure API: checkJwt, then attachCurrentUser (SQLite-backed user store only)
app.use('/api', checkJwt, attachCurrentUser());

// Auth probe
app.get('/api/me', (req, res) => {
    const payload = req.auth?.payload || {};
    res.json({
        sub: payload.sub,
        email: payload.email,
        claims: payload
    });
});

// Notifications: in MSSQL/TypeORM mode notifications are effectively
// disabled (NotificationService is a no-op without SQLite), but the
// endpoint should still exist and return an empty list so the
// frontend polling does not fail.
app.get('/api/notifications/pending', async (req, res) => {
    try {
        const pending = await notificationService.getPendingNotifications();
        res.json(pending || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
            // Clear existing data using TypeORM (MSSQL)
            await AppDataSource.manager.query('DELETE FROM todo_tags');
            await AppDataSource.manager.query('DELETE FROM todos');
            await AppDataSource.manager.query('DELETE FROM tags');
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
// (MSSQL mode: NotificationService is no-op; endpoints retained)

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


// (Removed duplicate health route; consolidated at top)

// Fallback handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
});
