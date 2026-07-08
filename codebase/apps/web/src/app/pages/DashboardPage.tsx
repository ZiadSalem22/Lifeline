import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { format } from 'date-fns';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { Priority, Subtask, Todo } from '@lifeline/shared';
import { Composer } from '../../features/todos/components/Composer';
import { TaskCard } from '../../features/todos/components/TaskCard';
import type { TaskEditUpdates } from '../../features/todos/components/TaskCard';
import {
  useAllTags,
  useAllTodos,
  useDeleteTodo,
  useRefreshOnDayChange,
  useReorder,
  useToggleComplete,
  useToggleFlag,
  useUpdateSubtasks,
  useUpdateTodo,
} from '../../features/todos/data/hooks';
import {
  completedCountForDay,
  filterTodosForDay,
  regroupIncompleteFirst,
  totalDurationMinutes,
} from '../../features/todos/lib/day-filter';
import type { SortOption } from '../../features/todos/lib/day-filter';
import { formatDuration } from '../../features/todos/lib/format';
import { ApiError } from '../../shared/api/client';
import { SparklesIcon } from '../../shared/ui/icons';
import { Spinner } from '../../shared/ui/Spinner';
import { parseSelectedDay } from '../layout/day-utils';
import styles from './DashboardPage.module.css';

