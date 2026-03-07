const { In } = require('typeorm');
const ITodoRepository = require('../domain/ITodoRepository');
const Todo = require('../domain/Todo');
const Tag = require('../domain/Tag');
const { AppDataSource } = require('../infra/db/data-source');

class TypeORMTodoRepository extends ITodoRepository {
    constructor() {
        super();
    }

    repo() {
        return AppDataSource.getRepository('Todo');
    }

    tagRepo() {
        return AppDataSource.getRepository('Tag');
    }

    async save(todo) {
        const repo = this.repo();
        const tagIds = (todo.tags || []).map(tag => tag.id);
        const tags = tagIds.length ? await this.tagRepo().findBy({ id: In(tagIds) }) : [];

        let entity = await repo.findOne({ where: { id: todo.id }, relations: ['tags'] });
        if (!entity) {
            entity = repo.create({ id: todo.id });
        }

        let taskNumber = Number.isInteger(todo.taskNumber) ? todo.taskNumber : null;
        if (!taskNumber && todo.userId) {
            taskNumber = (await this.getMaxTaskNumber(todo.userId)) + 1;
        }

        Object.assign(entity, {
            id: todo.id,
            user_id: todo.userId,
            task_number: taskNumber,
            title: todo.title,
            description: todo.description || null,
            due_date: todo.dueDate || null,
            due_time: todo.dueTime || null,
            is_completed: !!todo.isCompleted,
            is_flagged: !!todo.isFlagged,
            duration: Number(todo.duration || 0),
            priority: ['low', 'medium', 'high'].includes(String(todo.priority || '').toLowerCase()) ? String(todo.priority).toLowerCase() : 'medium',
            subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
            order: Number(todo.order || 0),
            recurrence: todo.recurrence || null,
            next_recurrence_due: todo.nextRecurrenceDue || null,
            original_id: todo.originalId || null,
            archived: !!todo.archived,
            tags,
        });

        await repo.save(entity);
    }

    async findById(id, userId) {
        const where = userId ? { id, user_id: userId } : { id };
        const row = await this.repo().findOne({ where, relations: ['tags'] });
        return row ? this._mapRowToDomain(row) : null;
    }

    async getMaxTaskNumber(userId) {
        const row = await this.repo()
            .createQueryBuilder('todo')
            .select('MAX(todo.task_number)', 'max')
            .where('todo.user_id = :userId', { userId })
            .getRawOne();
        return parseInt(row?.max || 0, 10) || 0;
    }

    async findByTaskNumber(userId, taskNumber) {
        const row = await this.repo().findOne({ where: { user_id: userId, task_number: taskNumber }, relations: ['tags'] });
        return row ? this._mapRowToDomain(row) : null;
    }

    async findAll(userId) {
        const rows = await this.repo().find({
            where: { archived: false, user_id: userId },
            relations: ['tags'],
            order: { due_date: 'ASC', order: 'ASC', task_number: 'ASC' },
        });
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
            userId,
            taskNumber,
        } = filters;

        const qb = this.repo()
            .createQueryBuilder('todo')
            .leftJoinAndSelect('todo.tags', 'tag')
            .where('todo.user_id = :userId', { userId })
            .distinct(true);

        if (!q && !taskNumber) {
            qb.andWhere('todo.archived = false');
        }

