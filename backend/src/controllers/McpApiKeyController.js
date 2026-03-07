const { AppError } = require('../utils/errors');

function requireCurrentUserId(req) {
  const userId = String(req.currentUser?.id || '').trim();
  if (!userId) {
    throw new AppError('Please log in to use this feature. Guest mode works only locally.', 401);
  }
  return userId;
}

class McpApiKeyController {
  constructor({ listCurrentUserMcpApiKeys, createSelfServeMcpApiKey, revokeCurrentUserMcpApiKey }) {
    this.listCurrentUserMcpApiKeys = listCurrentUserMcpApiKeys;
    this.createSelfServeMcpApiKey = createSelfServeMcpApiKey;
    this.revokeCurrentUserMcpApiKey = revokeCurrentUserMcpApiKey;
  }

  async list(req, res, next) {
    try {
      const limit = Number(req.validatedQuery?.limit || req.query?.limit || 25);
      const apiKeys = await this.listCurrentUserMcpApiKeys.execute({
        userId: requireCurrentUserId(req),
        limit,
      });
      res.json({ apiKeys, limit });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const result = await this.createSelfServeMcpApiKey.execute({
        userId: requireCurrentUserId(req),
        ...req.body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async revoke(req, res, next) {
    try {
      const apiKey = await this.revokeCurrentUserMcpApiKey.execute({
        userId: requireCurrentUserId(req),
        apiKeyId: req.params.id,
      });
      res.json({ apiKey });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = McpApiKeyController;
