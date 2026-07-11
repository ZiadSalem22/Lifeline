import { z } from 'zod';
import { dateOnlySchema } from './todo.js';

/**
 * Daily Plan — the per-day "command center" companion to the task list.
 *
 * Storage model (mirrors the server tables):
 * - one `DailyPlanData` blob per (user, date): schedule, priorities, habit
 *   checkmarks for THAT day, quick to-dos, meals diary, water, journals,
 *   mood, tomorrow plan, non-negotiables, food-log chat, workout progress;
 * - one `DailyPlanSettings` blob per user: card layout (order/width/hidden),
 *   density, the habit list, gym routines + weekly split + PRs, saved meal
 *   presets, macro targets, and the optional real-task sync hooks.
 *
 * Every field is optional-with-default so `parse({})` yields a complete,
 * well-formed value — clients and the server share the same normalization.
 * Bounds keep a blob far below the server's 1 MB JSON body limit.
 */

export const PLAN_LIMITS = {
  textMax: 500,
  longTextMax: 2000,
  labelMax: 100,
  keyMax: 40,
  listMax: 64,
  chatMax: 60,
  mealsPerSlotMax: 32,
  exercisesMax: 32,
  routinesMax: 24,
  scheduleRowsMax: 48,
} as const;

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const mealSlotSchema = z.enum(MEAL_SLOTS);

/* ── per-day data ─────────────────────────────────────────────────────────── */

const planText = z.string().max(PLAN_LIMITS.textMax);
const planLongText = z.string().max(PLAN_LIMITS.longTextMax);
const planKey = z.string().min(1).max(PLAN_LIMITS.keyMax);
const macroNumber = z.number().min(0).max(100_000);

export const checkItemSchema = z.object({
  t: planText.default(''),
  done: z.boolean().default(false),
});
export type CheckItem = z.infer<typeof checkItemSchema>;

export const quickItemSchema = z.object({
  id: z.string().max(PLAN_LIMITS.keyMax).optional(),
  t: planText.default(''),
  done: z.boolean().default(false),
});
export type QuickItem = z.infer<typeof quickItemSchema>;

export const mealItemSchema = z.object({
  n: z.string().max(200).default(''),
  cal: macroNumber.default(0),
  p: macroNumber.default(0),
  c: macroNumber.default(0),
  f: macroNumber.default(0),
});
export type MealItem = z.infer<typeof mealItemSchema>;

export const chatFoodSchema = z.object({
  name: z.string().max(200),
  cal: macroNumber,
  p: macroNumber,
  c: macroNumber,
  f: macroNumber,
});
export type ChatFood = z.infer<typeof chatFoodSchema>;

