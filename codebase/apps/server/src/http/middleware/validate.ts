import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';

export type ValidateSource = 'body' | 'query' | 'params';

/**
 * Validate a request segment against a zod schema. Failures forward the
 * ZodError to the terminal error handler (→ 400 validation_failed problem).
 *
 * Express 5 note: `req.query` is a getter, so the parsed (coerced/defaulted)
 * value is stored on `req.validated[source]` — read it back with
 * {@link getValidated}.
 */
export function validate(schema: z.ZodType, source: ValidateSource = 'body'): RequestHandler {
  return (req, _res, next) => {
    const input: unknown =
      source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const result = schema.safeParse(input);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}

/** Typed accessor for a previously validated segment (throws if not validated). */
export function getValidated<T>(req: Request, source: ValidateSource = 'body'): T {
  const value = req.validated?.[source];
  if (value === undefined) {
    throw new Error(`No validated ${source} on this request — is validate() mounted?`);
  }
  return value as T;
}
