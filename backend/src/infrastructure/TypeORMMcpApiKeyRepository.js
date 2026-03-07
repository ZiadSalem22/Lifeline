const { AppDataSource } = require('../infra/db/data-source');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: row.status,
    expiresAt: row.expires_at || null,
    lastUsedAt: row.last_used_at || null,
    lastUsedIp: row.last_used_ip || null,
    lastUsedUserAgent: row.last_used_user_agent || null,
    revokedAt: row.revoked_at || null,
    revocationReason: row.revocation_reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class TypeORMMcpApiKeyRepository {
  repo() {
    return AppDataSource.getRepository('McpApiKey');
  }

  async listByUserId(userId, { limit = 25 } = {}) {
    if (!userId) return [];
    const rows = await this.repo().find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
    return rows.map(mapRow);
  }

  async findById(id) {
    if (!id) return null;
    const row = await this.repo().findOne({ where: { id } });
    return mapRow(row);
  }

  async findByIdForUser(id, userId) {
    if (!id || !userId) return null;
    const row = await this.repo().findOne({ where: { id, user_id: userId } });
    return mapRow(row);
  }

  async findByKeyPrefix(keyPrefix) {
    if (!keyPrefix) return null;
    const row = await this.repo().findOne({ where: { key_prefix: keyPrefix } });
    return mapRow(row);
  }

  async findActiveByKeyPrefix(keyPrefix) {
    if (!keyPrefix) return null;
    const row = await this.repo().findOne({ where: { key_prefix: keyPrefix, status: 'active' } });
    return mapRow(row);
  }

  async save(apiKeyRecord) {
    const row = this.repo().create({
      id: apiKeyRecord.id,
      user_id: apiKeyRecord.userId,
      name: apiKeyRecord.name,
      key_prefix: apiKeyRecord.keyPrefix,
      key_hash: apiKeyRecord.keyHash,
      scopes: Array.isArray(apiKeyRecord.scopes) ? apiKeyRecord.scopes : [],
      status: apiKeyRecord.status || 'active',
      expires_at: apiKeyRecord.expiresAt || null,
      last_used_at: apiKeyRecord.lastUsedAt || null,
      last_used_ip: apiKeyRecord.lastUsedIp || null,
      last_used_user_agent: apiKeyRecord.lastUsedUserAgent || null,
      revoked_at: apiKeyRecord.revokedAt || null,
      revocation_reason: apiKeyRecord.revocationReason || null,
    });

    const saved = await this.repo().save(row);
    return mapRow(saved);
  }

  async recordUsage(id, usage = {}) {
    if (!id) return null;
    const now = usage.lastUsedAt || new Date().toISOString();
    await this.repo().update({ id }, {
      last_used_at: now,
      last_used_ip: usage.lastUsedIp || null,
      last_used_user_agent: usage.lastUsedUserAgent || null,
    });
    return this.findById(id);
  }

  async revokeByIdForUser(id, userId, details = {}) {
    if (!id || !userId) return null;

    const row = await this.repo().findOne({ where: { id, user_id: userId } });
    if (!row) return null;

    if (!row.revoked_at) {
      row.status = 'revoked';
      row.revoked_at = details.revokedAt || new Date().toISOString();
      row.revocation_reason = details.revocationReason || row.revocation_reason || null;
      await this.repo().save(row);
    }

    return mapRow(row);
  }
}

module.exports = new TypeORMMcpApiKeyRepository();
