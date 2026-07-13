import { memo, useState } from 'react';
import type { DragEvent, MouseEvent, ReactNode } from 'react';
import { format } from 'date-fns';
import { LIMITS } from '@lifeline/shared';
import type { Priority, Subtask, SubtaskInput, Tag, Todo } from '@lifeline/shared';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  DeleteIcon,
  EditIcon,
  FlagIcon,
  NoteIcon,
  RepeatIcon,
} from '../../../shared/ui/icons';
import { formatDuration, PRIORITY_COLORS, PRIORITY_LABELS, recurrenceLabel } from '../lib/format';
import styles from './TaskCard.module.css';

/**
 * TaskCard — port of the old App.jsx TaskCard (lines 2630-3723) as a
 * presentational component; data mutations are injected as callbacks so the
 * dashboard/search wire them to the TanStack hooks (which own the optimistic
 * subtask semantics).
 *
 * Behaviors kept: checkbox + double-click complete toggle, #number pill,
 * click-title inline edit (not when completed), priority/duration/recurrence
 * badges, description clamp + note hover preview, 🕐 dueTime row, tag chips
 * toggling filters, subtask progress bar + chevron expand (CSS animation),
 * collapsed 2 rows + "+N more", hover-reveal actions, drag-drop (collapsed
 * only when the card has subtasks). Subtask flag display was dropped — the v1
 * subtask schema has no isFlagged field.
 */

export interface TaskEditUpdates {
  title: string;
  description: string;
  tags: string[];
  priority: Priority;
  duration: number;
  subtasks: SubtaskInput[];
}

export interface TaskCardProps {
  todo: Todo;
  allTags: readonly Tag[];
  isEditing: boolean;
  isExpanded: boolean;
  showDate?: boolean;
  selectedFilterTags?: readonly string[];
  onToggle: (id: string) => void;
  onFlag: (id: string, isFlagged: boolean) => void;
  onDelete: (id: string) => void;
  onStartEdit: (todo: Todo) => void;
  onSaveEdit: (id: string, updates: TaskEditUpdates) => void;
  onCancelEdit: () => void;
  /** Server-side save error for the open editor; keeps it open with feedback. */
  editError?: string | null;
  onUpdatePriority: (id: string, priority: Priority) => void;
  onUpdateSubtasks: (id: string, subtasks: Subtask[]) => void;
  onToggleExpand: (id: string) => void;
  onToggleFilterTag?: (tagId: string) => void;
  onGoToDay?: (dueDate: string, id: string) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>, id: string) => void;
}

/* ── inline edit draft (mounted fresh when edit mode opens) ────────────────── */

interface DraftSubtask {
  key: string;
  subtaskId?: string;
  title: string;
  isCompleted: boolean;
}

function toDraftSubtasks(subtasks: readonly Subtask[]): DraftSubtask[] {
  return subtasks.map((subtask) => ({
    key: subtask.subtaskId,
    subtaskId: subtask.subtaskId,
    title: subtask.title,
    isCompleted: subtask.isCompleted,
  }));
}

