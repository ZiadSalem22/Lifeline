import type { Todo } from '@lifeline/shared';

/**
 * Drag-drop reorder helpers. The old client reordered its local array and
 * never persisted (api.reorderTodo existed but was never called) — decision
 * 05: v1 persists via PATCH {order} with minimal writes.
 */

/** Move source before/onto target, exactly like the old handleDrop splice. */
export function moveById<T extends { id: string }>(
  list: readonly T[],
  sourceId: string,
  targetId: string,
): T[] {
  const sourceIndex = list.findIndex((item) => item.id === sourceId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceId === targetId) return [...list];
  const updated = [...list];
  const [moved] = updated.splice(sourceIndex, 1);
  if (moved === undefined) return [...list];
  updated.splice(targetIndex, 0, moved);
  return updated;
}

export interface OrderPatch {
  id: string;
  order: number;
}

/**
 * Assign order = index over the day's visible list; emit patches only for
 * items whose stored order differs (minimal writes).
 */
export function computeOrderPatches(
  orderedIds: readonly string[],
  todos: readonly Todo[],
): OrderPatch[] {
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const patches: OrderPatch[] = [];
  orderedIds.forEach((id, index) => {
    const todo = byId.get(id);
    if (todo && todo.order !== index) patches.push({ id, order: index });
  });
  return patches;
}
