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
      const user = repo.create({ id: sub, email: email || null, name: name || null, picture: picture || null, auth0_sub: sub });
      return await repo.save(user);
    });
  }

  async ensureUserFromAuth0Claims(claims) {
    const { sub, email, name, picture } = claims || {};
    if (!sub) return null;
    // Role mapping
    const roles = (claims['https://lifeline.app/roles'] || []);
    let role = 'free';
    if (Array.isArray(roles)) {
      if (roles.includes('admin')) role = 'admin';
      else if (roles.includes('paid')) role = 'paid';
    }
    // Always set subscription_status to 'none' for now
    const subscription_status = 'none';
    return await AppDataSource.manager.transaction(async (manager) => {
      const repo = manager.getRepository('User');
      let user = await repo.findOne({ where: { id: sub } });
      if (user) {
        user.email = email || user.email || null;
        user.name = name || user.name || null;
        user.picture = picture || user.picture || null;
        user.role = role;
        user.subscription_status = subscription_status;
        return await repo.save(user);
      }
      user = repo.create({ id: sub, email: email || null, name: name || null, picture: picture || null, role, subscription_status, auth0_sub: sub });
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

  async findWithProfileById(userId) {
    if (!userId) return null;
    return await this._repo().findOne({
      where: { id: userId },
      relations: ['profile'],
    });
  }

  async listAll() {
    return await this._repo().find();
  }
}

module.exports = new TypeORMUserRepository();
