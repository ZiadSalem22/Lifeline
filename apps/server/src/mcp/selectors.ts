import type { Todo } from '@lifeline/shared';
import type { GetTodo } from '../application/todos/get-todo.js';
import { McpToolInputError } from './errors.js';

/**
 * Mutation selector resolution, ported from the old
 * `services/lifeline-mcp/src/mcp/taskSelectors.js` + backend
 * `taskResolution.js` cross-check — collapsed to one in-process lookup:
 *
 * - id alone → direct fetch;
 * - taskNumber → fetch by number;
 * - both → fetch by number and cross-check the ids resolve to the SAME task
 *   (mismatch → 400 invalid_input);
 * - neither → 400 invalid_input.
 */
export interface TaskSelector {
  taskNumber?: number | undefined;
  id?: string | undefined;
}

export async function resolveTaskForMutation(
  getTodo: GetTodo,
  userId: string,
  { taskNumber, id }: TaskSelector,
): Promise<Todo> {
  if (taskNumber === undefined && (id === undefined || id === '')) {
    throw new McpToolInputError('Provide taskNumber or id.');
  }

  if (taskNumber === undefined) {
    return getTodo.byId(userId, String(id));
  }

  const task = await getTodo.byTaskNumber(userId, taskNumber);
  if (id !== undefined && id !== '' && String(id) !== String(task.id)) {
    throw new McpToolInputError('Provided id and taskNumber do not resolve to the same task.');
  }
  return task;
}

/** Human label for previews: `#12` when addressed by number, else the id. */
export function describeSelector({ taskNumber, id }: TaskSelector, resolvedId: string): string {
  if (taskNumber !== undefined) return `#${taskNumber}`;
  return id ?? resolvedId;
}
