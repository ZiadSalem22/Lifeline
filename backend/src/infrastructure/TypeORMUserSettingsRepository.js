const { AppDataSource } = require('../infra/db/data-source');

class TypeORMUserSettingsRepository {
  constructor() {}

  async findByUserId(userId) {
    try {
      if (!AppDataSource || typeof AppDataSource.getRepository !== 'function') return null;
      const repo = AppDataSource.getRepository('UserSettings');
      const row = await repo.findOne({ where: { user_id: userId } });
      if (!row) return null;
      // Return a plain object with settings fields (assumes columns stored as JSON columns or individual columns)
      let layout = row.layout || null;
      if (layout && typeof layout === 'string') {
        try { layout = JSON.parse(layout); } catch (_) {}
      }
      return {
        theme: row.theme || null,
        locale: row.locale || null,
        layout
      };
    } catch (e) {
      return null;
    }
  }

  async saveOrUpdate(userId, settings) {
    try {
      if (!AppDataSource || typeof AppDataSource.getRepository !== 'function') return null;
      const repo = AppDataSource.getRepository('UserSettings');
      const theme = typeof settings.theme === 'string' ? settings.theme : (settings.theme ?? null);
      const locale = typeof settings.locale === 'string' ? settings.locale : (settings.locale ?? null);
      let layout = settings.layout;
      if (layout && typeof layout !== 'string') {
        try { layout = JSON.stringify(layout); } catch (_) { layout = null; }
      }
      let row = await repo.findOne({ where: { user_id: userId } });
      if (!row) {
        const uuid = require('uuid').v4();
        const toSave = repo.create({ id: uuid, user_id: userId, theme: theme || null, locale: locale || null, layout: layout || null });
        row = await repo.save(toSave);
      } else {
        row.theme = typeof theme !== 'undefined' ? theme : row.theme;
        row.locale = typeof locale !== 'undefined' ? locale : row.locale;
        row.layout = typeof layout !== 'undefined' ? layout : row.layout;
        row = await repo.save(row);
      }
      let outLayout = row.layout || null;
      if (outLayout && typeof outLayout === 'string') {
        try { outLayout = JSON.parse(outLayout); } catch (_) {}
      }
      return { theme: row.theme || null, locale: row.locale || null, layout: outLayout };
    } catch (e) {
      return null;
    }
  }
}

module.exports = new TypeORMUserSettingsRepository();
