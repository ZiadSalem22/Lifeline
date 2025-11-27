const { AppDataSource } = require('../infra/db/data-source');
const logger = require('../config/logger');

class TypeORMUserRepository {
  _repo() {
    try {
      return AppDataSource.getRepository('User');
    } catch (e) {
      logger.error('[UserRepo] getRepository failed', { error: e.message });
      throw e;
    }
  }

  async saveOrUpdateFromAuth0(auth0User) {
    const { sub, email, name, picture } = auth0User || {};
    if (!sub) {
      return null;
    }

    if (!AppDataSource.isInitialized) {
      logger.warn('[UserRepo] AppDataSource not initialized at upsert time');
    }
    return await AppDataSource.manager.transaction(async (manager) => {
      const repo = manager.getRepository('User');
      const existing = await repo.findOne({ where: { id: sub } });
      if (existing) {
        existing.email = email || existing.email || null;
        existing.name = name || existing.name || null;
        existing.picture = picture || existing.picture || null;
        return await repo.save(existing);
      }
      const user = repo.create({ id: sub, email: email || null, name: name || null, picture: picture || null });
      return await repo.save(user);
    });
  }

  async findById(id) {
    if (!id) return null;
    return await this._repo().findOne({ where: { id } });
  }

  async findByEmail(email) {
    if (!email) return null;
    return await this._repo().findOne({ where: { email } });
  }

  async listAll() {
    return await this._repo().find();
  }
}

module.exports = TypeORMUserRepository;
