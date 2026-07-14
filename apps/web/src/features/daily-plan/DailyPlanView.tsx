import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { DailyPlanData, DailyPlanSettings, HabitMark, Tag, Todo } from '@lifeline/shared';
import { MEAL_SLOTS, bmr, dayBalance, maintenanceBase } from '@lifeline/shared';
import { useTheme } from '../../app/providers/theme-context';
import { filterTodosForDay, resolveDayString } from '../todos/lib/day-filter';
import { useCreateTodo, useToggleComplete, useUpdateSubtasks } from '../todos/data/hooks';
import {
  useDailyPlanWeek,
  usePlanSaveStatus,
  usePlanSettings,
  useRecentPlanDays,
  useSaveDay,
  useSaveSettings,
  type PlanSaveStatus,
} from './data/hooks';
import {
  PLAN_GRID_KEYS,
  PLAN_SECTIONS,
  WEEK_LETTERS,
  daysAfter,
  daysBefore,
  sectionLabel,
  weekIndexOf,
  type PlanSectionKey,
} from './lib/plan-model';
import { computeScore } from './lib/score';
import { habitHistory, habitStreak } from './lib/streaks';
import { carryOverFrom, carryTitles, materializeNewDay } from './lib/templates';
import {
  prioritySuggestions,
  quickSuggestions,
  recentMealItems,
  scheduleSuggestions,
} from './lib/suggestions';
import { Masthead } from './Masthead';
import { PlanCard } from './PlanCard';
import { PlanSettingsModal } from './PlanSettingsModal';
import { ComposerModal } from './ComposerModal';
import { TaskPreviewModal } from './TaskPreviewModal';
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
  WeekReviewBody,
  WeightBody,
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
type SettingsPatch =
  Partial<DailyPlanSettings> | ((settings: DailyPlanSettings) => Partial<DailyPlanSettings>);

export interface DailyPlanViewProps {
  /** 'today' | 'tomorrow' | 'YYYY-MM-DD' route token. */
  dayToken: string;
  todos: Todo[];
  /** Tag list for the Add Task composer popup. */
  allTags?: Tag[];
  /** Deep-link a task into the Tasks-mode editor on the given day. */
  onOpenTask?: ((todo: Todo, dayStr: string) => void) | undefined;
  /** Navigate to another day (masthead week chips, chevrons, date jump). */
  onSelectDay?: ((date: string) => void) | undefined;
  /** Open the dedicated Weekly Review page for a week start date. */
  onOpenReview?: ((weekStart: string) => void) | undefined;
}

