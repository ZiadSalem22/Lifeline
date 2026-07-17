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

/** Habit day mark: done / not done / deliberately skipped. */
export const habitMarkSchema = z.union([z.boolean(), z.literal('skip')]);
export type HabitMark = z.infer<typeof habitMarkSchema>;

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
  /**
   * habitId → mark, for THIS day (the week grid writes to 7 day rows).
   * true = done, false = not done, 'skip' = deliberately skipped (sick or
   * travel day) — skipped marks count for neither the score nor a streak
   * break. Old blobs are plain booleans, still valid.
   */
  habits: boundedRecord(habitMarkSchema, PLAN_LIMITS.listMax).default({}),
  quick: z.array(quickItemSchema).max(PLAN_LIMITS.listMax).default([]),
  water: z.number().int().min(0).max(24).default(0),
  /** Body weight (kg) logged for THIS day; 0 = not weighed (0-as-unset). */
  weight: z.number().min(0).max(500).default(0),
  /**
   * Body measurements for THIS day (0 = unset, like weight). Circumferences are
   * CM (canonical) and fat is a percentage; the UI shows them in the user's
   * unit. Entered occasionally, so most days stay 0 — a sparse trend.
   */
  body: z
    .object({
      fat: z.number().min(0).max(100).default(0),
      waist: z.number().min(0).max(500).default(0),
      chest: z.number().min(0).max(500).default(0),
      hips: z.number().min(0).max(500).default(0),
      thigh: z.number().min(0).max(500).default(0),
      arm: z.number().min(0).max(500).default(0),
    })
    .default({ fat: 0, waist: 0, chest: 0, hips: 0, thigh: 0, arm: 0 }),
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
  /**
   * routineKey → cardio SNAPSHOT for THIS day (minutes/km/kcal completed). The
   * card recomputes it from the routine's timed exercises on every dot change
   * (recompute-on-write): the metrics extractor is settings-free and cannot
   * see an exercise's `min`, so cardio has to be denormalized here — and
   * freezing it means later routine edits never rewrite this day's history.
   */
  cardioDone: boundedRecord(
    z.object({
      min: z.number().min(0).max(1440).default(0),
      km: z.number().min(0).max(300).default(0),
      kcal: z.number().min(0).max(5000).default(0),
    }),
    PLAN_LIMITS.routinesMax,
  ).default({}),
  /**
   * routineKey → completed STRENGTH sets + their kcal estimate for THIS day.
   * Snapshotted like cardioDone (same reasons: the settings-free metrics
   * extractor, and frozen history across later routine/weight edits).
   */
  strengthDone: boundedRecord(
    z.object({
      sets: z.number().int().min(0).max(320).default(0),
      kcal: z.number().min(0).max(5000).default(0),
    }),
    PLAN_LIMITS.routinesMax,
  ).default({}),
  /** Per-day override of the weekly split ("today's routine" chip). */
  workoutRoutine: planKey.nullable().default(null),
  /** Carry-over bar handled (added-as-tasks or dismissed) — survives reloads. */
  carryHandled: z.boolean().default(false),
});
export type DailyPlanData = z.infer<typeof dailyPlanDataSchema>;

/* ── per-user settings ────────────────────────────────────────────────────── */

export const planHabitSchema = z.object({
  id: planKey,
  // Empty allowed: the editor autosaves mid-edit; a min(1) here would 400
  // the debounced PUT the instant a field is cleared and revert typing.
  label: z.string().max(PLAN_LIMITS.labelMax).default(''),
  salah: z.boolean().default(false),
  /**
   * User-controlled divider under this row. Tri-state on purpose — NO
   * .default(): when EVERY habit lacks the key the tracker falls back to the
   * legacy rule (divider after the last salah row); once any editor touches
   * dividers it writes explicit true/false onto all habits, so unchecking the
   * last divider means "no divider", not a resurrected legacy one. A default
   * would erase that distinction on every schema round-trip.
   */
  dividerBelow: z.boolean().optional(),
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
  /**
   * 'str' = strength (sets × reps × kg). 'time' = timed/cardio (sets = rounds,
   * `min` = minutes per round, optional `km`, `effort` → MET for the calorie
   * estimate). Absent on legacy blobs → defaults to 'str', so every stored
   * routine keeps parsing byte-compatibly.
   */
  type: z.enum(['str', 'time']).default('str'),
  sets: z.number().int().min(1).max(10).default(3),
  reps: z.string().max(20).default('10'),
  kg: z.number().min(0).max(2000).default(0),
  last: z.number().min(0).max(2000).default(0),
  /** 'time' only: minutes per round (dot). */
  min: z.number().int().min(0).max(600).default(0),
  /** 'time' only: km per round (0 = untracked). */
  km: z.number().min(0).max(200).default(0),
  /** 'time' only: intensity class → MET for the calorie estimate. */
  effort: z.enum(['walk', 'jog', 'run']).default('walk'),
  /**
   * 'time' only: speed (km/h) and incline (% grade). When speed is set the
   * calorie estimate upgrades from the flat MET table to the ACSM walking/
   * running equations (incline-aware); 0 = unset → MET fallback.
   */
  kmh: z.number().min(0).max(25).default(0),
  incline: z.number().min(0).max(20).default(0),
});
export type GymExercise = z.infer<typeof gymExerciseSchema>;

