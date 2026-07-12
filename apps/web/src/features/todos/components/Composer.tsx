import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { CreateTodoInput, Priority, Recurrence, Tag, Todo } from '@lifeline/shared';
import { FlagIcon } from '../../../shared/ui/icons';
import { useCreateTag, useCreateTodo, useSimilar, useTodoByNumber } from '../data/hooks';
import { resolveDayString } from '../lib/day-filter';
import { recurrenceLabel } from '../lib/format';
import { CreateTagModal } from './CreateTagModal';
import { RecurrenceSelector } from './RecurrenceSelector';
import styles from './Composer.module.css';

/**
 * Add-task composer — port of the old App.jsx add-task card (App.jsx:972+):
 * load-template-by-number bar (+ Clear Template), title, description, duration
 * h/m selects, flag toggle, `#` tag-picker reveal with CreateTagModal, date /
 * time inputs, priority select, RecurrenceSelector modal (+ label on the
 * button), subtasks editor, inline error banner. Closes on Escape and outside
 * click; the load-task input autofocuses on open (old behavior).
 */

export interface ComposerProps {
  open: boolean;
  allTags: readonly Tag[];
  /** Loaded todo list (dashboard's useAllTodos) that powers type-ahead suggestions. */
  allTodos: readonly Todo[];
  /** 'today' | 'tomorrow' | 'YYYY-MM-DD' — fallback dueDate when no date picked. */
  effectiveDate: string;
  onRequestClose: () => void;
  /** Preset due date ('YYYY-MM-DD') re-applied every time the composer opens. */
  initialDueDate?: string | undefined;
  /** Preset due time ('HH:mm') re-applied every time the composer opens. */
  initialDueTime?: string | undefined;
  /**
   * When false, the document-level outside-click close is skipped (Escape
   * still closes) — a wrapping popup owns dismissal instead. Defaults true
   * (the inline Tasks-mode behavior).
   */
  closeOnOutsideClick?: boolean | undefined;
  /**
   * Which field the open-autofocus targets. The inline Tasks composer keeps
   * the legacy 'load' (#number bar); the plan popup focuses 'title' so
   * typing right after "+ ADD TASK" lands in the task name.
   */
  initialFocus?: 'load' | 'title' | undefined;
}

interface DraftSubtask {
  key: string;
  title: string;
  isCompleted: boolean;
}

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

