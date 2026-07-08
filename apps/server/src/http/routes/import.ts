import { Router } from 'express';
import {
  importRequestSchema,
  importResponseSchema,
  problemSchema,
  type ImportRequest,
} from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { ImportData } from '../../application/data-transfer/import-data.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface ImportRouterDeps {
  importData: ImportData;
  registry: OpenApiRegistry;
}

/**
 * Import slice: POST /api/v1/import (mounted at /import). `data` is the
 * export payload as an object or a JSON string of it; bad JSON / missing
 * todos array surface as 400 problems from the use-case
 * ('Invalid JSON format' / 'Invalid import format: missing todos array').
 */
export function buildImportRouter(deps: ImportRouterDeps): Router {
  const router = Router();

  deps.registry.register({
    method: 'post',
    path: '/api/v1/import',
    summary: 'Import an export payload (mode merge|replace); returns the imported todo count',
    tag: 'data-transfer',
    request: { body: importRequestSchema },
    responses: {
      '200': { description: 'Import result', schema: importResponseSchema },
      '400': { description: 'Validation failed / invalid import payload', schema: problemSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.post('/', validate(importRequestSchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const input = getValidated<ImportRequest>(req);
    res.json(await deps.importData.execute(user.id, input));
  });

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}
