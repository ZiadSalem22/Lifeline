const Tag = require('../domain/Tag');
const { AppDataSource } = require('../infra/db/data-source');

class TypeORMTagRepository {
    constructor() {
        this.repo = AppDataSource.getRepository('Tag');
    }

    async findAll() {
        const rows = await this.repo.find();
        return rows.map(r => new Tag(r.id, r.name, r.color));
    }

    async findById(id) {
        const row = await this.repo.findOne({ where: { id } });
        if (!row) return null;
        return new Tag(row.id, row.name, row.color);
    }

    async findByName(name) {
        const row = await this.repo.findOne({ where: { name } });
        if (!row) return null;
        return new Tag(row.id, row.name, row.color);
    }

    async save(tag) {
        await this.repo.save({ id: tag.id, name: tag.name, color: tag.color });
    }

    async delete(id) {
        await this.repo.delete({ id });
    }
}

module.exports = TypeORMTagRepository;
