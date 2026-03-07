const { AppError } = require('../../utils/errors');
const { toMcpApiKeyMetadata } = require('./metadata');

class RevokeCurrentUserMcpApiKey {
  constructor({ mcpApiKeyRepository, now = () => new Date() }) {
    this.mcpApiKeyRepository = mcpApiKeyRepository;
    this.now = now;
  }

  async execute({ userId, apiKeyId } = {}) {
    if (!this.mcpApiKeyRepository) {
      throw new Error('mcpApiKeyRepository is required');
    }

    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw new AppError('userId is required.', 400);
    }

    const normalizedApiKeyId = String(apiKeyId || '').trim();
    if (!normalizedApiKeyId) {
      throw new AppError('apiKeyId is required.', 400);
    }

    const existing = await this.mcpApiKeyRepository.findByIdForUser(normalizedApiKeyId, normalizedUserId);
    if (!existing) {
      throw new AppError('API key not found.', 404);
    }

    if (existing.status === 'revoked' || existing.revokedAt) {
      return toMcpApiKeyMetadata(existing, this.now());
    }

    const revokedAt = this.now().toISOString();
    const revoked = await this.mcpApiKeyRepository.revokeByIdForUser(normalizedApiKeyId, normalizedUserId, {
      revokedAt,
      revocationReason: 'user_self_service',
    });

    if (!revoked) {
      throw new AppError('API key not found.', 404);
    }

    return toMcpApiKeyMetadata(revoked, new Date(revokedAt));
  }
}

module.exports = {
  RevokeCurrentUserMcpApiKey,
};
