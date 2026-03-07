const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/errors');
const { hashMcpApiKeySecret } = require('../utils/mcpApiKeys');

const API_KEY_PREFIX_PREFIX = 'lk';
const DEFAULT_MCP_API_KEY_SCOPES = Object.freeze(['tasks:read', 'tasks:write']);
const ALLOWED_MCP_API_KEY_SCOPES = new Set([
  'tasks:read',
  'tasks:write',
  'tasks:*',
  '*',
]);

function defaultGenerateKeyPrefix() {
  return `${API_KEY_PREFIX_PREFIX}_${crypto.randomBytes(4).toString('hex')}`;
}

function defaultGenerateSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

function normalizeApiKeyName(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new AppError('API key name is required.', 400);
  }
  return normalized;
}

function normalizeScopes(scopes) {
  const source = Array.isArray(scopes)
    ? scopes
    : String(scopes || '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);

  const normalized = Array.from(new Set((source.length > 0 ? source : DEFAULT_MCP_API_KEY_SCOPES)
    .map((scope) => String(scope || '').trim())
    .filter(Boolean)));

  if (normalized.length === 0) {
    throw new AppError('Provide at least one MCP API key scope.', 400);
  }

  const invalidScopes = normalized.filter((scope) => !ALLOWED_MCP_API_KEY_SCOPES.has(scope));
  if (invalidScopes.length > 0) {
    throw new AppError(`Unsupported MCP API key scope(s): ${invalidScopes.join(', ')}.`, 400);
  }

  return normalized;
}

function normalizeExpiresAt(expiresAt, now) {
  if (!expiresAt) return null;

  const normalized = new Date(expiresAt);
  if (Number.isNaN(normalized.getTime())) {
    throw new AppError('expiresAt must be a valid ISO timestamp.', 400);
  }

  if (normalized.getTime() <= now.getTime()) {
    throw new AppError('expiresAt must be in the future.', 400);
  }

  return normalized.toISOString();
}

class IssueMcpApiKey {
  constructor({
    mcpApiKeyRepository,
    userRepository,
    now = () => new Date(),
    generateId = uuidv4,
    generateKeyPrefix = defaultGenerateKeyPrefix,
    generateSecret = defaultGenerateSecret,
    hashSecret = hashMcpApiKeySecret,
    maxPrefixAttempts = 5,
  }) {
    this.mcpApiKeyRepository = mcpApiKeyRepository;
    this.userRepository = userRepository;
    this.now = now;
    this.generateId = generateId;
    this.generateKeyPrefix = generateKeyPrefix;
    this.generateSecret = generateSecret;
    this.hashSecret = hashSecret;
    this.maxPrefixAttempts = maxPrefixAttempts;
  }

  async createUniqueKeyPrefix() {
    for (let attempt = 0; attempt < this.maxPrefixAttempts; attempt += 1) {
      const keyPrefix = String(this.generateKeyPrefix() || '').trim();
      if (!keyPrefix) {
        throw new Error('generateKeyPrefix must return a non-empty prefix');
      }

      const existing = await this.mcpApiKeyRepository.findByKeyPrefix(keyPrefix);
      if (!existing) {
        return keyPrefix;
      }
    }

    throw new AppError('Could not allocate a unique MCP API key prefix.', 500);
  }

  async execute({ userId, name, scopes = DEFAULT_MCP_API_KEY_SCOPES, expiresAt = null } = {}) {
    if (!this.mcpApiKeyRepository || !this.userRepository) {
      throw new Error('mcpApiKeyRepository and userRepository are required');
    }

    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw new AppError('userId is required.', 400);
    }

    const user = await this.userRepository.findById(normalizedUserId);
    if (!user) {
      throw new AppError('User not found for MCP API key issuance.', 404);
    }

    const issuedAt = this.now();
    const normalizedName = normalizeApiKeyName(name);
    const normalizedScopes = normalizeScopes(scopes);
    const normalizedExpiresAt = normalizeExpiresAt(expiresAt, issuedAt);
    const keyPrefix = await this.createUniqueKeyPrefix();
    const secret = String(this.generateSecret() || '').trim();

    if (!secret) {
      throw new Error('generateSecret must return a non-empty secret');
    }

    const keyHash = this.hashSecret(secret);
    const id = String(this.generateId() || '').trim();
    if (!id) {
      throw new Error('generateId must return a non-empty id');
    }

    const savedRecord = await this.mcpApiKeyRepository.save({
      id,
      userId: normalizedUserId,
      name: normalizedName,
      keyPrefix,
      keyHash,
      scopes: normalizedScopes,
      status: 'active',
      expiresAt: normalizedExpiresAt,
    });

    return {
      apiKey: `${keyPrefix}.${secret}`,
      apiKeyId: savedRecord?.id || id,
      keyPrefix,
      userId: normalizedUserId,
      userEmail: user.email || null,
      userName: user.name || null,
      name: normalizedName,
      scopes: normalizedScopes,
      expiresAt: normalizedExpiresAt,
      createdAt: issuedAt.toISOString(),
    };
  }
}

module.exports = {
  ALLOWED_MCP_API_KEY_SCOPES,
  DEFAULT_MCP_API_KEY_SCOPES,
  IssueMcpApiKey,
  normalizeScopes,
};
