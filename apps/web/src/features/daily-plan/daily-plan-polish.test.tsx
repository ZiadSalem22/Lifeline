import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * UI/UX polish bundle: keyboard card reorder from the grip, the honest
 * Saving…/Saved ✓ indicator, and masthead day navigation (chevrons +
 * jump-to-date). The drag FLIP animation itself is browser-only (WAAPI);
 * its order logic is exercised through the same moveCard/secOrder path.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan(onSelectDay?: (date: string) => void) {
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken="2026-07-09" todos={[]} onSelectDay={onSelectDay} />
    </ThemeProvider>,
  );
}

describe('card reorder via keyboard', () => {
  it('arrow keys on the grip move the card one slot and persist the order', async () => {
    const user = userEvent.setup();
    renderPlan();

    const grip = await screen.findByRole('button', { name: 'Drag to rearrange Schedule' });
    grip.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(
      () => {
        const raw = window.localStorage.getItem('daily_plan_settings');
        expect(raw).not.toBeNull();
        const { secOrder } = JSON.parse(raw as string) as { secOrder: string[] };
        expect(secOrder[0]).toBe('focus');
        expect(secOrder[1]).toBe('schedule');
      },
      { timeout: 3000 },
    );

    // And back.
    await user.keyboard('{ArrowLeft}');
    await waitFor(
      () => {
        const raw = window.localStorage.getItem('daily_plan_settings');
        const { secOrder } = JSON.parse(raw as string) as { secOrder: string[] };
        expect(secOrder[0]).toBe('schedule');
      },
      { timeout: 3000 },
    );
  });
});

describe('save indicator', () => {
  it('shows Saving… on an edit and Saved ✓ once the write lands', async () => {
    const user = userEvent.setup();
    renderPlan();

    await user.click(await screen.findByRole('button', { name: 'Cup 1' }));
    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    expect(await screen.findByText('Saved ✓', undefined, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe('masthead day navigation', () => {
  it('chevrons step a day; the hidden date input jumps anywhere', async () => {
    const onSelectDay = vi.fn();
    const user = userEvent.setup();
    renderPlan(onSelectDay);

    await user.click(await screen.findByRole('button', { name: 'Next day' }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-10');
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-08');

    fireEvent.change(screen.getByLabelText('Jump to date'), { target: { value: '2026-08-01' } });
    expect(onSelectDay).toHaveBeenCalledWith('2026-08-01');
  });

  it('renders a plain date label without onSelectDay (no dead buttons)', async () => {
    renderPlan();
    expect(await screen.findByText('Thursday, July 9, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next day' })).not.toBeInTheDocument();
  });
});
