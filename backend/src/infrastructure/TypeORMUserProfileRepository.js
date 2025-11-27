const { AppDataSource } = require('../infra/db/data-source');

class TypeORMUserProfileRepository {
  constructor() {
    this.repo = () => AppDataSource.getRepository('UserProfile');
  }

  async findByUserId(userId) {
    return this.repo().findOne({ where: { user_id: userId } });
  }

  async saveOrUpdate(userId, profileData) {
    let profile = await this.findByUserId(userId);
    if (!profile) {
      profile = this.repo().create({ user_id: userId, ...profileData });
    } else {
      Object.assign(profile, profileData);
    }
    return this.repo().save(profile);
  }
}

module.exports = new TypeORMUserProfileRepository();
