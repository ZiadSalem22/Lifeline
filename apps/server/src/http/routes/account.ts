import { Router } from 'express';
import { z } from 'zod';
import { problemSchema } from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { ResetAccount } from '../../application/data-transfer/reset-account.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface AccountRouterDeps {
  resetAccount: ResetAccount;
  registry: OpenApiRegistry;
}

/** Old-app parity message (audit-domain-logic.md §10). */
export const RESET_ACCOUNT_MESSAGE = 'Account data reset: todos, tags, and theme deleted.';

const resetResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * Account slice: POST /api/v1/account/reset (mounted at /account). Deletes
 * the user's todos, custom tags, and settings; keeps user/profile/MCP keys.
 */
export function buildAccountRouter(deps: AccountRouterDeps): Router {
  const router = Router();

  deps.registry.register({
    method: 'post',
    path: '/api/v1/account/reset',
    summary: 'Reset account data (todos + custom tags + settings; user/profile/keys kept)',
    tag: 'account',
    responses: {
      '200': { description: 'Account data reset', schema: resetResponseSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.post('/reset', async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    await deps.resetAccount.execute(user.id);
    res.json({ success: true, message: RESET_ACCOUNT_MESSAGE });
  });

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}
