import { z } from 'zod';
import { DAY_NAMES, LIMITS, PRIORITIES } from './constants.js';
import { tagSchema } from './tag.js';

/** Date-only string, the canonical wire format for dueDate. */
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
/** Inputs also accept full ISO datetimes (old clients/exports); server normalizes to date-only. */
export const dueDateInputSchema = z.union([
  dateOnlySchema,
  z.iso.datetime({ offset: true }),
  z.iso.datetime(),
]);
export const dueTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

export const prioritySchema = z.enum(PRIORITIES);

export const subtaskSchema = z.object({
  subtaskId: z.uuid(),
  title: z.string().min(1).max(LIMITS.subtaskTitleMax),
  isCompleted: z.boolean(),
  position: z.number().int().min(1),
});
export type Subtask = z.infer<typeof subtaskSchema>;

/** What clients may send; identity is preserved via subtaskId, the rest is normalized server-side. */
export const subtaskInputSchema = z.object({
  subtaskId: z.uuid().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string().trim().min(1).max(LIMITS.subtaskTitleMax),
  isCompleted: z.boolean().optional(),
  position: z.number().int().min(1).optional(),
});
export type SubtaskInput = z.infer<typeof subtaskInputSchema>;

const recurrenceModernSchema = z
  .object({
    mode: z.enum(['daily', 'dateRange', 'specificDays']),
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
    selectedDays: z.array(z.enum(DAY_NAMES)).optional(),
  })
  .loose();
const recurrenceLegacySchema = z
  .object({
    type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
    interval: z.number().int().min(1).optional(),
    endDate: z.string().optional(),
    daysOfWeek: z.array(z.string()).optional(),
  })
  .loose();
export const recurrenceSchema = z.union([recurrenceModernSchema, recurrenceLegacySchema]);
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const todoSchema = z.object({
  id: z.string().min(1),
  taskNumber: z.number().int().min(1),
  title: z.string().min(1).max(LIMITS.subtaskTitleMax),
  description: z.string().nullable(),
  dueDate: dateOnlySchema.nullable(),
  dueTime: dueTimeSchema.nullable(),
  isCompleted: z.boolean(),
  isFlagged: z.boolean(),
  duration: z.number().int().min(0).max(LIMITS.durationMaxMinutes),
  priority: prioritySchema,
  tags: z.array(tagSchema),
  subtasks: z.array(subtaskSchema),
  order: z.number().int(),
  recurrence: recurrenceSchema.nullable(),
  /** Habit this task counts toward (Daily Plan habit id); completing the task
      checks that habit for the task's due date. Default so old rows self-heal. */
  habitId: z.string().min(1).max(64).nullable().default(null),
  originalId: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Todo = z.infer<typeof todoSchema>;

/** Tag references on todo writes: id string, or object carrying id and/or name. */
export const tagReferenceSchema = z.union([
  z.string().min(1),
  z
    .object({
      id: z.union([z.string().min(1), z.number()]).optional(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
    })
    .loose()
    .refine((t) => t.id !== undefined || t.name !== undefined, {
      message: 'Tag reference requires id or name',
    }),
]);
export type TagReference = z.infer<typeof tagReferenceSchema>;

export const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.todoTitleMax),
  description: z.string().max(LIMITS.descriptionMax).nullish(),
  dueDate: dueDateInputSchema.nullish().or(z.literal('')),
  dueTime: dueTimeSchema.nullish().or(z.literal('')),
  tags: z.array(tagReferenceSchema).max(50).optional(),
  isFlagged: z.boolean().optional(),
  duration: z.number().int().min(0).max(LIMITS.durationMaxMinutes).optional(),
  priority: prioritySchema.optional(),
  subtasks: z.array(subtaskInputSchema).max(LIMITS.subtasksPerTodoMax).optional(),
  recurrence: recurrenceSchema.nullish(),
  habitId: z.string().min(1).max(64).nullish(),
});
export type CreateTodoInput = z.infer<typeof createTodoSchema>;

/** PATCH body — recurrence is immutable after create (rejected at route level). */
export const updateTodoSchema = createTodoSchema
  .omit({ recurrence: true })
  .partial()
  .extend({ order: z.number().int().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

export const todoSortSchema = z.enum(['priority', 'duration', 'name', 'date_desc']);

/**
 * Query-string boolean. `z.coerce.boolean()` is `Boolean(input)`, so the
 * strings `'false'` and `'0'` coerce to `true` and invert the filter — a real
 * defect for any non-web API client. This strict parser accepts a native
 * boolean OR the strings `'true'`/`'1'`/`'false'`/`'0'`; the empty string (a
 * query param present with no value) is treated as absent; anything else is
 * rejected. Web only ever sends `true`, which still passes.
 */
export const queryBooleanSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .union([
      z.boolean(),
      z.enum(['true', '1', 'false', '0']).transform((v) => v === 'true' || v === '1'),
    ])
    .optional(),
);

export const listTodosQuerySchema = z.object({
  q: z.string().trim().optional(),
  tags: z.string().optional(), // csv of tag ids
  priority: prioritySchema.optional(),
  status: z.enum(['active', 'completed']).optional(),
  flagged: queryBooleanSchema,
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
  minDuration: z.coerce.number().int().min(0).optional(),
  maxDuration: z.coerce.number().int().min(0).optional(),
  taskNumber: z.coerce.number().int().min(1).optional(),
  includeArchived: queryBooleanSchema,
  sortBy: todoSortSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;

export const similarTodosQuerySchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.todoTitleMax),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  threshold: z.coerce.number().min(0.1).max(1).default(0.3),
});
export type SimilarTodosQuery = z.infer<typeof similarTodosQuerySchema>;

export const batchActionSchema = z.enum(['complete', 'uncomplete', 'archive', 'restore']);
export const batchTodosSchema = z.object({
  action: batchActionSchema,
  ids: z.array(z.string().min(1)).min(1).max(LIMITS.batchIdsMax),
});
export type BatchTodosInput = z.infer<typeof batchTodosSchema>;

export const batchItemStatusSchema = z.enum([
  'completed',
  'uncompleted',
  'archived',
  'restored',
  'already_active',
  'not_found',
  'error',
]);
export const batchResultSchema = z.object({
  action: batchActionSchema,
  results: z.array(
    z.object({
      id: z.string(),
      status: batchItemStatusSchema,
      reason: z.string().optional(),
    }),
  ),
});
export type BatchResult = z.infer<typeof batchResultSchema>;

export const addSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.subtaskTitleMax),
});
export const updateSubtaskSchema = z
  .object({
    title: z.string().trim().min(1).max(LIMITS.subtaskTitleMax).optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.isCompleted !== undefined, {
    message: 'Provide title and/or isCompleted',
  });