        if (q) {
            const cleanQ = q.trim().replace(/^#/, '').trim();
            const asNum = parseInt(cleanQ, 10);
            const isSpecificTask = !Number.isNaN(asNum) && String(asNum) === cleanQ;

            if (isSpecificTask) {
                qb.andWhere('(todo.title ILIKE :query OR COALESCE(todo.description, \'\') ILIKE :query OR CAST(todo.subtasks AS text) ILIKE :query OR todo.task_number = :taskNumber)', {
                    query: `%${q}%`,
                    taskNumber: asNum,
                });
            } else {
                qb.andWhere('(todo.title ILIKE :query OR COALESCE(todo.description, \'\') ILIKE :query OR CAST(todo.subtasks AS text) ILIKE :query)', {
                    query: `%${q}%`,
                });
            }
        }

        if (taskNumber) {
            qb.andWhere('todo.task_number = :taskNumberFilter', { taskNumberFilter: Number(taskNumber) });
        }

        if (priority) qb.andWhere('todo.priority = :priority', { priority });
        if (typeof flagged !== 'undefined') qb.andWhere('todo.is_flagged = :flagged', { flagged: !!flagged });
        if (status === 'completed') qb.andWhere('todo.is_completed = true');
        if (status === 'active') qb.andWhere('todo.is_completed = false');
        if (startDate) qb.andWhere('todo.due_date >= :startDate', { startDate });
        if (endDate) {
            const end = new Date(`${endDate}T00:00:00.000Z`);
            end.setUTCDate(end.getUTCDate() + 1);
            qb.andWhere('todo.due_date < :endDateExclusive', { endDateExclusive: end.toISOString() });
        }
        if (minDuration !== undefined && minDuration !== null && minDuration !== '') qb.andWhere('todo.duration >= :minDuration', { minDuration: Number(minDuration) });
        if (maxDuration !== undefined && maxDuration !== null && maxDuration !== '') qb.andWhere('todo.duration <= :maxDuration', { maxDuration: Number(maxDuration) });
        if (Array.isArray(tags) && tags.length) qb.andWhere('tag.id IN (:...tagIds)', { tagIds: tags.map(String) });

        if (sortBy === 'priority') {
            qb.orderBy(`CASE todo.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 2 END`, 'DESC');
        } else if (sortBy === 'duration') {
            qb.orderBy('todo.duration', 'DESC');
        } else if (sortBy === 'name') {
            qb.orderBy('todo.title', 'ASC');
        } else if (sortBy === 'date_desc') {
            qb.orderBy('todo.due_date', 'DESC', 'NULLS LAST');
        } else {
            qb.orderBy('todo.due_date', 'ASC', 'NULLS LAST').addOrderBy('todo.order', 'ASC').addOrderBy('todo.task_number', 'ASC');
        }

        const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();
        return { todos: rows.map(row => this._mapRowToDomain(row)), total };
    }

    async delete(id, userId) {
        const todo = await this.repo().findOne({ where: { id, user_id: userId }, relations: ['tags'] });
        if (!todo) return;
        todo.tags = [];
        todo.archived = true;
        await this.repo().save(todo);
    }

    async archive(id, userId) {
        await this.repo().update({ id, ...(userId ? { user_id: userId } : {}) }, { archived: true });
    }

    async unarchive(id, userId) {
        await this.repo().update({ id, ...(userId ? { user_id: userId } : {}) }, { archived: false });
    }

    async countByUser(userId) {
        return this.repo().count({ where: { user_id: userId, archived: false } });
    }

    async getExportStatsForUser(userId) {
        const todos = await this.findAllIncludingArchived(userId);
        return this._buildStatsFromTodos(todos);
    }

    async getStatisticsForUserInRange(userId, startDate, endDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        const todos = (await this.findAllIncludingArchived(userId)).filter(todo => {
            if (todo.archived) return false;
            if (!todo.dueDate) return false;
            const due = new Date(todo.dueDate);
            return due >= start && due < end;
        });

        const base = this._buildStatsFromTodos(todos);
        return {
            periodTotals: {
                totalTodos: base.totalTodos,
                completedCount: base.completedCount,
                completionRate: base.completionRate,
                avgDuration: base.avgDuration,
                timeSpentTotal: base.timeSpentTotal,
            },
            topTagsInPeriod: base.topTags,
            groups: this._groupTodosByDate(todos, startDate, endDate),
        };
    }

    async getStatisticsAggregated(userId, period) {
        const todos = (await this.findAllIncludingArchived(userId)).filter(todo => !todo.archived);
        const base = this._buildStatsFromTodos(todos);
        return {
            periodTotals: {
                totalTodos: base.totalTodos,
                completedCount: base.completedCount,
                completionRate: base.completionRate,
                avgDuration: base.avgDuration,
                timeSpentTotal: base.timeSpentTotal,
            },
            topTagsInPeriod: base.topTags,
            groups: this._groupTodosForPeriod(todos, period),
        };
    }

