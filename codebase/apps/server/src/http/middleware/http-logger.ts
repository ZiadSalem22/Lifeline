import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../../config/logger.js';

/**
 * Request logging via pino-http. Reuses the request id bound by the
 * request-id middleware; authorization/x-api-key headers are redacted by the
 * base logger configuration (see config/logger.ts).
 */
export function httpLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (req) => (req as Request).requestId ?? randomUUID(),
    customLogLevel: (_req, res, err) => {
      if (err !== undefined || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: {
      // Health probes fire every few seconds — keep them out of the logs.
      ignore: (req) => req.url === '/health/live' || req.url === '/health/ready',
    },
  });
}
