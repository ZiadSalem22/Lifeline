
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { checkJwt } = require('./middleware/auth0');
const { errorHandler, notFoundHandler, AppError } = require('./middleware/errorHandler');
const { attachCurrentUser } = require('./middleware/attachCurrentUser');
const { createRateLimiter } = require('./middleware/rateLimit');
const { validateTodoCreate, validateTodoUpdate, validateTodoBatch } = require('./middleware/validateTodo');
const { requireAuth, requireRole, requireRoleIn, requirePaid } = require('./middleware/roles');
const logger = require('./config/logger');

const TypeORMTodoRepository = require('./infrastructure/TypeORMTodoRepository');
const TypeORMTagRepository = require('./infrastructure/TypeORMTagRepository');
const TypeORMUserSettingsRepository = require('./infrastructure/TypeORMUserSettingsRepository');
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

app.use(bodyParser.json());

/**
 * @openapi
 * /api/reset-account:
 *   post:
 *     summary: Delete all todos, tags, and theme for the current user
 *     tags: [Account]
 *     responses:
 *       '200': { description: Account data reset }
 */
app.post('/api/reset-account', checkJwt, attachCurrentUser, requireAuth(), async (req, res) => {
    try {
        const userId = req.currentUser && req.currentUser.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Delete all todos for user
        await AppDataSource.manager.query('DELETE FROM todos WHERE user_id = @0', [userId]);
        // Delete all tags for user
        await AppDataSource.manager.query('DELETE FROM tags WHERE user_id = @0', [userId]);
        // Delete user settings (theme, etc)
        await AppDataSource.manager.query('DELETE FROM user_settings WHERE user_id = @0', [userId]);

        res.json({ success: true, message: 'Account data reset: todos, tags, and theme deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// PUBLIC DB health check route (must be before checkJwt)
/**
 * @openapi
 * /api/health/db:
 *   get:
 *     summary: Database health check
 *     tags: [Health]
 *     responses:
 *       '200':
 *         description: Database connection is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 db:
 *                   type: string
 *                   example: ok
 *       '500':
 *         description: Database connection error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 db:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 */
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

// Save or update user settings
/**
 * @openapi
 * /api/settings:
 *   post:
 *     summary: Save or update user settings (theme, locale, layout)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme: { type: string }
 *               locale: { type: string }
 *               layout: { type: object }
 *     responses:
 *       '200': { description: Saved settings }
 */
app.post('/api/settings', checkJwt, attachCurrentUser, requireAuth(), async (req, res) => {
    try {
        const userId = req.currentUser && req.currentUser.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { theme = null, locale = null, layout = null } = req.body || {};
        const saved = await TypeORMUserSettingsRepository.saveOrUpdate(userId, { theme, locale, layout });
        if (!saved) {
            logger.error('[settings] save failed', { userId, body: req.body });
            return res.status(500).json({ error: 'Failed to save settings' });
        }
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// INTERNAL: Schema validation endpoint for ExpressSQL (not public API, for debugging only)
/**
 * @openapi
 * /api/health/db/schema:
 *   get:
 *     summary: Inspect database schema (internal)
 *     tags: [Health]
 *     responses:
 *       '200':
 *         description: Current schema overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 todos:
 *                   type: array
 *                   items: { type: object }
 *                 tags:
 *                   type: array
 *                   items: { type: object }
 *                 todo_tags:
 *                   type: array
 *                   items: { type: object }
 *                 users:
 *                   type: array
 *                   items: { type: object }
 *       '500':
 *         description: Schema inspection failed
 */
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
        const [todos, tags, todo_tags, users] = await Promise.all([
            pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'todos'`),
            pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tags'`),
            pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'todo_tags'`),
            pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users'`)
        ]);
        res.json({
            todos: todos.recordset,
            tags: tags.recordset,
            todo_tags: todo_tags.recordset,
            users: users.recordset
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
async function ensureDataSource() {
    if (!AppDataSource.isInitialized) {
        try {
            await AppDataSource.initialize();
            console.log('[TypeORM] DataSource initialized (MSSQL)');
        } catch (err) {
            console.error('[TypeORM] Failed to initialize DataSource', err);
            throw err;
        }
    }
}
// Initialize proactively at startup
ensureDataSource().catch(() => {});

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

// Public info endpoint (no auth required)
/**
 * @openapi
 * /api/public/info:
 *   get:
 *     summary: Public application info (no auth)
 *     tags: [Public]
 *     responses:
 *       '200':
 *         description: Public information payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name: { type: string }
 *                 version: { type: string }
 *                 guestMode: { type: string }
 *                 message: { type: string }
 *                 time: { type: string, format: date-time }
 */
app.get('/api/public/info', (req, res) => {
    const pkg = require('../package.json');
    res.json({
        name: 'Lifeline API',
        version: pkg.version || '1.0.0',
        guestMode: 'local-only',
        message: 'Guest mode data never reaches the server; authenticate to sync.',
        time: new Date().toISOString()
    });
});

// Secure API: checkJwt, then attachCurrentUser (excludes /api/public/* which is above)
app.use('/api', checkJwt, attachCurrentUser);

// Rate limits
const todosLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => (req.currentUser && req.currentUser.id) || req.ip,
});
const aiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => (req.currentUser && req.currentUser.id) || req.ip,
    exempt: (req) => Array.isArray(req.currentUser?.roles) && req.currentUser.roles.includes('admin'),
});
app.use('/api/todos', todosLimiter);
app.use('/api/ai', aiLimiter);

// /api/me - requireAuth
/**
 * @openapi
 * /api/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     responses:
 *       '200':
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, nullable: true }
 *                 email: { type: string, nullable: true }
 *                 name: { type: string, nullable: true }
 *                 picture: { type: string, nullable: true }
 *                 role: { type: string, example: free }
 *                 roles:
 *                   type: array
 *                   items: { type: string }
 *                 subscription_status: { type: string, nullable: true }
 *                 profile:
 *                   type: object
 *                   nullable: true
 *       '401':
 *         description: Unauthorized
 */
app.get('/api/me', requireAuth(), (req, res) => {
    const user = req.currentUser || {};
    res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        roles: user.roles,
        subscription_status: user.subscription_status,
        profile: user.profile || { onboarding_completed: false }
    });
});
// Update or create user profile
/**
 * @openapi
 * /api/profile:
 *   post:
 *     summary: Create or update the current user's profile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               timezone: { type: string }
 *               phone: { type: string }
 *               country: { type: string }
 *               onboarding_completed: { type: boolean }
 *     responses:
 *       '200':
 *         description: Updated profile
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 */
app.post('/api/profile', requireAuth(), async (req, res) => {
    try { await ensureDataSource(); } catch (e) { return res.status(500).json({ error: 'Database init failed' }); }
    const user = req.currentUser;
    if (!user || !user.id) return res.status(401).json({ error: 'Unauthorized' });
    const {
        first_name,
        last_name,
        phone = null,
        country = null,
        city = null,
        birthday = null,
        avatar_url = null,
        timezone = null,
        onboarding_completed
    } = req.body || {};
    if (!first_name || !last_name) {
        return res.status(400).json({ error: 'first_name and last_name are required' });
    }
    // Only allow onboarding_completed to be true
    const onboardingFlag = onboarding_completed === true ? true : undefined;
    try {
        const userProfileRepo = require('./infrastructure/TypeORMUserProfileRepository');
        const saved = await userProfileRepo.saveOrUpdate(user.id, {
            first_name,
            last_name,
            timezone,
            phone,
            country,
            city,
            birthday,
            avatar_url,
            ...(onboardingFlag ? { onboarding_completed: true } : {})
        });
        res.json({
            first_name: saved.first_name,
            last_name: saved.last_name,
            timezone: saved.timezone,
            phone: saved.phone,
            country: saved.country,
            city: saved.city,
            birthday: saved.birthday,
            avatar_url: saved.avatar_url,
            onboarding_completed: !!saved.onboarding_completed
        });
    } catch (err) {
        logger.error('[POST /api/profile] failed', { error: err.message });
        res.status(500).json({ error: 'Failed to save profile' });
    }
});
// Auth probe
// Raw auth payload (kept separate to avoid overriding /api/me)
/**
 * @openapi
 * /api/me/raw:
 *   get:
 *     summary: Raw auth payload (debug)
 *     tags: [Auth]
 *     responses:
 *       '200':
 *         description: Raw JWT payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sub: { type: string, nullable: true }
 *                 email: { type: string, nullable: true }
 *                 claims: { type: object }
 */
app.get('/api/me/raw', (req, res) => {
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
/**
 * @openapi
 * /api/notifications/pending:
 *   get:
 *     summary: List pending notifications
 *     tags: [Notifications]
 *     responses:
 *       '200':
 *         description: Array of pending notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 */
app.get('/api/notifications/pending', async (req, res) => {
    try {
        const pending = await notificationService.getPendingNotifications();
        res.json(pending || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// /api/todos/* - requireAuth
/**
 * @openapi
 * /api/todos:
 *   get:
 *     summary: List todos for current user
 *     tags: [Todos]
 *     responses:
 *       '200':
 *         description: List of todos or guest mode
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     mode: { type: string, example: guest }
 *                 - type: array
 *                   items: { $ref: '#/components/schemas/Todo' }
 */
app.get('/api/todos', requireAuth(), async (req, res, next) => {
    try {
        const todos = await listTodos.execute(req.currentUser.id);
        res.json(todos);
    } catch (err) { next(err); }
});
/**
 * @openapi
 * /api/todos:
 *   post:
 *     summary: Create a todo
 *     tags: [Todos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               dueDate: { type: string, nullable: true }
 *               tags: { type: array, items: { type: string }, nullable: true }
 *               isFlagged: { type: boolean, nullable: true }
 *               duration: { type: integer, nullable: true }
 *               priority: { type: string, example: medium }
 *               dueTime: { type: string, nullable: true }
 *               subtasks: { type: array, items: { type: object }, nullable: true }
 *               description: { type: string, nullable: true }
 *               recurrence: { type: object, nullable: true }
 *     responses:
 *       '201':
 *         description: Created todo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Todo' }
 *       '403': { description: Free tier limit reached }
 */
app.post('/api/todos', requireAuth(), validateTodoCreate, async (req, res, next) => {
    try {
        const role = req.currentUser?.role || 'free';
        const userId = req.currentUser.id;
        if (role === 'free') {
            const currentCount = await todoRepository.countByUser(userId);
            if (currentCount >= 200) {
                return next(new AppError('Free tier max tasks reached.', 403));
            }
        }
        const { title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence } = req.body;
        const todo = await createTodo.execute(userId, title, dueDate, tags, isFlagged, duration, priority || 'medium', dueTime || null, subtasks || [], description || '', recurrence || null);
        res.status(201).json(todo);
    } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/todos/batch:
 *   post:
 *     summary: Batch operations on todos (delete or mark complete/undo)
 *     tags: [Todos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, enum: [delete, complete, uncomplete] }
 *               ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       '200': { description: Batch operation result }
 */
app.post('/api/todos/batch', requireAuth(), validateTodoBatch, async (req, res, next) => {
    try {
        const { action, ids } = req.body;
        const userId = req.currentUser.id;

        let deleted = 0;
        let updated = 0;
        if (action === 'delete') {
            for (const id of ids) {
                await todoRepository.delete(id, userId);
                deleted += 1;
            }
        } else if (action === 'complete' || action === 'uncomplete') {
            const toCompleted = action === 'complete';
            for (const id of ids) {
                const t = await todoRepository.findById(id, userId);
                if (!t) continue;
                t.isCompleted = toCompleted;
                await todoRepository.save(t);
                updated += 1;
            }
        }
        res.json({ action, ids, deleted, updated });
    } catch (err) { next(err); }
});
/**
 * @openapi
 * /api/todos/{id}/reorder:
 *   patch:
 *     summary: Reorder a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order: { type: integer }
 *     responses:
 *       '200': { description: Updated todo }
 *       '404': { description: Todo not found }
 */
app.patch('/api/todos/:id/reorder', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { order } = req.body;
        const todo = await todoRepository.findById(id, req.currentUser.id);
        if (!todo) return next(new AppError('Todo not found', 404));
        todo.order = order;
        await todoRepository.save(todo);
        res.json(todo);
    } catch (err) { next(err); }
});
/**
 * @openapi
 * /api/todos/{id}:
 *   patch:
 *     summary: Update a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       '200': { description: Updated todo }
 *       '404': { description: Not found }
 */
app.patch('/api/todos/:id', requireAuth(), validateTodoUpdate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const todo = await updateTodo.execute(req.currentUser.id, id, updates);
        res.json(todo);
    } catch (err) { next(err); }
});
/**
 * @openapi
 * /api/todos/search:
 *   get:
 *     summary: Search todos
 *     tags: [Todos]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: tags
 *         schema: { type: string, description: Comma-separated tag IDs }
 *       - in: query
 *         name: priority
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: minDuration
 *         schema: { type: integer }
 *       - in: query
 *         name: maxDuration
 *         schema: { type: integer }
 *       - in: query
 *         name: flagged
 *         schema: { type: boolean }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 30 }
 *     responses:
 *       '200':
 *         description: Paginated results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 todos: { type: array, items: { $ref: '#/components/schemas/Todo' } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 */
app.get('/api/todos/search', requireAuth(), async (req, res, next) => {
    try {
        const q = req.query.q || '';
        // support both 'tags' (array) and single 'tag'
        let tags = req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : req.query.tags.split(',')) : [];
        if (!tags.length && req.query.tag) tags = [req.query.tag];
        const priority = req.query.priority || null;
        const status = req.query.status || null;
        // support dueDateFrom/dueDateTo aliases
        const startDate = req.query.startDate || req.query.dueDateFrom || null;
        const endDate = req.query.endDate || req.query.dueDateTo || null;
        const minDuration = req.query.minDuration || null;
        const maxDuration = req.query.maxDuration || null;
        const flagged = typeof req.query.flagged !== 'undefined' ? (req.query.flagged === '1' || req.query.flagged === 'true') : undefined;
        const sortBy = req.query.sortBy || null;
        const page = parseInt(req.query.page || '1', 10) || 1;
        const limit = parseInt(req.query.limit || req.query.pageSize || '30', 10) || 30;
        const offset = (page - 1) * limit;
        const filters = { q, tags, priority, status, startDate, endDate, minDuration, maxDuration, flagged, sortBy, limit, offset };
        logger.info('[GET /api/todos/search] executing', { userId: req.currentUser.id, filters });
        const results = await searchTodos.execute(req.currentUser.id, filters);
        res.json({ todos: results.todos || [], total: results.total || 0, page, limit });
    } catch (err) {
        logger.error('[GET /api/todos/search] failed', { error: err.message, stack: err.stack });
        next(err);
    }
});
/**
 * @openapi
 * /api/todos/{id}/toggle:
 *   patch:
 *     summary: Toggle todo completion
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Updated todo }
 */
app.patch('/api/todos/:id/toggle', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const todo = await toggleTodo.execute(req.currentUser.id, id);
        if (!todo) return next(new AppError('Todo not found', 404));
        res.json(todo);
    } catch (err) { next(err); }
});
/**
 * @openapi
 * /api/todos/{id}/flag:
 *   patch:
 *     summary: Toggle flag on a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Updated todo }
 */
app.patch('/api/todos/:id/flag', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const todo = await todoRepository.findById(id, req.currentUser.id);
        if (!todo) return next(new AppError('Todo not found', 404));
        todo.toggleFlag();
        await todoRepository.save(todo);
        res.json(todo);
    } catch (err) { next(err); }
});
/**
 * @openapi
 * /api/todos/{id}:
 *   delete:
 *     summary: Delete a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '204': { description: Deleted }
 */
app.delete('/api/todos/:id', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        // ownership enforced by repository delete
        await deleteTodo.execute(req.currentUser.id, id);
        res.status(204).send();
    } catch (err) { next(err); }
});

