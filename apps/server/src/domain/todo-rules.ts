import { LIMITS, type Role } from '@lifeline/shared';
import { ConflictError, ForbiddenError } from './errors.js';

/**
 * Cross-cutting todo business rules (archive-first + free-tier caps).
 * Fixes old bug #2 (05-decisions.md): the archived guard actually fires here —
 * archived tasks reject every mutation with 409 until restored.
 */

export const ARCHIVED_TASK_MESSAGE = 'Cannot modify an archived task. Restore it first.';

/** Throws {@link ConflictError} (409) when the todo is archived. */
export function canMutate(todo: { archived: boolean }): void {
  if (todo.archived) {
    throw new ConflictError(ARCHIVED_TASK_MESSAGE);
  }
}

/**
 * Free-tier cap on active (non-archived) todos. Call before creating; pass the
 * number of rows the create will add (recurrence expansion may add many).
 */
export function assertActiveTodoCapacity(role: Role, activeCount: number, adding = 1): void {
  if (role !== 'free') return;
  if (activeCount + adding > LIMITS.freeTierActiveTodosMax) {
    throw new ForbiddenError('Free tier max tasks reached.');
  }
}

/** Free-tier cap on custom tags. Call before creating a tag. */
export function assertCustomTagCapacity(role: Role, customTagCount: number): void {
  if (role !== 'free') return;
  if (customTagCount >= LIMITS.freeTierCustomTagsMax) {
    throw new ForbiddenError('Free tier max tags reached.');
  }
}
