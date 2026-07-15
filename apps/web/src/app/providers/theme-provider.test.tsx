import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../shared/api/query-client';
import { installFetchMock, makeMe, makeSettings } from '../../test/test-utils';
import { AuthAdapterProvider } from './auth-adapter';
import { AuthProvider } from './auth-provider';
import { useAuth } from './auth-context';
import { ThemeProvider } from './theme-provider';
import { useTheme } from './theme-context';

function Probe() {
  const { theme, setTheme, font, setFont, fontSize, setFontSize } = useTheme();
  const { checkedIdentity } = useAuth();
  return (
    <div>
      <span data-testid="checked">{String(checkedIdentity)}</span>
      <span data-testid="theme">{theme}</span>
      <span data-testid="font">{font}</span>
      <span data-testid="font-size">{fontSize}</span>
      <button onClick={() => setTheme('midnight')}>set-theme</button>
      <button onClick={() => setFont('Inter')}>set-font</button>
      <button onClick={() => setFontSize(18)}>set-size</button>
    </div>
  );
}

function renderThemed(me = makeMe()) {
  installFetchMock(me);
  return render(
    <AuthAdapterProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <Probe />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AuthAdapterProvider>,
  );
}

async function identityResolved() {
  await waitFor(() => expect(screen.getByTestId('checked').textContent).toBe('true'));
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AUTH_DISABLED', '1');
    window.localStorage.clear();
    queryClient.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('defaults to paper / DM Sans / 14 and applies the data-theme attribute', async () => {
    renderThemed();
    await identityResolved();
    expect(document.documentElement.dataset.theme).toBe('paper');
    expect(screen.getByTestId('font').textContent).toBe('DM Sans');
    expect(screen.getByTestId('font-size').textContent).toBe('14');
    expect(document.documentElement.style.getPropertyValue('--font-family-base')).toContain(
      'DM Sans',
    );
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('14px');
  });

  it('applies + persists theme, font, and font size changes to localStorage', async () => {
    renderThemed();
    await identityResolved();
    const user = userEvent.setup();

    await user.click(screen.getByText('set-theme'));
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(window.localStorage.getItem('theme')).toBe('midnight');

    await user.click(screen.getByText('set-font'));
    expect(document.documentElement.style.getPropertyValue('--font-family-base')).toContain(
      'Inter',
    );
    expect(window.localStorage.getItem('font')).toBe('Inter');

    await user.click(screen.getByText('set-size'));
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('18px');
    expect(window.localStorage.getItem('fontSize')).toBe('18');
  });

  it('restores theme and font from localStorage', async () => {
    window.localStorage.setItem('theme', 'clean-beige');
    window.localStorage.setItem('font', 'Montserrat');
    renderThemed();
    await identityResolved();
    expect(document.documentElement.dataset.theme).toBe('clean-beige');
    expect(screen.getByTestId('font').textContent).toBe('Montserrat');
  });

  it('hydrates theme/font/fontSize from server settings once identity loads', async () => {
    renderThemed(
      makeMe({
        settings: makeSettings({
          theme: 'sunset',
          layout: { font: 'Space Grotesk', fontSize: 16 },
        }),
      }),
    );
    await identityResolved();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('sunset'));
    expect(screen.getByTestId('font').textContent).toBe('Space Grotesk');
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('16px');
  });
});