export const gymRoutineSchema = z.object({
  // Empty allowed — autosaving editors (see planHabitSchema.label).
  name: z.string().max(60).default(''),
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

// Parsed through the schema so every default exercise carries the full shape
// (type/min/km/effort) rather than a partial literal.
export const DEFAULT_GYM_ROUTINES: Record<string, GymRoutine> = {
  push: gymRoutineSchema.parse({
    name: 'Push',
    ex: [
      { n: 'Bench Press', sets: 4, reps: '8', kg: 60, last: 57.5 },
      { n: 'Overhead Press', sets: 3, reps: '10', kg: 40, last: 37.5 },
      { n: 'Incline DB Press', sets: 3, reps: '10', kg: 22.5, last: 20 },
      { n: 'Lateral Raises', sets: 3, reps: '12', kg: 10, last: 10 },
      { n: 'Triceps Pushdown', sets: 3, reps: '12', kg: 25, last: 22.5 },
    ],
  }),
  pull: gymRoutineSchema.parse({
    name: 'Pull',
    ex: [
      { n: 'Deadlift', sets: 3, reps: '5', kg: 100, last: 95 },
      { n: 'Pull-Ups', sets: 4, reps: '8', kg: 0, last: 0 },
      { n: 'Barbell Row', sets: 3, reps: '8', kg: 60, last: 57.5 },
      { n: 'Face Pulls', sets: 3, reps: '15', kg: 15, last: 15 },
      { n: 'Biceps Curl', sets: 3, reps: '12', kg: 12.5, last: 12.5 },
    ],
  }),
  legs: gymRoutineSchema.parse({
    name: 'Legs',
    ex: [
      { n: 'Squat', sets: 4, reps: '6', kg: 80, last: 77.5 },
      { n: 'Romanian Deadlift', sets: 3, reps: '10', kg: 70, last: 67.5 },
      { n: 'Leg Press', sets: 3, reps: '12', kg: 120, last: 115 },
      { n: 'Calf Raises', sets: 4, reps: '15', kg: 40, last: 40 },
    ],
  }),
  rest: { name: 'Rest', ex: [] },
};

export const mealPresetSchema = z.object({
  // Empty allowed — autosaving editors (see planHabitSchema.label).
  name: z.string().max(200).default(''),
  cal: macroNumber.default(0),
  p: macroNumber.default(0),
  c: macroNumber.default(0),
  f: macroNumber.default(0),
  pinned: z.boolean().default(false),
});
export type MealPreset = z.infer<typeof mealPresetSchema>;

/** Day-template keys: one per weekday plus a fallback for every day. */
export const TEMPLATE_KEYS = ['all', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** A reusable day skeleton — prefills brand-new days (nothing stored yet). */
export const dayTemplateSchema = z.object({
  schedule: boundedRecord(planText, PLAN_LIMITS.scheduleRowsMax).default({}),
  priorities: z.array(planText).max(5).default([]),
  quick: z.array(planText).max(16).default([]),
});
export type DayTemplate = z.infer<typeof dayTemplateSchema>;

export const DEFAULT_NON_NEGOTIABLES = [
  'Stay Disciplined',
  'Train Hard',
  'Eat Clean',
  'Protect Focus',
  'Finish Strong',
];

export const DEFAULT_MOTTO = 'No excuses. Just execution.';
export const DEFAULT_SUBTITLE = 'discipline · focus · execution';

export const dailyPlanSettingsSchema = z.object({
  density: z.enum(['compact', 'roomy']).default('compact'),
  /** Content text scale inside the plan cards — 's' is the original desktop
      density; 'm' (default) and 'l' step fonts/controls up for phones. */
  textScale: z.enum(['s', 'm', 'l']).default('m'),
  /** Clock display across the plan — 24-hour (default, e.g. 17:30) or 12-hour
      AM/PM (5:30 PM). Times are stored 24h; this only affects rendering. */
  timeFormat: z.enum(['24h', '12h']).default('24h'),
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
  /** Display units — storage stays canonical (weight kg, lengths cm). */
  units: z
    .object({
      weight: z.enum(['kg', 'lb']).default('kg'),
      length: z.enum(['cm', 'in']).default('cm'),
    })
    .default({ weight: 'kg', length: 'cm' }),
  /** Height in cm (canonical); 0 = unset. Near-static, so it lives in settings. */
  height: z.number().min(0).max(300).default(0),
  /**
   * Prayer times: the five salah habits show accurate times fetched by city.
   * method -1 = Auto (let the provider pick the closest authority for the
   * location); 0–23 / 99 are explicit calculation methods. Empty city = the
   * feature is dormant. Seeded once from the user's profile city on first load.
   */
  prayer: z
    .object({
      enabled: z.boolean().default(true),
      city: z.string().max(120).default(''),
      country: z.string().max(120).default(''),
      method: z.number().int().min(-1).max(99).default(-1),
      // Exact coordinates from the city picker — when present the app queries
      // Aladhan by lat/lon (pinpoint) instead of geocoding the city name.
      latitude: z.number().min(-90).max(90).nullable().default(null),
      longitude: z.number().min(-180).max(180).nullable().default(null),
    })
    .default({ enabled: true, city: '', country: '', method: -1, latitude: null, longitude: null }),
  /**
   * Energy profile for BMR/TDEE (see energy.ts). Katch-McArdle needs only
   * weight + fat%; Mifflin-St Jeor needs all four. 'unset'/0 = not provided —
   * the engine returns null rather than guessing.
   */
  profile: z
    .object({
      sex: z.enum(['male', 'female', 'unset']).default('unset'),
      /** Birth year (stable, unlike age); 0 = unset. */
      birthYear: z.number().int().min(0).max(2100).default(0),
      /**
       * Lifestyle OUTSIDE logged workouts (job, steps, chores). Logged cardio
       * is added on top of the multiplier, so picking "moderate" because you
       * train would double-count — the UI copy must say this.
       */
      activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very']).default('light'),
    })
    .default({ sex: 'unset', birthYear: 0, activity: 'light' }),
  /**
   * Weight goal. rateKgPerWeek is a magnitude; the sign comes from mode.
   * autoTarget=true hands targets.kcal to the engine: the plan view
   * materializes the goal-derived target into targets.kcal whenever it
   * drifts (weight change, rate change), so every consumer — ring,
   * masthead, Statistics — stays consistent without threading weight
   * around. false = targets.kcal is hand-set (the pre-goal behavior).
   * creditPct: % of logged exercise kcal credited into TODAY's budget
   * (0 = never eat back exercise, the recommended default; 50/100 for
   * people who insist — the realized deficit in the ledger is unaffected).
   */
  goal: z
    .object({
      mode: z.enum(['cut', 'maintain', 'bulk']).default('maintain'),
      rateKgPerWeek: z.number().min(0).max(1.5).default(0.5),
      // Default TRUE (owner decision): the target should follow the goal out
      // of the box — hand-editing KCAL/DAY is the explicit opt-out.
      autoTarget: z.boolean().default(true),
      creditPct: z.number().int().min(0).max(100).default(0),
    })
    .default({ mode: 'maintain', rateKgPerWeek: 0.5, autoTarget: true, creditPct: 0 }),
  /** Real task auto-completed when today's workout finishes (null = off). */
  gymTaskNumber: z.number().int().min(1).nullable().default(null),
  /** Habit row auto-checked when today's workout finishes. */
  gymHabitId: planKey.default('gym'),
  /* ── personalization (nothing hardcoded) ──────────────────────────────── */
  /** Editable non-negotiable labels (the checks row sizes to this list). */
  nonnegLabels: z
    .array(z.string().max(PLAN_LIMITS.labelMax))
    .max(8)
    .default(() => [...DEFAULT_NON_NEGOTIABLES]),
  motto: z.string().max(PLAN_LIMITS.labelMax).default(DEFAULT_MOTTO),
  subtitle: z.string().max(PLAN_LIMITS.labelMax).default(DEFAULT_SUBTITLE),
  /** Schedule range: first hour (0–23) → last hour (1–24; 24 renders 00:00). */
  dayStartHour: z.number().int().min(0).max(23).default(4),
  dayEndHour: z.number().int().min(1).max(24).default(24),
  priorityCount: z.number().int().min(1).max(5).default(3),
  gratitudeCount: z.number().int().min(1).max(8).default(3),
  tomorrowCount: z.number().int().min(1).max(8).default(4),
  /** Per-weekday day skeletons ('all' = fallback); prefill brand-new days. */
  templates: z.partialRecord(z.enum(TEMPLATE_KEYS), dayTemplateSchema).default({}),
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
