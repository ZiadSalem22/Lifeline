import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format, parseISO } from 'date-fns';
import type { PlanHabit, Todo } from '@lifeline/shared';
import { SquareCheck } from './cards';
import { formatClock, type TimeFormat } from './lib/time-format';
import styles from './TaskPreviewModal.module.css';

/**
 * Read-first task preview for the Daily Plan. Clicking a task on a plan card
 * opens this instead of navigating away: you see the whole task (notes, due,
 * duration, tags, subtasks) and can check it — or the task and its subtasks —
 * on the spot. "Edit in Tasks →" hands off to the full editor for structural
 * changes. Portaled to <body> like the composer, so it uses the global
 * --color-* tokens (plan tokens are container-scoped and absent here).
 */

const PRIORITY_LABEL: Record<Todo['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  try {
    return format(parseISO(value), 'EEE, MMM d');
  } catch {
    return value;
  }
}

function formatDuration(minutes: number): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export interface TaskPreviewModalProps {
  /** The task to preview; null keeps the modal closed. */
  todo: Todo | null;
  onClose: () => void;
  onToggleComplete: (id: string) => void;
  onToggleSubtask: (todo: Todo, subtaskId: string) => void;
  /** Hand off to the full Tasks editor. */
  onEdit: (todo: Todo) => void;
  /** Reschedule the task's due date ('YYYY-MM-DD'). */
  onMove?: ((todo: Todo, dateStr: string) => void) | undefined;
  /** Plan habits for the "Counts toward habit" select (absent hides it). */
  habits?: readonly PlanHabit[] | undefined;
  /** Link/unlink the task to a habit (null clears the link). */
  onLinkHabit?: ((todo: Todo, habitId: string | null) => void) | undefined;
  /** 24h vs 12h clock display for the due-time in the meta line. */
  timeFormat?: TimeFormat | undefined;
}

export function TaskPreviewModal({
  todo,
  onClose,
  onToggleComplete,
  onToggleSubtask,
  onEdit,
  onMove,
  habits,
  onLinkHabit,
  timeFormat = '24h',
}: TaskPreviewModalProps) {
  const open = todo !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!todo) return null;

  const done = todo.subtasks.filter((sub) => sub.isCompleted).length;
  const total = todo.subtasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const meta = [
    formatDate(todo.dueDate),
    todo.dueTime ? formatClock(todo.dueTime, timeFormat) : null,
    formatDuration(todo.duration),
  ].filter(Boolean);
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Task ${todo.taskNumber}`}
      >
        <div className={styles.head}>
          <span className={styles.num}>#{todo.taskNumber}</span>
          <span className={styles.priority} data-priority={todo.priority}>
            {PRIORITY_LABEL[todo.priority]}
          </span>
          {todo.isFlagged && (
            <span className={styles.flag} title="Flagged">
              ★
            </span>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label="Close preview"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className={styles.titleRow}>
          <SquareCheck
            on={todo.isCompleted}
            label={`Toggle task ${todo.taskNumber}`}
            onToggle={() => onToggleComplete(todo.id)}
          />
          <h2 dir="auto" className={todo.isCompleted ? styles.titleDone : styles.title}>
            {todo.title}
          </h2>
        </div>

        {meta.length > 0 && <div className={styles.meta}>{meta.join('  ·  ')}</div>}

        {todo.tags.length > 0 && (
          <div className={styles.tags}>
            {todo.tags.map((tag) => (
              <span key={tag.id} className={styles.tagChip}>
                <span className={styles.tagChipDot} style={{ background: tag.color }} />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {todo.description && (
          <p dir="auto" className={styles.desc}>
            {todo.description}
          </p>
        )}

        {total > 0 && (
          <div className={styles.subs}>
            <div className={styles.subsHead}>
              <span>Subtasks</span>
              <span className={styles.subsCount}>
                {done}/{total}
              </span>
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <ul className={styles.subList}>
              {todo.subtasks.map((sub) => (
                <li key={sub.subtaskId} className={styles.subRow}>
                  <SquareCheck
                    on={sub.isCompleted}
                    label={`Toggle subtask ${sub.title}`}
                    onToggle={() => onToggleSubtask(todo, sub.subtaskId)}
                  />
                  <span dir="auto" className={sub.isCompleted ? styles.subDone : undefined}>
                    {sub.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {habits && habits.length > 0 && onLinkHabit && (
          <div className={styles.moveRow}>
            <span className={styles.moveLabel}>Counts toward</span>
            <select
              className={styles.habitSelect}
              value={todo.habitId ?? ''}
              aria-label="Counts toward habit"
              onChange={(event) => onLinkHabit(todo, event.target.value || null)}
            >
              <option value="">No habit</option>
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  ✓ {habit.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {onMove && (
          <div className={styles.moveRow}>
            <span className={styles.moveLabel}>Move to</span>
            <button
              type="button"
              className={styles.moveBtn}
              disabled={todo.dueDate === todayStr}
              onClick={() => onMove(todo, todayStr)}
            >
              Today
            </button>
            <button
              type="button"
              className={styles.moveBtn}
              disabled={todo.dueDate === tomorrowStr}
              onClick={() => onMove(todo, tomorrowStr)}
            >
              Tomorrow
            </button>
            <label className={styles.moveDate}>
              <span>Pick a date</span>
              <input
                type="date"
                aria-label="Move task to a specific date"
                value={todo.dueDate ?? ''}
                onChange={(event) => {
                  if (event.target.value) onMove(todo, event.target.value);
                }}
              />
            </label>
          </div>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.editBtn} onClick={() => onEdit(todo)}>
            Edit in Tasks →
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
