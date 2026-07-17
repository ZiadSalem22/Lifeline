import { DEFAULT_TAGS } from '@lifeline/shared';
import type { Tag, Todo } from '@lifeline/shared';
import { GUEST_TAGS_KEY, GUEST_TODOS_KEY, plausibleRecurrence } from '../../shared/guest/guest-api';
import type { GuestStorage } from '../../shared/guest/guest-api';

/**
 * Guest-mode export/import — client-side JSON over the localStorage workspace
 * (decision 05: export must work in guest mode too; the old ExportImport was
 * server-only and the guest-aware ExportDataModal was dead code).
 *
 * Import accepts both v1 camelCase exports and old snake_case export files
 * (`is_completed`, `due_date`, `task_number`, …).
 */

const browserStorage: GuestStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

function readArray(storage: GuestStorage, key: string): unknown[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface GuestExportPayload {
  exportedAt: string;
  user: { id: string; email: null; profile: null; settings: null };
  todos: unknown[];
  tags: unknown[];
  stats: Record<string, unknown>;
}

export function buildGuestExport(storage: GuestStorage = browserStorage): GuestExportPayload {
  const todos = readArray(storage, GUEST_TODOS_KEY);
  const tags = readArray(storage, GUEST_TAGS_KEY);
  return {
    exportedAt: new Date().toISOString(),
    user: { id: 'guest', email: null, profile: null, settings: null },
    todos,
    tags,
    stats: {},
  };
}

/* ── import ───────────────────────────────────────────────────────────────── */

type Raw = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function pick(raw: Raw, camel: string, snake: string): unknown {
  return raw[camel] !== undefined ? raw[camel] : raw[snake];
}

function normalizeTag(raw: unknown): Tag | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Raw;
  const name = str(record.name);
  if (!name) return null;
  return {
    id: str(record.id) ?? crypto.randomUUID(),
    name,
    color: str(record.color) ?? '#6B7280',
    userId: null,
    isDefault: Boolean(pick(record, 'isDefault', 'is_default')),
  };
}

function normalizeTodo(raw: unknown, taskNumber: number): Todo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Raw;
  const title = str(record.title);
  if (!title) return null;
  const now = new Date().toISOString();
  const dueDateRaw = str(pick(record, 'dueDate', 'due_date'));
  const rawTags = Array.isArray(record.tags) ? record.tags : [];
  const rawSubtasks = Array.isArray(record.subtasks) ? record.subtasks : [];
  const duration = Number(pick(record, 'duration', 'duration'));
  const priority = str(record.priority);
  return {
    id: crypto.randomUUID(),
    taskNumber,
    title,
    description: str(record.description),
    dueDate: dueDateRaw ? dueDateRaw.slice(0, 10) : null,
    dueTime: str(pick(record, 'dueTime', 'due_time')),
    isCompleted: Boolean(pick(record, 'isCompleted', 'is_completed')),
    isFlagged: Boolean(pick(record, 'isFlagged', 'is_flagged')),
    duration: Number.isFinite(duration) ? Math.max(0, Math.min(1440, Math.round(duration))) : 0,
    priority: priority === 'low' || priority === 'high' ? priority : 'medium',
    tags: rawTags.map(normalizeTag).filter((tag): tag is Tag => tag !== null),
    subtasks: rawSubtasks
      .map((subtask, index) => {
        if (typeof subtask !== 'object' || subtask === null) return null;
        const subtaskRecord = subtask as Raw;
        const subtaskTitle = str(subtaskRecord.title);
        if (!subtaskTitle) return null;
        return {
          subtaskId: str(pick(subtaskRecord, 'subtaskId', 'subtask_id')) ?? crypto.randomUUID(),
          title: subtaskTitle,
          isCompleted: Boolean(pick(subtaskRecord, 'isCompleted', 'is_completed')),
          position: index + 1,
        };
      })
      .filter((subtask): subtask is Todo['subtasks'][number] => subtask !== null),
    order: 0,
    // Preserved when it parses as a plausible rule (has a mode/type string) —
    // the same tolerance as the server import; anything else becomes null.
    recurrence: plausibleRecurrence(record.recurrence),
    habitId: str(pick(record, 'habitId', 'habit_id')),
    originalId: str(pick(record, 'originalId', 'original_id')),
    archived: false,
    createdAt: str(pick(record, 'createdAt', 'created_at')) ?? now,
    updatedAt: now,
  };
}

/**
 * Imports a JSON export into the guest localStorage workspace. `merge` appends
 * (re-numbering task numbers past the current max); `replace` swaps the whole
 * todo list. Custom tags are merged by case-insensitive name either way.
 * Returns the imported todo count.
 */
export function importGuestData(
  text: string,
  mode: 'merge' | 'replace',
  storage: GuestStorage = browserStorage,
): number {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file.');
  }
  const record = typeof payload === 'object' && payload !== null ? (payload as Raw) : ({} as Raw);
  const rawTodos = Array.isArray(record.todos)
    ? record.todos
    : Array.isArray(payload)
      ? (payload as unknown[])
      : [];
  const rawTags = Array.isArray(record.tags) ? record.tags : [];

  const existing = mode === 'replace' ? [] : (readArray(storage, GUEST_TODOS_KEY) as Todo[]);
  let nextNumber =
    existing.reduce((max, todo) => Math.max(max, Number(todo.taskNumber) || 0), 0) + 1;

  const imported: Todo[] = [];
  for (const raw of rawTodos) {
    const todo = normalizeTodo(raw, nextNumber);
    if (todo) {
      imported.push(todo);
      nextNumber += 1;
    }
  }
  storage.setItem(GUEST_TODOS_KEY, JSON.stringify([...existing, ...imported]));

  // Merge custom tags by case-insensitive name (defaults re-seed on read).
  const currentTags = readArray(storage, GUEST_TAGS_KEY) as Tag[];
  const knownNames = new Set(
    [...currentTags, ...DEFAULT_TAGS].map((tag) => tag.name.toLowerCase()),
  );
  const newTags = rawTags
    .map(normalizeTag)
    .filter((tag): tag is Tag => tag !== null)
    .filter((tag) => {
      if (knownNames.has(tag.name.toLowerCase())) return false;
      knownNames.add(tag.name.toLowerCase());
      return true;
    })
    .map((tag) => ({ ...tag, isDefault: false }));
  if (newTags.length > 0 || mode === 'replace') {
    storage.setItem(GUEST_TAGS_KEY, JSON.stringify([...currentTags, ...newTags]));
  }

  return imported.length;
}

/** Wipes the guest workspace (Delete All Data in guest mode). */
export function wipeGuestData(storage: GuestStorage = browserStorage): void {
  storage.removeItem(GUEST_TODOS_KEY);
  storage.removeItem(GUEST_TAGS_KEY);
}

/** Browser download helper. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
