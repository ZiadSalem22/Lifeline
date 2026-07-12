import { DEFAULT_TAGS } from '@lifeline/shared';
import type {
  CreateTagInput,
  CreateTodoInput,
  Recurrence,
  Subtask,
  SubtaskInput,
  Tag,
  TagReference,
  Todo,
  UpdateTagInput,
} from '@lifeline/shared';

/**
 * Guest-mode adapter: a localStorage drop-in for the server API, ported from
 * the old client (utils/guestApi.js + hooks/useGuestStorage.js) with the todo
 * shape aligned to the shared `Todo` schema.
 *
 * Semantics preserved from the old app:
 * - keys `guest_todos` / `guest_tags`;
 * - taskNumber = max + 1 at creation (sequential across recurrence expansion);
 * - recurrence expansion mirrors the server: `daily` / `specificDays` /
 *   legacy `{type, interval}` pre-expand to N rows, `dateRange` creates one
 *   spanning todo; completion just flips the flag (pre-generate-only, like
 *   the server — no spawn-on-complete);
 * - the 10 default tags are seeded and re-merged case-insensitively by name on
 *   every read (ids `tag-work` … `tag-misc`, colors from shared DEFAULT_TAGS).
 *
 * Pure module: storage is injected (defaults to window.localStorage), so it is
 * unit-testable without a DOM.
 */

export const GUEST_TODOS_KEY = 'guest_todos';
export const GUEST_TAGS_KEY = 'guest_tags';

export interface GuestStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const browserStorage: GuestStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

/** Guest ids are `tag-<name>`; colors mirror the server-seeded defaults. */
const GUEST_DEFAULT_TAGS: readonly Tag[] = DEFAULT_TAGS.map((tag) => ({
  id: tag.id.replace(/^default-/, 'tag-'),
  name: tag.name,
  color: tag.color,
  userId: null,
  isDefault: true,
}));

/** Patch accepted by guest updateTodo — mirrors the server PATCH surface. */
export interface GuestTodoPatch {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  tags?: TagReference[];
  isFlagged?: boolean;
  duration?: number;
  priority?: Todo['priority'];
  subtasks?: SubtaskInput[];
  order?: number;
}

export interface GuestApi {
  fetchTodos: () => Promise<Todo[]>;
  createTodo: (input: CreateTodoInput) => Promise<Todo>;
  updateTodo: (id: string, patch: GuestTodoPatch) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<Todo>;
  toggleFlag: (id: string) => Promise<Todo>;
  fetchTags: () => Promise<Tag[]>;
  createTag: (input: CreateTagInput) => Promise<Tag>;
  updateTag: (id: string, patch: UpdateTagInput) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
}

/* ── date helpers (all UTC, date-only strings, matching the old adapter) ──── */