/** Turn a failed save into a user-facing message, preferring field-level detail. */
function editMessageFromError(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldErrors = error.problem?.errors;
    if (fieldErrors) {
      const joined = Object.values(fieldErrors).flat().join(' ');
      if (joined.trim().length > 0) return joined;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Failed to save changes.';
}

/**
 * Day view — ONE param-driven component for both `/` and `/day/:day` (the old
 * app duplicated ~880 lines of dashboard JSX across the two routes).
 *
 * Behaviors ported from the old dashboard (audit §2): hero with dynamic title,
 * duration pill, "N of M completed" + progress bar, tag-filter chips (AND) +
 * Clear, sort select; composer auto-opens when the list is empty; incomplete-
 * first list; Sparkles "All clear!" empty state; `?taskId` deep-link opens the
 * task in edit mode; double-click completes; drag-drop reorder persisted.
 */
export default function DashboardPage() {
  const { day = 'today' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const todosQuery = useAllTodos();
  const tagsQuery = useAllTags();
  useRefreshOnDayChange(day);

  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updateTodo = useUpdateTodo();
  const toggleComplete = useToggleComplete();
  const toggleFlag = useToggleFlag();
  const deleteTodo = useDeleteTodo();
  const updateSubtasks = useUpdateSubtasks();
  const { reorder } = useReorder();

  const todos = todosQuery.data;
  const allTags = tagsQuery.data ?? [];

  // Composer auto-open/close tracks list emptiness (old App.jsx:269-276) —
  // state adjusted during render, guarded by comparison (no set-state-in-effect).
  const isEmpty = todos !== undefined && todos.length === 0;
  const [wasEmpty, setWasEmpty] = useState<boolean | null>(null);
  if (todos !== undefined && wasEmpty !== isEmpty) {
    setWasEmpty(isEmpty);
    setComposerOpen(isEmpty);
  }

  // ?taskId deep-link opens that task in edit mode once it is in the list.
  const taskId = searchParams.get('taskId');
  const [handledTaskId, setHandledTaskId] = useState<string | null>(null);
  if (taskId && taskId !== handledTaskId && todos?.some((todo) => todo.id === taskId)) {
    setHandledTaskId(taskId);
    setEditingTodoId(taskId);
  }

  const dayTodos = filterTodosForDay(todos ?? [], day, {
    tagIds: selectedFilterTags,
    sort: sortOption,
  });
  const orderedTodos = regroupIncompleteFirst(dayTodos);
  const completedCount = completedCountForDay(todos ?? [], day);
  const durationString = formatDuration(totalDurationMinutes(dayTodos));
  const progress = dayTodos.length > 0 ? (completedCount / dayTodos.length) * 100 : 0;

  const title =
    day === 'today'
      ? 'Today'
      : day === 'tomorrow'
        ? 'Tomorrow'
        : format(parseSelectedDay(day), 'EEEE, MMMM d');

  const showSaved = useCallback(() => {
    setSavedMessage('Saved');
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedMessage(''), 1800);
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      const todo = todos?.find((item) => item.id === id);
      if (!todo) return;
      toggleComplete.mutate({ id, isCompleted: todo.isCompleted });
    },
    [todos, toggleComplete],
  );

  const handleFlag = useCallback(
    (id: string, isFlagged: boolean) => toggleFlag.mutate({ id, isFlagged }),
    [toggleFlag],
  );

  const handleDelete = useCallback((id: string) => deleteTodo.mutate(id), [deleteTodo]);

  const handleStartEdit = useCallback((todo: Todo) => {
    if (!todo.isCompleted) {
      setEditError(null);
      setEditingTodoId(todo.id);
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditError(null);
    setEditingTodoId(null);
  }, []);

  const handleSaveEdit = useCallback(
    (id: string, updates: TaskEditUpdates) => {
      updateTodo.mutate(
        {
          id,
          patch: {
            title: updates.title,
            description: updates.description || null,
            tags: updates.tags,
            priority: updates.priority,
            duration: updates.duration,
            subtasks: updates.subtasks,
          },
        },
        {
          onSuccess: () => {
            setEditError(null);
            setEditingTodoId(null);
            showSaved();
          },
          // Keep the editor open with feedback instead of failing silently.
          onError: (error) => setEditError(editMessageFromError(error)),
        },
      );
    },
    [updateTodo, showSaved],
  );

  const handleUpdatePriority = useCallback(
    (id: string, priority: Priority) => updateTodo.mutate({ id, patch: { priority } }),
    [updateTodo],
  );

  const handleUpdateSubtasks = useCallback(
    (id: string, subtasks: Subtask[]) => updateSubtasks.mutate({ id, subtasks }),
    [updateSubtasks],
  );

  const handleToggleExpand = useCallback(
    (id: string) => setExpandedTodoId((previous) => (previous === id ? null : id)),
    [],
  );

  const handleToggleFilterTag = useCallback((tagId: string) => {
    setSelectedFilterTags((previous) =>
      previous.includes(tagId) ? previous.filter((id) => id !== tagId) : [...previous, tagId],
    );
  }, []);

  const handleDragStart = useCallback((event: DragEvent<HTMLDivElement>, id: string) => {
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Not memoized: the visible id list is derived fresh each render anyway.
  const handleDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;
    reorder(
      sourceId,
      targetId,
      orderedTodos.map((todo) => todo.id),
    );
  };

  const handleGoToDay = useCallback(
    (dueDate: string, id: string) => {
      void navigate(`/day/${dueDate}?taskId=${id}`);
    },
    [navigate],
  );

  if (todosQuery.isLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size={40} label="Loading your tasks..." />
      </div>
    );
  }

  return (
    <div data-selected-day={day}>
      {savedMessage && (
        <div className={styles.savedToast} role="status">
          {savedMessage}
        </div>
      )}

      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <div className={`${styles.hero} fade-in-slide-down`}>
        <div className={styles.heroTitleRow}>
          <h1 className={styles.heroTitle}>{title}</h1>
          {durationString && (
            <span className={`${styles.durationPill} scale-in`}>{durationString}</span>
          )}
        </div>

        <div className={styles.progressRow}>
          <p className={styles.progressText}>
            {completedCount} of {dayTodos.length} completed
          </p>
          {dayTodos.length > 0 && (
            <div className={styles.progressMeter}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className={styles.filtersRow}>
          {allTags.length > 0 && (
            <div className={styles.filterChips}>
              <span className={styles.filterLabel}>Filter:</span>
              {allTags.map((tag) => {
                const active = selectedFilterTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={[styles.filterChip, active ? styles.filterChipActive : undefined]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      active
                        ? { borderColor: tag.color, color: tag.color, background: `${tag.color}20` }
                        : undefined
                    }
                    onClick={() => handleToggleFilterTag(tag.id)}
                    aria-pressed={active}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {selectedFilterTags.length > 0 && (
                <button
                  type="button"
                  className={styles.filterChip}
                  onClick={() => setSelectedFilterTags([])}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <select
            className={styles.sortSelect}
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SortOption)}
            aria-label="Sort tasks"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="duration">Sort by Duration</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      {/* ── composer ─────────────────────────────────────────────────────── */}
      {todosQuery.isError && (
        <div className={styles.errorBanner} role="alert">
          Failed to load tasks. Check your connection and try again.
        </div>
      )}

      {!composerOpen && (
        <div className={styles.addTaskRow}>
          <button
            type="button"
            className={styles.addTaskButton}
            onClick={() => setComposerOpen(true)}
          >
            + Add Task
          </button>
        </div>
      )}
      <Composer
        open={composerOpen}
        allTags={allTags}
        effectiveDate={day}
        onRequestClose={() => setComposerOpen(false)}
      />

      {/* ── task list ────────────────────────────────────────────────────── */}
      <div className={styles.taskList}>
        {dayTodos.length === 0 && (
          <div className={`${styles.emptyState} fade-in-scale-up`}>
            <div className={styles.emptyIcon}>
              <SparklesIcon width={48} height={48} />
            </div>
            <h3 className={styles.emptyTitle}>All clear!</h3>
            <p className={styles.emptyText}>No tasks for {title.toLowerCase()}</p>
          </div>
        )}

        {orderedTodos.map((todo) => (
          <TaskCard
            key={todo.id}
            todo={todo}
            allTags={allTags}
            isEditing={editingTodoId === todo.id}
            isExpanded={expandedTodoId === todo.id}
            selectedFilterTags={selectedFilterTags}
            onToggle={handleToggle}
            onFlag={handleFlag}
            onDelete={handleDelete}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            editError={editingTodoId === todo.id ? editError : null}
            onUpdatePriority={handleUpdatePriority}
            onUpdateSubtasks={handleUpdateSubtasks}
            onToggleExpand={handleToggleExpand}
            onToggleFilterTag={handleToggleFilterTag}
            onGoToDay={handleGoToDay}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
