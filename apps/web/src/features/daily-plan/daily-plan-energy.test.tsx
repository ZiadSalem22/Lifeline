import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultDailyPlanSettings, emptyDailyPlanData } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';
import { PlanSettingsModal } from './PlanSettingsModal';

/**
 * Energy engine UI: the Meals card's BMR/maintenance/deficit ledger, the
 * Customize panel's goal → proposed-target flow, and the workout card's
 * quick-cardio logger (the "walk 30 min at this speed and incline" answer).
 * Golden values match energy.test.ts in packages/shared.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe('Meals energy ledger', () => {
  it('shows BMR, maintenance, and the realized deficit from a Katch-McArdle profile', async () => {
    // 80 kg @ 18.5% fat → BMR 1778 (katch); default lifestyle "light" → 2445.
    window.localStorage.setItem(
      'daily_plan:2026-07-09',
      JSON.stringify({
        weight: 80,
        body: { fat: 18.5 },
        meals: { breakfast: [{ n: 'Eggs & toast', cal: 500, p: 30, c: 5, f: 35 }] },
      }),
    );
    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="2026-07-09" todos={[]} />
      </ThemeProvider>,
    );

    expect(await screen.findByText('~1,778')).toBeInTheDocument();
    expect(screen.getByText('~2,445')).toBeInTheDocument();
    // 500 in − 2445 maintenance (no cardio logged) → deficit 1945.
    expect(screen.getByText('Deficit')).toBeInTheDocument();
    expect(screen.getByText('−~1,945')).toBeInTheDocument();
    // Masthead summary ring: 2400 target − 500 eaten → 1,900 left + deficit label.
    expect(screen.getByLabelText('1,900 kcal left of 2,400')).toBeInTheDocument();
    expect(screen.getByText('~1,945 deficit')).toBeInTheDocument();
  });

  it('nudges toward setup instead of guessing when there is no usable profile', async () => {
    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="2026-07-09" todos={[]} />
      </ThemeProvider>,
    );
    expect(
      await screen.findByRole('button', { name: /Set up energy tracking/ }),
    ).toBeInTheDocument();
  });
});

describe('Body & goal section', () => {
  it('proposes a cut target from BMR × lifestyle − rate and applies it on USE', async () => {
    const settings = defaultDailyPlanSettings();
    settings.goal = { mode: 'cut', rateKgPerWeek: 0.5, autoTarget: false, creditPct: 0 };
    const patchSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <PlanSettingsModal
        open
        onClose={() => undefined}
        settings={settings}
        patchSettings={patchSettings}
        day={emptyDailyPlanData()}
        dateStr="2026-07-09"
        weightKg={80}
        fatPct={18.5}
      />,
    );

    // 1778 × 1.375 = 2445 maintenance; cut 0.5 kg/wk → −550 → 1895.
    expect(screen.getByText('~1,895 kcal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /USE ~1,895 AS DAILY KCAL TARGET/ }));
    expect(patchSettings).toHaveBeenCalledWith({
      targets: { ...settings.targets, kcal: 1895 },
    });
  });
});

const pad2 = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const todayKey = `daily_plan:${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

describe('Goal-driven energy v2', () => {
  it('AUTO target: a declared cut materializes the goal target into the ring (today only)', async () => {
    const settings = defaultDailyPlanSettings();
    settings.goal = { mode: 'cut', rateKgPerWeek: 0.5, autoTarget: true, creditPct: 0 };
    window.localStorage.setItem('daily_plan_settings', JSON.stringify(settings));
    // 80 kg @ 18.5% → BMR 1778 → light 2445 → cut 0.5 → 1895.
    window.localStorage.setItem(todayKey, JSON.stringify({ weight: 80, body: { fat: 18.5 } }));

    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="today" todos={[]} />
      </ThemeProvider>,
    );

    expect(await screen.findByText('kcal left of 1,895')).toBeInTheDocument();
    // The ledger frames the deficit against the plan (cut 0.5 → −550/day).
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('−550')).toBeInTheDocument();
    // Persisted, so Statistics/metrics see the same target.
    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem('daily_plan_settings') ?? '{}',
      ) as typeof settings;
      expect(stored.targets.kcal).toBe(1895);
    });
  });

  it('strength sets burn honestly and creditPct feeds the budget explicitly', async () => {
    const settings = defaultDailyPlanSettings();
    settings.goal = { mode: 'maintain', rateKgPerWeek: 0.5, autoTarget: false, creditPct: 100 };
    window.localStorage.setItem('daily_plan_settings', JSON.stringify(settings));
    window.localStorage.setItem(
      'daily_plan:2026-07-09',
      JSON.stringify({
        weight: 80,
        body: { fat: 18.5 },
        strengthDone: { push: { sets: 16, kcal: 235 } },
        meals: { breakfast: [{ n: 'Eggs & toast', cal: 500, p: 30, c: 5, f: 35 }] },
      }),
    );

    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="2026-07-09" todos={[]} />
      </ThemeProvider>,
    );

    // Budget = 2400 + 100% × 235 = 2635; eaten 500 → 2,135 left, flagged.
    expect(await screen.findByText('kcal left of 2,635 (+235 exercise)')).toBeInTheDocument();
    // Ledger maintenance includes the strength burn: 2445 + 235 = 2680,
    // realized deficit 500 − 2680 = −2180 (credit never touches the ledger).
    expect(screen.getByText('~2,680')).toBeInTheDocument();
    expect(screen.getByText('−~2,180')).toBeInTheDocument();
    // Both the workout card and the meals card surface the strength burn.
    expect(screen.getAllByText(/~235 kcal burned/).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Quick cardio', () => {
  it('previews the ACSM estimate live and logs it into the day cardio total', async () => {
    // 80 kg, defaults 30 min @ 5 km/h flat → ~142 kcal (4.733 kcal/min × 30).
    window.localStorage.setItem('daily_plan:2026-07-09', JSON.stringify({ weight: 80 }));
    const user = userEvent.setup();
    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="2026-07-09" todos={[]} />
      </ThemeProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '+ Quick cardio' }));
    expect(screen.getByText('~142 kcal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log quick cardio' }));
    // Both the workout card and the meals card surface the burn — assert the
    // persisted truth (debounced flush) plus at least one visible line.
    await waitFor(
      () => {
        const blob = JSON.parse(window.localStorage.getItem('daily_plan:2026-07-09') ?? '{}') as {
          cardioDone?: Record<string, { kcal: number; min: number }>;
        };
        expect(blob.cardioDone?.quick?.kcal).toBe(142);
        expect(blob.cardioDone?.quick?.min).toBe(30);
      },
      { timeout: 4000 },
    );
    expect((await screen.findAllByText(/~142 kcal burned/)).length).toBeGreaterThan(0);
  });
});
