import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultDailyPlanSettings } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * Weight & body card: weight is stored canonically in kg but shown in the
 * user's chosen unit, and the circumference/fat measurements live behind a
 * "+ Body measurements" disclosure so the daily entry stays weight-focused.
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe('Weight & body card', () => {
  it('shows weight in the chosen unit (lb) and reveals body measurements on demand', async () => {
    const settings = defaultDailyPlanSettings();
    settings.units = { weight: 'lb', length: 'in' };
    window.localStorage.setItem('daily_plan_settings', JSON.stringify(settings));
    // Stored canonically as 80 kg.
    window.localStorage.setItem('daily_plan:2026-07-09', JSON.stringify({ weight: 80 }));

    const user = userEvent.setup();
    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="2026-07-09" todos={[]} />
      </ThemeProvider>,
    );

    // 80 kg displays as 176.4 lb, and the field announces the active unit.
    const input = await screen.findByLabelText("Today's weight in pounds");
    expect(input).toHaveValue(176.4);

    // Measurements are hidden until asked for.
    expect(screen.queryByLabelText('Waist')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Body measurements' }));
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
    expect(screen.getByLabelText('Body fat')).toBeInTheDocument();
    expect(screen.getByLabelText('Waist')).toBeInTheDocument();
    expect(screen.getByLabelText('Arm')).toBeInTheDocument();
  });
});
