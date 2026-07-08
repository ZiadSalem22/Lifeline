import { z } from 'zod';
import { DAY_NAMES, ROLES } from './constants.js';

export const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  timezone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  startDayOfWeek: z.enum(DAY_NAMES),
  onboardingCompleted: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().pipe(z.email()).optional(),
  phone: z.string().max(50).nullish(),
  country: z.string().max(100).nullish(),
  city: z.string().max(100).nullish(),
  timezone: z.string().max(100).nullish(),
  avatarUrl: z.string().max(2000).nullish(),
  startDayOfWeek: z.enum(DAY_NAMES).optional(),
  onboardingCompleted: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const settingsSchema = z.object({
  theme: z.string().min(1),
  locale: z.string().min(1),
  layout: z.record(z.string(), z.unknown()),
});
export type Settings = z.infer<typeof settingsSchema>;

export const updateSettingsSchema = z
  .object({
    theme: z.string().trim().min(1).max(50).optional(),
    locale: z.string().trim().min(1).max(20).optional(),
    layout: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const roleSchema = z.enum(ROLES);

export const meSchema = z.object({
  id: z.string().min(1),
  email: z.string().nullable(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
  role: roleSchema,
  roles: z.array(z.string()),
  subscriptionStatus: z.string(),
  profile: profileSchema.nullable(),
  settings: settingsSchema.nullable(),
});
export type Me = z.infer<typeof meSchema>;
