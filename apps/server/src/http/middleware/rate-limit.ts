import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { sendProblem } from '../problem.js';

/**
 * Rate limiters keyed by authenticated user id (IP fallback for
 * unauthenticated requests). Budgets match the old app: todos 60/min,
 * MCP-key writes 10/min. Standard RateLimit-* headers; 429s are problem+json.
 */

function createLimiter(limit: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.currentUser?.id ?? ipKeyGenerator(req.ip ?? ''),
    handler: (_req, res) => {
      sendProblem(res, {
        status: 429,
        code: 'rate_limited',
        detail: 'Rate limit exceeded. Try again shortly.',
      });
    },
  });
}

/** 60 requests/min per user across /api/v1/todos*. */
export function createTodosLimiter(): RequestHandler {
  return createLimiter(60);
}

/** 10 requests/min per user for MCP API-key writes. */
export function createKeyWriteLimiter(): RequestHandler {
  return createLimiter(10);
}
