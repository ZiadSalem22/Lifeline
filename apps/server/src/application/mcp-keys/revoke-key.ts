import type { McpKey } from '@lifeline/shared';
import type { McpKeyRepository } from '../ports.js';
import { toMcpKeyDto } from './metadata.js';

/**
 * POST /api/v1/mcp-keys/:id/revoke — idempotent self-serve revocation
 * (reason `user_self_service`, matching the old backend). Unknown or
 * foreign keys → NotFoundError('API key not found.') from the repository.
 */
export class RevokeMcpKey {
  constructor(
    private readonly deps: { keys: McpKeyRepository },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, keyId: string): Promise<McpKey> {
    const record = await this.deps.keys.revoke(userId, keyId, 'user_self_service');
    return toMcpKeyDto(record, this.now());
  }
}
