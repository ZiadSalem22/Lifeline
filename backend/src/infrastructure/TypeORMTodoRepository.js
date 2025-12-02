const ITodoRepository = require('../domain/ITodoRepository');
const Todo = require('../domain/Todo');
const Tag = require('../domain/Tag');
const { AppDataSource } = require('../infra/db/data-source');

class TypeORMTodoRepository extends ITodoRepository {
    constructor() {
        super();
        this.repo = AppDataSource.getRepository('Todo');
        this.tagRepo = AppDataSource.getRepository('Tag');
    }
 

    async save(todo) {
        const entity = {
            id: todo.id,
            title: todo.title,
            description: todo.description || '',
            is_completed: todo.isCompleted ? 1 : 0,
            due_date: todo.dueDate,
            is_flagged: todo.isFlagged ? 1 : 0,
            duration: todo.duration,
            priority: todo.priority || 'medium',
            due_time: todo.dueTime || null,
            subtasks: JSON.stringify(todo.subtasks || []),
            order: todo.order || 0,
            recurrence: todo.recurrence ? JSON.stringify(todo.recurrence) : null,
            next_recurrence_due: todo.nextRecurrenceDue || null,
            original_id: todo.originalId || null,
            user_id: todo.userId,
        };

        const tagIds = (todo.tags || []).map(t => t.id);
        const tags = tagIds.length > 0
            ? await this.tagRepo.findByIds(tagIds)
            : [];

        await this.repo.save({ ...entity, tags });
    }

    async findById(id, userId) {
        const row = await this.repo.findOne({ where: { id, user_id: userId }, relations: ['tags'] });
        if (!row) return null;
        return this._mapRowToDomain(row);
    }

    async findAll(userId) {
        const rows = await this.repo.find({ where: { archived: 0, user_id: userId }, relations: ['tags'] });
        return rows.map(row => this._mapRowToDomain(row));
    }

    async findByFilters(filters = {}) {
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
            limit = 30,
            offset = 0,
            userId
        } = filters;

        const qb = this.repo.createQueryBuilder('todo')
            .leftJoinAndSelect('todo.tags', 'tag')
            .distinct(true);

        qb.andWhere('ISNULL(todo.archived, 0) = 0');
        if (userId) {
            qb.andWhere('todo.user_id = :userId', { userId });
        }

        if (q) {
            qb.andWhere('(todo.title LIKE :q OR todo.description LIKE :q)', { q: `%${q}%` });
        }

        if (priority) {
            qb.andWhere('todo.priority = :priority', { priority });
        }

        if (typeof flagged !== 'undefined') {
            qb.andWhere('todo.is_flagged = :flagged', { flagged: flagged ? 1 : 0 });
        }

        if (status === 'completed') {
            qb.andWhere('todo.is_completed = 1');
        } else if (status === 'active') {
            qb.andWhere('todo.is_completed = 0');
        }

        // Normalize date range: inclusive start, exclusive next-day end for correctness
        if (startDate && endDate) {
            let endPlusOne = endDate;
            try {
                const d = new Date(endDate);
                if (!Number.isNaN(d.getTime())) {
                    d.setDate(d.getDate() + 1);
                    endPlusOne = d.toISOString().slice(0, 10);
                }
            } catch (_) { /* ignore parse issues, fallback to <= endDate below */ }
            if (endPlusOne !== endDate) {
                qb.andWhere('todo.due_date >= :startDate AND todo.due_date < :endPlusOne', { startDate, endPlusOne });
            } else {
                qb.andWhere('todo.due_date >= :startDate AND todo.due_date <= :endDate', { startDate, endDate });
            }
        } else if (startDate) {
            qb.andWhere('todo.due_date >= :startDate', { startDate });
        } else if (endDate) {
            let endPlusOne = endDate;
            try {
                const d = new Date(endDate);
                if (!Number.isNaN(d.getTime())) {
                    d.setDate(d.getDate() + 1);
                    endPlusOne = d.toISOString().slice(0, 10);
                }
            } catch (_) { /* ignore */ }
            if (endPlusOne !== endDate) {
                qb.andWhere('todo.due_date < :endPlusOne', { endPlusOne });
            } else {
                qb.andWhere('todo.due_date <= :endDate', { endDate });
            }
        }