// Archive/Unarchive (soft-delete management)
/**
 * @openapi
 * /api/todos/{id}/archive:
 *   post:
 *     summary: Archive a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Archived state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 archived: { type: boolean, example: true }
 */
app.post('/api/todos/:id/archive', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        await todoRepository.archive(id);
        res.json({ id, archived: true });
    } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/todos/{id}/unarchive:
 *   post:
 *     summary: Unarchive a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Archived state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 archived: { type: boolean, example: false }
 */
app.post('/api/todos/:id/unarchive', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        await todoRepository.unarchive(id);
        res.json({ id, archived: false });
    } catch (err) { next(err); }
});
// /api/admin/* - requireRole('admin')
app.use('/api/admin', requireRole('admin'));
// /api/ai/* - requirePaid()
app.use('/api/ai', requirePaid());

// Tag Routes
/**
 * @openapi
 * /api/tags:
 *   get:
 *     summary: List tags (default + user custom)
 *     tags: [Tags]
 *     responses:
 *       '200':
 *         description: Array of tags or guest mode
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     mode: { type: string, example: guest }
 *                 - type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       color: { type: string }
 */
app.get('/api/tags', requireAuth(), async (req, res, next) => {
    try {
        const tags = await listTags.execute(req.currentUser.id);
        res.json(tags);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /api/tags:
 *   post:
 *     summary: Create a custom tag
 *     tags: [Tags]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               color: { type: string }
 *     responses:
 *       '201': { description: Created tag }
 *       '403': { description: Free tier max tags reached }
 */
app.post('/api/tags', requireAuth(), async (req, res, next) => {
    try {
        const role = req.currentUser?.role || 'free';
        const userId = req.currentUser.id;
        if (role === 'free') {
            const currentCount = await tagRepository.countCustomByUser(userId);
            if (currentCount >= 50) {
                return next(new AppError('Free tier max tags reached.', 403));
            }
        }
        const { name, color } = req.body;
        // Force custom tag creation only (is_default cannot be spoofed)
        const tag = await createTag.execute(req.currentUser.id, name, color, role === 'free' ? { maxTags: 50 } : null);
        res.status(201).json(tag);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @openapi
 * /api/tags/{id}:
 *   patch:
 *     summary: Update a custom tag
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               color: { type: string }
 *     responses:
 *       '200': { description: Updated tag }
 *       '403': { description: Forbidden or default tag }
 *       '404': { description: Not found }
 */
app.patch('/api/tags/:id', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;
        // ownership: ensure tag belongs to user if not default
        const existing = await tagRepository.findById(id);
        if (!existing) return next(new AppError('Tag not found', 404));
        if (existing.isDefault) return next(new AppError('Default tags cannot be modified', 403));
        if (existing.userId !== req.currentUser.id) return next(new AppError('Forbidden', 403));
        const tag = await updateTag.execute(req.currentUser.id, id, name, color);
        res.json(tag);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /api/tags/{id}:
 *   delete:
 *     summary: Delete a custom tag
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '204': { description: Deleted }
 *       '403': { description: Forbidden or default tag }
 */
app.delete('/api/tags/:id', requireAuth(), async (req, res, next) => {
    try {
        const { id } = req.params;
        await deleteTag.execute(req.currentUser.id, id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Statistics endpoint
/**
 * @openapi
 * /api/stats:
 *   get:
 *     summary: Get statistics
 *     tags: [Stats]
 *     responses:
 *       '200': { description: Statistics payload }
 */
app.get('/api/stats', requireAuth(), async (req, res) => {
    try {
        const userId = req.currentUser && req.currentUser.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const { period, startDate, endDate } = req.query; // period OR explicit date range
        // Use SQLite aggregation when available; fallback to in-memory grouping
        let stats;
        if (startDate && endDate && typeof todoRepository.getStatisticsForUserInRange === 'function') {
            stats = await todoRepository.getStatisticsForUserInRange(userId, startDate, endDate);
        } else if (typeof todoRepository.getStatisticsAggregated === 'function') {
            stats = await todoRepository.getStatisticsAggregated(userId, period);
        } else {
            const todos = await listTodos.execute(userId) || [];
            const total = todos.length;
            const completedCount = todos.filter(t => t.isCompleted).length;
            const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
            // naive grouping by dueDate string
            const format = (d) => {
                const date = new Date(d);
                if (period === 'year') return `${date.getFullYear()}`;
                if (period === 'month') return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
                if (period === 'week') {
                    const onejan = new Date(date.getFullYear(),0,1);
                    const week = Math.ceil((((date - onejan) / 86400000) + onejan.getDay()+1) / 7);
                    return `${date.getFullYear()}-${String(week).padStart(2,'0')}`;
                }
                return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
            };
            const map = {};
            todos.forEach(t => {
                if (!t.dueDate) return;
                const key = format(t.dueDate);
                map[key] = (map[key] || 0) + 1;
            });
            const groups = Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).map(([period, count]) => ({ period, count }));
            // naive period totals equal overall totals (fallback)
            const periodTotals = { totalTodos: total, completedCount, completionRate, avgDuration: 0, timeSpentTotal: 0 };
            stats = { totalTodos: total, completedCount, completionRate, groups, periodTotals, topTagsInPeriod: [] };
        }
        res.json(stats || { totalTodos: 0, completedCount: 0, completionRate: 0, groups: [], periodTotals: { totalTodos: 0, completedCount: 0, completionRate: 0, avgDuration: 0, timeSpentTotal: 0 }, topTagsInPeriod: [] });
    } catch (err) {
        logger.error('[GET /api/stats] failed', { error: err.message, stack: err.stack });
        res.status(500).json({ error: err.message });
    }
});

// Export endpoint
/**
 * @openapi
 * /api/export:
 *   get:
 *     summary: Export data
 *     tags: [Export]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, csv], default: json }
 *     responses:
 *       '200': { description: Export file }
 */
app.get('/api/export', requireAuth(), async (req, res) => {
    try {
        const format = req.query.format || 'json'; // json or csv
        const userId = req.currentUser && req.currentUser.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Load scoped data for this user only
        const todos = await listTodos.execute(userId) || [];
        const tags = await listTags.execute(userId) || [];

        if (format === 'csv') {
            // Export as CSV (scoped to user)
            let csv = 'id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags,subtasks,recurrence\n';
            todos.forEach(todo => {
                const tagsStr = (todo.tags || []).map(t => t.name).join(';');
                const subtasksStr = (todo.subtasks || []).map(s => `${s.title}(${s.isCompleted ? 'done' : 'pending'})`).join(';');
                const recurrenceStr = todo.recurrence ? JSON.stringify(todo.recurrence).replace(/"/g, '\\"') : '';
                csv += `"${todo.id}","${(todo.title || '').replace(/"/g, '\\"')}","${((todo.description || '')).replace(/"/g, '\\"')}","${todo.dueDate || ''}","${todo.dueTime || ''}",${todo.isCompleted ? 1 : 0},${todo.isFlagged ? 1 : 0},"${todo.priority}",${todo.duration || 0},"${tagsStr}","${subtasksStr}","${recurrenceStr}"\n`;
            });
            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', 'attachment; filename="todos_export.csv"');
            res.send(csv);
            return;
        }

        // Delegate stats calculation to repository for performance
        let stats = { totalTodos: todos.length, completedCount: todos.filter(t=>t.isCompleted).length, completionRate: 0 };
        try {
            const repoStats = await todoRepository.getExportStatsForUser(userId);
            if (repoStats) stats = repoStats;
        } catch (e) {
            // Fallback to in-memory stats if repository aggregation fails
            const total = todos.length;
            const completedCount = todos.filter(t => t.isCompleted).length;
            const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;
            stats = { totalTodos: total, completedCount, completionRate };
        }

        // Build export JSON structure per spec
        const exportPayload = {
            exported_at: new Date().toISOString(),
            user: {
                id: req.currentUser.id,
                email: req.currentUser.email || null,
                profile: req.currentUser.profile || null,
                settings: req.currentUser.settings || null
            },
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
                tags: (todo.tags || []).map(t => ({ id: t.id, name: t.name, color: t.color })),
                subtasks: todo.subtasks || [],
                recurrence: todo.recurrence || null,
                originalId: todo.originalId || null
            })),
            tags: (tags || []).map(tag => ({ id: tag.id, name: tag.name, color: tag.color, isDefault: !!tag.isDefault })),
            stats
        };

        res.header('Content-Type', 'application/json');
        res.header('Content-Disposition', 'attachment; filename="todos_export.json"');
        res.send(JSON.stringify(exportPayload, null, 2));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import endpoint
/**
 * @openapi
 * /api/import:
 *   post:
 *     summary: Import data
 *     tags: [Import]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data: { type: string, description: Export JSON string }
 *               mode: { type: string, enum: [merge, replace], default: merge }
 *     responses:
 *       '200':
 *         description: Import result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 importedCount: { type: integer }
 */
app.post('/api/import', requireAuth(), async (req, res) => {
    try {
        const userId = req.currentUser && req.currentUser.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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

        // If mode is 'replace', clear existing data for THIS user only
        if (mode === 'replace') {
            try {
                // Delete tag relations for this user's todos
                await AppDataSource.manager.query(`
                    DELETE tt
                    FROM todo_tags tt
                    JOIN todos t ON tt.todo_id = t.id
                    WHERE t.user_id = @0
                `, [userId]);
            } catch (_) {}
            await AppDataSource.manager.query('DELETE FROM todos WHERE user_id = @0', [userId]);
            // Delete only this user's custom tags (keep defaults)
            await AppDataSource.manager.query('DELETE FROM tags WHERE user_id = @0', [userId]);
        }

        // Build existing tag maps (default + user custom)
        const existingTags = await listTags.execute(userId);
        const defaultByName = {};
        const customByName = {};
        (existingTags || []).forEach(t => {
            if (t.isDefault) defaultByName[(t.name || '').toLowerCase()] = t;
            else if (t.userId === userId) customByName[(t.name || '').toLowerCase()] = t;
        });

        // Import tags first and map old -> new ids
        const tagIdMap = {};
        if (importedData.tags && Array.isArray(importedData.tags)) {
            for (const tag of importedData.tags) {
                const nameKey = (tag.name || '').toLowerCase();
                if (tag.isDefault) {
                    const match = defaultByName[nameKey] || null;
                    if (match) tagIdMap[tag.id] = match.id;
                    continue;
                }
                // custom tag: prefer existing user's tag by name
                let target = customByName[nameKey] || null;
                if (!target) {
                    // create a new custom tag for this user
                    try {
                        target = await createTag.execute(userId, tag.name, tag.color);
                        customByName[nameKey] = target;
                    } catch (_) {
                        target = null;
                    }
                }
                if (target) {
                    tagIdMap[tag.id] = target.id;
                }
            }
        }

        // Import todos
        let importedCount = 0;
        for (const todoData of importedData.todos) {
            const Todo = require('./domain/Todo');
            const mappedTags = (todoData.tags || []).map(tag => {
                if (!tag) return null;
                const oldId = typeof tag === 'string' ? tag : tag.id;
                const newId = tagIdMap[oldId];
                return newId ? { id: newId, name: tag.name || '', color: tag.color || '' } : null;
            }).filter(Boolean);

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
                todoData.originalId || null,
                userId
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
/**
 * @openapi
 * /api/notifications/schedule:
 *   post:
 *     summary: Schedule notification for a todo
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               todoId: { type: string }
 *               minutesBefore: { type: integer, default: 0 }
 *     responses:
 *       '200':
 *         description: Scheduled notification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 todoId: { type: string }
 *                 message: { type: string }
 *                 scheduledTime: { type: string }
 *                 delayMs: { type: integer }
 */
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
/**
 * @openapi
 * /api/notifications/{id}/sent:
 *   patch:
 *     summary: Mark notification as sent
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Success flag }
 */
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
/**
 * @openapi
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '204': { description: Deleted }
 */
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
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Backend running at http://localhost:${port}`);
    });
}

module.exports = app;
