const { AppError } = require('../../utils/errors');
const { toMcpApiKeyMetadata } = require('./metadata');
const { resolveSelfServeExpiresAt, resolveSelfServeScopes } = require('./selfServePresets');

class CreateSelfServeMcpApiKey {
  constructor({ issueMcpApiKey, now = () => new Date() }) {
    this.issueMcpApiKey = issueMcpApiKey;
    this.now = now;
  }

  async execute({ userId, name, scopePreset, expiryPreset } = {}) {
    if (!this.issueMcpApiKey) {
      throw new Error('issueMcpApiKey is required');
    }

    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw new AppError('userId is required.', 400);
    }

    const issuedAt = this.now();
    const issued = await this.issueMcpApiKey.execute({
      userId: normalizedUserId,
      name,
      scopes: resolveSelfServeScopes(scopePreset),
      expiresAt: resolveSelfServeExpiresAt(expiryPreset, issuedAt),
    });

    return {
      apiKey: toMcpApiKeyMetadata({
        id: issued.apiKeyId,
        name: issued.name,
        keyPrefix: issued.keyPrefix,
        scopes: issued.scopes,
        status: 'active',
        createdAt: issued.createdAt,
        expiresAt: issued.expiresAt,
        lastUsedAt: null,
        revokedAt: null,
      }, issuedAt),
      plaintextKey: issued.apiKey,
    };
  }
}

module.exports = {
  CreateSelfServeMcpApiKey,
};