export const chatMessageSchema = z.object({
  who: z.enum(['me', 'ai']),
  t: planLongText.default(''),
  foods: z.array(chatFoodSchema).max(16).optional(),
  presetSaved: z.boolean().optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

const boundedRecord = <V extends z.ZodType>(value: V, max: number) =>
  z
    .record(planKey, value)
    .refine((obj) => Object.keys(obj).length <= max, { message: `At most ${max} keys` });

export const dailyPlanDataSchema = z.object({
  /** 'HH:mm' → what's planned for that hour. */
  schedule: boundedRecord(planText, PLAN_LIMITS.scheduleRowsMax).default({}),
  priorities: z
    .array(checkItemSchema)
    .max(5)
    .default([
      { t: '', done: false },
      { t: '', done: false },
      { t: '', done: false },
    ]),
  /** habitId → done, for THIS day (the week grid writes to 7 day rows). */
  habits: boundedRecord(z.boolean(), PLAN_LIMITS.listMax).default({}),
  quick: z.array(quickItemSchema).max(PLAN_LIMITS.listMax).default([]),
  water: z.number().int().min(0).max(24).default(0),
  focusText: planLongText.default(''),
  gratitude: z.array(planText).max(8).default(['', '', '']),
  reviewWell: planLongText.default(''),
  reviewImprove: planLongText.default(''),
  reviewForward: planLongText.default(''),
  rating: z.number().int().min(0).max(5).default(0),
  moodAm: z.number().int().min(0).max(5).default(0),
  moodPm: z.number().int().min(0).max(5).default(0),
  tomorrow: z
    .array(checkItemSchema)
    .max(8)
    .default([
      { t: '', done: false },
      { t: '', done: false },
      { t: '', done: false },
      { t: '', done: false },
    ]),
  nonnegs: z.array(z.boolean()).max(8).default([false, false, false, false, false]),
  meals: z
    .object({
      breakfast: z.array(mealItemSchema).max(PLAN_LIMITS.mealsPerSlotMax).default([]),
      lunch: z.array(mealItemSchema).max(PLAN_LIMITS.mealsPerSlotMax).default([]),
      dinner: z.array(mealItemSchema).max(PLAN_LIMITS.mealsPerSlotMax).default([]),
      snacks: z.array(mealItemSchema).max(PLAN_LIMITS.mealsPerSlotMax).default([]),
    })
    .default({ breakfast: [], lunch: [], dinner: [], snacks: [] }),
  chat: z.array(chatMessageSchema).max(PLAN_LIMITS.chatMax).default([]),
  /** Last chat/preset log target, so the strip can offer UNDO. */
  lastLog: z
    .object({ slot: mealSlotSchema, count: z.number().int().min(1).max(32) })
    .nullable()
    .default(null),
  /** routineKey → done-set count per exercise index, for THIS day. */
  workoutDone: boundedRecord(
    z.array(z.number().int().min(0).max(20)).max(PLAN_LIMITS.exercisesMax),
    PLAN_LIMITS.routinesMax,
  ).default({}),
  /** Per-day override of the weekly split ("today's routine" chip). */
  workoutRoutine: planKey.nullable().default(null),
});
export type DailyPlanData = z.infer<typeof dailyPlanDataSchema>;

/* ── per-user settings ────────────────────────────────────────────────────── */

export const planHabitSchema = z.object({
  id: planKey,
  label: z.string().min(1).max(PLAN_LIMITS.labelMax),
  salah: z.boolean().default(false),
});
export type PlanHabit = z.infer<typeof planHabitSchema>;

/** The design's 15 default habit rows — first five are the daily prayers. */
export const DEFAULT_PLAN_HABITS: PlanHabit[] = [
  { id: 'fajr', label: 'الفجر', salah: true },
  { id: 'dhuhr', label: 'الظهر', salah: true },
  { id: 'asr', label: 'العصر', salah: true },
  { id: 'maghrib', label: 'المغرب', salah: true },
  { id: 'isha', label: 'العشاء', salah: true },
  { id: 'brush', label: 'Brush Teeth', salah: false },
  { id: 'hairAm', label: 'Morning Hair Routine', salah: false },
  { id: 'hairPm', label: 'Night Hair Routine', salah: false },
  { id: 'udemy', label: '1 Hour Udemy', salah: false },
  { id: 'gym', label: 'Gym Workout', salah: false },
  { id: 'typing', label: 'Keyboard Typing Training', salah: false },
  { id: 'reading', label: 'Reading', salah: false },
  { id: 'deep', label: 'Deep Work (2+ Hours)', salah: false },
  { id: 'stretch', label: 'Stretch / Mobility', salah: false },
  { id: 'sleep', label: 'Sleep by 11 PM', salah: false },
];

export const gymExerciseSchema = z.object({
  n: z.string().max(PLAN_LIMITS.labelMax).default(''),
  sets: z.number().int().min(1).max(10).default(3),
  reps: z.string().max(20).default('10'),
  kg: z.number().min(0).max(2000).default(0),
  last: z.number().min(0).max(2000).default(0),
});
export type GymExercise = z.infer<typeof gymExerciseSchema>;

export const gymRoutineSchema = z.object({
  name: z.string().min(1).max(60),
  ex: z.array(gymExerciseSchema).max(PLAN_LIMITS.exercisesMax).default([]),
});
export type GymRoutine = z.infer<typeof gymRoutineSchema>;

export const gymSettingsSchema = z.object({
  routines: boundedRecord(gymRoutineSchema, PLAN_LIMITS.routinesMax).default({}),
  /** Monday-first routine key per weekday. */
  week: z
    .array(planKey)
    .length(7)
    .default(['push', 'pull', 'legs', 'push', 'pull', 'legs', 'rest']),
  prs: z
    .array(z.object({ n: z.string().max(PLAN_LIMITS.labelMax), v: z.string().max(60) }))
    .max(24)
    .default([]),
});
export type GymSettings = z.infer<typeof gymSettingsSchema>;

export const DEFAULT_GYM_ROUTINES: Record<string, GymRoutine> = {
  push: {
    name: 'Push',
    ex: [
      { n: 'Bench Press', sets: 4, reps: '8', kg: 60, last: 57.5 },
      { n: 'Overhead Press', sets: 3, reps: '10', kg: 40, last: 37.5 },
      { n: 'Incline DB Press', sets: 3, reps: '10', kg: 22.5, last: 20 },
      { n: 'Lateral Raises', sets: 3, reps: '12', kg: 10, last: 10 },
      { n: 'Triceps Pushdown', sets: 3, reps: '12', kg: 25, last: 22.5 },
    ],
  },
  pull: {
    name: 'Pull',
    ex: [
      { n: 'Deadlift', sets: 3, reps: '5', kg: 100, last: 95 },
      { n: 'Pull-Ups', sets: 4, reps: '8', kg: 0, last: 0 },
      { n: 'Barbell Row', sets: 3, reps: '8', kg: 60, last: 57.5 },
      { n: 'Face Pulls', sets: 3, reps: '15', kg: 15, last: 15 },
      { n: 'Biceps Curl', sets: 3, reps: '12', kg: 12.5, last: 12.5 },
    ],
  },
  legs: {
    name: 'Legs',
    ex: [
      { n: 'Squat', sets: 4, reps: '6', kg: 80, last: 77.5 },
      { n: 'Romanian Deadlift', sets: 3, reps: '10', kg: 70, last: 67.5 },
      { n: 'Leg Press', sets: 3, reps: '12', kg: 120, last: 115 },
      { n: 'Calf Raises', sets: 4, reps: '15', kg: 40, last: 40 },
    ],
  },
  rest: { name: 'Rest', ex: [] },
};

export const mealPresetSchema = z.object({
  name: z.string().min(1).max(200),
  cal: macroNumber.default(0),
  p: macroNumber.default(0),
  c: macroNumber.default(0),
  f: macroNumber.default(0),
  pinned: z.boolean().default(false),
});
export type MealPreset = z.infer<typeof mealPresetSchema>;

export const dailyPlanSettingsSchema = z.object({
  density: z.enum(['compact', 'roomy']).default('compact'),
  secOrder: z.array(planKey).max(32).default([]),
  secWide: boundedRecord(z.boolean(), 32).default({}),
  hidden: boundedRecord(z.boolean(), 32).default({}),
  habits: z
    .array(planHabitSchema)
    .max(32)
    .default(() => DEFAULT_PLAN_HABITS.map((h) => ({ ...h }))),
  gym: gymSettingsSchema.default({
    routines: DEFAULT_GYM_ROUTINES,
    week: ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'rest'],
    prs: [
      { n: 'Bench Press', v: '70kg × 5' },
      { n: 'Squat', v: '95kg × 5' },
      { n: 'Deadlift', v: '120kg × 3' },
    ],
  }),
  presets: z
    .array(mealPresetSchema)
    .max(PLAN_LIMITS.listMax)
    .default([
      { name: 'My usual breakfast', cal: 520, p: 32, c: 55, f: 18, pinned: true },
      { name: 'Chicken & rice bowl', cal: 680, p: 48, c: 72, f: 16, pinned: true },
      { name: 'Protein shake + banana', cal: 285, p: 32, c: 33, f: 3, pinned: false },
      { name: 'Shawarma wrap', cal: 550, p: 32, c: 48, f: 24, pinned: false },
    ]),
  targets: z
    .object({
      kcal: z.number().int().min(500).max(10_000).default(2400),
      protein: z.number().int().min(20).max(500).default(180),
      carbs: z.number().int().min(20).max(1000).default(250),
      water: z.number().int().min(1).max(24).default(8),
    })
    .default({ kcal: 2400, protein: 180, carbs: 250, water: 8 }),
  /** Real task auto-completed when today's workout finishes (null = off). */
  gymTaskNumber: z.number().int().min(1).nullable().default(null),
  /** Habit row auto-checked when today's workout finishes. */
  gymHabitId: planKey.default('gym'),
});
export type DailyPlanSettings = z.infer<typeof dailyPlanSettingsSchema>;

/* ── API wire shapes ──────────────────────────────────────────────────────── */

export const dailyPlanDaySchema = z.object({
  date: dateOnlySchema,
  data: dailyPlanDataSchema,
});
export type DailyPlanDay = z.infer<typeof dailyPlanDaySchema>;

export const dailyPlanRangeQuerySchema = z
  .object({ start: dateOnlySchema, end: dateOnlySchema })
  .refine((q) => q.start <= q.end, { message: 'start must be on or before end' });
export type DailyPlanRangeQuery = z.infer<typeof dailyPlanRangeQuerySchema>;

export const dailyPlanRangeResponseSchema = z.object({
  items: z.array(dailyPlanDaySchema),
});
export type DailyPlanRangeResponse = z.infer<typeof dailyPlanRangeResponseSchema>;

export const putDailyPlanDaySchema = z.object({ data: dailyPlanDataSchema });
export type PutDailyPlanDay = z.infer<typeof putDailyPlanDaySchema>;

export const putDailyPlanSettingsSchema = z.object({ data: dailyPlanSettingsSchema });
export type PutDailyPlanSettings = z.infer<typeof putDailyPlanSettingsSchema>;

/** `parse({})` — a complete empty day, shared by web defaults and the server. */
export function emptyDailyPlanData(): DailyPlanData {
  return dailyPlanDataSchema.parse({});
}

/** `parse({})` — the default settings blob. */
export function defaultDailyPlanSettings(): DailyPlanSettings {
  return dailyPlanSettingsSchema.parse({});
}
