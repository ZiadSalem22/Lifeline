import type { McpKey } from '@lifeline/shared';
import type { McpKeyRecord } from '../ports.js';

/**
 * Public metadata mapping, ported from the old `mcpApiKeys/metadata.js`:
 * status is DERIVED (never trusted from the row alone) with precedence
 * revoked > expired (by status or `expires_at <= now`) > active. The key hash
 * and usage IP/user-agent never leave the server.
 */

export function deriveMcpKeyStatus(
  record: Pick<McpKeyRecord, 'status' | 'revokedAt' | 'expiresAt'>,
  now: Date,
): McpKey['status'] {
  if (record.status === 'revoked' || record.revokedAt !== null) return 'revoked';
  if (
    record.status === 'expired' ||
    (record.expiresAt !== null && record.expiresAt.getTime() <= now.getTime())
  ) {
    return 'expired';
  }
  return 'active';
}

export function toMcpKeyDto(record: McpKeyRecord, now: Date): McpKey {
  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    scopes: [...record.scopes],
    status: deriveMcpKeyStatus(record, now),
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
  };
}
