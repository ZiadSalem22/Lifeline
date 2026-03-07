const Tag = require('../domain/Tag');
const { AppDataSource } = require('../infra/db/data-source');
const { AppError } = require('../utils/errors');

class TypeORMTagRepository {
    constructor() {
        this.repo = () => AppDataSource.getRepository('Tag');
    }

    async findAll() {
        const rows = await this.repo().find();
        return rows.map(r => new Tag(r.id, r.name, r.color, r.user_id || null, !!r.is_default));
    }

    async findById(id) {
        const row = await this.repo().findOne({ where: { id } });
        if (!row) return null;
        return new Tag(row.id, row.name, row.color, row.user_id || null, !!row.is_default);
    }

    async findByName(name) {
        const qb = this.repo().createQueryBuilder('tag');
        const row = await qb.where('LOWER(tag.name) = LOWER(:name)', { name }).getOne();
        if (!row) return null;
        return new Tag(row.id, row.name, row.color, row.user_id || null, !!row.is_default);
    }

    async save(tag) {
        // Prevent modification of default tags via API layer
        if (tag.isDefault) {
            throw new AppError('Default tags cannot be modified', 403);
        }
        await this.repo().save({ id: tag.id, name: tag.name, color: tag.color, user_id: tag.userId || null, is_default: false });
    }

    async delete(id, userId) {
        const existing = await this.repo().findOne({ where: { id } });
        if (!existing) return; // silence if already gone
        if (existing.is_default) {
            throw new AppError('Default tags cannot be deleted', 403);
        }
        if (existing.user_id !== userId) {
            throw new AppError('Forbidden', 403);
        }
        await this.repo().delete({ id });
    }
    async countAll() {
        return await this.repo().count();
    }

    async countByUser(userId) {
        return await this.repo().count({ where: { user_id: userId } });
    }

    async countCustomByUser(userId) {
        return await this.repo().count({ where: { user_id: userId, is_default: false } });
    }

    async findAllForUser(userId) {
        const rows = await this.repo().createQueryBuilder('tag')
            .where('tag.is_default = true OR tag.user_id = :userId', { userId })
            .orderBy('tag.is_default', 'DESC')
            .addOrderBy('LOWER(tag.name)', 'ASC')
            .getMany();
        return rows.map(r => new Tag(r.id, r.name, r.color, r.user_id || null, !!r.is_default));
    }
}

module.exports = TypeORMTagRepository;
