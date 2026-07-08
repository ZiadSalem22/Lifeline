import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUserAuth, renderWithProviders } from '../../test/harness';
import { bodyOf, jsonResponse, makeMe, makeSettings } from '../../test/test-utils';
import { DonutChart } from './charts';
import { weekRange } from './stats-lib';
import { StatisticsView } from './StatisticsView';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function statsBody(completionRate: number) {
  return {
    periodTotals: {
      totalTodos: 4,
      completedCount: 2,
      completionRate,
      avgDuration: 25,
      timeSpentTotal: 100,
    },
    topTags: [{ id: 't1', name: 'Work', color: '#3B82F6', count: 3 }],
    groups: [{ period: 'day', date: '2026-07-06', count: 2 }],
  };
}

function stubStatsFetch(completionRate = 50) {
  const statsCalls: URLSearchParams[] = [];
  const settingsBodies: unknown[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname === '/api/v1/stats') {
      statsCalls.push(parsed.searchParams);
      return Promise.resolve(jsonResponse(statsBody(completionRate)));
    }
    if (parsed.pathname === '/api/v1/me/settings' && init?.method === 'PUT') {
      settingsBodies.push(bodyOf(init));
      return Promise.resolve(jsonResponse(makeSettings()));
    }
    if (parsed.pathname === '/api/v1/tags') return Promise.resolve(jsonResponse([]));
    if (parsed.pathname === '/api/v1/me') return Promise.resolve(jsonResponse(makeMe()));
    return Promise.resolve(
      jsonResponse({ items: [], page: 1, pageSize: 50, totalItems: 0, totalPages: 0 }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { statsCalls, settingsBodies };
}

describe('StatisticsView (server mode)', () => {
  it('maps the All tab to the period branch and Week tab to the week-start-aware range', async () => {
    const { statsCalls } = stubStatsFetch();
    const user = userEvent.setup();
    renderWithProviders(<StatisticsView />, { auth: makeUserAuth(makeMe()) });

    // All tab (default): period branch, NOT a 1970→2100 sentinel range (which
    // would make the server zero-fill ~47,800 day groups and now 400s).
    await waitFor(() => expect(statsCalls.length).toBeGreaterThan(0));
    expect(statsCalls[0]?.get('period')).toBe('year');
    expect(statsCalls[0]?.get('startDate')).toBeNull();
    expect(statsCalls[0]?.get('endDate')).toBeNull();

    // Week tab: profile startDayOfWeek is Monday.
    await user.click(screen.getByRole('tab', { name: 'Week' }));
    const expected = weekRange(format(new Date(), 'yyyy-MM-dd'), 'monday');
    await waitFor(() => {
      const last = statsCalls[statsCalls.length - 1];
      expect(last?.get('startDate')).toBe(expected.startDate);
      expect(last?.get('endDate')).toBe(expected.endDate);
    });
  });

  it('renders the donut % and metric cards from the response', async () => {
    stubStatsFetch(50);
    renderWithProviders(<StatisticsView />, { auth: makeUserAuth(makeMe()) });
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText('25m')).toBeInTheDocument(); // avg duration
    expect(screen.getByText('100m')).toBeInTheDocument(); // time spent
    expect(screen.getByText('Work')).toBeInTheDocument(); // top tag
  });

  it('saves the week-start preference via PUT /me/settings {layout:{weekStart}}', async () => {
    const { settingsBodies } = stubStatsFetch();
    const user = userEvent.setup();
    renderWithProviders(<StatisticsView />, { auth: makeUserAuth(makeMe()) });

    await user.click(screen.getByRole('tab', { name: 'Week' }));
    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.click(screen.getByRole('button', { name: 'Sunday' }));

    await waitFor(() => expect(settingsBodies.length).toBe(1));
    expect(settingsBodies[0]).toEqual({ layout: { weekStart: 'sunday' } });
    // The hint reflects the new preference.
    expect(screen.getByText(/Week starts on Sunday/)).toBeInTheDocument();
  });
});

describe('DonutChart math', () => {
  it('shows the clamped percentage text', () => {
    const { rerender } = render(<DonutChart value={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    rerender(<DonutChart value={140} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    rerender(<DonutChart value={-5} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('offsets the progress arc proportionally to the value', () => {
    const { container } = render(<DonutChart value={25} size={120} stroke={12} />);
    const circles = container.querySelectorAll('circle');
    const radius = (120 - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(Number(circles[1]?.getAttribute('stroke-dashoffset'))).toBeCloseTo(
      circumference * 0.75,
      5,
    );
  });
});
