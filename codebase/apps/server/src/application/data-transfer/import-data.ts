import { randomUUID } from 'node:crypto';
import type { ImportRequest, Priority, Recurrence } from '@lifeline/shared';
import { LIMITS, PRIORITIES } from '@lifeline/shared';
import { DomainValidationError } from '../../domain/errors.js';
import {
  normalizeSubtasks,
  type SubtaskInputLike,
  type SubtaskRecord,
} from '../../domain/subtask-contract.js';
import type { ImportPlan, ImportTagInput, ImportTodoInput, ImportTodoWriter } from '../ports.js';

/**
 * POST /api/v1/import — ported from the old `/api/import`
 * (audit-domain-logic.md §10):
 *
 * - `data` may be the export payload object or a JSON string of it.
 * - replace mode purges the user's todos + custom tags FIRST.
 * - Tags remap by lower(name): defaults match an existing default (else the
 *   mapping is dropped), customs match the user's custom by name else are
 *   created (creation failure → tag silently dropped).
 * - Todos keep their incoming id (merge-mode collision = upsert/overwrite),
 *   unmapped tag refs are dropped, `order` forced 0, `userId` forced, and the
 *   task number is ALWAYS reassigned (decisions #10).
 *
 * Transaction contract (decisions #10, api-contract 'transactional'; fixes
 * confirmed-findings-round1 #1/#5): the use-case parses AND FULLY NORMALIZES
 * every row (titles, subtask contract, duration clamp, dates, tag refs) BEFORE
 * any write — so a bad user payload throws a 400 with ZERO side effects — then
 * hands the finished plan to `TodoRepository.importAll`, which runs the purge,
 * tag remap/creation, and all row upserts inside ONE db transaction. A failure
 * mid-import rolls the purge back, so replace mode can never lose data.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | null {
  if (typeof value === 'string' && value !== '') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

/** Accepts date-only or full ISO strings (old exports); normalizes to date-only. */
function normalizeDueDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = DATE_ONLY.exec(value.trim());
  return match ? match[0] : null;
}

function normalizeDueTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return HH_MM.test(trimmed) ? trimmed : null;
}

function normalizePriority(value: unknown): Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)
    ? (value as Priority)
    : 'medium';
}

function normalizeDuration(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  // Clamp to the product limit. Without this an out-of-range duration (e.g.
  // 1e12 from a crafted export) sails past pre-validation and blows up the
  // INSERT with 22003 'integer out of range' mid-import (round2 finding #1).
  return Math.min(Math.floor(numeric), LIMITS.durationMaxMinutes);
}

/** Old imports carried raw jsonb; keep only subtask-like objects with a title. */
function normalizeImportedSubtasks(value: unknown): SubtaskRecord[] {
  if (!Array.isArray(value)) return [];
  const usable = value.filter(
    (entry): entry is SubtaskInputLike =>
      isRecord(entry) && typeof entry['title'] === 'string' && entry['title'].trim() !== '',
  );
  return normalizeSubtasks(usable.slice(0, 50));
}

/** Collect incoming tag refs (string id or `{id}`) as raw old ids, deduped. */
function collectTagRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const ref of value) {
    const oldId =
      typeof ref === 'string' ? ref : isRecord(ref) ? asOptionalString(ref['id']) : null;
    if (oldId !== null && !ids.includes(oldId)) ids.push(oldId);
  }
  return ids;
}

/** Parse the payload's `tags` array into remap inputs (skips malformed rows). */
function parseTagInputs(tagsRaw: unknown): ImportTagInput[] {
  if (!Array.isArray(tagsRaw)) return [];
  const inputs: ImportTagInput[] = [];
  for (const raw of tagsRaw) {
    if (!isRecord(raw)) continue;
    const oldId = asOptionalString(raw['id']);
    const name = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
    if (oldId === null || name === '') continue;
    inputs.push({
      oldId,
      name,
      color: typeof raw['color'] === 'string' ? raw['color'] : '',
      isDefault: raw['isDefault'] === true || raw['is_default'] === true,
    });
  }
  return inputs;
}

export interface ImportDataDeps {
  todos: ImportTodoWriter;
}

export interface ImportDataOptions {
  generateId?: (() => string) | undefined;
}

export class ImportData {
  private readonly generateId: () => string;

  constructor(
    private readonly deps: ImportDataDeps,
    options: ImportDataOptions = {},
  ) {
    this.generateId = options.generateId ?? randomUUID;
  }

  async execute(userId: string, input: ImportRequest): Promise<{ importedCount: number }> {
    const payload = this.parsePayload(input.data);
    const todosRaw = payload['todos'];
    if (!Array.isArray(todosRaw)) {
      throw new DomainValidationError('Invalid import format: missing todos array');
    }

    // Fully map + validate EVERY row before touching the database. Title
    // checks, the subtask contract (≤500 chars, ≤50 subtasks), and the
    // duration clamp all run here, so any user-payload error throws a 400 with
    // ZERO side effects (round1 #1). The repository then performs the purge +
    // writes atomically in one transaction.
    const rows: ImportTodoInput[] = todosRaw.map((entry, index) => {
      if (!isRecord(entry) || typeof entry['title'] !== 'string' || entry['title'].trim() === '') {
        throw new DomainValidationError(
          `Invalid import format: todos[${index}] is missing a title`,
        );
      }
      return this.toImportTodoInput(entry);
    });

    const plan: ImportPlan = {
      replace: input.mode === 'replace',
      tags: parseTagInputs(payload['tags']),
      todos: rows,
      generateTagId: this.generateId,
    };
    return this.deps.todos.importAll(userId, plan);
  }

  private parsePayload(data: ImportRequest['data']): Record<string, unknown> {
    if (typeof data !== 'string') return data;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new DomainValidationError('Invalid JSON format');
    }
    if (!isRecord(parsed)) {
      throw new DomainValidationError('Invalid import format: missing todos array');
    }
    return parsed;
  }

  private toImportTodoInput(entry: Record<string, unknown>): ImportTodoInput {
    const id = asOptionalString(entry['id']) ?? this.generateId();
    const recurrence = isRecord(entry['recurrence']) ? (entry['recurrence'] as Recurrence) : null;
    return {
      id,
      title: (entry['title'] as string).trim(),
      description: typeof entry['description'] === 'string' ? entry['description'] : null,
      dueDate: normalizeDueDate(entry['dueDate'] ?? entry['due_date']),
      dueTime: normalizeDueTime(entry['dueTime'] ?? entry['due_time']),
      isCompleted: Boolean(entry['isCompleted'] ?? entry['is_completed'] ?? false),
      isFlagged: Boolean(entry['isFlagged'] ?? entry['is_flagged'] ?? false),
      duration: normalizeDuration(entry['duration']),
      priority: normalizePriority(entry['priority']),
      subtasks: normalizeImportedSubtasks(entry['subtasks']),
      order: 0,
      recurrence,
      originalId: asOptionalString(entry['originalId'] ?? entry['original_id']),
      tagRefs: collectTagRefs(entry['tags']),
    };
  }
}
