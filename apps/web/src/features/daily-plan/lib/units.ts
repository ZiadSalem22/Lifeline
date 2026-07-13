import type { DailyPlanSettings } from '@lifeline/shared';

/**
 * Unit conversion for body metrics. Storage is ALWAYS canonical — weight in kg,
 * lengths in cm — so every downstream consumer (metrics extractor, Statistics,
 * Review) keeps working unit-blind. These helpers convert only at the UI edge:
 * canonical → display on read, display → canonical on write.
 */

export type WeightUnit = DailyPlanSettings['units']['weight']; // 'kg' | 'lb'
export type LengthUnit = DailyPlanSettings['units']['length']; // 'cm' | 'in'

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Canonical kg → the display value in the chosen unit (rounded to 0.1). */
export function toWeightDisplay(kg: number, unit: WeightUnit): number {
  return round1(unit === 'lb' ? kg * LB_PER_KG : kg);
}

/** A value typed in the chosen unit → canonical kg (rounded to 0.1). */
export function fromWeightDisplay(value: number, unit: WeightUnit): number {
  return round1(unit === 'lb' ? value / LB_PER_KG : value);
}

/** Canonical cm → the display value in the chosen unit (rounded to 0.1). */
export function toLengthDisplay(cm: number, unit: LengthUnit): number {
  return round1(unit === 'in' ? cm / CM_PER_IN : cm);
}

/** A value typed in the chosen unit → canonical cm (rounded to 0.1). */
export function fromLengthDisplay(value: number, unit: LengthUnit): number {
  return round1(unit === 'in' ? value * CM_PER_IN : value);
}
