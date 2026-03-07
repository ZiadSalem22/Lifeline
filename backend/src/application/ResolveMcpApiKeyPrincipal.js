const { AppError } = require('../utils/errors');
const { verifyMcpApiKeySecret } = require('../utils/mcpApiKeys');

const API_KEY_DELIMITER = '.';

function stripBearerPrefix(apiKey) {
  if (!apiKey) return '';
  return String(apiKey).replace(/^Bearer\s+/i, '').trim();
}

function parsePresentedApiKey(apiKey) {
  const normalized = stripBearerPrefix(apiKey);
  if (!normalized) {
    throw new AppError('Missing API key.', 401);
  }

  const separatorIndex = normalized.indexOf(API_KEY_DELIMITER);
  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
    throw new AppError('Invalid API key.', 401);
  }

  return {
    presentedKey: normalized,
    keyPrefix: normalized.slice(0, separatorIndex),
    secret: normalized.slice(separatorIndex + 1),
  };
}

function isExpired(expiresAt, now) {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return false;
  return expiresAtMs <= now.getTime();
}

async function recordUsageBestEffort(mcpApiKeyRepository, id, usage) {
  if (!mcpApiKeyRepository?.recordUsage || !id) return;

  try {
    await mcpApiKeyRepository.recordUsage(id, usage);
  } catch (_error) {
    // Best-effort only. Usage tracking should not block valid authentication.
  }
}

class ResolveMcpApiKeyPrincipal {
  constructor({ mcpApiKeyRepository, userRepository, now = () => new Date(), verifySecret = verifyMcpApiKeySecret }) {
    this.mcpApiKeyRepository = mcpApiKeyRepository;
    this.userRepository = userRepository;
    this.now = now;
    this.verifySecret = verifySecret;
  }

  async execute({ apiKey, clientIp = null, clientUserAgent = null } = {}) {
    if (!this.mcpApiKeyRepository || !this.userRepository) {
      throw new Error('mcpApiKeyRepository and userRepository are required');
    }

    const { keyPrefix, secret } = parsePresentedApiKey(apiKey);
    const apiKeyRecord = await this.mcpApiKeyRepository.findByKeyPrefix(keyPrefix);
    if (!apiKeyRecord) {
      throw new AppError('Invalid API key.', 401);
    }

    const now = this.now();

    if (apiKeyRecord.status === 'revoked' || apiKeyRecord.revokedAt) {
      throw new AppError('API key revoked.', 403);
    }

    if (isExpired(apiKeyRecord.expiresAt, now) || apiKeyRecord.status === 'expired') {
      throw new AppError('API key expired.', 403);
    }

    if (apiKeyRecord.status !== 'active') {
      throw new AppError('API key is not active.', 403);
    }

    const isValidSecret = this.verifySecret(secret, apiKeyRecord.keyHash);
    if (!isValidSecret) {
      throw new AppError('Invalid API key.', 401);
    }

    const user = await this.userRepository.findById(apiKeyRecord.userId);
    if (!user) {
      throw new AppError('API key user not found.', 404);
    }

    await recordUsageBestEffort(this.mcpApiKeyRepository, apiKeyRecord.id, {
      lastUsedAt: now.toISOString(),
      lastUsedIp: clientIp,
      lastUsedUserAgent: clientUserAgent,
    });

    return {
      lifelineUserId: String(user.id),
      subjectType: 'api_key',
      authMethod: 'api_key',
      subjectId: String(apiKeyRecord.id),
      displayName: user.name || apiKeyRecord.name || null,
      scopes: Array.isArray(apiKeyRecord.scopes) ? apiKeyRecord.scopes : [],
      apiKeyId: apiKeyRecord.id,
      apiKeyName: apiKeyRecord.name,
      keyPrefix: apiKeyRecord.keyPrefix,
    };
  }
}

module.exports = {
  API_KEY_DELIMITER,
  ResolveMcpApiKeyPrincipal,
  parsePresentedApiKey,
  stripBearerPrefix,
};