function TaskCardEditor({
  todo,
  allTags,
  onSaveEdit,
  onCancelEdit,
  editError,
}: Pick<TaskCardProps, 'todo' | 'allTags' | 'onSaveEdit' | 'onCancelEdit' | 'editError'>) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? '');
  const [tagIds, setTagIds] = useState<string[]>(todo.tags.map((tag) => tag.id));
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [duration, setDuration] = useState(todo.duration);
  const [subtasks, setSubtasks] = useState<DraftSubtask[]>(() => toDraftSubtasks(todo.subtasks));
  const [newSubtask, setNewSubtask] = useState('');

  const save = () => {
    if (!title.trim()) return;
    onSaveEdit(todo.id, {
      title: title.trim(),
      description,
      tags: tagIds,
      priority,
      duration,
      subtasks: subtasks
        .filter((subtask) => subtask.title.trim().length > 0)
        .map((subtask) => ({
          ...(subtask.subtaskId !== undefined ? { subtaskId: subtask.subtaskId } : {}),
          title: subtask.title.trim(),
          isCompleted: subtask.isCompleted,
        })),
    });
  };

  const addSubtask = () => {
    const value = newSubtask.trim();
    if (!value) return;
    setSubtasks((previous) => [
      ...previous,
      { key: `new-${Date.now()}-${previous.length}`, title: value, isCompleted: false },
    ]);
    setNewSubtask('');
  };

  return (
    <div className={styles.editArea} onClick={(event) => event.stopPropagation()}>
      <input
        type="text"
        className={styles.editTitle}
        value={title}
        maxLength={LIMITS.todoTitleMax}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
          else if (event.key === 'Escape') onCancelEdit();
        }}
        autoFocus
        aria-label="Edit title"
      />
      <textarea
        className={styles.editDescription}
        value={description}
        maxLength={LIMITS.descriptionMax}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') save();
          else if (event.key === 'Escape') onCancelEdit();
        }}
        placeholder="Add notes or description... (Ctrl+Enter to save)"
        aria-label="Edit description"
      />

      <div className={styles.editSection}>
        <span className={styles.editLabel}>Tags</span>
        <div className={styles.editTagsRow}>
          {allTags.map((tag) => {
            const selected = tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={[styles.tagPill, selected ? styles.tagPillActive : undefined]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  selected
                    ? { borderColor: tag.color, color: tag.color, background: `${tag.color}20` }
                    : undefined
                }
                onClick={() =>
                  setTagIds((previous) =>
                    selected ? previous.filter((id) => id !== tag.id) : [...previous, tag.id],
                  )
                }
              >
                <span className={styles.tagDot} style={{ background: tag.color }} />
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.editControls}>
        <div className={styles.editField}>
          <span className={styles.editLabel}>Priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            aria-label="Edit priority"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className={styles.editField}>
          <span className={styles.editLabel}>Duration</span>
          <div className={styles.durationInputs}>
            <input
              type="number"
              min={0}
              value={Math.floor(duration / 60)}
              onChange={(event) =>
                setDuration(Number.parseInt(event.target.value || '0', 10) * 60 + (duration % 60))
              }
              aria-label="Duration hours"
            />
            <span>h</span>
            <input
              type="number"
              min={0}
              max={59}
              value={duration % 60}
              onChange={(event) =>
                setDuration(
                  Math.floor(duration / 60) * 60 + Number.parseInt(event.target.value || '0', 10),
                )
              }
              aria-label="Duration minutes"
            />
            <span>m</span>
          </div>
        </div>
      </div>

      <div className={styles.editSection}>
        <span className={styles.editLabel}>Subtasks</span>
        <div className={styles.editSubtasks}>
          {subtasks.map((subtask) => (
            <div key={subtask.key} className={styles.editSubtaskRow}>
              <input
                type="checkbox"
                checked={subtask.isCompleted}
                onChange={(event) =>
                  setSubtasks((previous) =>
                    previous.map((item) =>
                      item.key === subtask.key
                        ? { ...item, isCompleted: event.target.checked }
                        : item,
                    ),
                  )
                }
                aria-label={`Toggle subtask ${subtask.title}`}
              />
              <input
                type="text"
                value={subtask.title}
                onChange={(event) =>
                  setSubtasks((previous) =>
                    previous.map((item) =>
                      item.key === subtask.key ? { ...item, title: event.target.value } : item,
                    ),
                  )
                }
                aria-label="Subtask title"
              />
              <button
                type="button"
                className={styles.editSubtaskRemove}
                onClick={() =>
                  setSubtasks((previous) => previous.filter((item) => item.key !== subtask.key))
                }
                aria-label={`Remove subtask ${subtask.title}`}
              >
                ×
              </button>
            </div>
          ))}
          <div className={styles.editSubtaskRow}>
            <input
              type="text"
              placeholder="New subtask"
              value={newSubtask}
              onChange={(event) => setNewSubtask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSubtask();
                }
              }}
              aria-label="New subtask"
            />
            <button type="button" className={styles.editSubtaskAdd} onClick={addSubtask}>
              Add
            </button>
          </div>
        </div>
      </div>

      {editError && (
        <p className={styles.editError} role="alert">
          {editError}
        </p>
      )}
      <div className={styles.editActions}>
        <button type="button" className={styles.saveButton} onClick={save} title="Save">
          Save
        </button>
        <button type="button" className={styles.cancelButton} onClick={onCancelEdit} title="Cancel">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── subtask rows (display mode) ───────────────────────────────────────────── */

