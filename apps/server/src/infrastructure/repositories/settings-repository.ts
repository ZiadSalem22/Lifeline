import { eq } from 'drizzle-orm';
import type {
  SettingsRecord,
  SettingsRepository,
  SettingsUpsert,
} from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { userSettings } from '../db/schema.js';

type SettingsRow = typeof userSettings.$inferSelect;

function toRecord(row: SettingsRow): SettingsRecord {
  return {
    userId: row.userId,
    theme: row.theme,
    locale: row.locale,
    layout: row.layout,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function definedFields(data: SettingsUpsert): Partial<typeof userSettings.$inferInsert> {
  const out: Partial<typeof userSettings.$inferInsert> = {};
  if (data.theme !== undefined) out.theme = data.theme;
  if (data.locale !== undefined) out.locale = data.locale;
  if (data.layout !== undefined) out.layout = data.layout;
  return out;
}

export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<SettingsRecord | null> {
    const rows = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async upsert(userId: string, data: SettingsUpsert): Promise<SettingsRecord> {
    const fields = definedFields(data);
    const rows = await this.db
      .insert(userSettings)
      .values({ userId, ...fields })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { ...fields, updatedAt: new Date() },
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('Settings upsert returned no row');
    return toRecord(row);
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.db.delete(userSettings).where(eq(userSettings.userId, userId));
  }
}
