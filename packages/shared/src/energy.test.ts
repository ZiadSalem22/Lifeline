import { describe, expect, it } from 'vitest';
import {
  acsmKcalPerMin,
  bmr,
  bmrKatch,
  bmrMifflin,
  cardioKcal,
  dayBalance,
  maintenanceBase,
  metKcalPerMin,
  proposeTarget,
  strengthKcal,
  trendWeight,
} from './energy.js';

/** Golden values hand-computed from the published formulas. */

describe('bmr', () => {
  it('Katch-McArdle from weight + fat% (80 kg @ 18.5% → LBM 65.2 → 1778)', () => {
    expect(Math.round(bmrKatch(80, 18.5))).toBe(1778);
    const r = bmr({
      weightKg: 80,
      fatPct: 18.5,
      heightCm: 0,
      birthYear: 0,
      sex: 'unset',
      currentYear: 2026,
    });
    expect(r).toEqual({ kcal: 1778, method: 'katch' });
  });

  it('falls back to Mifflin-St Jeor (80 kg, 180 cm, 30 y, male → 1780)', () => {
    expect(bmrMifflin(80, 180, 30, 'male')).toBe(1780);
    expect(bmrMifflin(60, 165, 25, 'female')).toBe(60 * 10 + 6.25 * 165 - 125 - 161);
    const r = bmr({
      weightKg: 80,
      fatPct: 0,
      heightCm: 180,
      birthYear: 1996,
      sex: 'male',
      currentYear: 2026,
    });
    expect(r).toEqual({ kcal: 1780, method: 'mifflin' });
  });

  it('returns null rather than guessing when inputs are missing', () => {
    expect(
      bmr({
        weightKg: 0,
        fatPct: 18,
        heightCm: 180,
        birthYear: 1996,
        sex: 'male',
        currentYear: 2026,
      }),
    ).toBeNull();
    expect(
      bmr({
        weightKg: 80,
        fatPct: 0,
        heightCm: 0,
        birthYear: 1996,
        sex: 'male',
        currentYear: 2026,
      }),
    ).toBeNull();
    expect(
      bmr({ weightKg: 80, fatPct: 0, heightCm: 180, birthYear: 0, sex: 'male', currentYear: 2026 }),
    ).toBeNull();
    expect(
      bmr({
        weightKg: 80,
        fatPct: 0,
        heightCm: 180,
        birthYear: 1996,
        sex: 'unset',
        currentYear: 2026,
      }),
    ).toBeNull();
  });
});

describe('maintenance + target proposal', () => {
  it('applies the lifestyle factor (1778 × 1.375 → 2445)', () => {
    expect(maintenanceBase(1778, 'light')).toBe(2445);
    expect(maintenanceBase(1778, 'sedentary')).toBe(Math.round(1778 * 1.2));
  });

  it('cut proposal subtracts rate×7700/7 (0.5 kg/wk → −550/day)', () => {
    const p = proposeTarget(1778, 'light', { mode: 'cut', rateKgPerWeek: 0.5 }, 80);
    expect(p.kcal).toBe(2445 - 550);
    expect(p.warnings).toEqual([]);
  });

  it('maintain ignores rate; bulk adds a surplus', () => {
    expect(proposeTarget(1778, 'light', { mode: 'maintain', rateKgPerWeek: 1 }, 80).kcal).toBe(
      2445,
    );
    expect(proposeTarget(1778, 'light', { mode: 'bulk', rateKgPerWeek: 0.25 }, 80).kcal).toBe(
      2445 + 275,
    );
  });

  it('warns on aggressive rates (>0.75% BW/week) and floors at BMR', () => {
    const aggressive = proposeTarget(1778, 'light', { mode: 'cut', rateKgPerWeek: 1 }, 80);
    expect(aggressive.warnings.some((w) => w.includes('muscle loss'))).toBe(true);
    // Bulk gets bulk-appropriate copy, not the cut warning.
    const bulky = proposeTarget(1778, 'light', { mode: 'bulk', rateKgPerWeek: 1 }, 80);
    expect(bulky.warnings.some((w) => w.includes('fat gain'))).toBe(true);
    // 55 kg @ 1 kg/wk from a sedentary base → raw target below BMR → floored.
    const floored = proposeTarget(1400, 'sedentary', { mode: 'cut', rateKgPerWeek: 1 }, 55);
    expect(floored.kcal).toBe(1400);
    expect(floored.warnings.some((w) => w.includes('floored'))).toBe(true);
  });

  it('clamps proposals to the targets.kcal schema bounds [500, 10000]', () => {
    // Implausible profiles (weight typos) must not produce a target the
    // settings schema rejects — that would fail the whole settings save.
    const low = proposeTarget(300, 'sedentary', { mode: 'maintain', rateKgPerWeek: 0.5 }, 3);
    expect(low.kcal).toBe(500);
    expect(low.warnings.some((w) => w.includes('implausible'))).toBe(true);
    const high = proposeTarget(8146, 'light', { mode: 'maintain', rateKgPerWeek: 0.5 }, 400);
    expect(high.kcal).toBe(10_000);
    expect(high.warnings.some((w) => w.includes('implausible'))).toBe(true);
  });
});

