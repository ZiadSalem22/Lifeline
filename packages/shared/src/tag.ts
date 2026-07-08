import { z } from 'zod';
import { LIMITS } from './constants.js';

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected hex color like #3B82F6');

export const tagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(LIMITS.tagNameMax),
  color: z.string().min(1),
  userId: z.string().nullable(),
  isDefault: z.boolean(),
});
export type Tag = z.infer<typeof tagSchema>;

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.tagNameMax),
  color: hexColorSchema,
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.tagNameMax).optional(),
    color: hexColorSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: 'Provide name and/or color',
  });
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
