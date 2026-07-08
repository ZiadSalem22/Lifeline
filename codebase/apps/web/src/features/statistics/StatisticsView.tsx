import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { StatsResponse } from '@lifeline/shared';
import { useAuth } from '../../app/providers/auth-context';
import { resolveWeekStart } from '../../app/layout/day-utils';
import { api } from '../../shared/api/client';
import { putSettings } from '../../shared/api/endpoints';
import { StatsIcon } from '../../shared/ui/icons';
import { Spinner } from '../../shared/ui/Spinner';
import { useAllTags, useAllTodos } from '../todos/data/hooks';
import { DonutChart, LineChart } from './charts';
import {
  computeGuestStats,
  defaultQueryForPeriod,
  monthRange,
  presetWeekRange,
  statsQueryKey,
  statsQueryString,
  weekRange,
  yearRange,
} from './stats-lib';
import type { StatsPeriod, StatsQuery, StatsRange, WeekStart } from './stats-lib';
import styles from './Statistics.module.css';

/**
 * Statistics page — port of the old components/statistics/Statistics.jsx:
 * period tabs All/Day/Week/Month/Year with pickers, metric cards, SVG donut
 * (completion), SVG line (tasks/day), top-tags progress bars. Week-start
 * preference reads profile.startDayOfWeek ?? settings.layout.weekStart and
 * saves via PUT /me/settings {layout:{weekStart}}. Guest mode computes stats
 * locally from the localStorage todos.
 */

const PERIODS: StatsPeriod[] = ['all', 'day', 'week', 'month', 'year'];

function toWeekStart(value: string): WeekStart {
  const lower = value.toLowerCase();
  return lower === 'sunday' || lower === 'saturday' ? lower : 'monday';
}

