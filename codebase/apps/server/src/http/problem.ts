import type { Response } from 'express';
import { PROBLEM_CONTENT_TYPE, type ErrorCode, type Problem } from '@lifeline/shared';

/** Default human titles per stable error code (RFC 7807 `title`). */
export const PROBLEM_TITLES: Record<ErrorCode, string> = {
  validation_failed: 'Validation failed',
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  not_found: 'Not found',
  conflict: 'Conflict',
  rate_limited: 'Too many requests',
  payload_too_large: 'Payload too large',
  internal: 'Internal server error',
};

export interface ProblemInput {
  status: number;
  code: ErrorCode;
  title?: string | undefined;
  detail?: string | undefined;
  errors?: Record<string, string[]> | undefined;
}

/** Render an application/problem+json response (the ONLY error body shape). */
export function sendProblem(res: Response, input: ProblemInput): void {
  const requestId = res.req.requestId;
  const body: Problem = {
    type: 'about:blank',
    title: input.title ?? PROBLEM_TITLES[input.code],
    status: input.status,
    code: input.code,
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
    ...(input.errors !== undefined ? { errors: input.errors } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  };
  res.status(input.status).set('Content-Type', PROBLEM_CONTENT_TYPE).send(JSON.stringify(body));
}
