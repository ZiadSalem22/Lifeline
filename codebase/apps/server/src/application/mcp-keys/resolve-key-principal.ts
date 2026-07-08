import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../domain/errors.js';
import { parsePlaintextKey, verifySecret } from '../../utils/mcp-key-crypto.js';
import type { McpKeyRepository, UserRepository } from '../ports.js';

/**
 * API-key → principal resolution for the embedded MCP module, ported from the
 * old `ResolveMcpApiKeyPrincipal.js` (audit-auth.md §4). Check order and
 * messages are preserved:
 *
 * 1. parse at the FIRST '.'      → 401 'Invalid API key.' (missing → 'Missing API key.')
 * 2. unknown prefix              → 401 'Invalid API key.'
 * 3. revoked (status/revokedAt)  → 403 'API key revoked.'
 * 4. expired (date or status)    → 403 'API key expired.'
 * 5. any other non-active status → 403 'API key is not active.'
 * 6. HMAC mismatch               → 401 'Invalid API key.'
 * 7. user gone                   → 404 'API key user not found.'
 *
 * Usage bookkeeping is best-effort: recordUsage failures never block auth.
 */

export interface ResolvedKeyPrincipal {
  principal: {
    subjectType: 'api_key';
    lifelineUserId: string;
    authMethod: 'api_key';
    scopes: string[];
    subjectId: string;
    displayName: string | null;
  };
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
  };
}

export interface ResolveKeyPrincipalDeps {
  keys: McpKeyRepository;
  users: Pick<UserRepository, 'findById'>;
}

export interface ResolveKeyPrincipalOptions {
  pepper: string;
  now?: (() => Date) | undefined;
}

export interface ResolveKeyPrincipalInput {
  apiKey: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export class ResolveKeyPrincipal {
  private readonly pepper: string;
  private readonly now: () => Date;

  constructor(
    private readonly deps: ResolveKeyPrincipalDeps,
    options: ResolveKeyPrincipalOptions,
  ) {
    this.pepper = options.pepper;
    this.now = options.now ?? (() => new Date());
  }

  async execute(input: ResolveKeyPrincipalInput): Promise<ResolvedKeyPrincipal> {
    if (input.apiKey.trim() === '') throw new UnauthorizedError('Missing API key.');
    const parsed = parsePlaintextKey(input.apiKey);
    if (parsed === null) throw new UnauthorizedError('Invalid API key.');

    const record = await this.deps.keys.findByPrefix(parsed.keyPrefix);
    if (record === null) throw new UnauthorizedError('Invalid API key.');

    const now = this.now();
    if (record.status === 'revoked' || record.revokedAt !== null) {
      throw new ForbiddenError('API key revoked.');
    }
    if (
      record.status === 'expired' ||
      (record.expiresAt !== null && record.expiresAt.getTime() <= now.getTime())
    ) {
      throw new ForbiddenError('API key expired.');
    }
    if (record.status !== 'active') {
      throw new ForbiddenError('API key is not active.');
    }
    if (!verifySecret(parsed.secret, record.keyHash, this.pepper)) {
      throw new UnauthorizedError('Invalid API key.');
    }

    const user = await this.deps.users.findById(record.userId);
    if (user === null) throw new NotFoundError('API key user not found.');

    try {
      await this.deps.keys.recordUsage(record.id, {
        at: now,
        ip: input.ip,
        userAgent: input.userAgent,
      });
    } catch {
      // Best-effort only — usage tracking must never block valid auth.
    }

    return {
      principal: {
        subjectType: 'api_key',
        lifelineUserId: user.id,
        authMethod: 'api_key',
        scopes: [...record.scopes],
        subjectId: record.id,
        displayName: user.name ?? record.name,
      },
      apiKey: {
        id: record.id,
        name: record.name,
        keyPrefix: record.keyPrefix,
        scopes: [...record.scopes],
      },
    };
  }
}
