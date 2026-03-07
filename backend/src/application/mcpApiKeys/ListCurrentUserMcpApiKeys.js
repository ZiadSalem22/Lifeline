const { AppError } = require('../../utils/errors');
const { toMcpApiKeyMetadata } = require('./metadata');

class ListCurrentUserMcpApiKeys {
  constructor({ mcpApiKeyRepository, now = () => new Date() }) {
    this.mcpApiKeyRepository = mcpApiKeyRepository;
    this.now = now;
  }

  async execute({ userId, limit = 25 } = {}) {
    if (!this.mcpApiKeyRepository) {
      throw new Error('mcpApiKeyRepository is required');
    }

    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw new AppError('userId is required.', 400);
    }

    const now = this.now();
    const normalizedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 25;
    const records = await this.mcpApiKeyRepository.listByUserId(normalizedUserId, {
      limit: normalizedLimit,
    });
    return records.map((record) => toMcpApiKeyMetadata(record, now));
  }
}

module.exports = {
  ListCurrentUserMcpApiKeys,
};
