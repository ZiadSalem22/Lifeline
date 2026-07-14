import type { DailyPlanSettings, GymExercise } from './daily-plan.js';

/**
 * Energy engine — every kcal number in the app (maintenance, targets, burn,
 * balance) derives from these pure functions so the plan card, Statistics,
 * Review, guest mode, and the MCP tools can never disagree.
 *
 * Honesty rules (match the app's existing convention):
 * - Estimates are estimates: callers render "~" and round; nothing here fakes
 *   precision beyond whole kcal.
 * - Missing inputs → null, never a guessed number.
 * - Exercise burn is ADDED to maintenance for the day's balance, and intake
 *   targets are set from the pre-exercise baseline — burn never silently
 *   inflates "you can eat more" (the existing never-net-into-the-ring ADR).
 */

/* ── BMR ─────────────────────────────────────────────────────────────────── */

export type BmrMethod = 'katch' | 'mifflin';

export interface BmrResult {
  kcal: number;
  method: BmrMethod;
}

export interface BmrInputs {
  weightKg: number;
  /** Body-fat %; 0 = unset. */
  fatPct: number;
  /** cm; 0 = unset. */
  heightCm: number;
  /** 0 = unset. */
  birthYear: number;
  sex: 'male' | 'female' | 'unset';
  /** Calendar year "today" — passed in so the lib stays clock-free. */
  currentYear: number;
}

/** Katch-McArdle: BMR = 370 + 21.6 × lean body mass (kg). */
export function bmrKatch(weightKg: number, fatPct: number): number {
  const lbm = weightKg * (1 - fatPct / 100);
  return 370 + 21.6 * lbm;
}

/** Mifflin-St Jeor: 10w + 6.25h − 5a + (male +5 / female −161). */
export function bmrMifflin(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female',
): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/**
 * Best available BMR: Katch-McArdle when fat% is logged (uses the measurement
 * the user actually took), else Mifflin-St Jeor when height/age/sex are all
 * present, else null — never a guess.
 */
export function bmr(inputs: BmrInputs): BmrResult | null {
  if (inputs.weightKg <= 0) return null;
  if (inputs.fatPct > 0 && inputs.fatPct < 100) {
    return { kcal: Math.round(bmrKatch(inputs.weightKg, inputs.fatPct)), method: 'katch' };
  }
  const age = inputs.birthYear > 0 ? inputs.currentYear - inputs.birthYear : 0;
  if (inputs.heightCm > 0 && age >= 10 && age <= 120 && inputs.sex !== 'unset') {
    return {
      kcal: Math.round(bmrMifflin(inputs.weightKg, inputs.heightCm, age, inputs.sex)),
      method: 'mifflin',
    };
  }
  return null;
}

/* ── Activity / maintenance ──────────────────────────────────────────────── */

/**
 * Multiplier for lifestyle OUTSIDE logged workouts. Deliberately shifted a
 * step below the classic Harris factors (which bake exercise in) because
 * logged cardio kcal is added on top — the standard NEAT-baseline + logged-EAT
 * model. Picking by job/steps, not by training volume.
 */
export const ACTIVITY_FACTOR: Record<DailyPlanSettings['profile']['activity'], number> = {
  sedentary: 1.2, // desk job, little walking
  light: 1.375, // some walking, on your feet a few hours
  moderate: 1.55, // active job or lots of daily walking
  active: 1.725, // physically demanding job
  very: 1.9, // hard labor / athlete-level daily movement
};

/** Pre-exercise maintenance for a day: BMR × lifestyle factor. */
export function maintenanceBase(bmrKcal: number, activity: keyof typeof ACTIVITY_FACTOR): number {
  return Math.round(bmrKcal * ACTIVITY_FACTOR[activity]);
}

/* ── Goal → proposed calorie target ──────────────────────────────────────── */

export const KCAL_PER_KG = 7700;

export interface TargetProposal {
  kcal: number;
  /** Human-readable cautions (rate too aggressive, target floored, ...). */
  warnings: string[];
}

/**
 * Daily calorie target from goal mode + rate, off the PRE-exercise
 * maintenance (targets are set ahead of the day; logged burn then deepens the
 * realized deficit rather than licensing extra intake). Clamps: warn above
 * ~0.75% bodyweight/week, floor at max(BMR, 1200) so a cut never proposes
 * eating below measured basal needs.
 */
