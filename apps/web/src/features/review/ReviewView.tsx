import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { extractDayMetrics, planScoreFromMetrics } from '@lifeline/shared';
import type { DailyPlanData, PlanScoreSettings, Todo } from '@lifeline/shared';
import { useAllTodos } from '../todos/data/hooks';
import { filterTodosForDay } from '../todos/lib/day-filter';
import { useDailyPlanRange, useDailyPlanWeek, usePlanSettings } from '../daily-plan/data/hooks';
import {
  WEEK_DAY_NAMES,
  daysAfter,
  daysBefore,
  dividerBelowAt,
  weekDatesOf,
  weekStartOf,
} from '../daily-plan/lib/plan-model';
import { toWeightDisplay } from '../daily-plan/lib/units';
import type { WeightUnit } from '../daily-plan/lib/units';
import { DonutChart } from '../../shared/ui/charts/charts';
import styles from './Review.module.css';

/**
 * Review — the dedicated full-page ritual, one WEEK or one MONTH at a time.
 * /review/:token routes here: 'YYYY-MM-DD' (any date in the week) → weekly,
 * 'YYYY-MM' → monthly. Uses the plan tokens so paper/dark keep the editorial
 * look — this IS part of the plan.
 */

const CIRC = 2 * Math.PI * 29;

/* ── month math (pure string/int — no timezone parsing) ─────────────────── */

const monthTokenOf = (dateStr: string): string => dateStr.slice(0, 7);

function monthDatesOf(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return [];
  const lastDay = new Date(y, m, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}

function stepMonth(ym: string, dir: 1 | -1): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const total = y * 12 + (m - 1) + dir;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/* ── shared per-day summary ─────────────────────────────────────────────── */

interface DaySummary {
  date: string;
  day: DailyPlanData | null;
  score: number | null;
  tasksDone: number;
  tasksTotal: number;
  habitsDone: number;
  water: number;
}

function summarize(
  source: Record<string, DailyPlanData>,
  dates: string[],
  todos: Todo[],
  scoreBits: PlanScoreSettings,
): DaySummary[] {
  return dates.map((date) => {
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
      score: planScoreFromMetrics(m, scoreBits, { done: tasksDone, total: dayTodos.length }),
      tasksDone,
      tasksTotal: dayTodos.length,
      habitsDone: scoreBits.habitIds.filter((id) => day.habits[id] === true).length,
      water: day.water,
    };
  });
}

const avgOf = (list: DaySummary[]): number | null => {
  const scored = list.map((s) => s.score).filter((s): s is number => s !== null);
  return scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
};

/** Weigh-in rollup for a run of days: first → last logged + count. */
function weightOf(source: Record<string, DailyPlanData>, dates: string[]) {
  const ins = dates.flatMap((date) => {
    const kg = source[date]?.weight ?? 0;
    return kg > 0 ? [{ date, kg }] : [];
  });
  const first = ins[0] ?? null;
  const last = ins[ins.length - 1] ?? null;
  return {
    count: ins.length,
    first,
    last,
    delta:
      first && last && first.date !== last.date ? Math.round((last.kg - first.kg) * 10) / 10 : null,
  };
}

const fmtDay = (dateStr: string, pattern: string): string =>
  format(new Date(`${dateStr}T00:00:00`), pattern);

function useScoreBits(): PlanScoreSettings {
  const { settings } = usePlanSettings();
  return useMemo(
    () => ({
      habitIds: settings.habits.map((h) => h.id),
      waterGoal: settings.targets.water,
      nonnegCount: settings.nonnegLabels.length,
      hidden: settings.hidden,
    }),
    [settings],
  );
}

/* ── shared header chrome ───────────────────────────────────────────────── */

function ModeToggle({
  mode,
  onWeek,
  onMonth,
}: {
  mode: 'week' | 'month';
  onWeek: () => void;
  onMonth: () => void;
}) {
  return (
    <span className={styles.modeToggle} role="group" aria-label="Review span">
      <button
        type="button"
        className={mode === 'week' ? `${styles.modeBtn} ${styles.modeBtnActive}` : styles.modeBtn}
        aria-pressed={mode === 'week'}
        onClick={onWeek}
      >
        Week
      </button>
      <button
        type="button"
        className={mode === 'month' ? `${styles.modeBtn} ${styles.modeBtnActive}` : styles.modeBtn}
        aria-pressed={mode === 'month'}
        onClick={onMonth}
      >
        Month
      </button>
    </span>
  );
}

