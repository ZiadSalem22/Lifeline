import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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
  it('a new day is prefilled from the weekday template (no carry bar off-today)', async () => {
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
    // Nothing lands in day.quick anymore, and the carry bar is a TODAY-only
    // ritual — a past date viewed later must not offer "yesterday" items.
    expect(screen.queryByText('Prep gym bag')).not.toBeInTheDocument();
    expect(screen.queryByText(/unfinished item/)).not.toBeInTheDocument();
  });

  it("today's carry bar turns yesterday's leftovers into real tasks, once", async () => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = fmt(new Date());
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yesterday = dailyPlanDataSchema.parse({
      tomorrow: [{ t: 'Prep gym bag', done: false }],
      quick: [{ t: 'Call bank', done: false }],
    });
    window.localStorage.setItem(`daily_plan:${fmt(yest)}`, JSON.stringify(yesterday));

    renderPlan('today');
    expect(await screen.findByText(/2 unfinished items from yesterday/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add as tasks' }));
    // Both carried items became REAL guest tasks due today.
    await waitFor(() => {
      const raw = window.localStorage.getItem('guest_todos');
      expect(raw).not.toBeNull();
      const todos = JSON.parse(raw as string) as { title: string; dueDate: string | null }[];
      const titles = todos.map((t) => t.title);
      expect(titles).toContain('Call bank');
      expect(titles).toContain('Prep gym bag');
      expect(todos.every((t) => t.dueDate === todayStr)).toBe(true);
    });
    await waitFor(() =>
      expect(screen.queryByText(/unfinished items from yesterday/)).not.toBeInTheDocument(),
    );
    // The outcome persists (carryHandled) — a reload must not re-offer.
    await waitFor(() => {
      const raw = window.localStorage.getItem(`daily_plan:${todayStr}`);
      expect(raw).not.toBeNull();
      expect((JSON.parse(raw as string) as { carryHandled: boolean }).carryHandled).toBe(true);
    });
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