function SubtaskRow({
  todo,
  subtask,
  small,
  onUpdateSubtasks,
}: {
  todo: Todo;
  subtask: Subtask;
  small?: boolean;
  onUpdateSubtasks: (id: string, subtasks: Subtask[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const toggle = () => {
    onUpdateSubtasks(
      todo.id,
      todo.subtasks.map((item) =>
        item.subtaskId === subtask.subtaskId ? { ...item, isCompleted: !item.isCompleted } : item,
      ),
    );
  };

  const commitRename = () => {
    const value = text.trim();
    onUpdateSubtasks(
      todo.id,
      todo.subtasks.map((item) =>
        item.subtaskId === subtask.subtaskId ? { ...item, title: value || item.title } : item,
      ),
    );
    setEditing(false);
    setText('');
  };

  return (
    <div
      className={[styles.subtaskRow, small ? styles.subtaskRowSmall : undefined]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => {
        event.stopPropagation();
        if (!editing) toggle();
      }}
    >
      <input
        type="checkbox"
        checked={subtask.isCompleted}
        onChange={(event) => {
          event.stopPropagation();
          toggle();
        }}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Toggle subtask ${subtask.title}`}
      />
      {editing ? (
        <input
          type="text"
          className={styles.subtaskEditInput}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitRename();
            } else if (event.key === 'Escape') {
              setEditing(false);
              setText('');
            }
          }}
          onBlur={commitRename}
          autoFocus
          aria-label="Rename subtask"
        />
      ) : (
        <span
          className={[styles.subtaskTitle, subtask.isCompleted ? styles.subtaskDone : undefined]
            .filter(Boolean)
            .join(' ')}
        >
          {subtask.title}
        </span>
      )}
      {!editing && (
        <button
          type="button"
          className={styles.subtaskEditButton}
          title="Edit subtask"
          onClick={(event) => {
            event.stopPropagation();
            setEditing(true);
            setText(subtask.title);
          }}
        >
          <EditIcon width={14} height={14} />
        </button>
      )}
    </div>
  );
}

/* ── badges ────────────────────────────────────────────────────────────────── */

function RecurrenceBadge({ todo }: { todo: Todo }) {
  const label = recurrenceLabel(todo.recurrence);
  if (!label) return null;
  return (
    <span className={styles.recurrenceBadge} title={`Repeats: ${label}`}>
      <RepeatIcon width={12} height={12} />
      {label}
    </span>
  );
}

function isInteractiveTarget(event: MouseEvent): boolean {
  const element = event.target as HTMLElement;
  return Boolean(element.closest('button, input, select, textarea, a, label'));
}

/* ── the card ──────────────────────────────────────────────────────────────── */

export const TaskCard = memo(function TaskCard(props: TaskCardProps) {
  const {
    todo,
    allTags,
    isEditing,
    isExpanded,
    showDate = false,
    selectedFilterTags = [],
    onToggle,
    onFlag,
    onDelete,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    editError,
    onUpdatePriority,
    onUpdateSubtasks,
    onToggleExpand,
    onToggleFilterTag,
    onGoToDay,
    onDragStart,
    onDragOver,
    onDrop,
  } = props;
  const [showNotePreview, setShowNotePreview] = useState(false);

  const hasSubtasks = todo.subtasks.length > 0;
  const doneSubtasks = todo.subtasks.filter((subtask) => subtask.isCompleted).length;
  const subtaskProgress = hasSubtasks ? (doneSubtasks / todo.subtasks.length) * 100 : 0;
  const draggable = !isEditing && (!hasSubtasks || !isExpanded);

  let tagChips: ReactNode = null;
  if (!isEditing && todo.tags.length > 0) {
    tagChips = todo.tags.map((tag) => {
      const active = selectedFilterTags.includes(tag.id);
      return (
        <button
          key={tag.id}
          type="button"
          className={[styles.cardTagChip, active ? styles.cardTagChipActive : undefined]
            .filter(Boolean)
            .join(' ')}
          style={
            active
              ? { borderColor: tag.color, color: tag.color, background: `${tag.color}20` }
              : undefined
          }
          title={active ? 'Remove filter' : 'Filter by tag'}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFilterTag?.(tag.id);
          }}
        >
          <span className={styles.tagDot} style={{ background: tag.color }} />
          {tag.name}
        </button>
      );
    });
  }

  return (
    <div
      className={`task-card-enter-exit ${styles.root}`}
      data-testid={`task-card-${todo.id}`}
      onDoubleClick={() => {
        if (!isEditing) onToggle(todo.id);
      }}
      onClick={(event) => {
        if (hasSubtasks && !isEditing && !isInteractiveTarget(event)) onToggleExpand(todo.id);
      }}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        onDragStart?.(event, todo.id);
      }}
      onDragOver={(event) => onDragOver?.(event)}
      onDrop={(event) => onDrop?.(event, todo.id)}
    >
      <div
        className={[styles.card, todo.isCompleted ? styles.cardCompleted : undefined]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          className={[styles.checkbox, todo.isCompleted ? styles.checkboxChecked : undefined]
            .filter(Boolean)
            .join(' ')}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(todo.id);
          }}
          aria-label={todo.isCompleted ? 'Mark as not completed' : 'Mark as completed'}
          aria-pressed={todo.isCompleted}
        >
          {todo.isCompleted && <CheckIcon />}
        </button>

        <div className={styles.content}>
          {isEditing ? (
            <TaskCardEditor
              todo={todo}
              allTags={allTags}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              editError={editError ?? null}
            />
          ) : (
            <>
              <div className={styles.titleRow}>
                <span
                  className={[styles.title, todo.isCompleted ? styles.titleCompleted : undefined]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={(event) => {
                    if (!todo.isCompleted) {
                      event.stopPropagation();
                      onStartEdit(todo);
                    }
                  }}
                  title="Click to edit"
                >
                  <span className={styles.numberPill} title={`Task #${todo.taskNumber}`}>
                    #{todo.taskNumber}
                  </span>
                  {todo.title}
                </span>
                <span
                  className={styles.priorityBadge}
                  style={{
                    color: PRIORITY_COLORS[todo.priority],
                    borderColor: PRIORITY_COLORS[todo.priority],
                    // color-mix, not hex+alpha: the colors are CSS vars now.
                    background: `color-mix(in srgb, ${PRIORITY_COLORS[todo.priority]} 12%, transparent)`,
                  }}
                  title={`Priority: ${PRIORITY_LABELS[todo.priority]}`}
                >
                  {PRIORITY_LABELS[todo.priority]}
                </span>
                {todo.duration > 0 && (
                  <span className={`${styles.durationBadge} scale-in`}>
                    {formatDuration(todo.duration)}
                  </span>
                )}
              </div>

              {todo.description && <div className={styles.description}>{todo.description}</div>}

              {(todo.tags.length > 0 || todo.recurrence) && (
                <div className={styles.tagsRow}>
                  {tagChips}
                  <RecurrenceBadge todo={todo} />
                </div>
              )}

              {showDate && todo.dueDate && (
                <div className={styles.dateRow}>
                  <CalendarIcon width={14} height={14} />
                  {format(new Date(`${todo.dueDate}T00:00:00`), 'MMM d')}
                  {todo.dueTime && <span>{todo.dueTime}</span>}
                </div>
              )}

              {todo.dueTime && !showDate && (
                <div className={styles.dueTimeRow}>🕐 {todo.dueTime}</div>
              )}

              {hasSubtasks && (
                <div className={styles.subtasks}>
                  <div
                    className={styles.subtasksHeader}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleExpand(todo.id);
                    }}
                  >
                    <div className={styles.subtaskProgressTrack}>
                      <div
                        className={styles.subtaskProgressFill}
                        style={{ width: `${subtaskProgress}%` }}
                      />
                    </div>
                    <span className={styles.subtaskCounter}>
                      {doneSubtasks}/{todo.subtasks.length}
                    </span>
                    <span
                      className={[styles.chevron, isExpanded ? styles.chevronOpen : undefined]
                        .filter(Boolean)
                        .join(' ')}
                      aria-hidden="true"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>

                  {isExpanded ? (
                    <div
                      className={styles.subtasksExpanded}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {todo.subtasks.map((subtask) => (
                        <SubtaskRow
                          key={subtask.subtaskId}
                          todo={todo}
                          subtask={subtask}
                          onUpdateSubtasks={onUpdateSubtasks}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={styles.subtasksCollapsed}>
                      {todo.subtasks.slice(0, 2).map((subtask) => (
                        <SubtaskRow
                          key={subtask.subtaskId}
                          todo={todo}
                          subtask={subtask}
                          small
                          onUpdateSubtasks={onUpdateSubtasks}
                        />
                      ))}
                      {todo.subtasks.length > 2 && (
                        <button
                          type="button"
                          className={styles.moreSubtasks}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleExpand(todo.id);
                          }}
                        >
                          +{todo.subtasks.length - 2} more
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.badgesColumn}>
          {todo.isFlagged && (
            <button
              type="button"
              className={styles.flagButton}
              onClick={(event) => {
                event.stopPropagation();
                onFlag(todo.id, todo.isFlagged);
              }}
              aria-label="Unflag task"
            >
              <FlagIcon filled width={16} height={16} />
            </button>
          )}
          {todo.description && !isEditing && (
            <div
              className={styles.notePreviewAnchor}
              title="Has notes"
              onMouseEnter={() => setShowNotePreview(true)}
              onMouseLeave={() => setShowNotePreview(false)}
            >
              <NoteIcon width={16} height={16} />
              {showNotePreview && <div className={styles.notePreviewPopup}>{todo.description}</div>}
            </div>
          )}
        </div>

        {!isEditing && (
          <div className={styles.hoverActions}>
            {!todo.isCompleted && (
              <button
                type="button"
                className={styles.actionButton}
                title="Edit"
                onClick={(event) => {
                  event.stopPropagation();
                  onStartEdit(todo);
                }}
              >
                <EditIcon width={16} height={16} />
              </button>
            )}
            <select
              className={styles.prioritySelect}
              value={todo.priority}
              onChange={(event) => onUpdatePriority(todo.id, event.target.value as Priority)}
              onClick={(event) => event.stopPropagation()}
              title="Change priority"
              aria-label="Quick change priority"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {showDate && todo.dueDate && (
              <button
                type="button"
                className={styles.actionButton}
                title="Go to day"
                onClick={(event) => {
                  event.stopPropagation();
                  if (todo.dueDate) onGoToDay?.(todo.dueDate, todo.id);
                }}
              >
                <ArrowRightIcon width={16} height={16} />
              </button>
            )}
            <button
              type="button"
              className={`${styles.actionButton} ${styles.deleteButton}`}
              title="Delete"
              aria-label="Delete task"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(todo.id);
              }}
            >
              <DeleteIcon width={16} height={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
