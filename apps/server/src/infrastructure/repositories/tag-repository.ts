import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import type { Tag } from '@lifeline/shared';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import type { TagRepository } from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { tags } from '../db/schema.js';
import { isUniqueViolation } from './pg-errors.js';

type TagRow = typeof tags.$inferSelect;

const DUPLICATE_TAG_MESSAGE = 'A tag with this name already exists.';

function toTagDto(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    userId: row.userId,
    isDefault: row.isDefault,
  };
}

/**
 * Drizzle TagRepository. Default tags are global rows (user_id NULL) seeded
 * by the baseline migration; writes are row-scoped to the owner's custom tags
 * (the 403 default/not-owner guards fire in the use-cases).
 */
export class DrizzleTagRepository implements TagRepository {
  constructor(private readonly db: Db) {}

  async listVisible(userId: string): Promise<Tag[]> {
    const rows = await this.db
      .select()
      .from(tags)
      .where(or(eq(tags.isDefault, true), eq(tags.userId, userId)))
      .orderBy(desc(tags.isDefault), sql`lower(${tags.name}) ASC`);
    return rows.map(toTagDto);
  }

  async findById(id: string): Promise<Tag | null> {
    const rows = await this.db.select().from(tags).where(eq(tags.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toTagDto(row);
  }

  async countCustomByUser(userId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.isDefault, false)));
    return rows[0]?.value ?? 0;
  }

  async create(userId: string, data: { id: string; name: string; color: string }): Promise<Tag> {
    try {
      const rows = await this.db
        .insert(tags)
        .values({
          id: data.id,
          name: data.name,
          color: data.color,
          userId,
          isDefault: false, // never creatable via the API
        })
        .returning();
      const row = rows[0];
      if (row === undefined) throw new Error('Tag insert returned no row');
      return toTagDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(DUPLICATE_TAG_MESSAGE);
      throw error;
    }
  }

  async update(
    userId: string,
    tagId: string,
    changes: { name?: string | undefined; color?: string | undefined },
  ): Promise<Tag> {
    const set: Partial<typeof tags.$inferInsert> = { updatedAt: new Date() };
    if (changes.name !== undefined) set.name = changes.name;
    if (changes.color !== undefined) set.color = changes.color;
    try {
      const rows = await this.db
        .update(tags)
        .set(set)
        .where(and(eq(tags.id, tagId), eq(tags.userId, userId), eq(tags.isDefault, false)))
        .returning();
      const row = rows[0];
      if (row === undefined) throw new NotFoundError('Tag not found.');
      return toTagDto(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(DUPLICATE_TAG_MESSAGE);
      throw error;
    }
  }

  async delete(userId: string, tagId: string): Promise<void> {
    await this.db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId), eq(tags.isDefault, false)));
  }

  async deleteCustomByUser(userId: string): Promise<void> {
    await this.db.delete(tags).where(and(eq(tags.userId, userId), eq(tags.isDefault, false)));
  }
}
