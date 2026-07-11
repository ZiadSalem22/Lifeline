import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { guestApi } from '../../../shared/guest/guest-api';
import { renderWithProviders } from '../../../test/harness';
import { Composer } from './Composer';

/**
 * Popup-mode composer presets (Daily Plan cards): initialDueDate/initialDueTime
 * seed the date/time fields and re-seed on every open transition, while the
 * rest of the draft survives; closeOnOutsideClick=false hands dismissal to the
 * wrapping overlay. The inline Tasks-mode composer passes none of these props
 * and is covered by composer.test.tsx unchanged.
 */

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Composer date/time presets', () => {
  it('seeds due date + time from the initial props and submits them', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(guestApi, 'createTodo');
    renderWithProviders(
      <Composer
        open
        allTags={[]}
        allTodos={[]}
        effectiveDate="2026-07-09"
        onRequestClose={vi.fn()}
        initialDueDate="2026-07-09"
        initialDueTime="13:00"
      />,
    );

    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-09');
    expect(screen.getByLabelText('Due time')).toHaveValue('13:00');

    await user.type(screen.getByLabelText('Task title'), 'Deep work');
    await user.click(screen.getByRole('button', { name: 'Add Task' }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({
      dueDate: '2026-07-09',
      dueTime: '13:00',
    });
  });

  it('re-seeds date/time on each open transition but keeps the rest of the draft', async () => {
    // Mirrors ComposerModal: one mounted composer, retargeted per opening card.
    function Harness() {
      const [state, setState] = useState({ open: true, time: '09:00' });
      return (
        <>
          <button type="button" onClick={() => setState((s) => ({ ...s, open: false }))}>
            close-popup
          </button>
          <button type="button" onClick={() => setState({ open: true, time: '15:00' })}>
            reopen-popup
          </button>
          <Composer
            open={state.open}
            allTags={[]}
            allTodos={[]}
            effectiveDate="2026-07-09"
            onRequestClose={vi.fn()}
            initialDueDate="2026-07-09"
            initialDueTime={state.time}
            closeOnOutsideClick={false}
          />
        </>
      );
    }
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    expect(screen.getByLabelText('Due time')).toHaveValue('09:00');
    await user.type(screen.getByLabelText('Task title'), 'Draft survives');

    await user.click(screen.getByText('close-popup'));
    expect(screen.queryByLabelText('Task title')).not.toBeInTheDocument();
    await user.click(screen.getByText('reopen-popup'));

    // Date/time re-seeded to the new opener; the typed draft is intact.
    expect(screen.getByLabelText('Due time')).toHaveValue('15:00');
    expect(screen.getByLabelText('Task title')).toHaveValue('Draft survives');
  });

  it('closeOnOutsideClick=false ignores outside clicks; Escape still closes', async () => {
    const user = userEvent.setup();
    const onRequestClose = vi.fn();
    renderWithProviders(
      <Composer
        open
        allTags={[]}
        allTodos={[]}
        effectiveDate="2026-07-09"
        onRequestClose={onRequestClose}
        closeOnOutsideClick={false}
      />,
    );

    await user.click(document.body);
    expect(onRequestClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onRequestClose).toHaveBeenCalled();
  });
});
