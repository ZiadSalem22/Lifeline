import { z } from 'zod';
import { LIMITS } from './constants.js';

export const SCOPE_PRESETS = {
  read_only: ['tasks:read'],
  read_write: ['tasks:read', 'tasks:write'],
} as const;
export type ScopePreset = keyof typeof SCOPE_PRESETS;

export const EXPIRY_PRESET_DAYS = {
  '1_day': 1,
  '7_days': 7,
  '30_days': 30,
  '90_days': 90,
  never: null,
} as const;
export type ExpiryPreset = keyof typeof EXPIRY_PRESET_DAYS;

export const mcpKeyStatusSchema = z.enum(['active', 'expired', 'revoked']);

export const mcpKeySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(LIMITS.mcpKeyNameMax),
  keyPrefix: z.string().min(1),
  scopes: z.array(z.string()),
  status: mcpKeyStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  lastUsedAt: z.iso.datetime({ offset: true }).nullable(),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type McpKey = z.infer<typeof mcpKeySchema>;

export const createMcpKeySchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.mcpKeyNameMax),
  scopePreset: z.enum(['read_only', 'read_write']),
  expiryPreset: z.enum(['1_day', '7_days', '30_days', '90_days', 'never']),
});
export type CreateMcpKeyInput = z.infer<typeof createMcpKeySchema>;

export const createMcpKeyResponseSchema = z.object({
  apiKey: mcpKeySchema,
  /** Full `lk_xxxxxxxx.<secret>` — shown exactly once at creation. */
  plaintextKey: z.string(),
});

export const listMcpKeysQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
