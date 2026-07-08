import { eq } from 'drizzle-orm';
import { DAY_NAMES, type DayName } from '@lifeline/shared';
import type { ProfileRecord, ProfileRepository, ProfileUpsert } from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { userProfiles } from '../db/schema.js';

type ProfileRow = typeof userProfiles.$inferSelect;

function toDayName(value: string): DayName {
  return (DAY_NAMES as readonly string[]).includes(value) ? (value as DayName) : 'Monday';
}

function toRecord(row: ProfileRow): ProfileRecord {
  return {
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    country: row.country,
    city: row.city,
    timezone: row.timezone,
    avatarUrl: row.avatarUrl,
    onboardingCompleted: row.onboardingCompleted,
    startDayOfWeek: toDayName(row.startDayOfWeek),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Drop undefined entries so partial upserts never write explicit NULLs. */
function definedFields(data: ProfileUpsert): Partial<typeof userProfiles.$inferInsert> {
  const out: Partial<typeof userProfiles.$inferInsert> = {};
  if (data.firstName !== undefined) out.firstName = data.firstName;
  if (data.lastName !== undefined) out.lastName = data.lastName;
  if (data.phone !== undefined) out.phone = data.phone;
  if (data.country !== undefined) out.country = data.country;
  if (data.city !== undefined) out.city = data.city;
  if (data.timezone !== undefined) out.timezone = data.timezone;
  if (data.avatarUrl !== undefined) out.avatarUrl = data.avatarUrl;
  if (data.startDayOfWeek !== undefined) out.startDayOfWeek = data.startDayOfWeek;
  if (data.onboardingCompleted !== undefined) out.onboardingCompleted = data.onboardingCompleted;
  return out;
}

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<ProfileRecord | null> {
    const rows = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async upsert(userId: string, data: ProfileUpsert): Promise<ProfileRecord> {
    const fields = definedFields(data);
    const rows = await this.db
      .insert(userProfiles)
      .values({ userId, ...fields })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { ...fields, updatedAt: new Date() },
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('Profile upsert returned no row');
    return toRecord(row);
  }
}
