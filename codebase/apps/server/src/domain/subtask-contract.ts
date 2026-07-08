import { randomUUID } from 'node:crypto';
import { LIMITS } from '@lifeline/shared';
import { DomainValidationError, NotFoundError } from './errors.js';

/**
 * Subtask stable-identity contract, ported from the old
 * `domain/SubtaskContract.js` (see audit-domain-logic.md §3):
 *
 * - `subtaskId` is the stable identity: any provided non-empty string is kept
 *   verbatim, otherwise a fresh UUID is minted.
 * - `id` is a legacy alias: `raw.id ?? subtaskId`.
 * - Titles are trimmed, required, and capped at {@link LIMITS.subtaskTitleMax}.
 * - At most {@link LIMITS.subtasksPerTodoMax} subtasks per task.
 * - `position` is re-sequenced 1..n from array order — client-sent positions
 *   are ignored.
 * - `isCompleted` is coerced to a boolean.
 *
 * The whole array is replaced on every write (clients echo `subtaskId` back to
 * preserve identity).
 */
export interface SubtaskRecord {
  subtaskId: string;
  /** Legacy alias kept for old exports/clients; equals subtaskId when absent. */
  id: string | number;
  title: string;
  isCompleted: boolean;
  /** 1-based, contiguous. */
  position: number;
}

export interface SubtaskInputLike {
  subtaskId?: unknown;
  id?: unknown;
  title?: unknown;
  isCompleted?: unknown;
  position?: unknown;
}

function normalizeOne(raw: SubtaskInputLike | null | undefined, index: number): SubtaskRecord {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new DomainValidationError(`subtasks[${index}] must be an object`);
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title === '') {
    throw new DomainValidationError(`subtasks[${index}].title is required`);
  }
  if (title.length > LIMITS.subtaskTitleMax) {
    throw new DomainValidationError(
      `subtasks[${index}].title must be at most ${LIMITS.subtaskTitleMax} characters`,
    );
  }
  const subtaskId =
    typeof raw.subtaskId === 'string' && raw.subtaskId.trim() !== '' ? raw.subtaskId : randomUUID();
  const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? raw.id : subtaskId;
  return {
    subtaskId,
    id,
    title,
    isCompleted: Boolean(raw.isCompleted),
    position: index + 1,
  };
}

/**
 * Normalize a client-provided subtask array into the canonical stored shape.
 * Throws {@link DomainValidationError} on contract violations.
 */
export function normalizeSubtasks(
  inputs: readonly SubtaskInputLike[] | null | undefined,
): SubtaskRecord[] {
  if (inputs === null || inputs === undefined) return [];
  if (!Array.isArray(inputs)) {
    throw new DomainValidationError('subtasks must be an array');
  }
  if (inputs.length > LIMITS.subtasksPerTodoMax) {
    throw new DomainValidationError(
      `A task can have at most ${LIMITS.subtasksPerTodoMax} subtasks`,
    );
  }
  return inputs.map((raw, index) => normalizeOne(raw as SubtaskInputLike, index));
}

function resequence(subtasks: readonly SubtaskRecord[]): SubtaskRecord[] {
  return subtasks.map((subtask, index) => ({ ...subtask, position: index + 1 }));
}

function assertExists(subtasks: readonly SubtaskRecord[], subtaskId: string): void {
  if (!subtasks.some((subtask) => subtask.subtaskId === subtaskId)) {
    throw new NotFoundError('Subtask not found');
  }
}

/** Append a new subtask (enforces the per-task cap); returns a new array. */
export function addSubtask(subtasks: readonly SubtaskRecord[], title: string): SubtaskRecord[] {
  return normalizeSubtasks([...subtasks, { title }]);
}

/** Set completion of one subtask by stable id; immutably returns a new array. */
export function setSubtaskCompletion(
  subtasks: readonly SubtaskRecord[],
  subtaskId: string,
  isCompleted: boolean,
): SubtaskRecord[] {
  assertExists(subtasks, subtaskId);
  return resequence(
    subtasks.map((subtask) =>
      subtask.subtaskId === subtaskId ? { ...subtask, isCompleted } : subtask,
    ),
  );
}

export interface SubtaskPatch {
  title?: string | undefined;
  isCompleted?: boolean | undefined;
}

/** Patch title and/or completion of one subtask by stable id. */
export function updateSubtask(
  subtasks: readonly SubtaskRecord[],
  subtaskId: string,
  patch: SubtaskPatch,
): SubtaskRecord[] {
  assertExists(subtasks, subtaskId);
  let nextTitle: string | undefined;
  if (patch.title !== undefined) {
    nextTitle = patch.title.trim();
    if (nextTitle === '') {
      throw new DomainValidationError('Subtask title is required');
    }
    if (nextTitle.length > LIMITS.subtaskTitleMax) {
      throw new DomainValidationError(
        `Subtask title must be at most ${LIMITS.subtaskTitleMax} characters`,
      );
    }
  }
  return resequence(
    subtasks.map((subtask) => {
      if (subtask.subtaskId !== subtaskId) return subtask;
      return {
        ...subtask,
        title: nextTitle ?? subtask.title,
        isCompleted: patch.isCompleted ?? subtask.isCompleted,
      };
    }),
  );
}

/** Remove one subtask by stable id; remaining positions re-sequence 1..n. */
export function removeSubtask(
  subtasks: readonly SubtaskRecord[],
  subtaskId: string,
): SubtaskRecord[] {
  assertExists(subtasks, subtaskId);
  return resequence(subtasks.filter((subtask) => subtask.subtaskId !== subtaskId));
}
