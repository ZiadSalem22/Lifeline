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
import { usePlanMetrics, usePlanSettings } from '../daily-plan/data/hooks';
import {
  allMetricsRange,
  computeGuestStats,
  defaultQueryForPeriod,
  monthRange,
  presetWeekRange,
  statsQueryKey,
  statsQueryString,
  stepRange,
  weekRange,
  yearRange,
} from './stats-lib';
import type { StatsPeriod, StatsQuery, StatsRange, WeekStart } from './stats-lib';
import { aggregatePlanMetrics, previousRange } from './plan-metrics-lib';
import { OverviewSection } from './sections/OverviewSection';
import { TasksSection } from './sections/TasksSection';
import { HabitsSection } from './sections/HabitsSection';
import { NutritionSection } from './sections/NutritionSection';
import { WorkoutSection } from './sections/WorkoutSection';
import { JournalSection } from './sections/JournalSection';
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

const SECTIONS = [
  ['overview', 'Overview'],
  ['tasks', 'Tasks'],
  ['habits', 'Habits'],
  ['nutrition', 'Nutrition'],
  ['workout', 'Workout'],
  ['journal', 'Journal'],
] as const;
type StatsSection = (typeof SECTIONS)[number][0];

function toWeekStart(value: string): WeekStart {
  const lower = value.toLowerCase();
  return lower === 'sunday' || lower === 'saturday' ? lower : 'monday';
}

export function StatisticsView() {
  const { guestMode, currentUser, refreshIdentity } = useAuth();

  const [period, setPeriod] = useState<StatsPeriod>('all');
  const [section, setSection] = useState<StatsSection>('overview');
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

  // Life metrics (habits / nutrition / workout / journal) from the plan
  // store — 'All' maps to the trailing 366 days (the metrics cap).
  const metricsRange = query.mode === 'range' ? query.range : allMetricsRange();
  const prevMetricsRange = previousRange(metricsRange);
  const { metrics, isLoading: metricsLoading } = usePlanMetrics(metricsRange);
  const { metrics: prevMetrics } = usePlanMetrics(prevMetricsRange);
  const { settings: planSettings } = usePlanSettings();
  const agg = useMemo(
    () => aggregatePlanMetrics(metrics, planSettings, metricsRange, todayStr),
    [metrics, planSettings, metricsRange, todayStr],
  );
  const prevAgg = useMemo(
    () => aggregatePlanMetrics(prevMetrics, planSettings, prevMetricsRange, todayStr),
    [prevMetrics, planSettings, prevMetricsRange, todayStr],
  );
  const stepPeriod = (dir: -1 | 1) =>
    setQuery({ mode: 'range', range: stepRange(period, range, dir) });

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
        <div className={styles.toggleRow}>
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
          {period !== 'all' && (
            <div className={styles.stepBtns}>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label={`Previous ${period}`}
                onClick={() => stepPeriod(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.stepBtn}
                aria-label={`Next ${period}`}
                onClick={() => stepPeriod(1)}
              >
                ›
              </button>
            </div>
          )}
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

      <div
        className={styles.toggleGroup}
        role="tablist"
        aria-label="Stats section"
        style={{ marginBottom: 'var(--gap-lg)' }}
      >
        {SECTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            className={[styles.toggle, section === key ? styles.toggleActive : undefined]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {(section === 'tasks' ? loading : metricsLoading) && (
        <div className={styles.loading}>
          <Spinner size={32} label="Loading statistics..." />
        </div>
      )}
      {error && section === 'tasks' && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {section === 'overview' && !metricsLoading && (
        <OverviewSection
          agg={agg}
          prev={prevAgg}
          taskStats={stats}
          showHeatmap={period === 'month' || period === 'year' || period === 'all'}
        />
      )}
      {section === 'tasks' && !loading && !error && stats && <TasksSection stats={stats} />}
      {section === 'habits' && !metricsLoading && <HabitsSection agg={agg} />}
      {section === 'nutrition' && !metricsLoading && (
        <NutritionSection agg={agg} settings={planSettings} />
      )}
      {section === 'workout' && !metricsLoading && (
        <WorkoutSection agg={agg} settings={planSettings} />
      )}
      {section === 'journal' && !metricsLoading && <JournalSection agg={agg} />}
    </div>
  );
}