describe('dayBalance', () => {
  it('intake − (maintenance + exercise); null when nothing logged', () => {
    expect(dayBalance(1900, 3, 2445, 180)).toBe(1900 - 2625);
    expect(dayBalance(0, 0, 2445, 180)).toBeNull();
    // A logged 0-kcal fast is a real (huge) deficit, not unknown.
    expect(dayBalance(0, 1, 2000, 0)).toBe(-2000);
  });
});

describe('trendWeight', () => {
  it('EMA smooths noise and carries through gaps', () => {
    const t = trendWeight([80, null, 81, 80.2]);
    expect(t[0]).toBe(80);
    expect(t[1]).toBe(80); // gap carries the trend
    expect(t[2]).toBe(80.25); // 80 + 0.25×(81−80)
    expect(t[3]).toBeCloseTo(80.24, 2);
  });
});

describe('cardio kcal (MET + ACSM)', () => {
  it('flat MET path matches the classic formula', () => {
    // walk MET 3.5 @ 80 kg → 4.9 kcal/min
    expect(metKcalPerMin('walk', 80)).toBeCloseTo(4.9, 5);
    expect(cardioKcal({ effort: 'walk', kmh: 0, incline: 0 }, 80, 30)).toBeCloseTo(147, 0);
  });

  it('ACSM walking: 5 km/h flat vs 5% incline @ 80 kg', () => {
    // s = 83.33 m/min → flat VO2 = 3.5 + 8.333 = 11.83 → ×80/200 = 4.73 kcal/min
    expect(acsmKcalPerMin(5, 0, 80)).toBeCloseTo(4.73, 2);
    // +5% grade: VO2 += 1.8×83.33×0.05 = 7.5 → 19.33 → 7.73 kcal/min
    expect(acsmKcalPerMin(5, 5, 80)).toBeCloseTo(7.73, 2);
    // The user's question: "walk 30 min at this speed and incline" → ~232 kcal
    expect(cardioKcal({ effort: 'walk', kmh: 5, incline: 5 }, 80, 30)).toBeCloseTo(232, 0);
  });

  it('running equation kicks in ≥8 km/h and the blend is monotonic in speed', () => {
    // 10 km/h flat: s=166.7 → VO2 = 3.5 + 33.33 = 36.83 → ×80/200 = 14.73
    expect(acsmKcalPerMin(10, 0, 80)).toBeCloseTo(14.73, 2);
    const at64 = acsmKcalPerMin(6.4, 0, 80);
    const at72 = acsmKcalPerMin(7.2, 0, 80);
    const at80 = acsmKcalPerMin(8, 0, 80);
    expect(at72).toBeGreaterThan(at64);
    expect(at80).toBeGreaterThan(at72);
  });

  it('never fakes a number without body weight', () => {
    expect(cardioKcal({ effort: 'run', kmh: 10, incline: 0 }, 0, 30)).toBe(0);
  });
});

describe('strengthKcal', () => {
  it('≈15 kcal/set at 80 kg (3.5 MET × 3 min/set) — ~235 for a 16-set session', () => {
    expect(strengthKcal(1, 80)).toBeCloseTo(14.7, 1);
    expect(strengthKcal(16, 80)).toBeCloseTo(235.2, 1);
  });

  it('0 without body weight or sets', () => {
    expect(strengthKcal(16, 0)).toBe(0);
    expect(strengthKcal(0, 80)).toBe(0);
  });
});