        // Only apply duration filters when parsed numbers are valid
        if (typeof minDuration !== 'undefined' && minDuration !== null && minDuration !== '') {
            const parsedMin = parseInt(minDuration, 10);
            if (!Number.isNaN(parsedMin)) {
                qb.andWhere('todo.duration >= :minDuration', { minDuration: parsedMin });
            }
        }

        if (typeof maxDuration !== 'undefined' && maxDuration !== null && maxDuration !== '') {
            const parsedMax = parseInt(maxDuration, 10);
            if (!Number.isNaN(parsedMax)) {
                qb.andWhere('todo.duration <= :maxDuration', { maxDuration: parsedMax });
            }
        }

        if (tags && Array.isArray(tags)) {
            const tagIds = tags
                .map(t => (t != null ? String(t) : null))
                .filter(t => t && t.trim().length > 0);
            if (tagIds.length > 0) {
                qb.andWhere('tag.id IN (:...tagIds)', { tagIds });
            }
        }

        if (sortBy === 'priority') {
            qb.orderBy(`CASE todo.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 2 END`, 'DESC');
        } else if (sortBy === 'duration') {
            qb.orderBy('todo.duration', 'DESC');
        } else if (sortBy === 'name') {
            qb.orderBy('todo.title', 'ASC');
                } else {
                        // SQL Server compatible nulls-last ordering using a computed select alias
                        qb.addSelect("CASE WHEN todo.due_date IS NULL THEN 1 ELSE 0 END", 'due_date_nulls')
                            .orderBy('due_date_nulls', 'ASC')
                            .addOrderBy('todo.due_date', 'ASC');
                }

