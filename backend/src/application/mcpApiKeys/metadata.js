function toIsoStringOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function isExpired(expiresAt, now = new Date()) {
  const expiresAtIso = toIsoStringOrNull(expiresAt);
  if (!expiresAtIso) return false;
  return new Date(expiresAtIso).getTime() <= now.getTime();
}

function deriveMcpApiKeyStatus(record, now = new Date()) {
  if (!record) return 'revoked';

  if (record.status === 'revoked' || record.revokedAt) {
    return 'revoked';
  }

  if (record.status === 'expired' || isExpired(record.expiresAt, now)) {
    return 'expired';
  }

  return 'active';
}

function toMcpApiKeyMetadata(record, now = new Date()) {
  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    scopes: Array.isArray(record.scopes) ? [...record.scopes] : [],
    status: deriveMcpApiKeyStatus(record, now),
    createdAt: toIsoStringOrNull(record.createdAt),
    expiresAt: toIsoStringOrNull(record.expiresAt),
    lastUsedAt: toIsoStringOrNull(record.lastUsedAt),
    revokedAt: toIsoStringOrNull(record.revokedAt),
  };
}

module.exports = {
  deriveMcpApiKeyStatus,
  isExpired,
  toIsoStringOrNull,
  toMcpApiKeyMetadata,
};
