import { z } from 'zod';
import { dateOnlySchema } from './todo.js';

export const statsQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'year']).optional(),
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
  })
  .refine((v) => v.period !== undefined || (v.startDate !== undefined && v.endDate !== undefined), {
    message: 'Provide period, or startDate and endDate',
  });
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const statsResponseSchema = z.object({
  periodTotals: z.object({
    totalTodos: z.number().int(),
    completedCount: z.number().int(),
    /** Integer percentage 0–100. */
    completionRate: z.number(),
    /** Mean of positive durations, minutes, rounded. */
    avgDuration: z.number(),
    /** Sum of all durations, minutes. */
    timeSpentTotal: z.number(),
  }),
  topTags: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        color: z.string(),
        count: z.number().int(),
      }),
    )
    .max(10),
  groups: z.array(
    z.object({
      period: z.string(),
      date: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type StatsResponse = z.infer<typeof statsResponseSchema>;
