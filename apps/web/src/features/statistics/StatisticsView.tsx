import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import type { StatsResponse } from '@lifeline/shared';
import { useAuth } from '../../app/providers/auth-context';
import { resolveWeekStart } from '../../app/layout/day-utils';
import { api } from '../../shared/api/client';
import { putSettings } from '../../shared/api/endpoints';
import { StatsIcon } from '../../shared/ui/icons';
import { Spinner } from '../../shared/ui/Spinner';
import { filterTodosForDay } from '../todos/lib/day-filter';
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

/**
 * ArrowLeft/Right/Home/End move focus AND selection between tabs in a
 * roving-tabindex tablist (WAI-ARIA tabs pattern). Selected tab has
 * tabIndex 0, the rest -1, so Tab reaches the strip once and arrows walk it.
 */
function tablistKeyDown<T>(
  event: React.KeyboardEvent<HTMLDivElement>,
  items: readonly T[],
  currentIndex: number,
  select: (item: T) => void,
): void {
  const last = items.length - 1;
  let next = -1;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
    next = currentIndex >= last ? 0 : currentIndex + 1;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    next = currentIndex <= 0 ? last : currentIndex - 1;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = last;
  const target = next >= 0 ? items[next] : undefined;
  if (target === undefined) return;
  event.preventDefault();
  select(target);
  const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  tabs[next]?.focus();
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
  // Local draft so the year field can be edited digit-by-digit while staying
  // controlled — an uncontrolled input desyncs from the ‹ › chevrons.
  const [yearDraft, setYearDraft] = useState<string | null>(null);

  // The picker inputs edit an explicit range; "all" has no range to display.
  // Local date (NOT UTC): the streak anchor and Day view must match the Daily
  // Plan, which is fully local — a UTC date reads a day off after midnight for
  // east-of-UTC users (the owner is UTC+3).
  const todayStr = format(new Date(), 'yyyy-MM-dd');
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
  // store — 'All' maps to the trailing 366 days (the metrics cap). Memoized
  // so the range's object identity is stable across renders; a fresh object
  // every render defeats the agg memos below.
  const metricsRange = useMemo(
    () => (query.mode === 'range' ? query.range : allMetricsRange()),
    [query],
  );
  const prevMetricsRange = useMemo(() => previousRange(metricsRange), [metricsRange]);
  const {
    metrics,
    isLoading: metricsLoading,
    isError: metricsError,
  } = usePlanMetrics(metricsRange);
  const { metrics: prevMetrics } = usePlanMetrics(prevMetricsRange);
  const { settings: planSettings } = usePlanSettings();

  // Per-date real-task counts joined from the todos store — feeds the plan
  // score so Statistics matches the plan ring and the Weekly Review (both
  // count real tasks, not just quick items). useAllTodos serves guest+server,
  // so the join keeps mode parity.
  const taskCountFor = useMemo(() => {
    const todos = todosQuery.data ?? [];
    return (date: string) => {
      const dayTodos = filterTodosForDay(todos, date);
      return { done: dayTodos.filter((todo) => todo.isCompleted).length, total: dayTodos.length };
    };
  }, [todosQuery.data]);

  const agg = useMemo(
    () => aggregatePlanMetrics(metrics, planSettings, metricsRange, todayStr, taskCountFor),
    [metrics, planSettings, metricsRange, todayStr, taskCountFor],
  );
  const prevAgg = useMemo(
    () => aggregatePlanMetrics(prevMetrics, planSettings, prevMetricsRange, todayStr, taskCountFor),
    [prevMetrics, planSettings, prevMetricsRange, todayStr, taskCountFor],
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
          <div
            className={styles.toggleGroup}
            role="tablist"
            aria-label="Stats period"
            onKeyDown={(event) =>
              tablistKeyDown(event, PERIODS, PERIODS.indexOf(period), changePeriod)
            }
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                tabIndex={period === p ? 0 : -1}
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
                value={yearDraft ?? range.startDate.slice(0, 4)}
                onChange={(event) => {
                  setYearDraft(event.target.value);
                  if (/^\d{4}$/.test(event.target.value)) setRange(yearRange(event.target.value));
                }}
                onBlur={() => setYearDraft(null)}
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
        className={`${styles.toggleGroup} ${styles.sectionTabs}`}
        role="tablist"
        aria-label="Stats section"
        onKeyDown={(event) =>
          tablistKeyDown(
            event,
            SECTIONS,
            SECTIONS.findIndex(([key]) => key === section),
            ([key]) => setSection(key),
          )
        }
      >
        {SECTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            tabIndex={section === key ? 0 : -1}
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
      {/* Errors surface on every section — not only Tasks — and a failed
          metrics fetch must not masquerade as an empty "No plan data" state. */}
      {section === 'tasks' && error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {section !== 'tasks' && metricsError && (
        <div className={styles.error} role="alert">
          Failed to load life metrics for this period.
        </div>
      )}

      {period === 'all' && section !== 'tasks' && !metricsError && (
        <div className={styles.allHint}>Life metrics cover the last 12 months.</div>
      )}

      {section === 'overview' && !metricsLoading && !metricsError && (
        <OverviewSection
          agg={agg}
          prev={prevAgg}
          taskStats={stats}
          showHeatmap={period === 'month' || period === 'year' || period === 'all'}
        />
      )}
      {section === 'tasks' && !loading && !error && stats && (
        <TasksSection stats={stats} period={period} />
      )}
      {section === 'habits' && !metricsLoading && !metricsError && <HabitsSection agg={agg} />}
      {section === 'nutrition' && !metricsLoading && !metricsError && (
        <NutritionSection agg={agg} settings={planSettings} />
      )}
      {section === 'workout' && !metricsLoading && !metricsError && (
        <WorkoutSection agg={agg} settings={planSettings} />
      )}
      {section === 'journal' && !metricsLoading && !metricsError && <JournalSection agg={agg} />}
    </div>
  );
}
