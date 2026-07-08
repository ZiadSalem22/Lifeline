import type { CreateMcpKeyInput, McpKey } from '@lifeline/shared';
import { api } from '../../shared/api/client';

/** MCP API-key endpoints (02-api-contract-v1.md). */

export function listMcpKeys(): Promise<{ items: McpKey[] }> {
  return api.get<{ items: McpKey[] }>('/mcp-keys');
}

export interface CreateMcpKeyResponse {
  apiKey: McpKey;
  /** Full `lk_…` secret — shown exactly once at creation. */
  plaintextKey: string;
}

export function createMcpKey(input: CreateMcpKeyInput): Promise<CreateMcpKeyResponse> {
  return api.post<CreateMcpKeyResponse>('/mcp-keys', input);
}

export function revokeMcpKey(id: string): Promise<unknown> {
  return api.post<unknown>(`/mcp-keys/${id}/revoke`);
}