        const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();
        const todos = rows.map(row => this._mapRowToDomain(row));
        return { todos, total };
    }

    async delete(id, userId) {
        const todo = await this.repo.findOne({ where: { id, user_id: userId }, relations: ['tags'] });
        if (!todo) return;
        todo.tags = [];
        todo.archived = 1;
        await this.repo.save(todo);
    }

    async archive(id, userId) {
        await this.repo.update({ id, user_id: userId }, { archived: 1 });
    }

    async unarchive(id, userId) {
        await this.repo.update({ id, user_id: userId }, { archived: 0 });
    }

    async countByUser(userId) {
        return await this.repo.count({ where: { user_id: userId, archived: 0 } });
    }

    async getExportStatsForUser(userId) {
        // Use raw queries for aggregation for performance
        const dialect = (AppDataSource.options && AppDataSource.options.type) || 'mssql';

        if (dialect === 'sqlite') {
            // SQLite-friendly SQL (use ? placeholders)
            const params = [userId];
            const totalRow = await AppDataSource.manager.query(
                'SELECT COUNT(*) as total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed FROM todos WHERE user_id = ? AND COALESCE(archived,0) = 0',
                params
            );
            const total = totalRow && totalRow[0] ? parseInt(totalRow[0].total || 0, 10) : 0;
            const completedCount = totalRow && totalRow[0] ? parseInt(totalRow[0].completed || 0, 10) : 0;

            const avgRow = await AppDataSource.manager.query(
                'SELECT AVG(NULLIF(duration,0)) as avgDur FROM todos WHERE user_id = ? AND COALESCE(archived,0) = 0',
                params
            );
            const avgDuration = avgRow && avgRow[0] && avgRow[0].avgDur ? Math.round(avgRow[0].avgDur) : 0;

            const topTagsRows = await AppDataSource.manager.query(
                `SELECT t.id, t.name, t.color, COUNT(*) as cnt
                 FROM todo_tags tt
                 JOIN tags t ON t.id = tt.tag_id
                 JOIN todos on todos.id = tt.todo_id
                 WHERE todos.user_id = ?
                 GROUP BY t.id, t.name, t.color
                 ORDER BY cnt DESC
                 LIMIT 10`,
                params
            );
            const topTags = (topTagsRows || []).map(r => ({ id: r.id, name: r.name, color: r.color, count: r.cnt }));

            const today = new Date();
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const start = new Date(end.getTime() - (29 * 24 * 60 * 60 * 1000));
            const startStr = start.toISOString().slice(0,10);
            const endStr = end.toISOString().slice(0,10);

            const perDayRows = await AppDataSource.manager.query(
                `SELECT strftime('%Y-%m-%d', due_date) as day, COUNT(*) as cnt
                 FROM todos
                 WHERE user_id = ? AND due_date BETWEEN ? AND ? AND COALESCE(archived,0) = 0
                 GROUP BY day
                 ORDER BY day ASC`,
                [userId, startStr, endStr]
            );
            const map = {};
            (perDayRows || []).forEach(r => { if (r.day) map[r.day] = r.cnt; });
            const tasksPerDay = [];
            for (let i = 0; i < 30; i++) {
                const d = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
                const key = d.toISOString().slice(0,10);
                tasksPerDay.push({ day: key, count: map[key] || 0 });
            }

            return { totalTodos: total, completedCount, completionRate: total>0?Math.round((completedCount/total)*100):0, avgDuration, topTags, tasksPerDay };
        }

        // Default: MSSQL-style SQL (existing path)
        const params = [userId];
        // total and completed
        const totalRow = await AppDataSource.manager.query('SELECT COUNT(*) as total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed FROM todos WHERE user_id = @0 AND ISNULL(archived,0) = 0', params);
        const total = totalRow && totalRow[0] ? parseInt(totalRow[0].total || 0, 10) : 0;
        const completedCount = totalRow && totalRow[0] ? parseInt(totalRow[0].completed || 0, 10) : 0;

        // avg duration (minutes) for duration > 0
        const avgRow = await AppDataSource.manager.query('SELECT AVG(CASE WHEN duration > 0 THEN duration ELSE NULL END) as avgDur FROM todos WHERE user_id = @0 AND ISNULL(archived,0) = 0', params);
        const avgDuration = avgRow && avgRow[0] && avgRow[0].avgDur ? Math.round(avgRow[0].avgDur) : 0;

        // top tags (join todo_tags -> tags)
        const topTagsRows = await AppDataSource.manager.query(`
            SELECT t.id, t.name, t.color, COUNT(*) as cnt
            FROM todo_tags tt
            JOIN tags t ON t.id = tt.tag_id
            JOIN todos on todos.id = tt.todo_id
            WHERE todos.user_id = @0 AND ISNULL(t.is_default,0) IN (0,1) AND ISNULL(t.user_id, todos.user_id) IS NOT NULL
            GROUP BY t.id, t.name, t.color
            ORDER BY cnt DESC
            OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
        `, params);
        const topTags = (topTagsRows || []).map(r => ({ id: r.id, name: r.name, color: r.color, count: r.cnt }));

        // tasks per day last 30 days by due_date
        const today = new Date();
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const start = new Date(end.getTime() - (29 * 24 * 60 * 60 * 1000));
        const startStr = start.toISOString().slice(0,10);
        const endStr = end.toISOString().slice(0,10);
        const perDayRows = await AppDataSource.manager.query(`
            SELECT CONVERT(varchar(10), due_date, 23) as day, COUNT(*) as cnt
            FROM todos
            WHERE user_id = @0 AND due_date BETWEEN @1 AND @2 AND ISNULL(archived,0) = 0
            GROUP BY CONVERT(varchar(10), due_date, 23)
            ORDER BY day ASC
        `, [userId, startStr, endStr]);
        const map = {};
        (perDayRows || []).forEach(r => { if (r.day) map[r.day] = r.cnt; });
        const tasksPerDay = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
            const key = d.toISOString().slice(0,10);
            tasksPerDay.push({ day: key, count: map[key] || 0 });
        }

        return { totalTodos: total, completedCount, completionRate: total>0?Math.round((completedCount/total)*100):0, avgDuration, topTags, tasksPerDay };
    }

    _mapRowToDomain(row) {
        const tags = (row.tags || []).map(t => new Tag(t.id, t.name, t.color));
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
            row.user_id || null
        );
    }
}

module.exports = TypeORMTodoRepository;