function ScoreRing({
  avg,
  delta,
  deltaLabel,
}: {
  avg: number | null;
  delta: number | null;
  deltaLabel: string;
}) {
  const dash = `${(((avg ?? 0) / 100) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;
  return (
    <div className={styles.scoreWrap}>
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        role="img"
        aria-label={`Average score ${avg ?? 0}%`}
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
          {avg === null ? '—' : `${avg}%`}
        </text>
      </svg>
      <div className={styles.scoreMeta}>
        <span className={styles.miniLabel}>{deltaLabel.split('|')[0]}</span>
        {delta !== null && (
          <span
            className={styles.deltaChip}
            data-tone={delta === 0 ? 'neutral' : delta > 0 ? 'good' : 'bad'}
          >
            {delta === 0 ? '±' : delta > 0 ? '▲' : '▼'} {Math.abs(delta)} {deltaLabel.split('|')[1]}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── journal wall (shared; month passes headed=true for full dates) ─────── */

function JournalWall({
  summaries,
  headings,
  onlyWithContent = false,
}: {
  summaries: DaySummary[];
  headings: string[];
  onlyWithContent?: boolean;
}) {
  const entries = summaries
    .map((s, i) => {
      const day = s.day;
      const hasText =
        day !== null &&
        (day.reviewWell.trim() !== '' ||
          day.reviewImprove.trim() !== '' ||
          day.reviewForward.trim() !== '' ||
          day.gratitude.some((g) => g.trim() !== ''));
      return { s, heading: headings[i] ?? s.date, hasText };
    })
    .filter((e) => !onlyWithContent || e.hasText);
  if (entries.length === 0) {
    return <p className={styles.empty}>Nothing written this month — the evening review awaits.</p>;
  }
  return (
    <div className={styles.journalGrid}>
      {entries.map(({ s, heading, hasText }) => {
        const day = s.day;
        return (
          <article key={s.date} className={styles.journalDay}>
            <header className={styles.journalHead}>
              <span className={styles.journalDayName}>{heading}</span>
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
  );
}

/* ── weight card (shared) ───────────────────────────────────────────────── */

function WeightCard({
  weight,
  spanDays,
  unit,
}: {
  weight: ReturnType<typeof weightOf>;
  spanDays: number;
  unit: WeightUnit;
}) {
  if (weight.count === 0 || !weight.last) return null;
  // Convert first/last separately, then re-subtract, so the shown delta matches
  // the shown endpoints exactly in the chosen unit.
  const dispLast = toWeightDisplay(weight.last.kg, unit);
  const dispDelta =
    weight.delta !== null && weight.first
      ? Math.round((dispLast - toWeightDisplay(weight.first.kg, unit)) * 10) / 10
      : null;
  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Weight</h2>
      <div className={styles.statRow}>
        <span>
          <span className={styles.bigStat}>
            {dispLast} {unit}
          </span>
          <span className={styles.miniLabel}>latest · {fmtDay(weight.last.date, 'MMM d')}</span>
        </span>
        {dispDelta !== null && (
          <span>
            <span className={styles.bigStat}>
              {dispDelta > 0 ? '▲' : dispDelta < 0 ? '▼' : '±'} {Math.abs(dispDelta)}
            </span>
            <span className={styles.miniLabel}>
              since {weight.first ? fmtDay(weight.first.date, 'MMM d') : ''}
            </span>
          </span>
        )}
        <span>
          <span className={styles.bigStat}>
            {weight.count}/{spanDays}
          </span>
          <span className={styles.miniLabel}>weigh-ins</span>
        </span>
      </div>
    </section>
  );
}

/* ── weekly ─────────────────────────────────────────────────────────────── */

function WeeklyReview({ token }: { token?: string | undefined }) {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = weekStartOf(token && /^\d{4}-\d{2}-\d{2}$/.test(token) ? token : todayStr);
  const weekDates = weekDatesOf(weekStart);
  const weekEnd = weekDates[6] ?? weekStart;
  const isThisWeek = weekStart === weekStartOf(todayStr);

  const { days } = useDailyPlanWeek(weekStart);
  const { days: prevDays } = useDailyPlanWeek(daysBefore(weekStart, 7));
  const { settings } = usePlanSettings();
  const scoreBits = useScoreBits();
  const { settings: planSettings } = usePlanSettings();
  const todosQuery = useAllTodos();
  const todos = useMemo(() => todosQuery.data ?? [], [todosQuery.data]);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const summaries = useMemo(
    () => summarize(days, weekDates, todos, scoreBits),
    [days, weekDates, todos, scoreBits],
  );
  const prevSummaries = useMemo(
    () => summarize(prevDays, weekDatesOf(daysBefore(weekStart, 7)), todos, scoreBits),
    [prevDays, weekStart, todos, scoreBits],
  );

  const avgScore = avgOf(summaries);
  const prevAvg = avgOf(prevSummaries);
  const delta = avgScore !== null && prevAvg !== null ? avgScore - prevAvg : null;
  const weight = useMemo(() => weightOf(days, weekDates), [days, weekDates]);

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

  const weekLabel = `${fmtDay(weekStart, 'MMM d')} – ${fmtDay(weekEnd, 'MMM d, yyyy')}`;
  const goWeek = (date: string) => void navigate(`/review/${weekStartOf(date)}`);

  return (
    <div className={styles.root}>
      {/* ── header: title, mode, week nav, score ring, WoW delta ──────────── */}
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>WEEKLY REVIEW</h1>
            <ModeToggle
              mode="week"
              onWeek={() => void navigate('/review')}
              onMonth={() => void navigate(`/review/${monthTokenOf(weekStart)}`)}
            />
          </div>
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
        <ScoreRing avg={avgScore} delta={delta} deltaLabel="Week avg|vs last week" />
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

        <WeightCard weight={weight} spanDays={7} unit={planSettings.units.weight} />
      </div>

      {/* ── journal wall ─────────────────────────────────────────────────────── */}
      <section className={styles.journalWall}>
        <h2 className={styles.cardTitle}>Journal</h2>
        <JournalWall
          summaries={summaries}
          headings={weekDates.map((d, i) => `${WEEK_DAY_NAMES[i]} ${d.slice(8)}`)}
        />
      </section>
    </div>
  );
}

/* ── monthly ────────────────────────────────────────────────────────────── */

function MonthlyReview({ token }: { token: string }) {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const ym = /^\d{4}-\d{2}$/.test(token) ? token : monthTokenOf(todayStr);
  // Plain derivations — the React Compiler auto-memoizes these; a manual
  // useMemo here isn't preservable (ym derives from new Date()) and would make
  // the compiler skip optimizing the whole component.
  const dates = monthDatesOf(ym);
  const monthStart = dates[0] ?? `${ym}-01`;
  const monthEnd = dates[dates.length - 1] ?? monthStart;
  const isThisMonth = ym === monthTokenOf(todayStr);
  const prevYm = stepMonth(ym, -1);
  const prevDates = monthDatesOf(prevYm);

  const { days } = useDailyPlanRange(monthStart, monthEnd);
  const { days: prevMonthDays } = useDailyPlanRange(
    prevDates[0] ?? monthStart,
    prevDates[prevDates.length - 1] ?? monthStart,
  );
  const { settings } = usePlanSettings();
  const scoreBits = useScoreBits();
  const { settings: planSettings } = usePlanSettings();
  const todosQuery = useAllTodos();
  const todos = useMemo(() => todosQuery.data ?? [], [todosQuery.data]);
  const monthInputRef = useRef<HTMLInputElement | null>(null);

  const summaries = useMemo(
    () => summarize(days, dates, todos, scoreBits),
    [days, dates, todos, scoreBits],
  );
  const prevSummaries = useMemo(
    () => summarize(prevMonthDays, prevDates, todos, scoreBits),
    [prevMonthDays, prevDates, todos, scoreBits],
  );

  const avgScore = avgOf(summaries);
  const prevAvg = avgOf(prevSummaries);
  const delta = avgScore !== null && prevAvg !== null ? avgScore - prevAvg : null;
  const weight = useMemo(() => weightOf(days, dates), [days, dates]);
  const daysWithData = summaries.filter((s) => s.day !== null).length;

  // Weeks of the month (in-month segments) — each links to its weekly review.
  const weeks = useMemo(() => {
    const groups = new Map<string, DaySummary[]>();
    for (const s of summaries) {
      const ws = weekStartOf(s.date);
      const group = groups.get(ws) ?? [];
      group.push(s);
      groups.set(ws, group);
    }
    return [...groups.entries()].map(([weekStart, group]) => ({
      weekStart,
      group,
      avg: avgOf(group),
      logged: group.filter((s) => s.day !== null).length,
    }));
  }, [summaries]);

  // Habit month rows (skips excluded, unlogged days neutral).
  const habitRows = settings.habits.map((habit) => {
    let done = 0;
    let counted = 0;
    for (const date of dates) {
      const mark = days[date]?.habits[habit.id];
      if (mark === 'skip' || mark === undefined) continue;
      counted += 1;
      if (mark === true) done += 1;
    }
    return { habit, done, counted, pct: counted > 0 ? Math.round((done / counted) * 100) : null };
  });

  const monthTasks = useMemo(() => {
    const seen = new Map<string, Todo>();
    for (const date of dates) {
      for (const todo of filterTodosForDay(todos, date)) seen.set(todo.id, todo);
    }
    const list = [...seen.values()];
    return {
      total: list.length,
      done: list.filter((t) => t.isCompleted).length,
      unfinished: list.filter((t) => !t.isCompleted),
    };
  }, [todos, dates]);

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
    };
  }, [summaries]);

  const workout = useMemo(() => {
    const byRoutine = new Map<string, number>();
    let sessions = 0;
    let totalSets = 0;
    for (const s of summaries) {
      if (!s.day) continue;
      let daySets = 0;
      for (const [key, sets] of Object.entries(s.day.workoutDone)) {
        const n = sets.reduce((a, b) => a + b, 0);
        if (n > 0) byRoutine.set(key, (byRoutine.get(key) ?? 0) + 1);
        daySets += n;
      }
      if (daySets > 0) {
        sessions += 1;
        totalSets += daySets;
      }
    }
    return {
      sessions,
      totalSets,
      byRoutine: [...byRoutine.entries()]
        .map(([key, count]) => ({
          key,
          label: settings.gym.routines[key]?.name ?? key,
          count,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }, [summaries, settings.gym.routines]);

  const monthLabel = fmtDay(monthStart, 'MMMM yyyy');
  const goMonth = (nextYm: string) => void navigate(`/review/${nextYm}`);

  return (
    <div className={styles.root}>
      {/* ── header ─────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>MONTHLY REVIEW</h1>
            <ModeToggle
              mode="month"
              onWeek={() => void navigate(`/review/${monthStart}`)}
              onMonth={() => void navigate(`/review/${monthTokenOf(todayStr)}`)}
            />
          </div>
          <div className={styles.weekNav}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Previous month"
              onClick={() => goMonth(stepMonth(ym, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.weekLabelBtn}
              aria-label="Jump to month"
              onClick={() => {
                const input = monthInputRef.current;
                if (!input) return;
                if (typeof input.showPicker === 'function') input.showPicker();
                else input.click();
              }}
            >
              {monthLabel}
            </button>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Next month"
              onClick={() => goMonth(stepMonth(ym, 1))}
            >
              ›
            </button>
            {!isThisMonth && (
              <button
                type="button"
                className={styles.thisWeekChip}
                onClick={() => goMonth(monthTokenOf(todayStr))}
              >
                This month
              </button>
            )}
            <input
              ref={monthInputRef}
              type="month"
              className={styles.dateJumpInput}
              tabIndex={-1}
              value={ym}
              aria-label="Jump to a month"
              onChange={(e) => {
                if (e.target.value) goMonth(e.target.value);
              }}
            />
          </div>
          <span className={styles.miniLabel} style={{ marginTop: 8 }}>
            {daysWithData} of {dates.length} days lived in the plan
          </span>
        </div>
        <ScoreRing avg={avgScore} delta={delta} deltaLabel="Month avg|vs last month" />
      </div>

      {/* ── weeks strip: each row opens the weekly review ──────────────────── */}
      <div className={styles.weeksStrip}>
        {weeks.map(({ weekStart, group, avg, logged }) => {
          const first = group[0]?.date ?? weekStart;
          const last = group[group.length - 1]?.date ?? first;
          return (
            <button
              key={weekStart}
              type="button"
              className={styles.weekCard}
              aria-label={`Open weekly review ${fmtDay(first, 'MMM d')} – ${fmtDay(last, 'MMM d')}`}
              onClick={() => void navigate(`/review/${weekStart}`)}
            >
              <span className={styles.weekCardLabel}>
                {fmtDay(first, 'MMM d')} – {fmtDay(last, 'd')}
              </span>
              <span className={styles.weekBars}>
                {group.map((s) => (
                  <span
                    key={s.date}
                    className={styles.weekBarTrack}
                    title={`${s.date}${s.score === null ? '' : ` — ${s.score}%`}`}
                  >
                    <span className={styles.weekBarFill} style={{ height: `${s.score ?? 0}%` }} />
                  </span>
                ))}
              </span>
              <span className={styles.weekCardMeta}>
                <span className={styles.weekCardAvg}>{avg === null ? '—' : `${avg}%`}</span>
                <span className={styles.weekCardDays}>{logged}d · open ›</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.grid}>
        {/* ── habits ───────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Habits</h2>
          {habitRows.map(({ habit, done, counted, pct }, hi) => (
            <div
              key={habit.id}
              className={
                dividerBelowAt(settings.habits, hi)
                  ? `${styles.habitMonthRow} ${styles.habitRowDivide}`
                  : styles.habitMonthRow
              }
            >
              <span
                dir="auto"
                className={styles.habitLabel}
                data-salah={habit.salah ? 'true' : undefined}
              >
                {habit.label}
              </span>
              <span className={styles.pctTrack}>
                <span className={styles.pctFill} style={{ width: `${pct ?? 0}%` }} />
              </span>
              <span className={styles.habitCounts}>{counted > 0 ? `${done}/${counted}` : ''}</span>
              <span className={styles.habitPct}>{pct === null ? '—' : `${pct}%`}</span>
            </div>
          ))}
        </section>

        {/* ── tasks ────────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Tasks</h2>
          <div className={styles.taskSummary}>
            <DonutChart
              value={
                monthTasks.total > 0 ? Math.round((monthTasks.done / monthTasks.total) * 100) : 0
              }
              size={84}
              stroke={9}
              label="Month task completion"
            />
            <div>
              <div className={styles.bigStat}>
                {monthTasks.done} / {monthTasks.total}
              </div>
              <div className={styles.miniLabel}>completed this month</div>
            </div>
          </div>
          {monthTasks.unfinished.length > 0 && (
            <>
              <div className={styles.miniLabel} style={{ marginTop: 10 }}>
                Still open
              </div>
              {monthTasks.unfinished.slice(0, 8).map((todo) => (
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
              {monthTasks.unfinished.length > 8 && (
                <div className={styles.miniLabel}>+{monthTasks.unfinished.length - 8} more</div>
              )}
            </>
          )}
        </section>

        {/* ── nutrition ────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Nutrition</h2>
          {nutrition.loggedDays === 0 ? (
            <div className={styles.empty}>No meals logged this month.</div>
          ) : (
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
                <span className={styles.bigStat}>
                  {nutrition.loggedDays}/{dates.length}
                </span>
                <span className={styles.miniLabel}>days logged</span>
              </span>
            </div>
          )}
        </section>

        {/* ── workout ──────────────────────────────────────────────────────── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Workout</h2>
          {workout.sessions === 0 ? (
            <div className={styles.empty}>No training logged this month.</div>
          ) : (
            <>
              <div className={styles.statRow}>
                <span>
                  <span className={styles.bigStat}>{workout.sessions}</span>
                  <span className={styles.miniLabel}>sessions</span>
                </span>
                <span>
                  <span className={styles.bigStat}>{workout.totalSets}</span>
                  <span className={styles.miniLabel}>sets total</span>
                </span>
              </div>
              {workout.byRoutine.map((r) => (
                <div key={r.key} className={styles.routineRow}>
                  <span dir="auto">{r.label}</span>
                  <span className={styles.habitPct}>{r.count}×</span>
                </div>
              ))}
            </>
          )}
        </section>

        <WeightCard weight={weight} spanDays={dates.length} unit={planSettings.units.weight} />
      </div>

      {/* ── journal wall (only days that were written) ─────────────────────── */}
      <section className={styles.journalWall}>
        <h2 className={styles.cardTitle}>Journal</h2>
        <JournalWall
          summaries={summaries}
          headings={dates.map((d) => fmtDay(d, 'EEE, MMM d'))}
          onlyWithContent
        />
      </section>
    </div>
  );
}

/* ── dispatcher ─────────────────────────────────────────────────────────── */

export function ReviewView({ weekToken }: { weekToken?: string | undefined }) {
  if (weekToken && /^\d{4}-\d{2}$/.test(weekToken)) {
    return <MonthlyReview token={weekToken} />;
  }
  return <WeeklyReview token={weekToken} />;
}