export function proposeTarget(
  bmrKcal: number,
  activity: keyof typeof ACTIVITY_FACTOR,
  goal: DailyPlanSettings['goal'],
  weightKg: number,
): TargetProposal {
  const base = maintenanceBase(bmrKcal, activity);
  const warnings: string[] = [];
  const sign = goal.mode === 'cut' ? -1 : goal.mode === 'bulk' ? 1 : 0;
  const rate = goal.mode === 'maintain' ? 0 : goal.rateKgPerWeek;
  // Sustainable-rate guardrail: ~0.75% of bodyweight per week.
  if (weightKg > 0 && rate > weightKg * 0.0075) {
    warnings.push(
      goal.mode === 'bulk'
        ? `~${rate} kg/week is aggressive for ${Math.round(weightKg)} kg — expect mostly fat gain`
        : `~${rate} kg/week is aggressive for ${Math.round(weightKg)} kg — expect muscle loss / fatigue`,
    );
  }
  let kcal = Math.round(base + (sign * rate * KCAL_PER_KG) / 7);
  const floor = Math.max(Math.round(bmrKcal), 1200);
  if (goal.mode === 'cut' && kcal < floor) {
    kcal = floor;
    warnings.push(
      'target floored at your BMR — pick a slower rate instead of eating below basal needs',
    );
  }
  // targets.kcal accepts [500, 10000] — an out-of-range write fails the WHOLE
  // settings save, so the proposal must stay inside the schema bounds. Out of
  // range here almost always means a weight/fat typo; say so.
  if (kcal < 500 || kcal > 10_000) {
    kcal = Math.min(10_000, Math.max(500, kcal));
    warnings.push(
      'that maintenance looks implausible — double-check your weight and fat % entries',
    );
  }
  return { kcal, warnings };
}

/* ── Day energy balance ──────────────────────────────────────────────────── */

/**
 * Realized balance for a logged day: intake − (maintenance + logged exercise).
 * Negative = deficit. Null when there is no intake logged (an empty diary is
 * "unknown", not a 3000-kcal deficit) — mealCount distinguishes a true 0-kcal
 * fast (still logged) from nothing logged.
 */
export function dayBalance(
  kcalIn: number,
  mealCount: number,
  maintenanceKcal: number,
  exerciseKcal: number,
): number | null {
  if (mealCount <= 0) return null;
  return Math.round(kcalIn - (maintenanceKcal + exerciseKcal));
}

/* ── Trend weight (EMA) ──────────────────────────────────────────────────── */

/**
 * Exponentially-smoothed weight over a (nullable) daily series — daily scale
 * noise is ±1-2 kg of water; the trend is what a cut is steering. α=0.25,
 * gaps carry the last trend forward without decay.
 */
export function trendWeight(series: Array<number | null>, alpha = 0.25): Array<number | null> {
  let ema: number | null = null;
  return series.map((kg) => {
    if (kg === null || kg <= 0) return ema;
    ema = ema === null ? kg : ema + alpha * (kg - ema);
    return Math.round(ema * 100) / 100;
  });
}

/* ── Cardio kcal: MET table + ACSM equations ─────────────────────────────── */

/** MET per intensity class — 2011 Compendium values (flat-ground defaults). */
export const CARDIO_MET: Record<GymExercise['effort'], number> = {
  walk: 3.5,
  jog: 7.0,
  run: 9.8,
};

/** Flat MET estimate: kcal/min = MET × 3.5 × kg / 200. */
export function metKcalPerMin(effort: GymExercise['effort'], weightKg: number): number {
  return (CARDIO_MET[effort] * 3.5 * weightKg) / 200;
}

/**
 * ACSM metabolic equations → kcal/min at a given speed + incline.
 * VO2 (ml/kg/min): walking = 3.5 + 0.1·s + 1.8·s·g; running = 3.5 + 0.2·s + 0.9·s·g
 * where s = speed in m/min, g = grade fraction. kcal/min ≈ VO2 × kg / 200
 * (5 kcal per litre O2). Walking equation is validated ≤ ~6.4 km/h and the
 * running one ≥ ~8 km/h; between them we blend linearly rather than jump.
 */
export function acsmKcalPerMin(kmh: number, inclinePct: number, weightKg: number): number {
  const s = (kmh * 1000) / 60; // m/min
  const g = inclinePct / 100;
  const walkVo2 = 3.5 + 0.1 * s + 1.8 * s * g;
  const runVo2 = 3.5 + 0.2 * s + 0.9 * s * g;
  let vo2: number;
  if (kmh <= 6.4) vo2 = walkVo2;
  else if (kmh >= 8) vo2 = runVo2;
  else {
    const t = (kmh - 6.4) / (8 - 6.4);
    vo2 = walkVo2 * (1 - t) + runVo2 * t;
  }
  return (vo2 * weightKg) / 200;
}

/**
 * Calories for `minutes` of a timed exercise: ACSM (incline-aware) when a
 * speed is set, flat MET table otherwise. Returns 0 when weight is unknown
 * (never fake it) — same contract as the original cardioKcal.
 */
export function cardioKcal(
  ex: Pick<GymExercise, 'effort' | 'kmh' | 'incline'>,
  weightKg: number,
  minutes: number,
): number {
  if (weightKg <= 0 || minutes <= 0) return 0;
  const perMin =
    ex.kmh > 0 ? acsmKcalPerMin(ex.kmh, ex.incline, weightKg) : metKcalPerMin(ex.effort, weightKg);
  return perMin * minutes;
}
