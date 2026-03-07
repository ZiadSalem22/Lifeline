const crypto = require('crypto');

function getMcpApiKeyPepper() {
  return String(process.env.MCP_API_KEY_PEPPER || '');
}

function hashMcpApiKeySecret(secret, pepper = getMcpApiKeyPepper()) {
  if (!secret) {
    throw new Error('secret is required to hash an MCP API key');
  }

  return crypto
    .createHmac('sha256', pepper)
    .update(String(secret))
    .digest('hex');
}

function verifyMcpApiKeySecret(secret, expectedHash, pepper = getMcpApiKeyPepper()) {
  if (!secret || !expectedHash) return false;

  const calculatedHash = Buffer.from(hashMcpApiKeySecret(secret, pepper));
  const storedHash = Buffer.from(String(expectedHash));

  if (calculatedHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(calculatedHash, storedHash);
}

module.exports = {
  getMcpApiKeyPepper,
  hashMcpApiKeySecret,
  verifyMcpApiKeySecret,
};
