import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createMcpKeyResponseSchema,
  createMcpKeySchema,
  listMcpKeysQuerySchema,
  mcpKeySchema,
  problemSchema,
  type CreateMcpKeyInput,
} from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { IssueMcpKey } from '../../application/mcp-keys/issue-key.js';
import type { ListMcpKeys } from '../../application/mcp-keys/list-keys.js';
import type { RevokeMcpKey } from '../../application/mcp-keys/revoke-key.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface McpKeysRouterDeps {
  listKeys: ListMcpKeys;
  issueKey: IssueMcpKey;
  revokeKey: RevokeMcpKey;
  registry: OpenApiRegistry;
  /** Key-write rate limiter (10/min/user) — applied to BOTH POST routes. */
  limiter?: RequestHandler | undefined;
}

const idParamsSchema = z.object({ id: z.string().min(1) });
type IdParams = z.infer<typeof idParamsSchema>;
type ListQuery = z.infer<typeof listMcpKeysQuerySchema>;

const listResponseSchema = z.object({ items: z.array(mcpKeySchema) });
const revokeResponseSchema = z.object({ apiKey: mcpKeySchema });

/**
 * MCP API keys feature router (mounted at /api/v1/mcp-keys). The plaintext
 * `lk_…` key appears exactly once, in the 201 create response; listings only
 * ever carry metadata (derived status revoked > expired > active).
 */
export function buildMcpKeysRouter(deps: McpKeysRouterDeps): Router {
  const router = Router();
  const writeGuards: RequestHandler[] = deps.limiter !== undefined ? [deps.limiter] : [];
  registerOpenApi(deps.registry);

  router.get('/', validate(listMcpKeysQuerySchema, 'query'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { limit } = getValidated<ListQuery>(req, 'query');
    res.json({ items: await deps.listKeys.execute(user.id, limit) });
  });

  router.post('/', ...writeGuards, validate(createMcpKeySchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const input = getValidated<CreateMcpKeyInput>(req);
    const issued = await deps.issueKey.execute(user.id, input);
    res.status(201).json(issued);
  });

  router.post(
    '/:id/revoke',
    ...writeGuards,
    validate(idParamsSchema, 'params'),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id } = getValidated<IdParams>(req, 'params');
      res.json({ apiKey: await deps.revokeKey.execute(user.id, id) });
    },
  );

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}

function registerOpenApi(registry: OpenApiRegistry): void {
  const tag = 'mcp-keys';
  const problem = (description: string) => ({ description, schema: problemSchema });

  registry.register({
    method: 'get',
    path: '/api/v1/mcp-keys',
    summary: 'List the user’s MCP API keys (metadata only, newest first)',
    tag,
    request: { query: listMcpKeysQuerySchema },
    responses: {
      '200': { description: 'Keys', schema: listResponseSchema },
      '400': problem('Validation failed'),
      '401': problem('Not authenticated'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/mcp-keys',
    summary: 'Issue a key from presets; the plaintext key is returned exactly once (10/min)',
    tag,
    request: { body: createMcpKeySchema },
    responses: {
      '201': { description: 'Issued key + one-time plaintext', schema: createMcpKeyResponseSchema },
      '400': problem('Validation failed'),
      '401': problem('Not authenticated'),
      '429': problem('Rate limit exceeded'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/mcp-keys/:id/revoke',
    summary: 'Revoke a key (idempotent, reason user_self_service; 10/min)',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '200': { description: 'Revoked key metadata', schema: revokeResponseSchema },
      '404': problem('Key not found'),
      '429': problem('Rate limit exceeded'),
    },
  });
}