export function DailyPlanView({
  dayToken,
  todos,
  allTags = [],
  onOpenTask,
  onSelectDay,
  onOpenReview,
}: DailyPlanViewProps) {
  const dateStr = resolveDayString(dayToken);
  const selectedIdx = weekIndexOf(dateStr);
  const { theme, setTheme } = useTheme();

  const {
    days,
    weekDates,
    ready: weekReady,
    isError: weekError,
    refetch: refetchWeek,
  } = useDailyPlanWeek(dateStr);
  const saveDay = useSaveDay();
  const { settings, ready: settingsReady } = usePlanSettings();
  const saveSettings = useSaveSettings();
  const toggleComplete = useToggleComplete();
  const { recentDays, recentByDate, yesterday } = useRecentPlanDays(dateStr);

  // Midnight rollover: 'today' is resolved per render, but nothing re-renders
  // at 00:00 — a tab left open overnight would keep writing to yesterday's
  // blob. A timer armed for local midnight plus a wake-from-sleep/refocus
  // tick keep dateStr honest (browsers throttle background timers, so the
  // visibility tick is what actually heals the overnight case).
  const [, setDayTick] = useState(0);
  useEffect(() => {
    if (dayToken !== 'today' && dayToken !== 'tomorrow') return;
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const timer = setTimeout(
      () => setDayTick((t) => t + 1),
      Math.max(1_000, nextMidnight.getTime() - now.getTime()),
    );
    const onWake = () => {
      if (document.visibilityState === 'visible') setDayTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onWake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [dayToken, dateStr]);

  // Day continuity: a date with nothing stored wakes up prefilled from the
  // weekday template (display-only until the first edit persists it);
  // yesterday's leftovers arrive through the carry-over bar as real tasks.
  const materialized = useMemo(() => materializeNewDay(settings, dateStr), [settings, dateStr]);
  const effectiveDays = useMemo(
    () => (days[dateStr] ? days : { ...days, [dateStr]: materialized }),
    [days, dateStr, materialized],
  );

  // Refs updated synchronously by patches so consecutive same-tick writes
  // compose (e.g. workout set → completion sync) instead of clobbering.
  const daysRef = useRef(effectiveDays);
  const settingsRef = useRef(settings);
  const readyRef = useRef({ week: weekReady, settings: settingsReady });
  useLayoutEffect(() => {
    daysRef.current = effectiveDays;
  }, [effectiveDays]);
  useLayoutEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useLayoutEffect(() => {
    readyRef.current = { week: weekReady, settings: settingsReady };
  }, [weekReady, settingsReady]);

  const patchDate = useCallback(
    (date: string, patch: DayPatch) => {
      // Never compose a whole-blob save before the stored rows arrive — that
      // would overwrite a filled server day with template/blank data. The
      // load window is sub-second; an edit inside it is dropped, not saved
      // wrong (and the error banner below covers the failed-fetch case).
      if (!readyRef.current.week || !readyRef.current.settings) return;
      const current = daysRef.current[date] ?? materializeNewDay(settingsRef.current, date);
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
    (patch: SettingsPatch) => {
      // Same guard as patchDate: a PUT composed from the defaults (settings
      // fetch in flight or failed) would wipe every customization.
      if (!readyRef.current.settings) return;
      const current = settingsRef.current;
      const partial = typeof patch === 'function' ? patch(current) : patch;
      const next = { ...current, ...partial };
      settingsRef.current = next;
      saveSettings(next);
    },
    [saveSettings],
  );

  const day = effectiveDays[dateStr] ?? materialized;
  const dayTodos = filterTodosForDay(todos, dayToken);
  const taskDone = dayTodos.filter((t) => t.isCompleted).length;
  const tomorrowStr = daysAfter(dateStr, 1);
  const tomorrowTodos = filterTodosForDay(todos, tomorrowStr);
  const highTodos = dayTodos.filter((t) => t.priority === 'high');

  const openTask = useCallback(
    (todo: Todo, dayStr: string) => onOpenTask?.(todo, dayStr),
    [onOpenTask],
  );

  // Add Task popup — one composer, re-targeted per card (date, optional hour).
  const [composerTarget, setComposerTarget] = useState<{
    open: boolean;
    date: string;
    time?: string | undefined;
  }>({ open: false, date: dateStr });
  const openComposer = useCallback(
    (date: string, time?: string) => setComposerTarget({ open: true, date, time }),
    [],
  );
  const closeComposer = useCallback(() => setComposerTarget((t) => ({ ...t, open: false })), []);

  // Task preview popup — clicking a task on a card opens a read-first detail
  // view (check it / its subtasks) rather than jumping to the Tasks editor.
  // Held by id and re-derived from the live list so toggles reflect at once.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTodo = previewId ? (todos.find((t) => t.id === previewId) ?? null) : null;

  // Quick-add in the To-Do card creates a REAL task due the selected day.
  const createTodo = useCreateTodo();
  const [quickDraft, setQuickDraft] = useState('');
  const [quickError, setQuickError] = useState('');
  const quickAdd = useCallback(() => {
    const title = quickDraft.trim();
    if (!title || createTodo.isPending) return;
    setQuickError('');
    createTodo.mutate(
      {
        title,
        description: null,
        dueDate: dateStr,
        dueTime: null,
        tags: [],
        isFlagged: false,
        duration: 0,
        priority: 'medium',
        subtasks: [],
        recurrence: null,
      },
      {
        // Clear only on success — and only if the user hasn't already typed
        // the next thing while the create was in flight.
        onSuccess: () => setQuickDraft((d) => (d.trim() === title ? '' : d)),
        onError: () => setQuickError('Could not add the task. Try again.'),
      },
    );
  }, [quickDraft, createTodo, dateStr]);

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const dragKey = useRef<string | null>(null);

  // Carry-over: yesterday's unfinished priorities / legacy quick / tomorrow
  // notes, one tap to adopt as REAL tasks. `day.carryHandled` persists the
  // outcome (Add or Dismiss) so the bar never re-offers after a reload.
  // Offered on TODAY only — on other days "yesterday" isn't yesterday, and
  // on the tomorrow view the bar would invite duplicating in-progress work.
  const isToday = dateStr === resolveDayString('today');
  const carry = useMemo(() => carryOverFrom(yesterday), [yesterday]);
  const [carryError, setCarryError] = useState(false);
  const addCarryAsTasks = useCallback(() => {
    const existing = new Set(
      filterTodosForDay(todos, dateStr).map((t) => t.title.trim().toLowerCase()),
    );
    const creates: Promise<unknown>[] = [];
    for (const title of carryTitles(carry)) {
      const key = title.trim().toLowerCase();
      if (!key || existing.has(key)) continue;
      existing.add(key);
      creates.push(
        createTodo.mutateAsync({
          title,
          description: null,
          dueDate: dateStr,
          dueTime: null,
          tags: [],
          isFlagged: false,
          duration: 0,
          priority: 'medium',
          subtasks: [],
          recurrence: null,
        }),
      );
    }
    setCarryError(false);
    void Promise.allSettled(creates).then((results) => {
      // Don't burn the one-shot offer if every create failed (offline etc.).
      if (results.some((r) => r.status === 'rejected')) setCarryError(true);
      if (creates.length === 0 || results.some((r) => r.status === 'fulfilled')) {
        patchDay({ carryHandled: true });
      }
    });
  }, [carry, todos, createTodo, dateStr, patchDay]);

  // Personal suggestion pools from the last 28 days.
  const prioSugs = useMemo(() => prioritySuggestions(recentDays), [recentDays]);
  const quickSugs = useMemo(() => quickSuggestions(recentDays), [recentDays]);
  const recentMeals = useMemo(() => recentMealItems(recentDays), [recentDays]);
  const suggestionsForHour = useCallback(
    (hour: string) => scheduleSuggestions(recentDays, hour),
    [recentDays],
  );

  // Card order: persisted secOrder ∪ registry (new cards append).
  const persistedOrder = settings.secOrder.filter((k) => (PLAN_GRID_KEYS as string[]).includes(k));
  for (const key of PLAN_GRID_KEYS) if (!persistedOrder.includes(key)) persistedOrder.push(key);

  // Fluid drag: while a card is in flight, the grid reorders LIVE under the
  // cursor (previewOrder) and only commits on drop — a cancelled drag snaps
  // back. The ref mirrors the state so drag handlers never read stale order.
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const previewRef = useRef<string[] | null>(null);
  const setPreview = (next: string[] | null) => {
    previewRef.current = next;
    setPreviewOrder(next);
  };
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const order = previewOrder ?? persistedOrder;

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

  // FLIP: whenever cards land in new grid slots (drag preview, drop, width
  // toggle), glide them from their previous position instead of teleporting.
  const cardRects = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const origin = grid.getBoundingClientRect();
    const previous = cardRects.current;
    const next = new Map<string, { left: number; top: number }>();
    for (const el of grid.children) {
      const key = (el as HTMLElement).dataset['sec'];
      if (!key) continue;
      const rect = el.getBoundingClientRect();
      const pos = { left: rect.left - origin.left, top: rect.top - origin.top };
      next.set(key, pos);
      const old = previous.get(key);
      if (!reduced && old && typeof el.animate === 'function') {
        const dx = old.left - pos.left;
        const dy = old.top - pos.top;
        if (dx !== 0 || dy !== 0) {
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
          );
        }
      }
    }
    cardRects.current = next;
  });

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

  const dragStart = (key: string) => {
    dragKey.current = key;
    setDraggingKey(key);
  };
  // Make room live: moving over a card slides the dragged card into its slot
  // (after it when travelling forward, before it when travelling back).
  const dragOverCard = (target: string) => {
    const from = dragKey.current;
    if (!from || from === target) return;
    const base = previewRef.current ?? persistedOrder;
    const fromIdx = base.indexOf(from);
    const targetIdx = base.indexOf(target);
    if (fromIdx === -1 || targetIdx === -1) return;
    const next = base.filter((k) => k !== from);
    next.splice(fromIdx < targetIdx ? next.indexOf(target) + 1 : next.indexOf(target), 0, from);
    if (next.join('|') !== base.join('|')) setPreview(next);
  };
  const commitDrag = () => {
    const from = dragKey.current;
    const preview = previewRef.current;
    dragKey.current = null;
    setDraggingKey(null);
    setPreview(null);
    if (from && preview) patchSettings({ secOrder: preview });
  };
  // dragend without a drop (Escape, released outside) — snap back.
  const cancelDrag = () => {
    if (dragKey.current === null && previewRef.current === null) return;
    dragKey.current = null;
    setDraggingKey(null);
    setPreview(null);
  };
  // Keyboard reorder from the grip: one slot per arrow press, persisted.
  const moveCard = (key: string, delta: -1 | 1) => {
    const at = persistedOrder.indexOf(key);
    const to = at + delta;
    if (at === -1 || to < 0 || to >= persistedOrder.length) return;
    const next = [...persistedOrder];
    next.splice(at, 1);
    next.splice(to, 0, key);
    patchSettings({ secOrder: next });
  };

  // One toggle for tasks from any card (today's and tomorrow's alike).
  const toggleTask = useCallback(
    (id: string) => {
      const task = todos.find((t) => t.id === id);
      if (task) toggleComplete.mutate({ id, isCompleted: task.isCompleted });
    },
    [todos, toggleComplete],
  );

  // Subtasks are checkable right from the plan (task rows + schedule chips).
  const updateSubtasks = useUpdateSubtasks();
  const toggleSubtask = useCallback(
    (todo: Todo, subtaskId: string) => {
      updateSubtasks.mutate({
        id: todo.id,
        subtasks: todo.subtasks.map((sub) =>
          sub.subtaskId === subtaskId ? { ...sub, isCompleted: !sub.isCompleted } : sub,
        ),
      });
    },
    [updateSubtasks],
  );

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

  const saveStatus = usePlanSaveStatus();
  const hiddenChips = PLAN_SECTIONS.filter(([key]) => settings.hidden[key]);

  // Week Review aggregates — computed over stored week rows + this week's
  // real tasks; missing days stay null (an empty bar, not a zero).
  const weekStats = useMemo(() => {
    const habitIds = settings.habits.map((h) => h.id);
    const scores: (number | null)[] = [];
    let habitDone = 0;
    let habitCounted = 0;
    let waterSum = 0;
    let storedDays = 0;
    let tasksDone = 0;
    let tasksTotal = 0;
    for (const date of weekDates) {
      const dayTasks = filterTodosForDay(todos, date);
      tasksTotal += dayTasks.length;
      tasksDone += dayTasks.filter((t) => t.isCompleted).length;
      const row = effectiveDays[date];
      if (!row) {
        scores.push(null);
        continue;
      }
      scores.push(
        computeScore({
          day: row,
          taskTotal: dayTasks.length,
          taskDone: dayTasks.filter((t) => t.isCompleted).length,
          habitIds,
          waterGoal: settings.targets.water,
          nonnegCount: settings.nonnegLabels.length,
          hidden: settings.hidden,
        }),
      );
      storedDays += 1;
      waterSum += row.water;
      for (const id of habitIds) {
        const mark = row.habits[id];
        if (mark === 'skip') continue;
        habitCounted += 1;
        if (mark === true) habitDone += 1;
      }
    }
    return {
      scores,
      habitPct: habitCounted > 0 ? Math.round((habitDone / habitCounted) * 100) : null,
      waterAvg: storedDays > 0 ? Math.round((waterSum / storedDays) * 10) / 10 : null,
      tasksDone,
      tasksTotal,
    };
  }, [weekDates, effectiveDays, todos, settings]);
  const score = computeScore({
    day,
    taskTotal: dayTodos.length,
    taskDone,
    habitIds: settings.habits.map((h) => h.id),
    waterGoal: settings.targets.water,
    nonnegCount: settings.nonnegLabels.length,
    hidden: settings.hidden,
  });

  const daysHabits: Record<string, Record<string, HabitMark>> = {};
  for (const date of weekDates) daysHabits[date] = effectiveDays[date]?.habits ?? {};

  // Most recent earlier weigh-in (28-day window) — the Weight card's
  // comparison line. Same data horizon as streaks/history. Plain loop (no
  // manual memo): the React Compiler auto-memoizes, and a manual useMemo here
  // isn't preservable, which would make it skip optimizing the component.
  let lastWeighIn: { date: string; kg: number } | null = null;
  for (let back = 1; back <= 28; back += 1) {
    const date = daysBefore(dateStr, back);
    const row = effectiveDays[date] ?? recentByDate[date];
    if (row && row.weight > 0) {
      lastWeighIn = { date, kg: row.weight };
      break;
    }
  }
  // Effective body weight + most recent fat% — inputs to the energy ledger
  // (BMR/maintenance) and the cardio calorie estimates. 0 = unknown.
  const effectiveWeightKg = day.weight > 0 ? day.weight : (lastWeighIn?.kg ?? 0);
  let lastFatPct = day.body.fat;
  if (lastFatPct <= 0) {
    for (let back = 1; back <= 28; back += 1) {
      const date = daysBefore(dateStr, back);
      const row = effectiveDays[date] ?? recentByDate[date];
      if (row && row.body.fat > 0) {
        lastFatPct = row.body.fat;
        break;
      }
    }
  }
  // Masthead energy summary: kcal-left ring always works off intake vs target;
  // the deficit/surplus label needs a BMR-capable profile. Hidden with the
  // Meals card (no food tracking → no kcal summary).
  const intakeKcal = Math.round(
    MEAL_SLOTS.reduce(
      (sum, slot) => sum + day.meals[slot].reduce((a, item) => a + (Number(item.cal) || 0), 0),
      0,
    ),
  );
  const mastheadEnergy = settings.hidden['meals']
    ? null
    : (() => {
        const bmrRes = bmr({
          weightKg: effectiveWeightKg,
          fatPct: lastFatPct,
          heightCm: settings.height,
          birthYear: settings.profile.birthYear,
          sex: settings.profile.sex,
          currentYear: new Date().getFullYear(),
        });
        const burned = Math.round(
          Object.values(day.cardioDone ?? {}).reduce((sum, cardio) => sum + cardio.kcal, 0),
        );
        const mealCount = MEAL_SLOTS.reduce((a, slot) => a + day.meals[slot].length, 0);
        const balance = bmrRes
          ? dayBalance(
              intakeKcal,
              mealCount,
              maintenanceBase(bmrRes.kcal, settings.profile.activity),
              burned,
            )
          : null;
        return { intake: intakeKcal, target: settings.targets.kcal, balance };
      })();

  // Streaks + 28-day history: marks come from this week's cache plus the
  // recent window (28 days ending yesterday), all relative to the selected
  // day — a ~5-week horizon, plenty for the streaks that matter daily.
  const markSource = useCallback(
    (habitId: string) => (date: string) =>
      (effectiveDays[date] ?? recentByDate[date])?.habits[habitId],
    [effectiveDays, recentByDate],
  );
  const streaks = useMemo(() => {
    const out: Record<string, number> = {};
    for (const habit of settings.habits) {
      out[habit.id] = habitStreak(markSource(habit.id), dateStr);
    }
    return out;
  }, [settings.habits, markSource, dateStr]);
  const historyFor = useCallback(
    (habitId: string) => habitHistory(markSource(habitId), dateStr),
    [markSource, dateStr],
  );

  const bodies: Record<PlanSectionKey, { badge?: string; body: ReactElement } | null> = {
    schedule: {
      body: (
        <ScheduleBody
          day={day}
          patch={patchDay}
          startHour={settings.dayStartHour}
          endHour={settings.dayEndHour}
          suggestionsFor={suggestionsForHour}
          todos={dayTodos}
          onToggleTodo={toggleTask}
          onOpenTask={(todo) => setPreviewId(todo.id)}
          onAddTaskAt={(hour) => openComposer(dateStr, hour)}
          onToggleSubtask={toggleSubtask}
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
          highTodos={highTodos}
          onToggleTodo={toggleTask}
          onOpenTask={(todo) => setPreviewId(todo.id)}
          onToggleSubtask={toggleSubtask}
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
          onMark={(date, habitId, next) =>
            patchDate(date, (d) => ({ habits: { ...d.habits, [habitId]: next } }))
          }
          onEditHabits={(updater) => patchSettings((s) => ({ habits: updater(s.habits) }))}
          streaks={streaks}
          historyFor={historyFor}
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
          bodyWeightKg={effectiveWeightKg}
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
          onToggleTodo={toggleTask}
          onOpenTask={(todo) => setPreviewId(todo.id)}
          onAddTask={() => openComposer(dateStr)}
          quickDraft={quickDraft}
          onQuickDraft={setQuickDraft}
          onQuickAdd={quickAdd}
          quickPending={createTodo.isPending}
          quickError={quickError}
          suggestions={quickSugs}
          onToggleSubtask={toggleSubtask}
        />
      ),
    },
    water: {
      badge: `${Math.min(day.water, settings.targets.water)} / ${settings.targets.water} cups`,
      body: <WaterBody day={day} patch={patchDay} goal={settings.targets.water} />,
    },
    weight: {
      ...(day.weight > 0 ? { badge: `${Math.round(day.weight * 10) / 10} kg` } : {}),
      body: (
        <WeightBody
          day={day}
          patch={patchDay}
          lastWeighIn={lastWeighIn}
          settings={settings}
          patchSettings={patchSettings}
        />
      ),
    },
    tomorrow: {
      body: (
        <TomorrowBody
          day={day}
          patch={patchDay}
          count={settings.tomorrowCount}
          todos={tomorrowTodos}
          onToggleTodo={toggleTask}
          onOpenTask={(todo) => setPreviewId(todo.id)}
          onAddTask={() => openComposer(tomorrowStr)}
          onToggleSubtask={toggleSubtask}
        />
      ),
    },
    week: {
      body: (
        <WeekReviewBody
          weekDates={weekDates}
          selectedIdx={selectedIdx}
          weekLetters={WEEK_LETTERS}
          scores={weekStats.scores}
          habitPct={weekStats.habitPct}
          waterAvg={weekStats.waterAvg}
          tasksDone={weekStats.tasksDone}
          tasksTotal={weekStats.tasksTotal}
          onSelectDay={onSelectDay}
          onOpenFull={onOpenReview ? () => onOpenReview(weekDates[0] ?? dateStr) : undefined}
        />
      ),
    },
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
        <SaveIndicator status={saveStatus} />
        <Segmented
          label="Theme"
          options={[
            ['dark', 'DARK'],
            ['paper', 'PAPER'],
          ]}
          // Honest state: on any of the other 8 app themes neither tab is
          // active (the old ternary showed DARK as selected on all of them).
          value={theme === 'paper' || theme === 'dark' ? theme : ''}
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

      <Masthead
        dateStr={dateStr}
        score={score}
        subtitle={settings.subtitle}
        onSelectDay={onSelectDay}
        energy={mastheadEnergy}
      />

      {weekError && !weekReady && (
        <div className={styles.hiddenBar} role="alert">
          <span className={styles.hiddenBarLabel}>Offline?</span>
          <span style={{ fontSize: 12 }}>
            Couldn&apos;t load this day&apos;s plan — editing is paused so nothing gets overwritten.
          </span>
          <button type="button" className={styles.hiddenChip} onClick={() => void refetchWeek()}>
            Retry
          </button>
        </div>
      )}

      {isToday && carry.count > 0 && !day.carryHandled && (
        <div className={styles.hiddenBar} role="status">
          <span className={styles.hiddenBarLabel}>Yesterday</span>
          <span style={{ fontSize: 12 }}>
            {carryError
              ? "Couldn't add the tasks — check your connection and try again."
              : `${carry.count} unfinished item${carry.count > 1 ? 's' : ''} from yesterday`}
          </span>
          <button type="button" className={styles.hiddenChip} onClick={addCarryAsTasks}>
            {carryError ? 'Retry' : 'Add as tasks'}
          </button>
          <button
            type="button"
            className={styles.showAll}
            onClick={() => patchDay({ carryHandled: true })}
          >
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

      <div
        ref={gridRef}
        className={styles.grid}
        // Dropping in a gap between cards is as valid as dropping on one —
        // the live preview has already placed the card; just commit.
        onDragOver={(event) => {
          if (dragKey.current) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          commitDrag();
        }}
      >
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
              dragging={draggingKey === key}
              onToggleWide={() => toggleWide(key)}
              onHide={() => hide(key)}
              onDragStartKey={dragStart}
              onDragOverKey={dragOverCard}
              onDragEndKey={cancelDrag}
              onDropOnKey={() => commitDrag()}
              onMoveKey={moveCard}
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
          weightKg={effectiveWeightKg}
          fatPct={lastFatPct}
          onOpenSettings={() => setCustomizeOpen(true)}
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
        weightKg={effectiveWeightKg}
        fatPct={lastFatPct}
      />

      <ComposerModal
        open={composerTarget.open}
        allTags={allTags}
        allTodos={todos}
        effectiveDate={composerTarget.date}
        initialDueDate={composerTarget.date}
        initialDueTime={composerTarget.time}
        onClose={closeComposer}
      />

      <TaskPreviewModal
        todo={previewTodo}
        onClose={() => setPreviewId(null)}
        onToggleComplete={toggleTask}
        onToggleSubtask={toggleSubtask}
        onEdit={(todo) => {
          setPreviewId(null);
          openTask(todo, todo.dueDate ?? dateStr);
        }}
      />
    </div>
  );
}

/**
 * Honest write indicator: Saving… while any day/settings blob is dirty,
 * Saved ✓ for a moment once everything lands, a sticky warning on failure.
 */
function SaveIndicator({ status }: { status: PlanSaveStatus }) {
  // Saving/error derive straight from status; 'saved' lingers for a moment
  // (render-time transition detection + a timer, no set-state-in-effect).
  const [savedVisible, setSavedVisible] = useState(false);
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status === 'saved') setSavedVisible(true);
  }
  useEffect(() => {
    if (!savedVisible) return;
    const timer = setTimeout(() => setSavedVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [savedVisible]);
  const visible = status === 'saving' || status === 'error' || (status === 'saved' && savedVisible);
  if (!visible) return null;
  return (
    <span className={styles.saveHint} role="status" data-state={status}>
      {status === 'saving' ? 'Saving…' : status === 'error' ? 'Couldn’t save' : 'Saved ✓'}
    </span>
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
