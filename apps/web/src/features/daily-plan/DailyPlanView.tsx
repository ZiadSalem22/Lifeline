import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { DailyPlanData, DailyPlanSettings, Todo } from '@lifeline/shared';
import { useTheme } from '../../app/providers/theme-context';
import { filterTodosForDay, resolveDayString } from '../todos/lib/day-filter';
import { useToggleComplete } from '../todos/data/hooks';
import {
  useDailyPlanWeek,
  usePlanSettings,
  useRecentPlanDays,
  useSaveDay,
  useSaveSettings,
} from './data/hooks';
import {
  PLAN_GRID_KEYS,
  PLAN_SECTIONS,
  WEEK_LETTERS,
  sectionLabel,
  weekIndexOf,
  type PlanSectionKey,
} from './lib/plan-model';
import { computeScore } from './lib/score';
import { applyCarryOver, carryOverFrom, materializeNewDay } from './lib/templates';
import {
  prioritySuggestions,
  quickSuggestions,
  recentMealItems,
  scheduleSuggestions,
} from './lib/suggestions';
import { Masthead } from './Masthead';
import { PlanCard } from './PlanCard';
import { PlanSettingsModal } from './PlanSettingsModal';
import {
  FocusBody,
  GratitudeBody,
  HabitsBody,
  MoodBody,
  PrioritiesBody,
  ReviewBody,
  ScheduleBody,
  TodoBody,
  TomorrowBody,
  WaterBody,
} from './cards';
import { WorkoutBody } from './WorkoutCard';
import { workoutBadge } from './lib/workout-lib';
import { MealsSection } from './MealsSection';
import styles from './DailyPlan.module.css';

/**
 * Daily Plan mode — the command-center view of the Today page (design
 * handoff). Orchestrates the per-day blob + per-user settings, the masonry
 * card grid with full customization (drag order / width / hide / density),
 * and the real-task integrations (To-Do card, workout → habit + task sync).
 */

type DayPatch = Partial<DailyPlanData> | ((day: DailyPlanData) => Partial<DailyPlanData>);

export interface DailyPlanViewProps {
  /** 'today' | 'tomorrow' | 'YYYY-MM-DD' route token. */
  dayToken: string;
  todos: Todo[];
}

