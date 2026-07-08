import { randomUUID } from 'node:crypto';
import {
  EXPIRY_PRESET_DAYS,
  SCOPE_PRESETS,
  type CreateMcpKeyInput,
  type McpKey,
} from '@lifeline/shared';
import { AppError, ConflictError } from '../../domain/errors.js';
import { generateKey, hashSecret, type GeneratedMcpKey } from '../../utils/mcp-key-crypto.js';
import type { McpKeyRepository } from '../ports.js';
import { toMcpKeyDto } from './metadata.js';

/**
 * POST /api/v1/mcp-keys — self-serve issuance with fixed presets
 * (audit-auth.md §4): scopePreset → scopes, expiryPreset → now + days×24h
 * (never → null). The plaintext key is returned exactly once. Prefix
 * uniqueness is enforced by the DB unique index; collisions (23505 →
 * ConflictError from the repo) retry with fresh material, ≤5 attempts.
 */

const DAY_MS = 86_400_000;
const MAX_PREFIX_ATTEMPTS = 5;

export interface IssueMcpKeyDeps {
  keys: McpKeyRepository;
}

export interface IssueMcpKeyOptions {
  /** HMAC pepper (env MCP_API_KEY_PEPPER) — same scheme as the old backend. */
  pepper: string;
  now?: (() => Date) | undefined;
  generateId?: (() => string) | undefined;
  generateKeyMaterial?: (() => GeneratedMcpKey) | undefined;
}

export interface IssuedMcpKey {
  apiKey: McpKey;
  /** Full `lk_xxxxxxxx.<secret>` — shown exactly once. */
  plaintextKey: string;
}

export class IssueMcpKey {
  private readonly pepper: string;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private readonly generateKeyMaterial: () => GeneratedMcpKey;

  constructor(
    private readonly deps: IssueMcpKeyDeps,
    options: IssueMcpKeyOptions,
  ) {
    this.pepper = options.pepper;
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? randomUUID;
    this.generateKeyMaterial = options.generateKeyMaterial ?? generateKey;
  }

  async execute(userId: string, input: CreateMcpKeyInput): Promise<IssuedMcpKey> {
    const scopes = [...SCOPE_PRESETS[input.scopePreset]];
    const days = EXPIRY_PRESET_DAYS[input.expiryPreset];
    const issuedAt = this.now();
    const expiresAt = days === null ? null : new Date(issuedAt.getTime() + days * DAY_MS);

    for (let attempt = 0; attempt < MAX_PREFIX_ATTEMPTS; attempt += 1) {
      const material = this.generateKeyMaterial();
      try {
        const record = await this.deps.keys.create({
          id: this.generateId(),
          userId,
          name: input.name,
          keyPrefix: material.keyPrefix,
          keyHash: hashSecret(material.secret, this.pepper),
          scopes,
          expiresAt,
        });
        return { apiKey: toMcpKeyDto(record, this.now()), plaintextKey: material.plaintext };
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
        // duplicate prefix — regenerate and retry
      }
    }
    throw new AppError(500, 'internal', 'Could not allocate a unique MCP API key prefix.');
  }
}
