import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * Meals & Nutrition: the demo food-log chat parses text into the right slot,
 * updates the kcal badge, offers UNDO, and pinned presets log with one tap.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan() {
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken="2026-07-09" todos={[]} />
    </ThemeProvider>,
  );
}

describe('meals & nutrition', () => {
  it('logs "2 eggs and toast for breakfast" into Breakfast and supports UNDO', async () => {
    const user = userEvent.setup();
    renderPlan();

    await user.type(await screen.findByLabelText('Log food'), '2 eggs and toast for breakfast');
    await user.click(screen.getByRole('button', { name: 'LOG' }));

    expect(await screen.findByText('Analyzing…')).toBeInTheDocument();
    // Demo reply lands after ~900ms: 2× egg (156) + toast (80) = 236 kcal.
    await waitFor(() => expect(screen.getByDisplayValue('2× egg')).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.getByDisplayValue('toast')).toBeInTheDocument();
    expect(screen.getByText(/\+236 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/236 \/ 2,400 KCAL/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'UNDO' }));
    expect(screen.queryByDisplayValue('2× egg')).not.toBeInTheDocument();
    expect(screen.getByText(/0 \/ 2,400 KCAL/)).toBeInTheDocument();
  });

  it('a pinned preset chip logs its meal with one tap', async () => {
    const user = userEvent.setup();
    renderPlan();

    await user.click(await screen.findByRole('button', { name: /My usual breakfast/ }));
    expect(await screen.findByDisplayValue('My usual breakfast')).toBeInTheDocument();
    expect(screen.getByText(/520 \/ 2,400 KCAL/)).toBeInTheDocument();
  });

  it('unknown food gets the demo fallback reply without logging anything', async () => {
    const user = userEvent.setup();
    renderPlan();

    await user.type(await screen.findByLabelText('Log food'), 'mystery casserole');
    await user.click(screen.getByRole('button', { name: 'LOG' }));

    await waitFor(
      () => expect(screen.getByText(/couldn't recognize that food/)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    const slots = screen.getAllByText('Nothing logged yet');
    expect(slots).toHaveLength(4);
    expect(screen.getByText(/0 \/ 2,400 KCAL/)).toBeInTheDocument();
  });
});