export function DailyPlanView({ dayToken, todos }: DailyPlanViewProps) {
  const dateStr = resolveDayString(dayToken);
  const selectedIdx = weekIndexOf(dateStr);
  const { theme, setTheme } = useTheme();

  const { days, weekDates } = useDailyPlanWeek(dateStr);
  const saveDay = useSaveDay();
  const { settings } = usePlanSettings();
  const saveSettings = useSaveSettings();
  const toggleComplete = useToggleComplete();
  const { recentDays, yesterday } = useRecentPlanDays(dateStr);

  // Day continuity: a date with nothing stored wakes up prefilled from the
  // weekday template + yesterday's "Tomorrow Plan" (display-only until the
  // first edit persists it).
  const materialized = useMemo(
    () => materializeNewDay(settings, dateStr, yesterday),
    [settings, dateStr, yesterday],
  );
  const effectiveDays = useMemo(
    () => (days[dateStr] ? days : { ...days, [dateStr]: materialized }),
    [days, dateStr, materialized],
  );

  // Refs updated synchronously by patches so consecutive same-tick writes
  // compose (e.g. workout set → completion sync) instead of clobbering.
  const daysRef = useRef(effectiveDays);
  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    daysRef.current = effectiveDays;
  }, [effectiveDays]);
  useLayoutEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const patchDate = useCallback(
    (date: string, patch: DayPatch) => {
      const current = daysRef.current[date] ?? materializeNewDay(settingsRef.current, date, null);
      const partial = typeof patch === 'function' ? patch(current) : patch;
      const next = { ...current, ...partial };
      daysRef.current = { ...daysRef.current, [date]: next };
      saveDay(date, next);
    },
    [saveDay],
  );

  const patchDay = useCallback(
    (patch: DayPatch) => patchDate(dateStr, patch),
    [patchDate, dateStr],
  );

  const patchSettings = useCallback(
    (patch: Partial<DailyPlanSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      saveSettings(next);
    },
    [saveSettings],
  );

  const day = effectiveDays[dateStr] ?? materialized;
  const dayTodos = filterTodosForDay(todos, dayToken);
  const taskDone = dayTodos.filter((t) => t.isCompleted).length;

  const [quickDraft, setQuickDraft] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // Carry-bar dismissal is per-day — reset when the selected date changes
  // (render-time adjustment guarded by comparison, the app's usual pattern).
  const [carryState, setCarryState] = useState({ date: dateStr, dismissed: false });
  if (carryState.date !== dateStr) setCarryState({ date: dateStr, dismissed: false });
  const carryDismissed = carryState.dismissed;
  const setCarryDismissed = (dismissed: boolean) => setCarryState({ date: dateStr, dismissed });
  const dragKey = useRef<string | null>(null);

  // Carry-over: yesterday's unfinished priorities/quick, one tap to adopt.
  const carry = useMemo(() => carryOverFrom(yesterday), [yesterday]);

  // Personal suggestion pools from the last 28 days.
  const prioSugs = useMemo(() => prioritySuggestions(recentDays), [recentDays]);
  const quickSugs = useMemo(() => quickSuggestions(recentDays), [recentDays]);
  const recentMeals = useMemo(() => recentMealItems(recentDays), [recentDays]);
  const suggestionsForHour = useCallback(
    (hour: string) => scheduleSuggestions(recentDays, hour),
    [recentDays],
  );

  // Card order: persisted secOrder ∪ registry (new cards append).
  const order = settings.secOrder.filter((k) => (PLAN_GRID_KEYS as string[]).includes(k));
  for (const key of PLAN_GRID_KEYS) if (!order.includes(key)) order.push(key);

  const density = settings.density;
  const colw = density === 'roomy' ? 420 : 340;
  const gap = density === 'roomy' ? 20 : 14;

  // span-2 is only legal when the grid actually fits two columns.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [canWide, setCanWide] = useState(true);
  useEffect(() => {
    const measure = () => {
      const width = gridRef.current?.clientWidth ?? window.innerWidth;
      setCanWide(width >= 2 * colw + gap);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [colw, gap]);

  const hide = (key: PlanSectionKey) =>
    patchSettings({ hidden: { ...settingsRef.current.hidden, [key]: true } });
  const show = (key: string) => {
    const hidden = { ...settingsRef.current.hidden };
    delete hidden[key];
    patchSettings({ hidden });
  };
  const toggleWide = (key: PlanSectionKey) =>
    patchSettings({
      secWide: { ...settingsRef.current.secWide, [key]: !settingsRef.current.secWide[key] },
    });
  const dropOn = (target: string) => {
    const from = dragKey.current;
    dragKey.current = null;
    if (!from || from === target) return;
    const next = order.filter((k) => k !== from);
    const at = next.indexOf(target);
    next.splice(at === -1 ? next.length : at, 0, from);
    patchSettings({ secOrder: next });
  };

  // Workout completion → gym habit (+ configured real task) sync.
  const onWorkoutCompletion = useCallback(
    (complete: boolean) => {
      const current = settingsRef.current;
      patchDay((d) => ({ habits: { ...d.habits, [current.gymHabitId]: complete } }));
      if (current.gymTaskNumber !== null) {
        const task = todos.find((t) => t.taskNumber === current.gymTaskNumber);
        if (task && task.isCompleted !== complete) {
          toggleComplete.mutate({ id: task.id, isCompleted: task.isCompleted });
        }
      }
    },
    [patchDay, todos, toggleComplete],
  );

  const hiddenChips = PLAN_SECTIONS.filter(([key]) => settings.hidden[key]);
  const score = computeScore({
    day,
    taskTotal: dayTodos.length,
    taskDone,
    habitIds: settings.habits.map((h) => h.id),
    waterGoal: settings.targets.water,
    nonnegCount: settings.nonnegLabels.length,
    hidden: settings.hidden,
  });

  const daysHabits: Record<string, Record<string, boolean>> = {};
  for (const date of weekDates) daysHabits[date] = effectiveDays[date]?.habits ?? {};

  const bodies: Record<PlanSectionKey, { badge?: string; body: ReactElement } | null> = {
    schedule: {
      body: (
        <ScheduleBody
          day={day}
          patch={patchDay}
          startHour={settings.dayStartHour}
          endHour={settings.dayEndHour}
          suggestionsFor={suggestionsForHour}
        />
      ),
    },
    focus: { body: <FocusBody day={day} patch={patchDay} /> },
    gratitude: {
      body: <GratitudeBody day={day} patch={patchDay} count={settings.gratitudeCount} />,
    },
    mood: { body: <MoodBody day={day} patch={patchDay} /> },
    priorities: {
      body: (
        <PrioritiesBody
          day={day}
          patch={patchDay}
          count={settings.priorityCount}
          suggestions={prioSugs}
        />
      ),
    },
    habits: {
      body: (
        <HabitsBody
          habits={settings.habits}
          weekDates={weekDates}
          daysHabits={daysHabits}
          selectedIdx={selectedIdx}
          weekLetters={WEEK_LETTERS}
          onToggle={(date, habitId, next) =>
            patchDate(date, (d) => ({ habits: { ...d.habits, [habitId]: next } }))
          }
        />
      ),
    },
    workout: {
      badge: workoutBadge({ day, settings, selectedIdx }),
      body: (
        <WorkoutBody
          day={day}
          settings={settings}
          selectedIdx={selectedIdx}
          patchDay={patchDay}
          patchSettings={patchSettings}
          onCompletionChange={onWorkoutCompletion}
        />
      ),
    },
    review: { body: <ReviewBody day={day} patch={patchDay} /> },
    todo: {
      badge: "TODAY'S TASKS",
      body: (
        <TodoBody
          day={day}
          patch={patchDay}
          todos={dayTodos}
          onToggleTodo={(id) => {
            const task = dayTodos.find((t) => t.id === id);
            if (task) toggleComplete.mutate({ id, isCompleted: task.isCompleted });
          }}
          quickDraft={quickDraft}
          onQuickDraft={setQuickDraft}
          suggestions={quickSugs}
        />
      ),
    },
    water: {
      badge: `${Math.min(day.water, settings.targets.water)} / ${settings.targets.water} cups`,
      body: <WaterBody day={day} patch={patchDay} goal={settings.targets.water} />,
    },
    tomorrow: { body: <TomorrowBody day={day} patch={patchDay} count={settings.tomorrowCount} /> },
    meals: null,
    nonneg: null,
  };

  const densityStyle = { '--colw': `${colw}px` } as CSSProperties;

  return (
    <div className={styles.planRoot} data-density={density} style={densityStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 'var(--gap)',
        }}
      >
        <Segmented
          label="Theme"
          options={[
            ['dark', 'DARK'],
            ['paper', 'PAPER'],
          ]}
          value={theme === 'paper' ? 'paper' : 'dark'}
          onChange={(value) => setTheme(value === 'paper' ? 'paper' : 'dark')}
        />
        <Segmented
          label="Density"
          options={[
            ['compact', 'COMPACT'],
            ['roomy', 'ROOMY'],
          ]}
          value={density}
          onChange={(value) => patchSettings({ density: value as 'compact' | 'roomy' })}
        />
        <button
          type="button"
          className={styles.pillBtn}
          style={{ fontSize: 11, letterSpacing: '.08em' }}
          onClick={() => setCustomizeOpen(true)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 21v-7" />
            <path d="M4 10V3" />
            <path d="M12 21v-9" />
            <path d="M12 8V3" />
            <path d="M20 21v-5" />
            <path d="M20 12V3" />
            <path d="M1 14h6" />
            <path d="M9 8h6" />
            <path d="M17 16h6" />
          </svg>
          CUSTOMIZE
        </button>
      </div>

      <Masthead dateStr={dateStr} score={score} subtitle={settings.subtitle} />

      {carry.count > 0 && !carryDismissed && (
        <div className={styles.hiddenBar} role="status">
          <span className={styles.hiddenBarLabel}>Yesterday</span>
          <span style={{ fontSize: 12 }}>
            {carry.count} unfinished item{carry.count > 1 ? 's' : ''} from yesterday
          </span>
          <button
            type="button"
            className={styles.hiddenChip}
            onClick={() => {
              patchDay((d) => applyCarryOver(d, carry));
              setCarryDismissed(true);
            }}
          >
            Carry over
          </button>
          <button type="button" className={styles.showAll} onClick={() => setCarryDismissed(true)}>
            Dismiss
          </button>
        </div>
      )}

      {hiddenChips.length > 0 && (
        <div className={styles.hiddenBar}>
          <span className={styles.hiddenBarLabel}>Hidden</span>
          {hiddenChips.map(([key, label]) => (
            <button key={key} type="button" className={styles.hiddenChip} onClick={() => show(key)}>
              + {label}
            </button>
          ))}
          <button
            type="button"
            className={styles.showAll}
            onClick={() => patchSettings({ hidden: {} })}
          >
            Show all
          </button>
        </div>
      )}

      <div ref={gridRef} className={styles.grid}>
        {PLAN_GRID_KEYS.filter((key) => !settings.hidden[key]).map((key) => {
          const entry = bodies[key];
          if (!entry) return null;
          return (
            <PlanCard
              key={key}
              secKey={key}
              title={sectionLabel(key)}
              badge={entry.badge}
              order={order.indexOf(key)}
              wide={Boolean(settings.secWide[key])}
              canWide={canWide}
              gapPx={gap}
              onToggleWide={() => toggleWide(key)}
              onHide={() => hide(key)}
              onDragStartKey={(k) => {
                dragKey.current = k;
              }}
              onDropOnKey={dropOn}
            >
              {entry.body}
            </PlanCard>
          );
        })}
      </div>

      {!settings.hidden['meals'] && (
        <MealsSection
          day={day}
          settings={settings}
          patchDay={patchDay}
          patchSettings={patchSettings}
          onHide={() => hide('meals')}
          recentItems={recentMeals}
        />
      )}

      {!settings.hidden['nonneg'] && (
        <div className={styles.fullCard}>
          <button
            type="button"
            className={`${styles.cardCtl} ${styles.ctlHide}`}
            title="Hide section"
            aria-label="Hide Non-Negotiables"
            onClick={() => hide('nonneg')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 5l14 14" />
              <path d="M19 5L5 19" />
            </svg>
          </button>
          <div
            className={styles.secbar}
            style={{ justifyContent: 'center', letterSpacing: '0.2em' }}
          >
            <span>Non-Negotiables</span>
          </div>
          <div className={styles.nonnegRow}>
            {settings.nonnegLabels.map((label, i) => (
              <button
                key={`${label}-${i}`}
                type="button"
                className={styles.nonnegItem}
                onClick={() =>
                  patchDay((d) => {
                    const next = Array.from(
                      { length: Math.max(settings.nonnegLabels.length, d.nonnegs.length) },
                      (_, j) => d.nonnegs[j] ?? false,
                    );
                    next[i] = !next[i];
                    return { nonnegs: next };
                  })
                }
              >
                <span
                  className={
                    day.nonnegs[i] ? `${styles.nonnegBox} ${styles.squareOn}` : styles.nonnegBox
                  }
                  aria-hidden="true"
                >
                  {day.nonnegs[i] ? '✓' : ''}
                </span>
                <span className={styles.nonnegLabel} dir="auto">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {settings.motto.trim().length > 0 && (
        <div className={styles.motto} dir="auto">
          {settings.motto}
        </div>
      )}

      <PlanSettingsModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        settings={settings}
        patchSettings={patchSettings}
        day={day}
        dateStr={dateStr}
      />
    </div>
  );
}

function Segmented(props: {
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={props.label}
      style={{
        display: 'flex',
        border: '1px solid var(--plan-card-border)',
        borderRadius: 999,
        overflow: 'hidden',
        fontSize: 11,
        letterSpacing: '.08em',
      }}
    >
      {props.options.map(([value, label]) => {
        const active = props.value === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => props.onChange(value)}
            style={
              active
                ? {
                    padding: '6px 14px',
                    background: 'var(--plan-primary)',
                    color: 'var(--plan-primary-ink)',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }
                : {
                    padding: '6px 14px',
                    color: 'var(--plan-muted)',
                    fontWeight: 600,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
