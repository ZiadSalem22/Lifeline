import { and, desc, eq } from 'drizzle-orm';
import { ConflictError, NotFoundError } from '../../domain/errors.js';
import type { McpKeyRecord, McpKeyRepository } from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { mcpApiKeys } from '../db/schema.js';
import { isUniqueViolation } from './pg-errors.js';

type McpKeyRow = typeof mcpApiKeys.$inferSelect;

function toStatus(value: string): McpKeyRecord['status'] {
  return value === 'revoked' || value === 'expired' ? value : 'active';
}

function toRecord(row: McpKeyRow): McpKeyRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    keyHash: row.keyHash,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: toStatus(row.status),
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    lastUsedIp: row.lastUsedIp,
    lastUsedUserAgent: row.lastUsedUserAgent,
    revokedAt: row.revokedAt,
    revocationReason: row.revocationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleMcpKeyRepository implements McpKeyRepository {
  constructor(private readonly db: Db) {}

  async create(
    data: Pick<McpKeyRecord, 'id' | 'userId' | 'name' | 'keyPrefix' | 'keyHash' | 'scopes'> & {
      expiresAt: Date | null;
    },
  ): Promise<McpKeyRecord> {
    try {
      const rows = await this.db
        .insert(mcpApiKeys)
        .values({
          id: data.id,
          userId: data.userId,
          name: data.name,
          keyPrefix: data.keyPrefix,
          keyHash: data.keyHash,
          scopes: data.scopes,
          status: 'active',
          expiresAt: data.expiresAt,
        })
        .returning();
      const row = rows[0];
      if (!row) throw new Error('MCP API key insert returned no row');
      return toRecord(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('MCP API key prefix already exists');
      }
      throw error;
    }
  }

  async list(userId: string, limit: number): Promise<McpKeyRecord[]> {
    const rows = await this.db
      .select()
      .from(mcpApiKeys)
      .where(eq(mcpApiKeys.userId, userId))
      .orderBy(desc(mcpApiKeys.createdAt))
      .limit(limit);
    return rows.map(toRecord);
  }

  async findById(userId: string, keyId: string): Promise<McpKeyRecord | null> {
    const rows = await this.db
      .select()
      .from(mcpApiKeys)
      .where(and(eq(mcpApiKeys.id, keyId), eq(mcpApiKeys.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async findByPrefix(keyPrefix: string): Promise<McpKeyRecord | null> {
    // No user filter by design — this is the API-key resolution path.
    const rows = await this.db
      .select()
      .from(mcpApiKeys)
      .where(eq(mcpApiKeys.keyPrefix, keyPrefix))
      .limit(1);
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async revoke(userId: string, keyId: string, reason: string): Promise<McpKeyRecord> {
    const existing = await this.findById(userId, keyId);
    if (!existing) throw new NotFoundError('API key not found.');
    if (existing.status === 'revoked' || existing.revokedAt !== null) return existing;

    const now = new Date();
    const rows = await this.db
      .update(mcpApiKeys)
      .set({ status: 'revoked', revokedAt: now, revocationReason: reason, updatedAt: now })
      .where(and(eq(mcpApiKeys.id, keyId), eq(mcpApiKeys.userId, userId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundError('API key not found.');
    return toRecord(row);
  }

  async recordUsage(
    keyId: string,
    usage: { at?: Date | undefined; ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<void> {
    await this.db
      .update(mcpApiKeys)
      .set({
        lastUsedAt: usage.at ?? new Date(),
        lastUsedIp: usage.ip ?? null,
        lastUsedUserAgent: usage.userAgent ?? null,
      })
      .where(eq(mcpApiKeys.id, keyId));
  }
}
