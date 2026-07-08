import { z } from 'zod';

/**
 * Export payload. Todos/tags are intentionally loose on read (old export files
 * round-trip through import), while the server always emits canonical shapes.
 */
export const exportPayloadSchema = z.object({
  exportedAt: z.iso.datetime({ offset: true }),
  user: z
    .object({
      id: z.string(),
      email: z.string().nullable(),
      profile: z.record(z.string(), z.unknown()).nullable(),
      settings: z.record(z.string(), z.unknown()).nullable(),
    })
    .loose(),
  todos: z.array(z.record(z.string(), z.unknown())),
  tags: z.array(z.record(z.string(), z.unknown())),
  stats: z.record(z.string(), z.unknown()),
});
export type ExportPayload = z.infer<typeof exportPayloadSchema>;

export const importRequestSchema = z.object({
  /** Export payload as object, or a JSON string of it (old export files). */
  data: z.union([z.string().min(1), z.record(z.string(), z.unknown())]),
  mode: z.enum(['merge', 'replace']).default('merge'),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export const importResponseSchema = z.object({
  importedCount: z.number().int().min(0),
});

export const exportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});
