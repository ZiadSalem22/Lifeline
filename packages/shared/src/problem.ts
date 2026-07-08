import { z } from 'zod';

/**
 * RFC 7807 problem+json error envelope. Every non-2xx response from the API
 * has this shape, with `code` as the stable machine-readable discriminator.
 */
export const errorCodeSchema = z.enum([
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'payload_too_large',
  'internal',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const problemSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: errorCodeSchema,
  /** Present on validation_failed: path → human-readable messages. */
  errors: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string().optional(),
});
export type Problem = z.infer<typeof problemSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
