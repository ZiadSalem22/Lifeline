import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type {
  DailyPlanData,
  DailyPlanSettings,
  HabitMark,
  PlanHabit,
  Todo,
} from '@lifeline/shared';
import {
  WEEK_DAY_NAMES,
  dividerBelowAt,
  newHabitId,
  scheduleHours,
  withDividerAt,
} from './lib/plan-model';
import {
  fromLengthDisplay,
  fromWeightDisplay,
  toLengthDisplay,
  toWeightDisplay,
} from './lib/units';
import { PRAYER_HABIT_IDS, type DayPrayers, type PrayerKey } from './lib/prayer-times';
import { formatClock, type TimeFormat } from './lib/time-format';
import styles from './DailyPlan.module.css';

/**
 * The simple Daily Plan cards (design handoff): Schedule, Focus, Gratitude,
 * Mood, Top-3 Priorities, Habits week grid, Evening Review, To-Do List,
 * Water, Tomorrow. Each is a controlled view over the day blob; writes go
 * through `patch` (debounced upstream).
 */

type Patch = (patch: Partial<DailyPlanData>) => void;

export function CircleCheck(props: {
  on: boolean;
  size: number;
  label: string;
  onToggle: () => void;
  className?: string | undefined;
}) {
  // Scales with the plan's SIZE setting — bigger text deserves bigger targets.
  const style: CSSProperties = {
    width: `calc(${props.size}px * var(--plan-scale, 1))`,
    height: `calc(${props.size}px * var(--plan-scale, 1))`,
  };
  return (
    <button
      type="button"
      className={[styles.circle, props.on ? styles.circleOn : undefined, props.className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-pressed={props.on}
      aria-label={props.label}
      onClick={props.onToggle}
    />
  );
}

export function SquareCheck(props: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={props.on ? `${styles.square} ${styles.squareOn}` : styles.square}
      aria-pressed={props.on}
      aria-label={props.label}
      onClick={props.onToggle}
    >
      {props.on ? '✓' : ''}
    </button>
  );
}

type SubtaskToggle = (todo: Todo, subtaskId: string) => void;

/** Up to 3 tag dots + "+N"; full names in the tooltip. Compact for card rows. */
function TagCluster({ tags }: { tags: Todo['tags'] }) {
  if (tags.length === 0) return null;
  return (
    <span className={styles.tagCluster} title={tags.map((tag) => tag.name).join(', ')}>
      {tags.slice(0, 3).map((tag) => (
        <span key={tag.id} className={styles.tagDot} style={{ background: tag.color }} />
      ))}
      {tags.length > 3 && <span className={styles.tagMore}>+{tags.length - 3}</span>}
    </span>
  );
}

/** Expandable subtask checklist shared by task rows and schedule chips. */
function SubtaskDisclosure(props: { todo: Todo; expanded: boolean; onToggleExpand: () => void }) {
  const done = props.todo.subtasks.filter((s) => s.isCompleted).length;
  return (
    <button
      type="button"
      className={styles.subCountBtn}
      aria-expanded={props.expanded}
      aria-label={`Subtasks of task ${props.todo.taskNumber}`}
      onClick={props.onToggleExpand}
    >
      {done}/{props.todo.subtasks.length}
      <svg
        width="8"
        height="8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ transform: props.expanded ? 'rotate(180deg)' : undefined }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

function SubtaskList(props: { todo: Todo; onToggleSubtask: SubtaskToggle }) {
  return (
    <div className={styles.subtaskList}>
      {props.todo.subtasks.map((sub) => (
        <div key={sub.subtaskId} className={styles.subtaskRow}>
          <SquareCheck
            on={sub.isCompleted}
            label={`Toggle subtask ${sub.title}`}
            onToggle={() => props.onToggleSubtask(props.todo, sub.subtaskId)}
          />
          <span dir="auto" className={sub.isCompleted ? styles.todoTitleDone : styles.todoTitle}>
            {sub.title}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One real task as a plan-card row: check, #num, title (opens in Tasks), subtasks. */
function TaskRow(props: {
  todo: Todo;
  onToggle: () => void;
  onOpen: (todo: Todo) => void;
  onToggleSubtask?: SubtaskToggle | undefined;
}) {
  const { todo } = props;
  const [expanded, setExpanded] = useState(false);
  const expandable = todo.subtasks.length > 0 && props.onToggleSubtask !== undefined;
  return (
    <>
      <div className={styles.rowRule} style={{ padding: '5px 0', gap: 9 }}>
        <SquareCheck
          on={todo.isCompleted}
          label={`Toggle task ${todo.taskNumber}`}
          onToggle={props.onToggle}
        />
        <span className={styles.numChip}>#{todo.taskNumber}</span>
        {todo.isCompleted ? (
          // The Tasks editor refuses completed tasks — plain text, no dead link.
          <span dir="auto" className={styles.todoTitleDone}>
            {todo.title}
          </span>
        ) : (
          <button
            type="button"
            dir="auto"
            className={styles.todoTitleBtn}
            title="Preview task"
            onClick={() => props.onOpen(todo)}
          >
            {todo.title}
          </button>
        )}
        {expandable ? (
          <SubtaskDisclosure
            todo={todo}
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
          />
        ) : (
          todo.subtasks.length > 0 && (
            <span className={styles.todoSub}>
              {todo.subtasks.filter((s) => s.isCompleted).length}/{todo.subtasks.length}
            </span>
          )
        )}
        <TagCluster tags={todo.tags} />
      </div>
      {expandable && expanded && props.onToggleSubtask && (
        <SubtaskList todo={todo} onToggleSubtask={props.onToggleSubtask} />
      )}
    </>
  );
}

/** Small right-aligned "+ Add Task" header row shared by the task-aware cards. */
function AddTaskRow(props: { label: string; onAdd: () => void }) {
  return (
    <div className={styles.addTaskRow}>
      <button
        type="button"
        className={styles.addTaskBtn}
        aria-label={props.label}
        onClick={props.onAdd}
      >
        + ADD TASK
      </button>
    </div>
  );
}

/* ── Schedule ────────────────────────────────────────────────────────────── */

export interface ScheduleBodyProps {
  day: DailyPlanData;
  patch: Patch;
  startHour: number;
  endHour: number;
  /** Personal suggestions for an hour, mined from recent days. */
  suggestionsFor: (hour: string) => string[];
  /** The day's real tasks — ones with a dueTime appear under their hour row. */
  todos: Todo[];
  onToggleTodo: (id: string) => void;
  onOpenTask: (todo: Todo) => void;
  onAddTaskAt: (hour: string) => void;
  onToggleSubtask?: SubtaskToggle | undefined;
  /** Viewing TODAY: the current hour gets a live band and the list opens on it. */
  isToday?: boolean;
  /** 24h vs 12h clock display (times are stored 24h regardless). */
  timeFormat?: TimeFormat;
}

function SchedChip(props: {
  todo: Todo;
  /** Always show the time (off-hours chips) vs only off-hour minutes. */
  alwaysTime?: boolean;
  timeFormat: TimeFormat;
  onToggle: () => void;
  onOpen: (todo: Todo) => void;
  onToggleSubtask?: SubtaskToggle | undefined;
}) {
  const { todo } = props;
  const [expanded, setExpanded] = useState(false);
  const expandable = todo.subtasks.length > 0 && props.onToggleSubtask !== undefined;
  const showTime =
    todo.dueTime !== null && (props.alwaysTime === true || !todo.dueTime.endsWith(':00'));
  return (
    <>
      <div className={styles.schedChip}>
        <SquareCheck
          on={todo.isCompleted}
          label={`Toggle task ${todo.taskNumber}`}
          onToggle={props.onToggle}
        />
        {todo.isCompleted ? (
          <span dir="auto" className={styles.todoTitleDone}>
            {todo.title}
          </span>
        ) : (
          <button
            type="button"
            dir="auto"
            className={styles.todoTitleBtn}
            title="Preview task"
            onClick={() => props.onOpen(todo)}
          >
            {todo.title}
          </button>
        )}
        {expandable && (
          <SubtaskDisclosure
            todo={todo}
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
          />
        )}
        {showTime && todo.dueTime && (
          <span className={styles.chipTime}>{formatClock(todo.dueTime, props.timeFormat)}</span>
        )}
        <TagCluster tags={todo.tags} />
      </div>
      {expandable && expanded && props.onToggleSubtask && (
        <div className={styles.schedChipSubs}>
          <SubtaskList todo={todo} onToggleSubtask={props.onToggleSubtask} />
        </div>
      )}
    </>
  );
}

export function ScheduleBody({
  day,
  patch,
  startHour,
  endHour,
  suggestionsFor,
  todos,
  onToggleTodo,
  onOpenTask,
  onAddTaskAt,
  onToggleSubtask,
  isToday = false,
  timeFormat = '24h',
}: ScheduleBodyProps) {
  const hours = scheduleHours(startHour, endHour);
  const byTime = (a: Todo, b: Todo) => (a.dueTime ?? '').localeCompare(b.dueTime ?? '');
  // Timed tasks outside the configured hours must not silently vanish.
  const offHours = todos
    .filter(
      (t) =>
        t.dueTime !== null && !new Set(hours.map((h) => h.slice(0, 3))).has(t.dueTime.slice(0, 3)),
    )
    .sort(byTime);

  // Live "now" band (today only): the hour is read fresh each render; a
  // minute tick forces a render so the band crosses hour boundaries while
  // the tab stays open.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [isToday]);
  const nowHour = new Date().getHours();
  const nowLabel = isToday ? `${nowHour < 10 ? '0' : ''}${nowHour}:00` : null;

  // Open on "now": today's list starts scrolled so the current hour sits a
  // third of the way down its window instead of at 04:00.
  const listRef = useRef<HTMLDivElement | null>(null);
  const nowRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = nowRef.current;
    if (!isToday || !list || !row) return;
    list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - list.clientHeight / 3);
  }, [isToday]);

  return (
    <div className={styles.cardBody}>
      {/* The full day of hour rows scrolls inside the card on phones. */}
      <div ref={listRef} className={`${styles.scrollList} ${styles.scrollTall}`}>
        {hours.map((time) => {
          const suggestions = suggestionsFor(time);
          // '13:30' lands on the '13:00' row; the chip shows the real minutes.
          const rowTodos = todos
            .filter((t) => t.dueTime?.startsWith(time.slice(0, 3)))
            .sort(byTime);
          const isNow = time === nowLabel;
          return (
            <div key={time} ref={isNow ? nowRef : undefined}>
              <div
                className={[styles.rowRule, styles.schedRow, isNow ? styles.schedRowNow : undefined]
                  .filter(Boolean)
                  .join(' ')}
                {...(isNow ? { 'data-now': '' } : {})}
              >
                <span className={styles.schedTime}>{formatClock(time, timeFormat)}</span>
                <input
                  dir="auto"
                  className={styles.inputBare}
                  maxLength={500}
                  value={day.schedule[time] ?? ''}
                  aria-label={`Schedule ${formatClock(time, timeFormat)}`}
                  list={suggestions.length > 0 ? `plan-sched-sug-${time}` : undefined}
                  onChange={(e) => patch({ schedule: { ...day.schedule, [time]: e.target.value } })}
                />
                {suggestions.length > 0 && (
                  <datalist id={`plan-sched-sug-${time}`}>
                    {suggestions.map((text) => (
                      <option key={text} value={text} />
                    ))}
                  </datalist>
                )}
                <button
                  type="button"
                  className={styles.rowAddBtn}
                  aria-label={`Add task at ${formatClock(time, timeFormat)}`}
                  onClick={() => onAddTaskAt(time)}
                >
                  +
                </button>
              </div>
              {rowTodos.map((todo) => (
                <SchedChip
                  key={todo.id}
                  todo={todo}
                  timeFormat={timeFormat}
                  onToggle={() => onToggleTodo(todo.id)}
                  onOpen={onOpenTask}
                  onToggleSubtask={onToggleSubtask}
                />
              ))}
            </div>
          );
        })}
        {offHours.length > 0 && (
          <div>
            <div className={styles.sectionMiniMuted} style={{ paddingTop: 8 }}>
              Outside hours
            </div>
            {offHours.map((todo) => (
              <SchedChip
                key={todo.id}
                todo={todo}
                alwaysTime
                timeFormat={timeFormat}
                onToggle={() => onToggleTodo(todo.id)}
                onOpen={onOpenTask}
                onToggleSubtask={onToggleSubtask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Focus / Gratitude / Evening Review ──────────────────────────────────── */

export function FocusBody({ day, patch }: { day: DailyPlanData; patch: Patch }) {
  return (
    <div className={styles.cardBody}>
      <div className={styles.prompt}>Today I will focus on:</div>
      <textarea
        dir="auto"
        className={styles.lined}
        rows={3}
        maxLength={2000}
        value={day.focusText}
        aria-label="Focus"
        onChange={(e) => patch({ focusText: e.target.value })}
      />
    </div>
  );
}

export function GratitudeBody({
  day,
  patch,
  count,
}: {
  day: DailyPlanData;
  patch: Patch;
  count: number;
}) {
  const rows = Array.from({ length: count }, (_, i) => day.gratitude[i] ?? '');
  const write = (i: number, value: string) => {
    const next = Array.from(
      { length: Math.max(count, day.gratitude.length) },
      (_, j) => day.gratitude[j] ?? '',
    );
    next[i] = value;
    patch({ gratitude: next });
  };
  return (
    <div className={styles.cardBody}>
      <div className={styles.prompt}>I am grateful for:</div>
      {rows.map((value, i) => (
        <div key={i} className={styles.rowRule}>
          <span className={styles.schedTime} style={{ width: 14 }}>
            {i + 1}.
          </span>
          <input
            dir="auto"
            className={styles.inputBare}
            maxLength={500}
            value={value}
            aria-label={`Gratitude ${i + 1}`}
            onChange={(e) => write(i, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

export function ReviewBody({ day, patch }: { day: DailyPlanData; patch: Patch }) {
  const linedField = (label: string, value: string, onChange: (next: string) => void, rows = 2) => (
    <div>
      <div className={styles.prompt}>{label}</div>
      <textarea
        dir="auto"
        className={styles.lined}
        rows={rows}
        maxLength={2000}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
  return (
    <div className={styles.cardBody} style={{ gap: 14 }}>
      {linedField('What went well today?', day.reviewWell, (v) => patch({ reviewWell: v }))}
      {linedField('What can I improve?', day.reviewImprove, (v) => patch({ reviewImprove: v }))}
      <div className={styles.moodRow}>
        <span className={styles.prompt} style={{ marginBottom: 0 }}>
          How productive was I?
        </span>
        <span className={styles.dotGroup} style={{ gap: 8 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <button
              key={i}
              type="button"
              className={
                i < day.rating ? `${styles.ratingDot} ${styles.circleOn}` : styles.ratingDot
              }
              aria-label={`Rating ${i + 1}`}
              aria-pressed={i < day.rating}
              onClick={() => patch({ rating: i + 1 === day.rating ? 0 : i + 1 })}
            >
              {i + 1}
            </button>
          ))}
        </span>
      </div>
      {linedField("Tomorrow I'm looking forward to:", day.reviewForward, (v) =>
        patch({ reviewForward: v }),
      )}
    </div>
  );
}

/* ── Mood & Energy ───────────────────────────────────────────────────────── */

export function MoodBody({ day, patch }: { day: DailyPlanData; patch: Patch }) {
  const row = (label: string, value: number, key: 'moodAm' | 'moodPm') => (
    <div className={styles.moodRow}>
      <span className={styles.moodLabel}>{label}</span>
      <span className={styles.dotGroup}>
        {Array.from({ length: 5 }, (_, i) => (
          <CircleCheck
            key={i}
            on={i < value}
            size={20}
            label={`${label} ${i + 1}`}
            onToggle={() => patch({ [key]: i + 1 === value ? 0 : i + 1 })}
          />
        ))}
      </span>
    </div>
  );
  return (
    <div className={styles.cardBody} style={{ gap: 10 }}>
      {row('Morning', day.moodAm, 'moodAm')}
      {row('Evening', day.moodPm, 'moodPm')}
    </div>
  );
}

/* ── Top 3 Priorities ────────────────────────────────────────────────────── */

export interface PrioritiesBodyProps {
  day: DailyPlanData;
  patch: Patch;
  count: number;
  suggestions: string[];
  /** The day's high-priority real tasks, surfaced above the free slots. */
  highTodos: Todo[];
  onToggleTodo: (id: string) => void;
  onOpenTask: (todo: Todo) => void;
  onToggleSubtask?: SubtaskToggle | undefined;
}

export function PrioritiesBody({
  day,
  patch,
  count,
  suggestions,
  highTodos,
  onToggleTodo,
  onOpenTask,
  onToggleSubtask,
}: PrioritiesBodyProps) {
  const rows = Array.from({ length: count }, (_, i) => day.priorities[i] ?? { t: '', done: false });
  const write = (i: number, item: { t: string; done: boolean }) => {
    const next = Array.from(
      { length: Math.max(count, day.priorities.length) },
      (_, j) => day.priorities[j] ?? { t: '', done: false },
    );
    next[i] = item;
    patch({ priorities: next });
  };
  return (
    <div className={styles.cardBody} style={{ gap: 2 }}>
      {highTodos.length > 0 && (
        <>
          <div className={styles.sectionMiniMuted}>High priority</div>
          {highTodos.map((todo) => (
            <TaskRow
              key={todo.id}
              todo={todo}
              onToggle={() => onToggleTodo(todo.id)}
              onOpen={onOpenTask}
              onToggleSubtask={onToggleSubtask}
            />
          ))}
        </>
      )}
      {suggestions.length > 0 && (
        <datalist id="plan-prio-sug">
          {suggestions.map((text) => (
            <option key={text} value={text} />
          ))}
        </datalist>
      )}
      {rows.map((p, i) => (
        <div key={i} className={styles.rowRule} style={{ padding: '5px 0' }}>
          <span className={styles.prioNum}>{i + 1}.</span>
          <input
            dir="auto"
            className={p.done ? `${styles.inputBare} ${styles.inputDone}` : `${styles.inputBare}`}
            style={{ fontWeight: 600 }}
            maxLength={500}
            value={p.t}
            aria-label={`Priority ${i + 1}`}
            list={suggestions.length > 0 ? 'plan-prio-sug' : undefined}
            onChange={(e) => write(i, { ...p, t: e.target.value })}
          />
          <CircleCheck
            on={p.done}
            size={19}
            label={`Toggle priority ${i + 1}`}
            onToggle={() => write(i, { ...p, done: !p.done })}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Daily Habits Tracker ────────────────────────────────────────────────── */

export interface HabitsBodyProps {
  habits: PlanHabit[];
  weekDates: string[];
  /** habit mark-map per week date (true / false / 'skip'). */
  daysHabits: Record<string, Record<string, HabitMark>>;
  selectedIdx: number;
  weekLetters: readonly string[];
  /** Cell click cycles empty → done → skipped → empty. */
  onMark: (date: string, habitId: string, next: HabitMark) => void;
  /** On-card editing — functional write of the full habits list. */
  onEditHabits: (updater: (habits: PlanHabit[]) => PlanHabit[]) => void;
  /** Current streak per habit id (consecutive done days, skips pass through). */
  streaks: Record<string, number>;
  /** 28-day history per habit id, oldest → newest (label click reveals it). */
  historyFor: (habitId: string) => { date: string; mark: HabitMark | undefined }[];
  /** The selected day's five prayer times (by city), or null when unavailable. */
  prayerTimes?: DayPrayers | null;
  /** Prayer feature is on (a city is set) — gates the empty-city hint. */
  prayerActive?: boolean;
  /** 24h vs 12h clock display for the prayer-time badges. */
  timeFormat?: TimeFormat;
}

/** Fixed prayer-habit ids, for a quick "is this a timed salah" membership test. */
const PRAYER_ID_SET = new Set<string>(PRAYER_HABIT_IDS);

/** empty → done → skipped → empty. */
function nextHabitMark(current: HabitMark | undefined): HabitMark {
  if (current === true) return 'skip';
  if (current === 'skip') return false;
  return true;
}

/** Tri-state tracker cell: empty circle / filled / muted dash (skipped). */
function HabitCell(props: { mark: HabitMark | undefined; label: string; onCycle: () => void }) {
  const state = props.mark === true ? 'on' : props.mark === 'skip' ? 'skip' : 'off';
  return (
    <button
      type="button"
      className={[
        styles.circle,
        styles.habitCell,
        state === 'on' ? styles.circleOn : undefined,
        state === 'skip' ? styles.circleSkip : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: 15, height: 15 }}
      aria-pressed={state === 'on' ? true : state === 'skip' ? 'mixed' : false}
      aria-label={state === 'skip' ? `${props.label} (skipped)` : props.label}
      title={state === 'skip' ? 'Skipped — counts for neither score nor streak' : undefined}
      onClick={props.onCycle}
    >
      {state === 'skip' ? '–' : ''}
    </button>
  );
}

function HabitTrackerRow(props: {
  habit: PlanHabit;
  divide: boolean;
  weekDates: string[];
  daysHabits: Record<string, Record<string, HabitMark>>;
  onMark: (date: string, habitId: string, next: HabitMark) => void;
  streak: number;
  historyFor: (habitId: string) => { date: string; mark: HabitMark | undefined }[];
  /** HH:MM prayer time to show next to the label (salah rows only). */
  timeBadge?: string | null;
}) {
  const { habit } = props;
  const [showHistory, setShowHistory] = useState(false);
  return (
    <>
      <div
        className={[
          styles.habitRow,
          habit.salah ? styles.habitRowSalah : undefined,
          props.divide && !showHistory ? styles.habitRowDivide : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={styles.habitLabel}>
          <button
            type="button"
            dir="auto"
            className={styles.habitLabelBtn}
            aria-expanded={showHistory}
            aria-label={`${habit.label} — show last 28 days`}
            onClick={() => setShowHistory((v) => !v)}
          >
            {habit.label}
          </button>
          {props.timeBadge && (
            <span className={styles.prayerTimeBadge} title="Prayer time for the selected day">
              {props.timeBadge}
            </span>
          )}
          {props.streak >= 2 && (
            <span className={styles.streakChip} title={`${props.streak}-day streak`}>
              ×{props.streak}
            </span>
          )}
        </span>
        {props.weekDates.map((date, di) => {
          const mark = props.daysHabits[date]?.[habit.id];
          return (
            <HabitCell
              key={date}
              mark={mark}
              label={`${habit.label} ${WEEK_DAY_NAMES[di] ?? ''}`}
              onCycle={() => props.onMark(date, habit.id, nextHabitMark(mark))}
            />
          );
        })}
      </div>
      {showHistory && (
        <div
          className={
            props.divide ? `${styles.habitHistory} ${styles.habitRowDivide}` : styles.habitHistory
          }
          role="img"
          aria-label={`${habit.label} last 28 days`}
        >
          {props.historyFor(habit.id).map(({ date, mark }) => (
            <span
              key={date}
              className={[
                styles.histCell,
                mark === true ? styles.histCellOn : undefined,
                mark === 'skip' ? styles.histCellSkip : undefined,
              ]
                .filter(Boolean)
                .join(' ')}
              title={`${date}${mark === true ? ' — done' : mark === 'skip' ? ' — skipped' : ''}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function HabitsBody(props: HabitsBodyProps) {
  const [editing, setEditing] = useState(false);
  // Band position over the selected day's 22px column (3px gaps, rightmost = index 6).
  const bandRight = (6 - props.selectedIdx) * 25 - 2;
  return (
    <div className={styles.cardBody}>
      <div className={styles.bodyTools}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={editing ? 'Done editing habits' : 'Edit habits'}
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? (
            'DONE'
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 3l4 4L7 21H3v-4L17 3z" />
            </svg>
          )}
        </button>
      </div>
      {editing ? (
        <>
          {props.habits.map((habit, i) => (
            <div key={habit.id} className={styles.habitEditRow}>
              <input
                dir="auto"
                className={`${styles.smallInput} ${styles.habitEditName}`}
                maxLength={100}
                value={habit.label}
                aria-label={`Habit ${i + 1} name`}
                onChange={(e) =>
                  props.onEditHabits((habits) =>
                    habits.map((h, j) => (j === i ? { ...h, label: e.target.value } : h)),
                  )
                }
              />
              <label className={styles.habitEditFlag} title="Prayer rows are bold">
                <input
                  type="checkbox"
                  checked={habit.salah}
                  aria-label={`${habit.label} is a prayer`}
                  onChange={(e) =>
                    props.onEditHabits((habits) =>
                      habits.map((h, j) => (j === i ? { ...h, salah: e.target.checked } : h)),
                    )
                  }
                />
                PRAYER
              </label>
              <label className={styles.habitEditFlag} title="Rule line under this row">
                <input
                  type="checkbox"
                  checked={dividerBelowAt(props.habits, i)}
                  aria-label={`Divider below ${habit.label}`}
                  onChange={(e) =>
                    props.onEditHabits((habits) => withDividerAt(habits, i, e.target.checked))
                  }
                />
                DIVIDER
              </label>
              <button
                type="button"
                className={styles.iconBtn}
                style={{ color: 'var(--plan-muted)' }}
                aria-label={`Move ${habit.label} up`}
                disabled={i === 0}
                onClick={() =>
                  props.onEditHabits((habits) => {
                    if (i === 0) return habits;
                    const next = [...habits];
                    const [item] = next.splice(i, 1);
                    if (item) next.splice(i - 1, 0, item);
                    return next;
                  })
                }
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                style={{ color: 'var(--plan-muted)' }}
                aria-label={`Move ${habit.label} down`}
                disabled={i === props.habits.length - 1}
                onClick={() =>
                  props.onEditHabits((habits) => {
                    if (i >= habits.length - 1) return habits;
                    const next = [...habits];
                    const [item] = next.splice(i, 1);
                    if (item) next.splice(i + 1, 0, item);
                    return next;
                  })
                }
              >
                ↓
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Delete habit ${habit.label}`}
                onClick={() => {
                  // Tiny ✕, whole-week history at stake — confirm (app
                  // convention: native confirm, same as task delete).
                  if (!window.confirm(`Delete habit "${habit.label}"?`)) return;
                  props.onEditHabits((habits) => habits.filter((_, j) => j !== i));
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l14 14" />
                  <path d="M19 5L5 19" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.presetChipDashed}
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              props.onEditHabits((habits) => [
                ...habits,
                { id: newHabitId(habits), label: 'New habit', salah: false },
              ])
            }
          >
            + Add habit
          </button>
        </>
      ) : (
        <div className={styles.habitsWrap}>
          <div className={styles.todayBand} style={{ right: bandRight }} />
          <div className={styles.habitsInner}>
            <div className={styles.habitHeadRow}>
              <span />
              {props.weekLetters.map((letter, i) => (
                <span
                  key={i}
                  className={i === props.selectedIdx ? styles.habitHeadToday : styles.habitHead}
                >
                  {letter}
                </span>
              ))}
            </div>
            {props.habits.map((habit, hi) => (
              <HabitTrackerRow
                key={habit.id}
                habit={habit}
                divide={dividerBelowAt(props.habits, hi)}
                weekDates={props.weekDates}
                daysHabits={props.daysHabits}
                onMark={props.onMark}
                streak={props.streaks[habit.id] ?? 0}
                historyFor={props.historyFor}
                timeBadge={
                  habit.salah &&
                  PRAYER_ID_SET.has(habit.id) &&
                  props.prayerTimes?.[habit.id as PrayerKey]
                    ? formatClock(
                        props.prayerTimes[habit.id as PrayerKey],
                        props.timeFormat ?? '24h',
                      )
                    : null
                }
              />
            ))}
          </div>
          {!props.prayerActive && props.habits.some((h) => h.salah) && (
            <p className={styles.prayerHint}>Add your city in Customize to see prayer times.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Week Review ─────────────────────────────────────────────────────────── */

export interface WeekReviewBodyProps {
  weekDates: string[];
  selectedIdx: number;
  weekLetters: readonly string[];
  /** Per-day score, Monday-first; null = nothing stored that day. */
  scores: (number | null)[];
  /** Week habit completion % over counted (non-skipped) marks; null = no data. */
  habitPct: number | null;
  waterAvg: number | null;
  tasksDone: number;
  tasksTotal: number;
  onSelectDay?: ((date: string) => void) | undefined;
  /** Opens the dedicated Weekly Review page for this week. */
  onOpenFull?: (() => void) | undefined;
}

/** Seven mini score bars + week aggregates — "how did this week actually go?". */
export function WeekReviewBody(props: WeekReviewBodyProps) {
  return (
    <div className={styles.cardBody}>
      {props.onOpenFull && (
        <div className={styles.addTaskRow}>
          <button
            type="button"
            className={styles.addTaskBtn}
            aria-label="Open the full weekly review"
            onClick={props.onOpenFull}
          >
            FULL REVIEW →
          </button>
        </div>
      )}
      <div className={styles.weekBars}>
        {props.weekDates.map((date, i) => {
          const score = props.scores[i] ?? null;
          const bar = (
            <span className={styles.weekBarTrack} aria-hidden="true">
              <span
                className={i === props.selectedIdx ? styles.weekBarFillSel : styles.weekBarFill}
                style={{ height: `${score ?? 0}%` }}
              />
            </span>
          );
          const label = `${WEEK_DAY_NAMES[i] ?? ''} ${date}${score === null ? ' — no entry' : ` — ${score}%`}`;
          return (
            <div key={date} className={styles.weekBarCol}>
              {props.onSelectDay ? (
                <button
                  type="button"
                  className={styles.weekBarBtn}
                  aria-label={label}
                  onClick={() => props.onSelectDay?.(date)}
                >
                  {bar}
                </button>
              ) : (
                <span className={styles.weekBarBtn} aria-label={label}>
                  {bar}
                </span>
              )}
              <span
                className={i === props.selectedIdx ? styles.habitHeadToday : styles.habitHead}
                style={{ width: 'auto' }}
              >
                {props.weekLetters[i]}
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.weekStatsRow}>
        <span className={styles.weekStat}>
          <span className={styles.sectionMiniMuted}>Habits</span>
          {props.habitPct === null ? '—' : `${props.habitPct}%`}
        </span>
        <span className={styles.weekStat}>
          <span className={styles.sectionMiniMuted}>Water</span>
          {props.waterAvg === null ? '—' : `${props.waterAvg} / day`}
        </span>
        <span className={styles.weekStat}>
          <span className={styles.sectionMiniMuted}>Tasks</span>
          {props.tasksTotal === 0 ? '—' : `${props.tasksDone} / ${props.tasksTotal}`}
        </span>
      </div>
    </div>
  );
}

/* ── To-Do List (real tasks + quick items) ───────────────────────────────── */

export interface TodoBodyProps {
  day: DailyPlanData;
  patch: Patch;
  todos: Todo[];
  onToggleTodo: (id: string) => void;
  onOpenTask: (todo: Todo) => void;
  /** Opens the full composer popup preset to this day. */
  onAddTask: () => void;
  quickDraft: string;
  onQuickDraft: (value: string) => void;
  /** Creates a REAL task from the draft — owner clears the draft on success. */
  onQuickAdd: () => void;
  quickPending: boolean;
  quickError: string;
  suggestions: string[];
  onToggleSubtask?: SubtaskToggle | undefined;
}

export function TodoBody(props: TodoBodyProps) {
  const { day, patch, todos } = props;
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!props.quickPending) props.onQuickAdd();
    }
  };
  return (
    <div className={styles.cardBody} style={{ gap: 2 }}>
      <AddTaskRow label="Add task to To-Do List" onAdd={props.onAddTask} />
      {todos.length === 0 && day.quick.length === 0 && (
        <div className={styles.emptyHint}>No tasks for this day yet — add one below.</div>
      )}
      <div className={styles.scrollList}>
        {todos.map((todo) => (
          <TaskRow
            key={todo.id}
            todo={todo}
            onToggle={() => props.onToggleTodo(todo.id)}
            onOpen={props.onOpenTask}
            onToggleSubtask={props.onToggleSubtask}
          />
        ))}
        {/* Legacy scratch items from before quick-add created real tasks. */}
        {day.quick.map((q, i) => (
          <div key={`q-${i}`} className={styles.rowRule} style={{ padding: '5px 0', gap: 9 }}>
            <SquareCheck
              on={q.done}
              label={`Toggle quick to-do ${q.t}`}
              onToggle={() =>
                patch({ quick: day.quick.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })
              }
            />
            <span dir="auto" className={q.done ? styles.todoTitleDone : styles.todoTitle}>
              {q.t}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.quickAddRow}>
        {props.suggestions.length > 0 && (
          <datalist id="plan-quick-sug">
            {props.suggestions.map((text) => (
              <option key={text} value={text} />
            ))}
          </datalist>
        )}
        <input
          dir="auto"
          className={styles.smallInput}
          style={{ flex: 1 }}
          placeholder="Add a quick task…"
          aria-label="Add a quick task"
          maxLength={200}
          value={props.quickDraft}
          list={props.suggestions.length > 0 ? 'plan-quick-sug' : undefined}
          onChange={(e) => props.onQuickDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={props.quickPending}
          onClick={props.onQuickAdd}
        >
          Add
        </button>
      </div>
      {props.quickError && (
        <div className={styles.quickError} role="alert">
          {props.quickError}
        </div>
      )}
    </div>
  );
}

/* ── Water Tracker ───────────────────────────────────────────────────────── */

export function WaterBody({
  day,
  patch,
  goal,
}: {
  day: DailyPlanData;
  patch: Patch;
  goal: number;
}) {
  return (
    <div className={styles.waterRow}>
      {Array.from({ length: goal }, (_, i) => {
        const filled = i < day.water;
        return (
          <button
            key={i}
            type="button"
            className={styles.cupBtn}
            title="Toggle cup"
            aria-label={`Cup ${i + 1}`}
            aria-pressed={filled}
            onClick={() => patch({ water: i + 1 === day.water ? i : i + 1 })}
          >
            <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
              <path
                d="M3 2h20l-2.6 26H5.6L3 2z"
                fill={filled ? 'var(--plan-primary)' : 'transparent'}
                stroke={filled ? 'var(--plan-primary)' : 'var(--plan-muted)'}
                strokeWidth="2"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/* ── Weight & Body ───────────────────────────────────────────────────────── */

const fmt1 = (v: number): string => String(Math.round(v * 10) / 10);

/** One measurement input — drafts in the display unit, stores canonical. */
function MeasureField(props: {
  label: string;
  canonical: number;
  unitLabel: string;
  max: number;
  toDisplay: (v: number) => number;
  fromDisplay: (v: number) => number;
  onCommit: (canonical: number) => void;
}) {
  const shown = () => (props.canonical > 0 ? String(props.toDisplay(props.canonical)) : '');
  const [draft, setDraft] = useState(shown);
  // Re-sync when the stored value OR the display unit changes — a cm↔in toggle
  // reformats the same canonical value, so keying on canonical alone would
  // leave a stale number under the new unit label (and a spinner tick on it
  // would then be read in the new unit and rewrite storage). Mirrors WeightBody.
  const sig = `${props.canonical}|${props.unitLabel}`;
  const [seen, setSeen] = useState(sig);
  if (sig !== seen) {
    setSeen(sig);
    setDraft(shown());
  }
  const commit = (raw: string) => {
    if (raw.trim() === '') {
      if (props.canonical !== 0) props.onCommit(0);
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed) || parsed < 0) return;
    const canonical = Math.min(props.max, props.fromDisplay(parsed));
    if (canonical !== props.canonical) props.onCommit(canonical);
  };
  return (
    <label className={styles.measureRow}>
      <span className={styles.measureLabel}>{props.label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.1}
        className={styles.measureInput}
        value={draft}
        placeholder="—"
        aria-label={props.label}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setDraft(shown())}
      />
      <span className={styles.measureUnit}>{props.unitLabel}</span>
    </label>
  );
}

function UnitToggle<T extends string>(props: {
  label: string;
  value: T;
  options: readonly T[];
  onPick: (value: T) => void;
}) {
  return (
    <div className={styles.unitToggle} role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option}
          type="button"
          className={
            option === props.value
              ? `${styles.unitToggleBtn} ${styles.unitToggleOn}`
              : styles.unitToggleBtn
          }
          aria-pressed={option === props.value}
          onClick={() => props.onPick(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export interface WeightBodyProps {
  day: DailyPlanData;
  patch: Patch;
  /** Most recent earlier weigh-in (28-day window) — the comparison line. */
  lastWeighIn: { date: string; kg: number } | null;
  settings: DailyPlanSettings;
  patchSettings: (patch: Partial<DailyPlanSettings>) => void;
}

export function WeightBody({ day, patch, lastWeighIn, settings, patchSettings }: WeightBodyProps) {
  const wUnit = settings.units.weight;
  const lUnit = settings.units.length;
  const [showMore, setShowMore] = useState(false);

  // Draft locally so clearing to retype doesn't snap to 0 mid-edit; the draft
  // is in the DISPLAY unit and re-syncs when the stored value OR unit changes.
  const shownWeight = () => (day.weight > 0 ? String(toWeightDisplay(day.weight, wUnit)) : '');
  const [draft, setDraft] = useState(shownWeight);
  const sig = `${day.weight}|${wUnit}`;
  const [seen, setSeen] = useState(sig);
  if (sig !== seen) {
    setSeen(sig);
    setDraft(shownWeight());
  }
  const commit = (raw: string) => {
    if (raw.trim() === '') {
      if (day.weight !== 0) patch({ weight: 0 });
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    const kg = Math.min(500, fromWeightDisplay(parsed, wUnit));
    if (kg !== day.weight) patch({ weight: kg });
  };
  const delta =
    day.weight > 0 && lastWeighIn
      ? Math.round(
          (toWeightDisplay(day.weight, wUnit) - toWeightDisplay(lastWeighIn.kg, wUnit)) * 10,
        ) / 10
      : null;

  const setBody = (key: keyof DailyPlanData['body'], value: number) =>
    patch({ body: { ...day.body, [key]: value } });

  const lengthField = (label: string, key: Exclude<keyof DailyPlanData['body'], 'fat'>) => (
    <MeasureField
      label={label}
      canonical={day.body[key]}
      unitLabel={lUnit}
      max={500}
      toDisplay={(v) => toLengthDisplay(v, lUnit)}
      fromDisplay={(v) => fromLengthDisplay(v, lUnit)}
      onCommit={(v) => setBody(key, v)}
    />
  );

  return (
    <div className={styles.cardBody} style={{ gap: 8 }}>
      <div className={styles.weightRow}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          className={styles.weightInput}
          value={draft}
          placeholder="—"
          aria-label={`Today's weight in ${wUnit === 'lb' ? 'pounds' : 'kilograms'}`}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setDraft(shownWeight())}
        />
        <UnitToggle
          label="Weight unit"
          value={wUnit}
          options={['kg', 'lb'] as const}
          onPick={(u) => patchSettings({ units: { ...settings.units, weight: u } })}
        />
        {delta !== null && delta !== 0 && (
          <span className={styles.weightDelta} data-up={delta > 0 ? 'true' : undefined}>
            {delta > 0 ? '▲' : '▼'} {fmt1(Math.abs(delta))}
          </span>
        )}
      </div>
      <span className={styles.weightHint}>
        {lastWeighIn
          ? `Last weigh-in ${fmt1(toWeightDisplay(lastWeighIn.kg, wUnit))} ${wUnit} · ${shortDate(lastWeighIn.date)}`
          : day.weight > 0
            ? 'First weigh-in on record'
            : 'Step on the scale and log it'}
      </span>

      <button
        type="button"
        className={styles.moreBtn}
        aria-expanded={showMore}
        onClick={() => setShowMore((v) => !v)}
      >
        {showMore ? '− Body measurements' : '+ Body measurements'}
      </button>

      {showMore && (
        <div className={styles.measureBlock}>
          <div className={styles.measureHeadRow}>
            <span className={styles.measureHead}>Measurements</span>
            <UnitToggle
              label="Length unit"
              value={lUnit}
              options={['cm', 'in'] as const}
              onPick={(u) => patchSettings({ units: { ...settings.units, length: u } })}
            />
          </div>
          <div className={styles.measureGrid}>
            <MeasureField
              label="Height"
              canonical={settings.height}
              unitLabel={lUnit}
              max={300}
              toDisplay={(v) => toLengthDisplay(v, lUnit)}
              fromDisplay={(v) => fromLengthDisplay(v, lUnit)}
              onCommit={(v) => patchSettings({ height: v })}
            />
            <MeasureField
              label="Body fat"
              canonical={day.body.fat}
              unitLabel="%"
              max={100}
              toDisplay={(v) => v}
              fromDisplay={(v) => Math.round(v * 10) / 10}
              onCommit={(v) => setBody('fat', v)}
            />
            {lengthField('Waist', 'waist')}
            {lengthField('Chest', 'chest')}
            {lengthField('Hips', 'hips')}
            {lengthField('Thigh', 'thigh')}
            {lengthField('Arm', 'arm')}
          </div>
        </div>
      )}
    </div>
  );
}

/** '2026-07-10' → 'Jul 10' without a Date round-trip surprise. */
function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[Number(m) - 1] ?? ''} ${Number(d)}`;
}

/* ── Tomorrow Plan ───────────────────────────────────────────────────────── */

export interface TomorrowBodyProps {
  day: DailyPlanData;
  patch: Patch;
  count: number;
  /** Tomorrow's real tasks — adding here creates tasks due tomorrow. */
  todos: Todo[];
  onToggleTodo: (id: string) => void;
  onOpenTask: (todo: Todo) => void;
  onAddTask: () => void;
  onToggleSubtask?: SubtaskToggle | undefined;
}

export function TomorrowBody({
  day,
  patch,
  count,
  todos,
  onToggleTodo,
  onOpenTask,
  onAddTask,
  onToggleSubtask,
}: TomorrowBodyProps) {
  const rows = Array.from({ length: count }, (_, i) => day.tomorrow[i] ?? { t: '', done: false });
  const write = (i: number, item: { t: string; done: boolean }) => {
    const next = Array.from(
      { length: Math.max(count, day.tomorrow.length) },
      (_, j) => day.tomorrow[j] ?? { t: '', done: false },
    );
    next[i] = item;
    patch({ tomorrow: next });
  };
  return (
    <div className={styles.cardBody} style={{ gap: 2 }}>
      <AddTaskRow label="Add task for tomorrow" onAdd={onAddTask} />
      <div className={styles.scrollList}>
        {todos.map((todo) => (
          <TaskRow
            key={todo.id}
            todo={todo}
            onToggle={() => onToggleTodo(todo.id)}
            onOpen={onOpenTask}
            onToggleSubtask={onToggleSubtask}
          />
        ))}
      </div>
      <div className={styles.sectionMiniMuted} style={{ paddingTop: 6 }}>
        Notes
      </div>
      {rows.map((item, i) => (
        <div key={i} className={styles.rowRule} style={{ padding: '5px 0', gap: 9 }}>
          <SquareCheck
            on={item.done}
            label={`Toggle tomorrow item ${i + 1}`}
            onToggle={() => write(i, { ...item, done: !item.done })}
          />
          <input
            dir="auto"
            className={styles.inputBare}
            style={{ padding: '2px 0' }}
            maxLength={500}
            value={item.t}
            aria-label={`Tomorrow item ${i + 1}`}
            onChange={(e) => write(i, { ...item, t: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
