import type { McpKey } from '@lifeline/shared';
import type { McpKeyRepository } from '../ports.js';
import { toMcpKeyDto } from './metadata.js';

/** GET /api/v1/mcp-keys — the user's keys, newest first, derived status. */
export class ListMcpKeys {
  constructor(
    private readonly deps: { keys: McpKeyRepository },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, limit: number): Promise<McpKey[]> {
    const records = await this.deps.keys.list(userId, limit);
    const now = this.now();
    return records.map((record) => toMcpKeyDto(record, now));
  }
}
