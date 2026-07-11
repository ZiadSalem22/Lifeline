import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dailyPlanDataSchema, defaultDailyPlanSettings } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * Personalization: the Customize panel edits everything (habits, targets,
 * words), day templates + yesterday's Tomorrow Plan prefill new days, and
 * unfinished items offer a one-tap carry-over.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan(dayToken = '2026-07-09') {
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken={dayToken} todos={[]} />
    </ThemeProvider>,
  );
}

describe('customize panel', () => {
  it('adds a habit and edits the motto through the panel', async () => {
    const user = userEvent.setup();
    renderPlan();

    await user.click(await screen.findByRole('button', { name: 'CUSTOMIZE' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: '+ Add habit' }));
    const newHabit = within(dialog).getByDisplayValue('New habit');
    await user.clear(newHabit);
    await user.type(newHabit, 'Read Quran');

    const motto = within(dialog).getByLabelText('Motto');
    await user.clear(motto);
    await user.type(motto, 'Bismillah.');

    await user.keyboard('{Escape}');
    // The tracker shows the new habit row; the motto line updates.
    expect(await screen.findByText('Read Quran')).toBeInTheDocument();
    expect(screen.getByText('Bismillah.')).toBeInTheDocument();
    // And it persists to guest settings.
    await waitFor(
      () => {
        const raw = window.localStorage.getItem('daily_plan_settings');
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw as string) as {
          habits: { label: string }[];
          motto: string;
        };
        expect(parsed.habits.some((h) => h.label === 'Read Quran')).toBe(true);
        expect(parsed.motto).toBe('Bismillah.');
      },
      { timeout: 3000 },
    );
  });

  it('deleting a habit removes its tracker row', async () => {
    const user = userEvent.setup();
    renderPlan();
    expect(await screen.findByText('Brush Teeth')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'CUSTOMIZE' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete habit Brush Teeth' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByText('Brush Teeth')).not.toBeInTheDocument();
  });
});

describe('day continuity', () => {
  it('a new day is prefilled from the weekday template + yesterday tomorrow-plan', async () => {
    // Seed settings with a Thursday template and yesterday's plan row.
    const settings = defaultDailyPlanSettings();
    settings.templates = {
      thu: {
        schedule: { '06:00': 'Gym — Push' },
        priorities: ['Ship personalization'],
        quick: [],
      },
    };
    window.localStorage.setItem('daily_plan_settings', JSON.stringify(settings));
    const yesterday = dailyPlanDataSchema.parse({
      tomorrow: [{ t: 'Prep gym bag', done: false }],
      quick: [{ t: 'Call bank', done: false }],
    });
    window.localStorage.setItem('daily_plan:2026-07-08', JSON.stringify(yesterday));

    renderPlan('2026-07-09');

    // Template schedule + priority prefill (display-only materialization).
    expect(await screen.findByDisplayValue('Gym — Push')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ship personalization')).toBeInTheDocument();
    // Yesterday's tomorrow-plan item landed as a quick to-do.
    expect(screen.getByText('Prep gym bag')).toBeInTheDocument();
    // Unfinished quick item offers a carry-over.
    expect(screen.getByText(/1 unfinished item from yesterday/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Carry over' }));
    expect(await screen.findByText('Call bank')).toBeInTheDocument();
    expect(screen.queryByText(/unfinished item from yesterday/)).not.toBeInTheDocument();
  });
});

describe('personal suggestions', () => {
  it('recent meals from past days appear as one-tap chips', async () => {
    const past = dailyPlanDataSchema.parse({
      meals: { lunch: [{ n: 'Chicken & rice', cal: 700, p: 50, c: 70, f: 18 }] },
    });
    window.localStorage.setItem('daily_plan:2026-07-08', JSON.stringify(past));

    renderPlan('2026-07-09');
    const chipText = await screen.findByText('Chicken & rice');
    const chip = chipText.closest('button') as HTMLElement;
    const user = userEvent.setup();
    await user.click(chip);
    // Logged into a diary slot → kcal badge reflects it.
    expect(await screen.findByText(/700 \/ 2,400 KCAL/)).toBeInTheDocument();
  });
});
