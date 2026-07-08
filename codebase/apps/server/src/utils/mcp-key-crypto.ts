import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * MCP API-key material — EXACT port of the old `utils/mcpApiKeys.js` +
 * `IssueMcpApiKey.js` generators (audit-auth.md §4). The algorithm is frozen
 * so keys issued by the old backend keep verifying:
 *
 * - plaintext = `${keyPrefix}.${secret}`
 * - keyPrefix = `lk_` + 4 random bytes hex (e.g. `lk_a1b2c3d4`)
 * - secret    = 24 random bytes base64url
 * - stored hash = HMAC-SHA256(secret, key = MCP_API_KEY_PEPPER) hex
 */

export const MCP_KEY_DELIMITER = '.';
export const MCP_KEY_PREFIX_PATTERN = /^lk_[0-9a-f]{8}$/;

export interface GeneratedMcpKey {
  keyPrefix: string;
  secret: string;
  /** Full key shown to the user exactly once. */
  plaintext: string;
}

export function generateKey(): GeneratedMcpKey {
  const keyPrefix = `lk_${randomBytes(4).toString('hex')}`;
  const secret = randomBytes(24).toString('base64url');
  return { keyPrefix, secret, plaintext: `${keyPrefix}${MCP_KEY_DELIMITER}${secret}` };
}

/** HMAC-SHA256(secret, key = pepper) hex — must never change (prod-key compat). */
export function hashSecret(secret: string, pepper: string): string {
  if (secret === '') throw new Error('secret is required to hash an MCP API key');
  return createHmac('sha256', pepper).update(secret).digest('hex');
}

/** Timing-safe comparison of a presented secret against the stored hash. */
export function verifySecret(secret: string, expectedHash: string, pepper: string): boolean {
  if (secret === '' || expectedHash === '') return false;
  const calculated = Buffer.from(hashSecret(secret, pepper));
  const stored = Buffer.from(expectedHash);
  if (calculated.length !== stored.length) return false;
  return timingSafeEqual(calculated, stored);
}

export interface ParsedMcpKey {
  keyPrefix: string;
  secret: string;
}

/**
 * Split a presented key at the FIRST delimiter (an optional `Bearer ` prefix
 * is stripped, matching the old parser). Returns null when the shape is
 * unusable (missing prefix or secret) — callers map that to 401.
 */
export function parsePlaintextKey(presented: string): ParsedMcpKey | null {
  const normalized = presented.replace(/^Bearer\s+/i, '').trim();
  if (normalized === '') return null;
  const separatorIndex = normalized.indexOf(MCP_KEY_DELIMITER);
  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) return null;
  return {
    keyPrefix: normalized.slice(0, separatorIndex),
    secret: normalized.slice(separatorIndex + 1),
  };
}
