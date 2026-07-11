import type { CSSProperties, KeyboardEvent } from 'react';
import type { DailyPlanData, PlanHabit, Todo } from '@lifeline/shared';
import { scheduleHours } from './lib/plan-model';
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

/* ── Schedule ────────────────────────────────────────────────────────────── */

export function ScheduleBody({ day, patch }: { day: DailyPlanData; patch: Patch }) {
  return (
    <div className={styles.cardBody}>
      {scheduleHours().map((time) => (
        <div key={time} className={styles.rowRule}>
          <span className={styles.schedTime}>{time}</span>
          <input
            dir="auto"
            className={styles.inputBare}
            value={day.schedule[time] ?? ''}
            aria-label={`Schedule ${time}`}
            onChange={(e) => patch({ schedule: { ...day.schedule, [time]: e.target.value } })}
          />
        </div>
      ))}
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

export function GratitudeBody({ day, patch }: { day: DailyPlanData; patch: Patch }) {
  return (
    <div className={styles.cardBody}>
      <div className={styles.prompt}>I am grateful for:</div>
      {day.gratitude.map((value, i) => (
        <div key={i} className={styles.rowRule}>
          <span className={styles.schedTime} style={{ width: 14 }}>
            {i + 1}.
          </span>
          <input
            dir="auto"
            className={styles.inputBare}
            value={value}
            aria-label={`Gratitude ${i + 1}`}
            onChange={(e) =>
              patch({ gratitude: day.gratitude.map((g, j) => (j === i ? e.target.value : g)) })
            }
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

export function PrioritiesBody({ day, patch }: { day: DailyPlanData; patch: Patch }) {
  return (
    <div className={styles.cardBody} style={{ gap: 2 }}>
      {day.priorities.map((p, i) => (
        <div key={i} className={styles.rowRule} style={{ padding: '5px 0' }}>
          <span className={styles.prioNum}>{i + 1}.</span>
          <input
            dir="auto"
            className={p.done ? `${styles.inputBare} ${styles.inputDone}` : `${styles.inputBare}`}
            style={{ fontWeight: 600 }}
            value={p.t}
            aria-label={`Priority ${i + 1}`}
            onChange={(e) =>
              patch({
                priorities: day.priorities.map((x, j) =>
                  j === i ? { ...x, t: e.target.value } : x,
                ),
              })
            }
          />
          <CircleCheck
            on={p.done}
            size={19}
            label={`Toggle priority ${i + 1}`}
            onToggle={() =>
              patch({
                priorities: day.priorities.map((x, j) => (j === i ? { ...x, done: !x.done } : x)),
              })
            }
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
}

export function HabitsBody(props: HabitsBodyProps) {
  const salahCount = props.habits.filter((h) => h.salah).length;
  // Band position over the selected day's 22px column (3px gaps, rightmost = index 6).
  const bandRight = (6 - props.selectedIdx) * 25 - 2;
  return (
    <div className={styles.cardBody}>
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
                hi === salahCount - 1 ? styles.habitRowDivide : undefined,
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
                    label={`${habit.label} ${props.weekLetters[di] ?? ''}`}
                    onToggle={() => props.onToggle(date, habit.id, !on)}
                  />
                );
              })}
            </div>
          ))}
        </div>
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
  quickDraft: string;
  onQuickDraft: (value: string) => void;
}

export function TodoBody(props: TodoBodyProps) {
  const { day, patch, todos } = props;
  const addQuick = () => {
    const value = props.quickDraft.trim();
    if (!value) return;
    patch({ quick: [...day.quick, { t: value, done: false }] });
    props.onQuickDraft('');
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addQuick();
    }
  };
  return (
    <div className={styles.cardBody} style={{ gap: 2 }}>
      {todos.map((todo) => {
        const doneSubs = todo.subtasks.filter((s) => s.isCompleted).length;
        return (
          <div key={todo.id} className={styles.rowRule} style={{ padding: '5px 0', gap: 9 }}>
            <SquareCheck
              on={todo.isCompleted}
              label={`Toggle task ${todo.taskNumber}`}
              onToggle={() => props.onToggleTodo(todo.id)}
            />
            <span className={styles.numChip}>#{todo.taskNumber}</span>
            <span dir="auto" className={todo.isCompleted ? styles.todoTitleDone : styles.todoTitle}>
              {todo.title}
            </span>
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
      })}
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
        <input
          dir="auto"
          className={styles.smallInput}
          style={{ flex: 1 }}
          placeholder="Add a quick to-do…"
          aria-label="Add a quick to-do"
          value={props.quickDraft}
          onChange={(e) => props.onQuickDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <button type="button" className={styles.primaryBtn} onClick={addQuick}>
          Add
        </button>
      </div>
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

export function TomorrowBody({ day, patch }: { day: DailyPlanData; patch: Patch }) {
  return (
    <div className={styles.cardBody} style={{ gap: 2 }}>
      {day.tomorrow.map((item, i) => (
        <div key={i} className={styles.rowRule} style={{ padding: '5px 0', gap: 9 }}>
          <SquareCheck
            on={item.done}
            label={`Toggle tomorrow item ${i + 1}`}
            onToggle={() =>
              patch({
                tomorrow: day.tomorrow.map((x, j) => (j === i ? { ...x, done: !x.done } : x)),
              })
            }
          />
          <input
            dir="auto"
            className={styles.inputBare}
            style={{ padding: '2px 0' }}
            value={item.t}
            aria-label={`Tomorrow item ${i + 1}`}
            onChange={(e) =>
              patch({
                tomorrow: day.tomorrow.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)),
              })
            }
          />
        </div>
      ))}
    </div>
  );
}