    async findAllIncludingArchived(userId) {
        const rows = await this.repo().find({
            where: { user_id: userId },
            relations: ['tags'],
            order: { due_date: 'ASC', order: 'ASC', task_number: 'ASC' },
        });
        return rows.map(row => ({ ...this._mapRowToDomain(row), archived: !!row.archived }));
    }

    _buildStatsFromTodos(todos) {
        const active = todos.filter(todo => !todo.archived);
        const totalTodos = active.length;
        const completedCount = active.filter(todo => todo.isCompleted).length;
        const completionRate = totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0;
        const durations = active.map(todo => Number(todo.duration || 0)).filter(value => value > 0);
        const timeSpentTotal = active.reduce((sum, todo) => sum + Number(todo.duration || 0), 0);
        const avgDuration = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
        const tagCounts = new Map();
        for (const todo of active) {
            for (const tag of todo.tags || []) {
                const existing = tagCounts.get(tag.id) || { id: tag.id, name: tag.name, color: tag.color, count: 0 };
                existing.count += 1;
                tagCounts.set(tag.id, existing);
            }
        }
        const topTags = Array.from(tagCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
        return {
            totalTodos,
            completedCount,
            completionRate,
            avgDuration,
            timeSpentTotal,
            topTags,
            tasksPerDay: this._groupLastThirtyDays(active),
        };
    }

    _groupLastThirtyDays(todos) {
        const end = new Date();
        end.setUTCHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 29);
        const map = new Map();
        for (const todo of todos) {
            if (!todo.dueDate) continue;
            const key = new Date(todo.dueDate).toISOString().slice(0, 10);
            map.set(key, (map.get(key) || 0) + 1);
        }
        const results = [];
        for (let i = 0; i < 30; i += 1) {
            const current = new Date(start);
            current.setUTCDate(start.getUTCDate() + i);
            const key = current.toISOString().slice(0, 10);
            results.push({ day: key, count: map.get(key) || 0 });
        }
        return results;
    }

    _groupTodosByDate(todos, startDate, endDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T00:00:00.000Z`);
        const map = new Map();
        for (const todo of todos) {
            if (!todo.dueDate) continue;
            const key = new Date(todo.dueDate).toISOString().slice(0, 10);
            map.set(key, (map.get(key) || 0) + 1);
        }
        const groups = [];
        for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
            const key = date.toISOString().slice(0, 10);
            groups.push({ period: key, date: key, count: map.get(key) || 0 });
        }
        return groups;
    }

    _groupTodosForPeriod(todos, period) {
        const formatter = (dateValue) => {
            const date = new Date(dateValue);
            if (period === 'year') return `${date.getUTCFullYear()}`;
            if (period === 'month') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            if (period === 'week') {
                const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
                const days = Math.floor((date - firstDay) / 86400000);
                const week = Math.ceil((days + firstDay.getUTCDay() + 1) / 7);
                return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
            }
            return date.toISOString().slice(0, 10);
        };

        const map = new Map();
        for (const todo of todos) {
            if (!todo.dueDate) continue;
            const key = formatter(todo.dueDate);
            map.set(key, (map.get(key) || 0) + 1);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([periodKey, count]) => ({ period: periodKey, count, date: periodKey }));
    }

    _mapRowToDomain(row) {
        const tags = (row.tags || []).map(tag => new Tag(tag.id, tag.name, tag.color, tag.user_id || null, !!tag.is_default));
        return new Todo(
            row.id,
            row.title,
            !!row.is_completed,
            row.due_date,
            tags,
            !!row.is_flagged,
            Number(row.duration || 0),
            row.priority || 'medium',
            row.due_time || null,
            Array.isArray(row.subtasks) ? row.subtasks : [],
            Number(row.order || 0),
            row.description || '',
            row.recurrence || null,
            row.next_recurrence_due || null,
            row.original_id || null,
            row.task_number || null,
            row.user_id,
        );
    }
}

module.exports = TypeORMTodoRepository;