export function StatisticsView() {
  const { guestMode, currentUser, refreshIdentity } = useAuth();

  const [period, setPeriod] = useState<StatsPeriod>('all');
  const [query, setQuery] = useState<StatsQuery>({ mode: 'all' });
  const [weekStart, setWeekStart] = useState<WeekStart>(() =>
    toWeekStart(resolveWeekStart(currentUser)),
  );
  const [showWeekStartPicker, setShowWeekStartPicker] = useState(false);
  const [saveError, setSaveError] = useState('');

  // The picker inputs edit an explicit range; "all" has no range to display.
  const todayStr = new Date().toISOString().slice(0, 10);
  const range = query.mode === 'range' ? query.range : { startDate: todayStr, endDate: todayStr };
  const setRange = (next: StatsRange) => setQuery({ mode: 'range', range: next });

  // Guest mode computes locally from the full local list.
  const todosQuery = useAllTodos();
  const tagsQuery = useAllTags();

  const serverQuery = useQuery({
    queryKey: statsQueryKey(query),
    enabled: !guestMode,
    queryFn: () => api.get<StatsResponse>(`/stats${statsQueryString(query)}`),
  });

  const guestStats = useMemo(
    () =>
      guestMode && todosQuery.data
        ? computeGuestStats(todosQuery.data, tagsQuery.data ?? [], query)
        : null,
    [guestMode, todosQuery.data, tagsQuery.data, query],
  );

  const stats = guestMode ? guestStats : (serverQuery.data ?? null);
  const loading = guestMode ? todosQuery.isLoading : serverQuery.isLoading;
  const error = !guestMode && serverQuery.isError ? 'Failed to load statistics.' : null;

  const changePeriod = (next: StatsPeriod) => {
    setPeriod(next);
    setQuery(defaultQueryForPeriod(next, weekStart));
  };

  const saveWeekStart = async (value: WeekStart) => {
    setShowWeekStartPicker(false);
    setSaveError('');
    const previous = weekStart;
    setWeekStart(value);
    if (guestMode) return;
    try {
      // Merge into the existing layout so font/fontSize settings survive.
      const layout = currentUser?.settings?.layout ?? {};
      await putSettings({ layout: { ...layout, weekStart: value } });
      void refreshIdentity();
    } catch {
      setWeekStart(previous);
      setSaveError('Failed to save week-start preference.');
    }
  };

  const totals = stats?.periodTotals;
  const topTags = stats?.topTags ?? [];
  const groups = stats?.groups ?? [];
  const maxPerDay = groups.reduce((max, group) => Math.max(max, group.count), 0) || 1;
  const points = groups.map((group) => ({ x: group.date, y: group.count }));
  const maxTagCount = topTags[0]?.count ?? 1;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.iconBox}>
          <StatsIcon width={22} height={22} />
        </div>
        <h1 className={styles.title}>Statistics</h1>
      </div>

      {/* ── period tabs + pickers ────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <div className={styles.toggleGroup} role="tablist" aria-label="Stats period">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              className={[styles.toggle, period === p ? styles.toggleActive : undefined]
                .filter(Boolean)
                .join(' ')}
              onClick={() => changePeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.panel} aria-live="polite">
          {period === 'day' && (
            <div className={styles.pickerRow}>
              <label className={styles.pickerLabel} htmlFor="stats-day">
                Pick a day
              </label>
              <input
                id="stats-day"
                className={styles.input}
                type="date"
                value={range.startDate}
                onChange={(event) => {
                  if (event.target.value) {
                    setRange({ startDate: event.target.value, endDate: event.target.value });
                  }
                }}
              />
            </div>
          )}

          {period === 'week' && (
            <>
              <div className={styles.pickerRow}>
                <label className={styles.pickerLabel} htmlFor="stats-week">
                  Pick any date in week
                </label>
                <input
                  id="stats-week"
                  className={styles.input}
                  type="date"
                  value={range.startDate}
                  onChange={(event) => {
                    if (event.target.value) setRange(weekRange(event.target.value, weekStart));
                  }}
                />
              </div>
              <div className={styles.chipRow}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => setRange(presetWeekRange(0, weekStart))}
                >
                  This Week
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => setRange(presetWeekRange(-1, weekStart))}
                >
                  Last Week
                </button>
              </div>
              <div className={styles.hint}>
                Week starts on {weekStart.charAt(0).toUpperCase() + weekStart.slice(1)} ·{' '}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setShowWeekStartPicker((show) => !show)}
                >
                  Change
                </button>
                {showWeekStartPicker && (
                  <span className={styles.weekStartOptions}>
                    {(['monday', 'sunday', 'saturday'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={styles.chip}
                        onClick={() => void saveWeekStart(option)}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              {saveError && (
                <p className={styles.error} role="alert">
                  {saveError}
                </p>
              )}
            </>
          )}

          {period === 'month' && (
            <div className={styles.pickerRow}>
              <label className={styles.pickerLabel} htmlFor="stats-month">
                Pick a month
              </label>
              <input
                id="stats-month"
                className={styles.input}
                type="month"
                value={range.startDate.slice(0, 7)}
                onChange={(event) => {
                  if (event.target.value) setRange(monthRange(event.target.value));
                }}
              />
            </div>
          )}

          {period === 'year' && (
            <div className={styles.pickerRow}>
              <label className={styles.pickerLabel} htmlFor="stats-year">
                Enter a year
              </label>
              <input
                id="stats-year"
                className={styles.input}
                type="number"
                min={1970}
                max={2100}
                step={1}
                placeholder={todayStr.slice(0, 4)}
                defaultValue={range.startDate.slice(0, 4)}
                onChange={(event) => {
                  if (/^\d{4}$/.test(event.target.value)) setRange(yearRange(event.target.value));
                }}
              />
            </div>
          )}

          {period === 'all' && (
            <div className={styles.allHint}>
              Showing overall stats. Use Day/Week/Month/Year to select.
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>
          <Spinner size={32} label="Loading statistics..." />
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {!loading && !error && totals && (
        <div className={styles.stack}>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Total</div>
              <div className={styles.metricValue}>{totals.totalTodos}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Completed</div>
              <div className={styles.metricValue}>{totals.completedCount}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Avg. Duration</div>
              <div className={styles.metricValue}>{totals.avgDuration}m</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>Time Spent</div>
              <div className={styles.metricValue}>{totals.timeSpentTotal}m</div>
            </div>
          </div>

          <section className={styles.sections}>
            <div className={styles.sectionCard}>
              <h3 className={styles.cardTitle}>Completion</h3>
              <div className={styles.donutWrap}>
                <DonutChart value={totals.completionRate} />
              </div>
              <div className={styles.legend}>
                <span>Completed: {totals.completedCount}</span>
                <span>Total: {totals.totalTodos}</span>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.cardTitle}>Tasks per Day</h3>
              <div className={styles.lineWrap}>
                <LineChart points={points} />
              </div>
              <div className={styles.legend}>
                <span>Max: {maxPerDay}</span>
                <span>Points: {points.length}</span>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <h3 className={styles.cardTitle}>Top Tags</h3>
              {topTags.length === 0 && <div className={styles.chartEmpty}>No tags used yet</div>}
              {topTags.map((tag) => (
                <div key={tag.id} className={styles.tagRow}>
                  <div className={styles.tagSwatch} style={{ background: tag.color }} />
                  <div className={styles.tagName}>{tag.name}</div>
                  <div className={styles.tagBar}>
                    <div className={styles.progressWrap}>
                      <div
                        className={styles.progressBar}
                        style={{
                          width: `${Math.min(100, Math.round((tag.count / maxTagCount) * 100))}%`,
                          background: tag.color,
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles.tagCount}>{tag.count}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
