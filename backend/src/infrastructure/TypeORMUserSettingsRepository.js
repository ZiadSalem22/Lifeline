const { AppDataSource } = require('../infra/db/data-source');

class TypeORMUserSettingsRepository {
  constructor() {}

  async findByUserId(userId) {
    try {
      if (!AppDataSource || typeof AppDataSource.getRepository !== 'function') return null;
      const repo = AppDataSource.getRepository('UserSettings');
      const row = await repo.findOne({ where: { user_id: userId } });
      if (!row) return null;
      return {
        theme: row.theme || 'system',
        locale: row.locale || 'en',
        layout: row.layout || {}
      };
    } catch (e) {
      return null;
    }
  }

  async saveOrUpdate(userId, settings) {
    try {
      if (!AppDataSource || typeof AppDataSource.getRepository !== 'function') return null;
      const repo = AppDataSource.getRepository('UserSettings');
      const theme = typeof settings.theme === 'string' && settings.theme.trim() ? settings.theme.trim() : 'system';
      const locale = typeof settings.locale === 'string' && settings.locale.trim() ? settings.locale.trim() : 'en';
      const layout = settings.layout && typeof settings.layout === 'object' && !Array.isArray(settings.layout)
        ? settings.layout
        : {};
      let row = await repo.findOne({ where: { user_id: userId } });
      if (!row) {
        const toSave = repo.create({ user_id: userId, theme, locale, layout });
        row = await repo.save(toSave);
      } else {
        row.theme = theme;
        row.locale = locale;
        row.layout = layout;
        row = await repo.save(row);
      }
      return { theme: row.theme || 'system', locale: row.locale || 'en', layout: row.layout || {} };
    } catch (e) {
      return null;
    }
  }
}

module.exports = new TypeORMUserSettingsRepository();
