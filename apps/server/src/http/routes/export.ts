import { Router } from 'express';
import { exportPayloadSchema, exportQuerySchema, problemSchema } from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { ExportData } from '../../application/data-transfer/export-data.js';
import type { CurrentUser } from '../../application/ports.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface ExportRouterDeps {
  exportData: ExportData;
  registry: OpenApiRegistry;
}

/** Export slice: GET /api/v1/export?format=json|csv (mounted at /export). */
export function buildExportRouter(deps: ExportRouterDeps): Router {
  const router = Router();

  deps.registry.register({
    method: 'get',
    path: '/api/v1/export',
    summary:
      'Download the user’s data as an attachment: todos_export.json (full payload) or todos_export.csv (todos only)',
    tag: 'data-transfer',
    request: { query: exportQuerySchema },
    responses: {
      '200': {
        description: 'Export attachment (JSON payload shown; CSV returns text/csv)',
        schema: exportPayloadSchema,
      },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.get('/', validate(exportQuerySchema, 'query'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { format } = getValidated<{ format: 'json' | 'csv' }>(req, 'query');

    if (format === 'csv') {
      const csv = await deps.exportData.buildCsv(user.id);
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', 'attachment; filename="todos_export.csv"');
      res.send(csv);
      return;
    }

    const payload = await deps.exportData.buildJson(user);
    res.header('Content-Type', 'application/json');
    res.header('Content-Disposition', 'attachment; filename="todos_export.json"');
    res.send(JSON.stringify(payload, null, 2));
  });

  return router;
}

function requireCurrentUser(user: CurrentUser | null | undefined): CurrentUser {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}
