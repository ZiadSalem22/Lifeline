import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { extractDayMetrics, planScoreFromMetrics } from '@lifeline/shared';
import type { DailyPlanData, Todo } from '@lifeline/shared';
import { useAllTodos } from '../todos/data/hooks';
import { filterTodosForDay } from '../todos/lib/day-filter';
import { useDailyPlanWeek, usePlanSettings } from '../daily-plan/data/hooks';
import {
  WEEK_DAY_NAMES,
  daysAfter,
  daysBefore,
  dividerBelowAt,
  weekDatesOf,
  weekStartOf,
} from '../daily-plan/lib/plan-model';
import { DonutChart } from '../../shared/ui/charts/charts';
import styles from './Review.module.css';

/**
 * Weekly Review — the dedicated full-page ritual: one week at a time, with
 * ‹ › navigation, day columns, the week's habit grid, unfinished tasks,
 * nutrition vs targets, workout days, and the journal wall. Uses the plan
 * tokens so paper/dark keep the editorial look — this IS part of the plan.
 */

const CIRC = 2 * Math.PI * 29;

export function ReviewView({ weekToken }: { weekToken?: string | undefined }) {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = weekStartOf(
    weekToken && /^\d{4}-\d{2}-\d{2}$/.test(weekToken) ? weekToken : todayStr,
  );
  const weekDates = weekDatesOf(weekStart);
  const weekEnd = weekDates[6] ?? weekStart;
  const isThisWeek = weekStart === weekStartOf(todayStr);

  const { days } = useDailyPlanWeek(weekStart);
  const { days: prevDays } = useDailyPlanWeek(daysBefore(weekStart, 7));
  const { settings } = usePlanSettings();
  const todosQuery = useAllTodos();
  const todos = useMemo(() => todosQuery.data ?? [], [todosQuery.data]);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const scoreBits = useMemo(
    () => ({
      habitIds: settings.habits.map((h) => h.id),
      waterGoal: settings.targets.water,
      nonnegCount: settings.nonnegLabels.length,
      hidden: settings.hidden,
    }),
    [settings],
  );

  interface DaySummary {
    date: string;
    day: DailyPlanData | null;
    score: number | null;
    tasksDone: number;
    tasksTotal: number;
    habitsDone: number;
    water: number;
  }

  const summarize = (source: Record<string, DailyPlanData>, dates: string[]): DaySummary[] =>
    dates.map((date) => {
      const day = source[date] ?? null;
      const dayTodos = filterTodosForDay(todos, date);
      const tasksDone = dayTodos.filter((t) => t.isCompleted).length;
      if (!day) {
        return {
          date,
          day: null,
          score: null,
          tasksDone,
          tasksTotal: dayTodos.length,
          habitsDone: 0,
          water: 0,
        };
      }
      const m = extractDayMetrics(date, day);
      return {
        date,
        day,
        score: planScoreFromMetrics(m, scoreBits, {
          done: tasksDone,
          total: dayTodos.length,
        }),
        tasksDone,
        tasksTotal: dayTodos.length,
        habitsDone: scoreBits.habitIds.filter((id) => day.habits[id] === true).length,
        water: day.water,
      };
    });

  const summaries = useMemo(
    () => summarize(days, weekDates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, weekDates, todos, scoreBits],
  );
  const prevSummaries = useMemo(
    () => summarize(prevDays, weekDatesOf(daysBefore(weekStart, 7))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prevDays, weekStart, todos, scoreBits],
  );

  const avgOf = (list: DaySummary[]): number | null => {
    const scored = list.map((s) => s.score).filter((s): s is number => s !== null);
    return scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  };
  const avgScore = avgOf(summaries);
  const prevAvg = avgOf(prevSummaries);
  const delta = avgScore !== null && prevAvg !== null ? avgScore - prevAvg : null;

  // Week task rollup + unfinished list (deduped — span tasks cover many days).
  const weekTasks = useMemo(() => {
    const seen = new Map<string, Todo>();
    for (const date of weekDates) {
      for (const todo of filterTodosForDay(todos, date)) seen.set(todo.id, todo);
    }
    const list = [...seen.values()];
    return {
      total: list.length,
      done: list.filter((t) => t.isCompleted).length,
      unfinished: list.filter((t) => !t.isCompleted),
    };
  }, [todos, weekDates]);

  // Habits week rows.
  const habitRows = settings.habits.map((habit) => {
    let done = 0;
    let counted = 0;
    for (const date of weekDates) {
      const mark = days[date]?.habits[habit.id];
      if (mark === 'skip' || mark === undefined) continue;
      counted += 1;
      if (mark === true) done += 1;
    }
    return { habit, done, counted, pct: counted > 0 ? Math.round((done / counted) * 100) : null };
  });

  // Nutrition + workout rollups from stored days.
  const nutrition = useMemo(() => {
    const logged = summaries
      .map((s) => (s.day ? extractDayMetrics(s.date, s.day) : null))
      .filter((m): m is NonNullable<typeof m> => m !== null && m.mealCount > 0);
    return {
      loggedDays: logged.length,
      kcalAvg:
        logged.length > 0
          ? Math.round(logged.reduce((a, m) => a + m.kcal, 0) / logged.length)
          : null,
      proteinAvg:
        logged.length > 0
          ? Math.round(logged.reduce((a, m) => a + m.protein, 0) / logged.length)
          : null,
      byDate: new Map(logged.map((m) => [m.date, m])),
    };
  }, [summaries]);

  const workout = useMemo(() => {
    const trained = summaries.map((s) => {
      if (!s.day) return 0;
      return Object.values(s.day.workoutDone).reduce(
        (a, sets) => a + sets.reduce((x, y) => x + y, 0),
        0,
      );
    });
    return { trained, totalSets: trained.reduce((a, b) => a + b, 0) };
  }, [summaries]);

  const dash = `${(((avgScore ?? 0) / 100) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;
  const weekLabel = `${format(new Date(`${weekStart}T00:00:00`), 'MMM d')} – ${format(
    new Date(`${weekEnd}T00:00:00`),
    'MMM d, yyyy',
  )}`;

  const goWeek = (date: string) => void navigate(`/review/${weekStartOf(date)}`);

  return (
    <div className={styles.root}>
      {/* ── header: title, week nav, score ring, WoW delta ────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>WEEKLY REVIEW</h1>
          <div className={styles.weekNav}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Previous week"
              onClick={() => goWeek(daysBefore(weekStart, 7))}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.weekLabelBtn}
              aria-label="Jump to week"
              onClick={() => {
                const input = dateInputRef.current;
                if (!input) return;
                if (typeof input.showPicker === 'function') input.showPicker();
                else input.click();
              }}
            >
              {weekLabel}
            </button>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Next week"
              onClick={() => goWeek(daysAfter(weekStart, 7))}
            >
              ›
            </button>
            {!isThisWeek && (
              <button
                type="button"
                className={styles.thisWeekChip}
                onClick={() => void navigate('/review')}
              >
                This week
              </button>
            )}
            <input
              ref={dateInputRef}
              type="date"
              className={styles.dateJumpInput}
              tabIndex={-1}
              value={weekStart}
              aria-label="Jump to a date's week"
              onChange={(e) => {
                if (e.target.value) goWeek(e.target.value);
              }}
            />
          </div>
        </div>
        <div className={styles.scoreWrap}>
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            role="img"
            aria-label={`Week average score ${avgScore ?? 0}%`}
          >
            <circle cx="36" cy="36" r="29" fill="none" stroke="var(--plan-rule)" strokeWidth="6" />
            <circle
              cx="36"
              cy="36"
              r="29"
              fill="none"
              stroke="var(--plan-primary)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={dash}
              transform="rotate(-90 36 36)"
            />
            <text
              x="36"
              y="41"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="var(--color-text)"
              fontFamily="var(--plan-display-font)"
            >
              {avgScore === null ? '—' : `${avgScore}%`}
            </text>
          </svg>
          <div className={styles.scoreMeta}>
            <span className={styles.miniLabel}>Week avg</span>
            {delta !== null && (
              <span className={styles.deltaChip} data-tone={delta >= 0 ? 'good' : 'bad'}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs last week
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── days strip ─────────────────────────────────────────────────────── */}
      <div className={styles.daysStrip}>
        {summaries.map((s, i) => (
          <button
            key={s.date}
            type="button"
            className={styles.dayCol}
            data-today={s.date === todayStr ? 'true' : undefined}
            aria-label={`Open ${WEEK_DAY_NAMES[i] ?? ''} ${s.date}${s.score === null ? '' : ` — score ${s.score}%`}`}
            onClick={() => void navigate(`/day/${s.date}`)}
          >
            <span className={styles.dayBarTrack}>
              <span className={styles.dayBarFill} style={{ height: `${s.score ?? 0}%` }} />
            </span>
            <span className={styles.dayName}>{WEEK_DAY_NAMES[i]}</span>
            <span className={styles.dayDate}>{s.date.slice(8)}</span>
            <span className={styles.dayMeta}>{s.score === null ? '—' : `${s.score}%`}</span>
            <span className={styles.dayCounts}>
              {s.tasksDone}/{s.tasksTotal} tasks · {s.habitsDone} habits · {s.water}💧
            </span>
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {/* ── habits grid ──────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Habits</h2>
          {habitRows.map(({ habit, pct }, hi) => (
            <div
              key={habit.id}
              className={
                dividerBelowAt(settings.habits, hi)
                  ? `${styles.habitRow} ${styles.habitRowDivide}`
                  : styles.habitRow
              }
            >
              <span
                dir="auto"
                className={styles.habitLabel}
                data-salah={habit.salah ? 'true' : undefined}
              >
                {habit.label}
              </span>
              {weekDates.map((date, di) => {
                const mark = days[date]?.habits[habit.id];
                return (
                  <span
                    key={date}
                    className={styles.habitCell}
                    data-mark={mark === true ? 'on' : mark === 'skip' ? 'skip' : 'off'}
                    title={`${WEEK_DAY_NAMES[di] ?? ''}${mark === true ? ' — done' : mark === 'skip' ? ' — skipped' : ''}`}
                  >
                    {mark === 'skip' ? '–' : ''}
                  </span>
                );
              })}
              <span className={styles.habitPct}>{pct === null ? '—' : `${pct}%`}</span>
            </div>
          ))}
        </section>

        {/* ── tasks ─────────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Tasks</h2>
          <div className={styles.taskSummary}>
            <DonutChart
              value={weekTasks.total > 0 ? Math.round((weekTasks.done / weekTasks.total) * 100) : 0}
              size={84}
              stroke={9}
              label="Week task completion"
            />
            <div>
              <div className={styles.bigStat}>
                {weekTasks.done} / {weekTasks.total}
              </div>
              <div className={styles.miniLabel}>completed this week</div>
            </div>
          </div>
          {weekTasks.unfinished.length > 0 && (
            <>
              <div className={styles.miniLabel} style={{ marginTop: 10 }}>
                Still open
              </div>
              {weekTasks.unfinished.slice(0, 8).map((todo) => (
                <button
                  key={todo.id}
                  type="button"
                  dir="auto"
                  className={styles.taskLink}
                  onClick={() =>
                    void navigate(`/day/${todo.dueDate ?? todayStr}?taskId=${todo.id}`)
                  }
                >
                  <span className={styles.numChip}>#{todo.taskNumber}</span>
                  {todo.title}
                </button>
              ))}
              {weekTasks.unfinished.length > 8 && (
                <div className={styles.miniLabel}>+{weekTasks.unfinished.length - 8} more</div>
              )}
            </>
          )}
        </section>

        {/* ── nutrition ─────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Nutrition</h2>
          {nutrition.loggedDays === 0 ? (
            <div className={styles.empty}>No meals logged this week.</div>
          ) : (
            <>
              <div className={styles.statRow}>
                <span>
                  <span className={styles.bigStat}>{nutrition.kcalAvg}</span>
                  <span className={styles.miniLabel}>
                    avg kcal (target {settings.targets.kcal.toLocaleString()})
                  </span>
                </span>
                <span>
                  <span className={styles.bigStat}>{nutrition.proteinAvg}g</span>
                  <span className={styles.miniLabel}>
                    avg protein (target {settings.targets.protein}g)
                  </span>
                </span>
                <span>
                  <span className={styles.bigStat}>{nutrition.loggedDays}/7</span>
                  <span className={styles.miniLabel}>days logged</span>
                </span>
              </div>
              <div className={styles.kcalBars} role="img" aria-label="Calories per day vs target">
                {weekDates.map((date, i) => {
                  const m = nutrition.byDate.get(date);
                  const pct = m ? Math.min(130, (m.kcal / settings.targets.kcal) * 100) : 0;
                  return (
                    <span
                      key={date}
                      className={styles.kcalBarCol}
                      title={m ? `${date}: ${m.kcal} kcal` : `${date}: not logged`}
                    >
                      <span className={styles.kcalBarTrack}>
                        <span
                          className={styles.kcalBarFill}
                          style={{ height: `${Math.min(pct, 100)}%` }}
                          data-over={pct > 100 ? 'true' : undefined}
                        />
                        <span className={styles.kcalTarget} />
                      </span>
                      <span className={styles.dayName}>{WEEK_DAY_NAMES[i]?.[0]}</span>
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ── workout ──────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Workout</h2>
          <div className={styles.trainDots}>
            {workout.trained.map((sets, i) => (
              <span
                key={weekDates[i]}
                className={styles.trainDot}
                data-on={sets > 0 ? 'true' : undefined}
                title={`${WEEK_DAY_NAMES[i] ?? ''}: ${sets > 0 ? `${sets} sets` : 'rest'}`}
              >
                {WEEK_DAY_NAMES[i]?.[0]}
              </span>
            ))}
          </div>
          <div className={styles.miniLabel}>
            {workout.trained.filter((s) => s > 0).length} sessions · {workout.totalSets} sets total
          </div>
        </section>
      </div>

      {/* ── journal wall ─────────────────────────────────────────────────────── */}
      <section className={styles.journalWall}>
        <h2 className={styles.cardTitle}>Journal</h2>
        <div className={styles.journalGrid}>
          {summaries.map((s, i) => {
            const day = s.day;
            const hasText =
              day &&
              (day.reviewWell.trim() ||
                day.reviewImprove.trim() ||
                day.reviewForward.trim() ||
                day.gratitude.some((g) => g.trim()));
            return (
              <article key={s.date} className={styles.journalDay}>
                <header className={styles.journalHead}>
                  <span className={styles.journalDayName}>
                    {WEEK_DAY_NAMES[i]} {s.date.slice(8)}
                  </span>
                  {day && day.rating > 0 && (
                    <span className={styles.journalRating} title={`Rated ${day.rating}/5`}>
                      {'●'.repeat(day.rating)}
                      {'○'.repeat(5 - day.rating)}
                    </span>
                  )}
                </header>
                {!hasText && <p className={styles.journalEmpty}>—</p>}
                {day && day.reviewWell.trim() && (
                  <p dir="auto" className={styles.journalLine}>
                    <span className={styles.journalTag}>Well</span> {day.reviewWell}
                  </p>
                )}
                {day && day.reviewImprove.trim() && (
                  <p dir="auto" className={styles.journalLine}>
                    <span className={styles.journalTag}>Improve</span> {day.reviewImprove}
                  </p>
                )}
                {day && day.reviewForward.trim() && (
                  <p dir="auto" className={styles.journalLine}>
                    <span className={styles.journalTag}>Ahead</span> {day.reviewForward}
                  </p>
                )}
                {day &&
                  day.gratitude
                    .filter((g) => g.trim())
                    .map((g, gi) => (
                      <p key={gi} dir="auto" className={styles.journalGratitude}>
                        ♥ {g}
                      </p>
                    ))}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
