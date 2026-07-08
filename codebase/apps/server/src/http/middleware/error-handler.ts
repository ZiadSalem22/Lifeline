import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { AppError, DomainValidationError } from '../../domain/errors.js';
import type { Logger } from '../../config/logger.js';
import { sendProblem } from '../problem.js';

/**
 * Terminal handlers. Every non-2xx response funnels through sendProblem so
 * the wire shape is always `application/problem+json` matching
 * @lifeline/shared `problemSchema` (incl. requestId).
 */

/** Flatten a ZodError into `{ path: [messages] }` (form errors under `_`). */
export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const flattened = z.flattenError(error);
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      out[key] = messages.filter((message): message is string => typeof message === 'string');
    }
  }
  if (flattened.formErrors.length > 0) out._ = flattened.formErrors;
  return out;
}

/** 404 problem for unmatched routes; mount after all routers. */
export function notFoundHandler(): RequestHandler {
  return (req, res) => {
    sendProblem(res, {
      status: 404,
      code: 'not_found',
      detail: `Route ${req.method} ${req.path} not found`,
    });
  };
}

interface BodyParserError {
  type?: unknown;
  status?: unknown;
}

/** Single terminal error handler; mount last. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof ZodError) {
      sendProblem(res, {
        status: 400,
        code: 'validation_failed',
        detail: 'Request validation failed',
        errors: zodFieldErrors(err),
      });
      return;
    }

    if (err instanceof AppError) {
      sendProblem(res, {
        status: err.status,
        code: err.code,
        detail: err.detail,
        errors: err instanceof DomainValidationError ? err.fieldErrors : undefined,
      });
      return;
    }

    // body-parser errors (raw-body/express.json)
    const bodyError = err as BodyParserError;
    if (bodyError !== null && typeof bodyError === 'object') {
      if (bodyError.type === 'entity.too.large') {
        sendProblem(res, {
          status: 413,
          code: 'payload_too_large',
          detail: 'Request body exceeds the 1mb limit',
        });
        return;
      }
      if (bodyError.type === 'entity.parse.failed') {
        sendProblem(res, {
          status: 400,
          code: 'validation_failed',
          detail: 'Malformed JSON body',
        });
        return;
      }
    }

    logger.error({ err, requestId: req.requestId }, 'Unhandled error');
    sendProblem(res, {
      status: 500,
      code: 'internal',
      detail: 'An unexpected error occurred.',
    });
  };
}
