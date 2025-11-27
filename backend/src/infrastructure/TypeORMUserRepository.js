const { AppDataSource } = require('../infra/db/data-source');

class TypeORMUserRepository {
  constructor() {
    this.repo = AppDataSource.getRepository('User');
  }

  async saveOrUpdateFromAuth0(auth0User) {
    const { sub, email, name, picture } = auth0User || {};
    if (!sub) {
      return null;
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
    return await this.repo.findOne({ where: { id } });
  }

  async findByEmail(email) {
    if (!email) return null;
    return await this.repo.findOne({ where: { email } });
  }

  async listAll() {
    return await this.repo.find();
  }
}

module.exports = TypeORMUserRepository;
