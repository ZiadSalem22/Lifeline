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
            original_id: todo.originalId || null
        };

        const tagIds = (todo.tags || []).map(t => t.id);
        const tags = tagIds.length > 0
            ? await this.tagRepo.findByIds(tagIds)
            : [];

        await this.repo.save({ ...entity, tags });
    }

    async findById(id) {
        const row = await this.repo.findOne({ where: { id }, relations: ['tags'] });
        if (!row) return null;
        return this._mapRowToDomain(row);
    }

    async findAll() {
        const rows = await this.repo.find({ relations: ['tags'] });
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
            offset = 0
        } = filters;

        const qb = this.repo.createQueryBuilder('todo')
            .leftJoinAndSelect('todo.tags', 'tag');

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

        if (startDate) {
            qb.andWhere('todo.due_date >= :startDate', { startDate });
        }

        if (endDate) {
            qb.andWhere('todo.due_date <= :endDate', { endDate });
        }

        if (minDuration) {
            qb.andWhere('todo.duration >= :minDuration', { minDuration: parseInt(minDuration) });
        }

        if (maxDuration) {
            qb.andWhere('todo.duration <= :maxDuration', { maxDuration: parseInt(maxDuration) });
        }

        if (tags && Array.isArray(tags) && tags.length > 0) {
            qb.andWhere('tag.id IN (:...tagIds)', { tagIds: tags });
        }

        if (sortBy === 'priority') {
            qb.orderBy(`CASE todo.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 2 END`, 'DESC');
        } else if (sortBy === 'duration') {
            qb.orderBy('todo.duration', 'DESC');
        } else if (sortBy === 'name') {
            qb.orderBy('todo.title', 'ASC');
        } else {
            qb.orderBy('todo.due_date IS NULL', 'ASC')
              .addOrderBy('todo.due_date', 'ASC');
        }

        const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();
        const todos = rows.map(row => this._mapRowToDomain(row));
        return { todos, total };
    }

    async delete(id) {
        const todo = await this.repo.findOne({ where: { id }, relations: ['tags'] });
        if (!todo) {
            return;
        }
        todo.tags = [];
        await this.repo.save(todo);
        await this.repo.delete({ id });
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
            row.original_id || null
        );
    }
}

module.exports = TypeORMTodoRepository;