const DAY_NAMES_SUNDAY_FIRST = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00Z`);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDueDate(value: CreateTodoInput['dueDate']): string | null {
  if (value === undefined || value === null || value === '') return null;
  return value.slice(0, 10);
}

interface RecurrenceFields {
  mode?: string;
  type?: string;
  interval?: number;
  startDate?: string;
  endDate?: string;
  selectedDays?: readonly string[];
}

function recurrenceFields(recurrence: Recurrence): RecurrenceFields {
  return recurrence as unknown as RecurrenceFields;
}

/**
 * Same tolerance as the server schema: any object carrying a `mode` or `type`
 * string is treated as a recurrence rule; anything else becomes null.
 */
export function plausibleRecurrence(value: unknown): Recurrence | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  return typeof record.mode === 'string' || typeof record.type === 'string'
    ? (value as Recurrence)
    : null;
}

/* ── stored-todo normalization (self-healing legacy migration) ─────────────── */

type StoredRecord = Record<string, unknown>;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/;
const DUE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function asRecord(value: unknown): StoredRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as StoredRecord)
    : null;
}

function usableTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickField(record: StoredRecord, camel: string, snake: string): unknown {
  return record[camel] !== undefined ? record[camel] : record[snake];
}

function isoOrNow(value: unknown, now: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : now;
}

/**
 * Normalizes one stored subtask. Pre-rebuild guest data wrote
 * `{id, title, isCompleted}` with NO subtaskId — identity-based ops then
 * matched `undefined === undefined` and toggling one subtask flipped ALL of
 * them. Missing subtaskIds are minted here (and persisted by readTodos so
 * they stay stable); the legacy `id` is kept as an alias.
 */
function normalizeStoredSubtask(value: unknown, position: number): Subtask | null {
  const record = asRecord(value);
  if (!record) return null;
  const title = usableTitle(record.title);
  if (title === null) return null;
  const subtask: Subtask = {
    subtaskId:
      typeof record.subtaskId === 'string' && record.subtaskId.length > 0
        ? record.subtaskId
        : crypto.randomUUID(),
    title,
    isCompleted: Boolean(pickField(record, 'isCompleted', 'is_completed')),
    position,
  };
  if (typeof record.id === 'string' || typeof record.id === 'number') {
    (subtask as Subtask & { id?: string | number }).id = record.id;
  }
  return subtask;
}

function normalizeStoredTag(value: unknown): Tag | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = usableTitle(record.name);
  if (name === null) return null;
  return {
    id:
      typeof record.id === 'string' && record.id.length > 0
        ? record.id
        : `tag-${name.toLowerCase()}`,
    name,
    color: typeof record.color === 'string' && record.color.length > 0 ? record.color : '#6B7280',
    userId: null,
    isDefault: Boolean(pickField(record, 'isDefault', 'is_default')),
  };
}

/**
 * Normalizes one stored todo to the shared `Todo` shape. Pre-rebuild guest
 * data used different shapes and lacked several v1 fields (taskNumber,
 * archived, order, priority, …) which rendered as NaN/undefined in the UI.
 * Entries without a usable title are dropped. A missing/invalid taskNumber is
 * left as 0 here; readTodos runs a max+1 assignment pass afterwards.
 */
function normalizeStoredTodo(value: unknown): Todo | null {
  const record = asRecord(value);
  if (!record) return null;
  const title = usableTitle(record.title);
  if (title === null) return null;
  const now = new Date().toISOString();

  const dueDateRaw = pickField(record, 'dueDate', 'due_date');
  const dueTimeRaw = pickField(record, 'dueTime', 'due_time');
  const taskNumber = Number(pickField(record, 'taskNumber', 'task_number'));
  const duration = Number(record.duration);
  const order = Number(record.order);
  const priority = record.priority;
  const description = usableTitle(record.description);
  const originalId = pickField(record, 'originalId', 'original_id');

  const subtasks: Subtask[] = [];
  for (const raw of Array.isArray(record.subtasks) ? record.subtasks : []) {
    const subtask = normalizeStoredSubtask(raw, subtasks.length + 1);
    if (subtask) subtasks.push(subtask);
  }

  const rawId = record.id;
  return {
    id:
      typeof rawId === 'string' && rawId !== ''
        ? rawId
        : typeof rawId === 'number'
          ? String(rawId)
          : crypto.randomUUID(),
    taskNumber: Number.isInteger(taskNumber) && taskNumber >= 1 ? taskNumber : 0,
    title,
    description,
    dueDate:
      typeof dueDateRaw === 'string' && DATE_ONLY_RE.test(dueDateRaw)
        ? dueDateRaw.slice(0, 10)
        : null,
    dueTime: typeof dueTimeRaw === 'string' && DUE_TIME_RE.test(dueTimeRaw) ? dueTimeRaw : null,
    isCompleted: Boolean(pickField(record, 'isCompleted', 'is_completed')),
    isFlagged: Boolean(pickField(record, 'isFlagged', 'is_flagged')),
    duration: Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0,
    priority:
      priority === 'low' || priority === 'medium' || priority === 'high' ? priority : 'medium',
    tags: (Array.isArray(record.tags) ? record.tags : [])
      .map(normalizeStoredTag)
      .filter((tag): tag is Tag => tag !== null),
    subtasks,
    order: Number.isFinite(order) ? Math.round(order) : 0,
    recurrence: plausibleRecurrence(record.recurrence),
    originalId: typeof originalId === 'string' && originalId.length > 0 ? originalId : null,
    archived: Boolean(record.archived),
    createdAt: isoOrNow(pickField(record, 'createdAt', 'created_at'), now),
    updatedAt: isoOrNow(pickField(record, 'updatedAt', 'updated_at'), now),
  };
}

/* ── factory ───────────────────────────────────────────────────────────────── */

export function createGuestApi(storage: GuestStorage = browserStorage): GuestApi {
  function readTodos(): Todo[] {
    try {
      const raw = storage.getItem(GUEST_TODOS_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const todos = parsed.map(normalizeStoredTodo).filter((todo): todo is Todo => todo !== null);
      // taskNumber max+1 assignment pass for entries that had no usable number.
      let nextNumber = todos.reduce((max, todo) => Math.max(max, todo.taskNumber), 0) + 1;
      for (const todo of todos) {
        if (todo.taskNumber < 1) {
          todo.taskNumber = nextNumber;
          nextNumber += 1;
        }
      }
      // Self-healing migration: persist once so normalization (in particular
      // minted subtaskIds) is stable across reads.
      const serialized = JSON.stringify(todos);
      if (serialized !== raw) storage.setItem(GUEST_TODOS_KEY, serialized);
      return todos;
    } catch {
      return [];
    }
  }

  function writeTodos(todos: Todo[]): void {
    storage.setItem(GUEST_TODOS_KEY, JSON.stringify(todos));
  }

  function readTags(): Tag[] {
    const seed = () => {
      const defaults = [...GUEST_DEFAULT_TAGS];
      storage.setItem(GUEST_TAGS_KEY, JSON.stringify(defaults));
      return defaults;
    };
    try {
      const raw = storage.getItem(GUEST_TAGS_KEY);
      if (!raw) return seed();
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return seed();
      const tags = parsed as Tag[];
      // Re-add missing defaults by case-insensitive name on every read.
      const names = new Set(tags.map((tag) => (tag.name || '').toLowerCase()));
      const missing = GUEST_DEFAULT_TAGS.filter((def) => !names.has(def.name.toLowerCase()));
      if (missing.length > 0) {
        const merged = [...tags, ...missing];
        storage.setItem(GUEST_TAGS_KEY, JSON.stringify(merged));
        return merged;
      }
      return tags;
    } catch {
      return seed();
    }
  }

  function writeTags(tags: Tag[]): void {
    storage.setItem(GUEST_TAGS_KEY, JSON.stringify(tags));
  }

  function nextTaskNumber(todos: readonly Todo[]): number {
    const max = todos.reduce((acc, todo) => {
      const value = Number.isFinite(Number(todo.taskNumber)) ? Number(todo.taskNumber) : 0;
      return Math.max(acc, value);
    }, 0);
    return max + 1;
  }

  function resolveTags(references: readonly TagReference[] | undefined): Tag[] {
    if (!references || references.length === 0) return [];
    const known = readTags();
    const resolved: Tag[] = [];
    for (const ref of references) {
      const id = typeof ref === 'string' ? ref : ref.id !== undefined ? String(ref.id) : null;
      const name = typeof ref === 'string' ? null : (ref.name ?? null);
      const match = known.find(
        (tag) =>
          (id !== null && tag.id === id) ||
          (name !== null && tag.name.toLowerCase() === name.toLowerCase()),
      );
      if (match && !resolved.some((tag) => tag.id === match.id)) resolved.push(match);
    }
    return resolved;
  }

  function normalizeSubtasks(inputs: readonly SubtaskInput[] | undefined): Subtask[] {
    if (!inputs || inputs.length === 0) return [];
    return inputs.map((input, index) => ({
      subtaskId: input.subtaskId ?? crypto.randomUUID(),
      title: input.title,
      isCompleted: input.isCompleted ?? false,
      position: index + 1,
    }));
  }

  function requireTodo(todos: Todo[], id: string): number {
    const index = todos.findIndex((todo) => todo.id === id);
    if (index === -1) throw new Error('Todo not found');
    return index;
  }

  /* ── recurrence ──────────────────────────────────────────────────────────── */

  /**
   * Hard cap on generated occurrences (one leap year of daily tasks) —
   * mirrors the server's `MAX_OCCURRENCES` in domain/recurrence.ts so an
   * unbounded daily range cannot flood localStorage.
   */
  const MAX_OCCURRENCES = 366;

  function expandDates(recurrence: Recurrence, dueDate: string | null): string[] {
    const rec = recurrenceFields(recurrence);

    if (rec.mode === 'dateRange') {
      // Server semantics: one spanning task starting at startDate.
      const start = rec.startDate ?? dueDate;
      return start !== null && start !== undefined ? [start] : [];
    }

    if (rec.mode === 'daily' || rec.mode === 'specificDays') {
      const startStr = rec.startDate ?? dueDate;
      const endStr = rec.endDate ?? dueDate;
      if (startStr === null || startStr === undefined) return [];
      const current = toUtcDate(startStr);
      const end = toUtcDate(endStr ?? startStr);
      if (!isValidDate(current) || !isValidDate(end)) return [];
      const selected = (rec.selectedDays ?? []).map((day) => day.toLowerCase());
      const dates: string[] = [];
      while (current <= end && dates.length < MAX_OCCURRENCES) {
        const dayName = DAY_NAMES_SUNDAY_FIRST[current.getUTCDay()] ?? '';
        if (rec.mode === 'daily' || selected.includes(dayName)) {
          dates.push(toDateOnly(current));
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
      return dates;
    }

    if (
      rec.type === 'daily' ||
      rec.type === 'weekly' ||
      rec.type === 'monthly' ||
      rec.type === 'custom'
    ) {
      if (dueDate === null) return [];
      const interval = rec.interval ?? 1;
      const current = toUtcDate(dueDate);
      const end = rec.endDate ? toUtcDate(rec.endDate.slice(0, 10)) : toUtcDate(dueDate);
      if (!isValidDate(current) || !isValidDate(end)) return [];
      const dates: string[] = [];
      while (current <= end && dates.length < MAX_OCCURRENCES) {
        dates.push(toDateOnly(current));
        if (rec.type === 'weekly') current.setUTCDate(current.getUTCDate() + 7 * interval);
        else if (rec.type === 'monthly') current.setUTCMonth(current.getUTCMonth() + interval);
        else current.setUTCDate(current.getUTCDate() + interval);
      }
      return dates;
    }

    return [];
  }

  /* ── public surface ──────────────────────────────────────────────────────── */

  return {
    fetchTodos(): Promise<Todo[]> {
      return Promise.resolve(readTodos());
    },

    createTodo(input: CreateTodoInput): Promise<Todo> {
      const todos = readTodos();
      const dueDate = normalizeDueDate(input.dueDate);
      const recurrence = input.recurrence ?? null;
      const tags = resolveTags(input.tags);
      const subtasks = normalizeSubtasks(input.subtasks);

      const addOne = (date: string | null): Todo => {
        const now = new Date().toISOString();
        const todo: Todo = {
          id: crypto.randomUUID(),
          taskNumber: nextTaskNumber(todos),
          title: input.title.trim(),
          description: input.description ?? null,
          dueDate: date,
          dueTime: input.dueTime === '' || input.dueTime === undefined ? null : input.dueTime,
          isCompleted: false,
          isFlagged: input.isFlagged ?? false,
          duration: input.duration ?? 0,
          priority: input.priority ?? 'medium',
          tags,
          subtasks: subtasks.map((subtask) => ({ ...subtask })),
          order: 0,
          recurrence,
          originalId: null,
          archived: false,
          createdAt: now,
          updatedAt: now,
        };
        todos.push(todo);
        return todo;
      };

      let first: Todo | null = null;
      if (recurrence) {
        for (const date of expandDates(recurrence, dueDate)) {
          const created = addOne(date);
          first ??= created;
        }
      }
      // No recurrence, unknown rule, or empty expansion: create a single todo.
      first ??= addOne(dueDate);

      writeTodos(todos);
      return Promise.resolve(first);
    },

    updateTodo(id: string, patch: GuestTodoPatch): Promise<Todo> {
      const todos = readTodos();
      const index = requireTodo(todos, id);
      const current = todos[index] as Todo;
      const next: Todo = { ...current, updatedAt: new Date().toISOString() };

      if (patch.title !== undefined) next.title = patch.title.trim();
      if (patch.description !== undefined) next.description = patch.description;
      if (patch.dueDate !== undefined) next.dueDate = normalizeDueDate(patch.dueDate);
      if (patch.dueTime !== undefined) next.dueTime = patch.dueTime === '' ? null : patch.dueTime;
      if (patch.isFlagged !== undefined) next.isFlagged = patch.isFlagged;
      if (patch.duration !== undefined) next.duration = patch.duration;
      if (patch.priority !== undefined) next.priority = patch.priority;
      if (patch.order !== undefined) next.order = patch.order;
      if (patch.tags !== undefined) next.tags = resolveTags(patch.tags);
      if (patch.subtasks !== undefined) next.subtasks = normalizeSubtasks(patch.subtasks);

      todos[index] = next;
      writeTodos(todos);
      return Promise.resolve(next);
    },

    deleteTodo(id: string): Promise<void> {
      writeTodos(readTodos().filter((todo) => todo.id !== id));
      return Promise.resolve();
    },

    toggleTodo(id: string): Promise<Todo> {
      const todos = readTodos();
      const index = requireTodo(todos, id);
      const current = todos[index] as Todo;
      const toggled: Todo = {
        ...current,
        isCompleted: !current.isCompleted,
        updatedAt: new Date().toISOString(),
      };
      todos[index] = toggled;
      // Pre-generate-only, matching the server: createTodo already expanded
      // the recurrence into rows, so completion just flips the flag — a
      // spawn-on-complete here duplicated every pre-expanded occurrence.
      writeTodos(todos);
      return Promise.resolve(toggled);
    },

    toggleFlag(id: string): Promise<Todo> {
      const todos = readTodos();
      const index = requireTodo(todos, id);
      const current = todos[index] as Todo;
      const next: Todo = {
        ...current,
        isFlagged: !current.isFlagged,
        updatedAt: new Date().toISOString(),
      };
      todos[index] = next;
      writeTodos(todos);
      return Promise.resolve(next);
    },

    fetchTags(): Promise<Tag[]> {
      return Promise.resolve(readTags());
    },

    createTag(input: CreateTagInput): Promise<Tag> {
      const tags = readTags();
      const tag: Tag = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        color: input.color,
        userId: null,
        isDefault: false,
      };
      tags.push(tag);
      writeTags(tags);
      return Promise.resolve(tag);
    },

    updateTag(id: string, patch: UpdateTagInput): Promise<Tag> {
      const tags = readTags();
      const index = tags.findIndex((tag) => tag.id === id);
      if (index === -1) throw new Error('Tag not found');
      const current = tags[index] as Tag;
      const next: Tag = {
        ...current,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
      };
      tags[index] = next;
      writeTags(tags);
      return Promise.resolve(next);
    },

    deleteTag(id: string): Promise<void> {
      writeTags(readTags().filter((tag) => tag.id !== id));
      return Promise.resolve();
    },
  };
}

/** App-wide instance bound to window.localStorage. */
export const guestApi: GuestApi = createGuestApi();
