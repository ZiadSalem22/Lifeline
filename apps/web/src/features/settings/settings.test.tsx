import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tag } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { SettingsModal } from './SettingsModal';

/** Guest-mode settings tests: tag CRUD hits localStorage, appearance hits the DOM. */

function readGuestTags(): Tag[] {
  return JSON.parse(window.localStorage.getItem('guest_tags') ?? '[]') as Tag[];
}

function renderSettings() {
  const onClose = vi.fn();
  const view = renderWithProviders(
    <ThemeProvider>
      <SettingsModal open onClose={onClose} />
    </ThemeProvider>,
  );
  return { ...view, onClose };
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsModal tags tab (guest-aware CRUD — decision 05 fix)', () => {
  it('seeds the 10 default tags read-only and creates custom tags locally', async () => {
    const user = userEvent.setup();
    renderSettings();

    // Defaults render with a Default badge and no edit/delete buttons.
    expect(await screen.findByText('Work')).toBeInTheDocument();
    expect(screen.getAllByText('Default')).toHaveLength(10);
    expect(screen.queryByRole('button', { name: 'Edit tag Work' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('New tag name'), 'Deep Focus');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Deep Focus')).toBeInTheDocument();
    expect(readGuestTags().some((tag) => tag.name === 'Deep Focus')).toBe(true);
  });

  it('renames and deletes custom tags in guest storage', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByLabelText('New tag name'), 'Temp');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Temp')).toBeInTheDocument();

    // Rename via inline edit + Enter.
    await user.click(screen.getByRole('button', { name: 'Edit tag Temp' }));
    const editInput = screen.getByLabelText('Edit name for Temp');
    await user.clear(editInput);
    await user.type(editInput, 'Renamed{Enter}');
    expect(await screen.findByText('Renamed')).toBeInTheDocument();
    expect(readGuestTags().some((tag) => tag.name === 'Renamed')).toBe(true);

    // Delete.
    await user.click(screen.getByRole('button', { name: 'Delete tag Renamed' }));
    await waitFor(() => expect(readGuestTags().some((tag) => tag.name === 'Renamed')).toBe(false));
  });
});

describe('SettingsModal appearance tab (wired theme/font/size)', () => {
  it('theme grid, font select, and the 12-20 size slider all apply for real', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('tab', { name: 'Appearance' }));

    // 9-theme swatch grid.
    expect(screen.getAllByRole('button', { name: /^Theme / })).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: 'Theme Midnight' }));
    expect(document.documentElement.dataset.theme).toBe('midnight');

    // Font select is wired (the old app's was a no-op).
    await user.selectOptions(screen.getByLabelText(/^Font$/), 'Inter');
    expect(document.documentElement.style.getPropertyValue('--font-family-base')).toContain(
      'Inter',
    );

    // Size slider is wired (the old app's had no onChange).
    fireEvent.change(screen.getByLabelText(/Font Size/), { target: { value: '18' } });
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('18px');
  });
});

describe('SettingsModal dismissal', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSettings();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