export function Composer({
  open,
  allTags,
  allTodos,
  effectiveDate,
  onRequestClose,
  initialDueDate,
  initialDueTime,
  closeOnOutsideClick = true,
  initialFocus = 'load',
}: ComposerProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const loadInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [dueTime, setDueTime] = useState(initialDueTime ?? '');
  const [scheduleDate, setScheduleDate] = useState(initialDueDate ?? '');

  // Re-seed the date/time presets on every open transition (the component
  // stays mounted between opens), so a popup opened from a different schedule
  // row picks up that row's hour. Other fields persist — an accidental
  // Escape + reopen keeps the draft. Render-time adjustment, guarded.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && (initialDueDate !== undefined || initialDueTime !== undefined)) {
      setScheduleDate(initialDueDate ?? '');
      setDueTime(initialDueTime ?? '');
    }
  }
  const [priority, setPriority] = useState<Priority>('medium');
  const [isFlagged, setIsFlagged] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [subtasks, setSubtasks] = useState<DraftSubtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [error, setError] = useState('');
  const [loadNumber, setLoadNumber] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const createTodo = useCreateTodo();
  const createTag = useCreateTag();
  const findByNumber = useTodoByNumber();
  const similar = useSimilar(title, allTodos);

  // Autofocus the load-task input when the panel opens (old App.jsx:206-213) —
  // but never steal focus from a field the user already started typing in
  // (clicking the title within the 40ms window used to yank focus away).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && formRef.current?.contains(active)) return;
      (initialFocus === 'title' ? titleInputRef : loadInputRef).current?.focus();
    }, 40);
    return () => clearTimeout(timer);
  }, [open, initialFocus]);

  // Outside click & Escape close the composer (old App.jsx:279-297). The
  // recurrence/tag modals stop propagation via their portal overlays, but we
  // still guard: while a modal is open, Escape/clicks belong to the modal.
  const modalOpen = showRecurrence || showNewTagModal;
  useEffect(() => {
    if (!open || modalOpen) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) onRequestClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    // A wrapping popup owns outside-dismissal (scrollbar drags and overlay
    // scrolls register mousedown and must not nuke the draft).
    if (closeOnOutsideClick) {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('touchstart', onDown);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, modalOpen, onRequestClose, closeOnOutsideClick]);

  if (!open) return null;

  const resetAll = () => {
    setTitle('');
    setDescription('');
    setHours(0);
    setMinutes(0);
    // Presets survive a reset — the popup keeps offering the row's date/time.
    setDueTime(initialDueTime ?? '');
    setScheduleDate(initialDueDate ?? '');
    setPriority('medium');
    setIsFlagged(false);
    setTagIds([]);
    setShowTagPicker(false);
    setSubtasks([]);
    setNewSubtask('');
    setRecurrence(null);
    setLoadNumber('');
    setLoadError('');
    setError('');
  };

  const addSubtask = () => {
    const value = newSubtask.trim();
    if (!value) return;
    setSubtasks((previous) => [
      ...previous,
      { key: `${Date.now()}-${previous.length}`, title: value, isCompleted: false },
    ]);
    setNewSubtask('');
  };

  // Populate the whole composer from an existing task — used by both the
  // load-by-number bar and the type-ahead suggestion dropdown. Copies title,
  // notes, tags, subtasks, duration and priority; a template is a NEW task, so
  // date/time/recurrence are explicitly reset (never inherited). keepProgress
  // decides the subtasks: true ("Keep progress") carries their checked state
  // over verbatim; false ("Fresh copy") resets every subtask to unchecked.
  const applyTemplate = (todo: Todo, keepProgress: boolean) => {
    setTitle(todo.title);
    setDescription(todo.description ?? '');
    setTagIds(todo.tags.map((tag) => tag.id));
    setIsFlagged(todo.isFlagged);
    setPriority(todo.priority);
    setSubtasks(
      todo.subtasks.map((subtask) => ({
        key: subtask.subtaskId,
        title: subtask.title,
        isCompleted: keepProgress ? subtask.isCompleted : false,
      })),
    );
    setHours(Math.floor(todo.duration / 60));
    setMinutes(todo.duration % 60);
    setDueTime(initialDueTime ?? '');
    setScheduleDate(initialDueDate ?? '');
    setRecurrence(null);
    if (todo.tags.length > 0) setShowTagPicker(true);
    setShowSuggestions(false);
    setHighlight(-1);
  };

  const loadTemplate = async (keepProgress: boolean) => {
    setLoadError('');
    const parsed = Number.parseInt(loadNumber, 10);
    if (!loadNumber || Number.isNaN(parsed)) {
      setLoadError('Enter a valid task number');
      return;
    }
    setLoadingTemplate(true);
    try {
      const todo = await findByNumber(parsed);
      if (!todo) {
        setLoadError('No task found with that number.');
        return;
      }
      applyTemplate(todo, keepProgress);
    } catch (loadFailure) {
      setLoadError(loadFailure instanceof Error ? loadFailure.message : 'Failed to load task');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!title.trim()) return;
    // No explicit date picked → schedule on the day being viewed ('today' and
    // 'tomorrow' tokens included), so the new task is visible where it was created.
    const dueDate = scheduleDate || resolveDayString(effectiveDate);
    const input: CreateTodoInput = {
      title: title.trim(),
      description: description || null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      tags: tagIds,
      isFlagged,
      duration: hours * 60 + minutes,
      priority,
      subtasks: subtasks.map((subtask) => ({
        title: subtask.title,
        isCompleted: subtask.isCompleted,
      })),
      recurrence,
    };
    try {
      await createTodo.mutateAsync(input);
      resetAll();
      onRequestClose();
    } catch (createFailure) {
      setError(createFailure instanceof Error ? createFailure.message : 'Failed to add todo');
    }
  };

  const toggleTag = (id: string) => {
    setTagIds((previous) =>
      previous.includes(id) ? previous.filter((tagId) => tagId !== id) : [...previous, id],
    );
  };

  const recurrenceText = recurrenceLabel(recurrence);

  return (
    <form ref={formRef} className={`${styles.form} fade-in-slide-down`} onSubmit={handleSubmit}>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      <div className={styles.templateBar}>
        <input
          ref={loadInputRef}
          type="number"
          min={1}
          className={styles.templateInput}
          value={loadNumber}
          onChange={(event) => setLoadNumber(event.target.value)}
          placeholder="Load task #"
          aria-label="Load task by number"
        />
        <button
          type="button"
          className={styles.templateLoad}
          onClick={() => void loadTemplate(false)}
          disabled={loadingTemplate}
          title="Load as a new task with subtasks unchecked"
        >
          {loadingTemplate ? 'Loading…' : 'Fresh copy'}
        </button>
        <button
          type="button"
          className={styles.templateLoad}
          onClick={() => void loadTemplate(true)}
          disabled={loadingTemplate}
          title="Load as a new task keeping subtask progress"
        >
          Keep progress
        </button>
        <button type="button" className={styles.templateClear} onClick={resetAll}>
          Clear Template
        </button>
      </div>
      <p className={styles.templateHint}>
        Repeating a Task? Enter its number to load a previous task instantly.
      </p>
      {loadError && (
        <p className={styles.loadError} role="alert">
          {loadError}
        </p>
      )}

      <div className={styles.divider} />

      <div className={styles.titleField}>
        <input
          ref={titleInputRef}
          type="text"
          dir="auto"
          className={styles.titleInput}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setShowSuggestions(true);
            setHighlight(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          onKeyDown={(event) => {
            if (!showSuggestions || similar.length === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlight((current) => (current + 1) % similar.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlight((current) => (current <= 0 ? similar.length - 1 : current - 1));
            } else if (event.key === 'Enter' && highlight >= 0) {
              const picked = similar[highlight];
              if (picked) {
                event.preventDefault();
                // Enter defaults to a fresh copy (the common case).
                applyTemplate(picked, false);
              }
            } else if (event.key === 'Escape') {
              // Close the dropdown first; don't let it bubble to the composer's
              // Escape-to-close handler on document.
              event.stopPropagation();
              setShowSuggestions(false);
              setHighlight(-1);
            }
          }}
          placeholder="Title — What do you want to accomplish?"
          aria-label="Task title"
          role="combobox"
          aria-expanded={showSuggestions && similar.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {showSuggestions && similar.length > 0 && (
          <div className={styles.suggestions}>
            <div className={styles.suggestionsHead}>Reuse a previous task</div>
            <ul role="listbox" aria-label="Previous tasks">
              {similar.map((todo, index) => {
                // The Fresh/Keep choice only differs when a subtask is ticked;
                // otherwise a single "Copy" keeps the row uncluttered.
                const hasProgress = todo.subtasks.some((subtask) => subtask.isCompleted);
                // onMouseDown (not onClick) + preventDefault so the title input
                // does not blur-and-hide the list before the action lands.
                const pick =
                  (keepProgress: boolean) => (event: ReactMouseEvent<HTMLButtonElement>) => {
                    event.preventDefault();
                    applyTemplate(todo, keepProgress);
                  };
                return (
                  <li
                    key={todo.id}
                    role="option"
                    aria-selected={index === highlight}
                    className={
                      index === highlight
                        ? `${styles.suggestion} ${styles.suggestionActive}`
                        : styles.suggestion
                    }
                    onMouseEnter={() => setHighlight(index)}
                  >
                    <span className={styles.suggestionInfo}>
                      <span className={styles.suggestionNum}>#{todo.taskNumber}</span>
                      <span className={styles.suggestionTitle}>{todo.title}</span>
                      {(todo.tags.length > 0 || todo.subtasks.length > 0) && (
                        <span className={styles.suggestionMeta}>
                          {[
                            todo.tags.length > 0 &&
                              `${todo.tags.length} tag${todo.tags.length > 1 ? 's' : ''}`,
                            todo.subtasks.length > 0 &&
                              `${todo.subtasks.length} subtask${todo.subtasks.length > 1 ? 's' : ''}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className={styles.suggestionActions}>
                      {hasProgress ? (
                        <>
                          <button
                            type="button"
                            className={styles.suggestionAction}
                            onMouseDown={pick(false)}
                            title="New task with subtasks unchecked"
                          >
                            Fresh copy
                          </button>
                          <button
                            type="button"
                            className={styles.suggestionAction}
                            onMouseDown={pick(true)}
                            title="New task keeping subtask progress"
                          >
                            Keep progress
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={styles.suggestionAction}
                          onMouseDown={pick(false)}
                        >
                          Copy
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <textarea
        dir="auto"
        className={styles.descriptionInput}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Add notes or description (optional)"
        aria-label="Task description"
      />

      <div className={styles.controlsRow}>
        <select
          className={styles.control}
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
          aria-label="Duration hours"
        >
          {HOUR_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h}h
            </option>
          ))}
        </select>

        <select
          className={styles.control}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
          aria-label="Duration minutes"
        >
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}m
            </option>
          ))}
        </select>

        <button
          type="button"
          className={[styles.control, styles.flagButton, isFlagged ? styles.flagActive : undefined]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setIsFlagged((flagged) => !flagged)}
          aria-pressed={isFlagged}
          aria-label="Flag task"
          title={isFlagged ? 'Unflag' : 'Flag'}
        >
          <FlagIcon filled={isFlagged} width={16} height={16} />
        </button>

        <button
          type="button"
          className={`${styles.control} ${styles.hashButton}`}
          onClick={() => setShowTagPicker((show) => !show)}
          aria-expanded={showTagPicker}
          aria-label="Toggle tag picker"
          title="Tags"
        >
          #
        </button>

        <input
          type="date"
          className={styles.control}
          value={scheduleDate}
          onChange={(event) => setScheduleDate(event.target.value)}
          aria-label="Due date"
        />

        <input
          type="time"
          className={styles.control}
          value={dueTime}
          onChange={(event) => setDueTime(event.target.value)}
          aria-label="Due time"
        />

        <select
          className={styles.control}
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          aria-label="Priority"
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>

        <button
          type="button"
          className={[styles.control, recurrenceText ? styles.recurrenceActive : undefined]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setShowRecurrence(true)}
          title={recurrenceText ? `Repeats: ${recurrenceText}` : 'Set recurrence'}
        >
          {recurrenceText ?? 'Recurrence'}
        </button>

        <button type="submit" className={styles.submit} disabled={createTodo.isPending}>
          {createTodo.isPending ? 'Adding…' : 'Add Task'}
        </button>
      </div>

      <div className={styles.extras}>
        <div className={styles.subtaskEditor}>
          <div className={styles.subtaskInputRow}>
            <input
              type="text"
              value={newSubtask}
              onChange={(event) => setNewSubtask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Add subtask..."
              dir="auto"
              aria-label="New subtask"
            />
            <button type="button" className={styles.subtaskAdd} onClick={addSubtask}>
              Add
            </button>
          </div>
          {subtasks.length > 0 && (
            <div className={styles.subtaskList}>
              {subtasks.map((subtask) => (
                <div key={subtask.key} className={styles.subtaskRow}>
                  <input
                    type="checkbox"
                    checked={subtask.isCompleted}
                    onChange={() =>
                      setSubtasks((previous) =>
                        previous.map((item) =>
                          item.key === subtask.key
                            ? { ...item, isCompleted: !item.isCompleted }
                            : item,
                        ),
                      )
                    }
                    aria-label={`Toggle subtask ${subtask.title}`}
                  />
                  <span
                    className={[
                      styles.subtaskTitle,
                      subtask.isCompleted ? styles.subtaskDone : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {subtask.title}
                  </span>
                  <button
                    type="button"
                    className={styles.subtaskRemove}
                    onClick={() =>
                      setSubtasks((previous) => previous.filter((item) => item.key !== subtask.key))
                    }
                    aria-label={`Remove subtask ${subtask.title}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {showTagPicker && (
          <div className={`${styles.tagPicker} animate-fadeIn`}>
            <button
              type="button"
              className={styles.newTagButton}
              onClick={() => setShowNewTagModal(true)}
              aria-label="Add new tag"
              title="Create new tag"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="10" y1="4" x2="10" y2="16" />
                <line x1="4" y1="10" x2="16" y2="10" />
              </svg>
            </button>
            {allTags.map((tag) => {
              const active = tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={[styles.tagPill, active ? styles.tagPillActive : undefined]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    active
                      ? { borderColor: tag.color, color: tag.color, background: `${tag.color}20` }
                      : undefined
                  }
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={active}
                >
                  <span className={styles.tagDot} style={{ background: tag.color }} />
                  {tag.name}
                </button>
              );
            })}
            {allTags.length === 0 && <p className={styles.noTags}>No tags yet.</p>}
          </div>
        )}
      </div>

      <RecurrenceSelector
        open={showRecurrence}
        recurrence={recurrence}
        baseDate={scheduleDate || (/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : '')}
        onClose={() => setShowRecurrence(false)}
        onApply={(next) => {
          setRecurrence(next);
          setShowRecurrence(false);
        }}
        onClear={() => {
          setRecurrence(null);
          setShowRecurrence(false);
        }}
      />

      <CreateTagModal
        open={showNewTagModal}
        onClose={() => setShowNewTagModal(false)}
        onCreate={async (input) => {
          const created = await createTag.mutateAsync(input);
          setTagIds((previous) => [...previous, created.id]);
          return created;
        }}
      />
    </form>
  );
}
