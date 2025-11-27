const Tag = require('../domain/Tag');
const { AppDataSource } = require('../infra/db/data-source');

class TypeORMTagRepository {
    constructor() {
        this.repo = AppDataSource.getRepository('Tag');
    }

    async findAll() {
        // For findAll without user scoping explicitly, return all (legacy)
        const rows = await this.repo.find();
        return rows.map(r => new Tag(r.id, r.name, r.color, r.user_id || null, (r.is_default === 1)));
    }

    async findById(id) {
        const row = await this.repo.findOne({ where: { id } });
        if (!row) return null;
        return new Tag(row.id, row.name, row.color, row.user_id || null, (row.is_default === 1));
    }

    async findByName(name) {
        const row = await this.repo.findOne({ where: { name } });
        if (!row) return null;
        return new Tag(row.id, row.name, row.color, row.user_id || null, (row.is_default === 1));
    }

    async save(tag) {
        await this.repo.save({ id: tag.id, name: tag.name, color: tag.color, user_id: tag.userId || null, is_default: tag.isDefault ? 1 : 0 });
    }

    async delete(id) {
        await this.repo.delete({ id });
    }
    async countAll() {
        return await this.repo.count();
    }

    async countByUser(userId) {
        return await this.repo.count({ where: { user_id: userId } });
    }

    async findAllForUser(userId) {
        const rows = await this.repo.createQueryBuilder('tag')
            .where('(tag.user_id = :userId OR tag.is_default = 1)', { userId })
            .getMany();
        return rows.map(r => new Tag(r.id, r.name, r.color, r.user_id || null, (r.is_default === 1)));
    }
}

module.exports = TypeORMTagRepository;
