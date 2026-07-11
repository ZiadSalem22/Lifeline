import { useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { DailyPlanData, PlanHabit, Todo } from '@lifeline/shared';
import {
  WEEK_DAY_NAMES,
  dividerBelowAt,
  newHabitId,
  scheduleHours,
  withDividerAt,
} from './lib/plan-model';
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
  const style: CSSProperties = { width: props.size, height: props.size };
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

/** One real task as a plan-card row: check, #num, title (opens in Tasks). */
function TaskRow(props: { todo: Todo; onToggle: () => void; onOpen: (todo: Todo) => void }) {
  const { todo } = props;
  const doneSubs = todo.subtasks.filter((s) => s.isCompleted).length;
  return (
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
          title="Open in Tasks"
          onClick={() => props.onOpen(todo)}
        >
          {todo.title}
        </button>
      )}
      {todo.subtasks.length > 0 && (
        <span className={styles.todoSub}>
          {doneSubs}/{todo.subtasks.length}
        </span>
      )}
      {todo.tags[0] && (
        <span className={styles.tagDot} style={{ background: todo.tags[0].color }} />
      )}
    </div>
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
}: ScheduleBodyProps) {
  return (
    <div className={styles.cardBody}>
      {scheduleHours(startHour, endHour).map((time) => {
        const suggestions = suggestionsFor(time);
        // '13:30' lands on the '13:00' row; the chip shows the real minutes.
        const rowTodos = todos.filter((t) => t.dueTime?.startsWith(time.slice(0, 3)));
        return (
          <div key={time}>
            <div className={`${styles.rowRule} ${styles.schedRow}`}>
              <span className={styles.schedTime}>{time}</span>
              <input
                dir="auto"
                className={styles.inputBare}
                value={day.schedule[time] ?? ''}
                aria-label={`Schedule ${time}`}
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
                aria-label={`Add task at ${time}`}
                onClick={() => onAddTaskAt(time)}
              >
                +
              </button>
            </div>
            {rowTodos.map((todo) => (
              <div key={todo.id} className={styles.schedChip}>
                <SquareCheck
                  on={todo.isCompleted}
                  label={`Toggle task ${todo.taskNumber}`}
                  onToggle={() => onToggleTodo(todo.id)}
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
                    title="Open in Tasks"
                    onClick={() => onOpenTask(todo)}
                  >
                    {todo.title}
                  </button>
                )}
                {todo.dueTime && !todo.dueTime.endsWith(':00') && (
                  <span className={styles.chipTime}>{todo.dueTime}</span>
                )}
                {todo.tags[0] && (
                  <span className={styles.tagDot} style={{ background: todo.tags[0].color }} />
                )}
              </div>
            ))}
          </div>
        );
      })}
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
}

export function PrioritiesBody({
  day,
  patch,
  count,
  suggestions,
  highTodos,
  onToggleTodo,
  onOpenTask,
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
  /** habit done-map per week date. */
  daysHabits: Record<string, Record<string, boolean>>;
  selectedIdx: number;
  weekLetters: readonly string[];
  onToggle: (date: string, habitId: string, next: boolean) => void;
  /** On-card editing — functional write of the full habits list. */
  onEditHabits: (updater: (habits: PlanHabit[]) => PlanHabit[]) => void;
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
                className={styles.smallInput}
                style={{ flex: 1 }}
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
                onClick={() => props.onEditHabits((habits) => habits.filter((_, j) => j !== i))}
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
              <div
                key={habit.id}
                className={[
                  styles.habitRow,
                  habit.salah ? styles.habitRowSalah : undefined,
                  dividerBelowAt(props.habits, hi) ? styles.habitRowDivide : undefined,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span dir="auto" className={styles.habitLabel}>
                  {habit.label}
                </span>
                {props.weekDates.map((date, di) => {
                  const on = props.daysHabits[date]?.[habit.id] ?? false;
                  return (
                    <CircleCheck
                      key={date}
                      on={on}
                      size={15}
                      className={styles.habitCell}
                      label={`${habit.label} ${WEEK_DAY_NAMES[di] ?? ''}`}
                      onToggle={() => props.onToggle(date, habit.id, !on)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
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
      {todos.map((todo) => (
        <TaskRow
          key={todo.id}
          todo={todo}
          onToggle={() => props.onToggleTodo(todo.id)}
          onOpen={props.onOpenTask}
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
}

export function TomorrowBody({
  day,
  patch,
  count,
  todos,
  onToggleTodo,
  onOpenTask,
  onAddTask,
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
      {todos.map((todo) => (
        <TaskRow
          key={todo.id}
          todo={todo}
          onToggle={() => onToggleTodo(todo.id)}
          onOpen={onOpenTask}
        />
      ))}
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
            value={item.t}
            aria-label={`Tomorrow item ${i + 1}`}
            onChange={(e) => write(i, { ...item, t: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
