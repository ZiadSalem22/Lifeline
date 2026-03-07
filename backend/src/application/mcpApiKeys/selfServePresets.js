const { AppError } = require('../../utils/errors');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const SELF_SERVE_SCOPE_PRESETS = Object.freeze({
  read_only: Object.freeze(['tasks:read']),
  read_write: Object.freeze(['tasks:read', 'tasks:write']),
});

const SELF_SERVE_EXPIRY_PRESETS = Object.freeze({
  '1_day': 1,
  '7_days': 7,
  '30_days': 30,
  '90_days': 90,
  never: null,
});

function resolveSelfServeScopes(scopePreset) {
  const normalizedPreset = String(scopePreset || '').trim();
  const scopes = SELF_SERVE_SCOPE_PRESETS[normalizedPreset];

  if (!scopes) {
    throw new AppError('scopePreset must be one of: read_only, read_write.', 400);
  }

  return [...scopes];
}

function resolveSelfServeExpiresAt(expiryPreset, now = new Date()) {
  const normalizedPreset = String(expiryPreset || '').trim();
  if (!Object.prototype.hasOwnProperty.call(SELF_SERVE_EXPIRY_PRESETS, normalizedPreset)) {
    throw new AppError('expiryPreset must be one of: 1_day, 7_days, 30_days, 90_days, never.', 400);
  }

  const days = SELF_SERVE_EXPIRY_PRESETS[normalizedPreset];
  if (days === null) {
    return null;
  }

  return new Date(now.getTime() + (days * DAY_IN_MS)).toISOString();
}

module.exports = {
  SELF_SERVE_EXPIRY_PRESETS,
  SELF_SERVE_SCOPE_PRESETS,
  resolveSelfServeExpiresAt,
  resolveSelfServeScopes,
};
