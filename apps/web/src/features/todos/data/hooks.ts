import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BatchResult,
  CreateTagInput,
  CreateTodoInput,
  Subtask,
  Tag,
  Todo,
  UpdateTagInput,
  UpdateTodoInput,
} from '@lifeline/shared';
import { guestApi } from '../../../shared/guest/guest-api';
import type { GuestTodoPatch } from '../../../shared/guest/guest-api';
import { useAuth } from '../../../app/providers/auth-context';
import { habitSyncTargets, useHabitTaskSync } from '../../daily-plan/data/habit-task-sync';
import { todosQueryKey, tagsQueryKey } from './keys';
import { moveById, computeOrderPatches } from '../lib/reorder';
import type { OrderPatch } from '../lib/reorder';
import * as todosApi from './api';

/**
 * Todos/tags data layer: TanStack Query hooks branching guest vs server on
 * `useAuth().guestMode`.
 *
 * Day-view strategy (documented choice): the server list endpoint filters by
 * dueDate, but `dateRange` recurrence spans carry dueDate = startDate, so a
 * startDate/endDate query would hide spans on later days. The old client
 * fetched the FULL active list and filtered client-side (TodoProvider) — we
 * mirror that: one `['todos']` query holding every active todo (pages of 100
 * auto-fetched while totalPages > page, hard cap for safety), then
 * `filterTodosForDay` runs on the client. Guest mode reads the same shape from
 * localStorage.
 */

const MAX_PAGES = 50;

export { todosQueryKey, tagsQueryKey };

async function fetchAllServerTodos(): Promise<Todo[]> {
  const items: Todo[] = [];
  let page = 1;
  for (;;) {
    const result = await todosApi.listTodos({ page, pageSize: 100 });
    items.push(...result.items);
    if (page >= result.totalPages || page >= MAX_PAGES) break;
    page += 1;
  }
  return items;
}

/** Full active todo list (guest: localStorage; server: paged GET /todos). */
export function useAllTodos() {
  const { guestMode, checkedIdentity } = useAuth();
  return useQuery({
    queryKey: todosQueryKey(guestMode),
    enabled: checkedIdentity,
    queryFn: () => (guestMode ? guestApi.fetchTodos() : fetchAllServerTodos()),
  });
}

/**
 * Old TodoProvider refetched todos on every selectedDate change (recurrence
 * freshness). Mirrored here as an invalidation keyed on the day token.
 */
export function useRefreshOnDayChange(selectedDay: string) {
  const queryClient = useQueryClient();
  const previousDay = useRef<string | null>(null);
  useEffect(() => {
    if (previousDay.current !== null && previousDay.current !== selectedDay) {
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    }
    previousDay.current = selectedDay;
  }, [selectedDay, queryClient]);
}

export function useAllTags() {
  const { guestMode, checkedIdentity } = useAuth();
  return useQuery({
    queryKey: tagsQueryKey(guestMode),
    enabled: checkedIdentity,
    queryFn: () => (guestMode ? guestApi.fetchTags() : todosApi.listTags()),
  });
}

/* ── cache helpers ────────────────────────────────────────────────────────── */

function useTodoCache() {
  const { guestMode } = useAuth();
  const queryClient = useQueryClient();
  const key = useMemo(() => todosQueryKey(guestMode), [guestMode]);

  const replaceTodo = useCallback(
    (updated: Todo) => {
      queryClient.setQueryData<Todo[]>(key, (previous) =>
        previous?.map((todo) => (todo.id === updated.id ? updated : todo)),
      );
    },
    [queryClient, key],
  );

  const removeTodo = useCallback(
    (id: string) => {
      queryClient.setQueryData<Todo[]>(key, (previous) =>
        previous?.filter((todo) => todo.id !== id),
      );
    },
    [queryClient, key],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
    [queryClient],
  );

  return { queryClient, key, replaceTodo, removeTodo, invalidate };
}

/* ── mutations ────────────────────────────────────────────────────────────── */

export function useCreateTodo() {
  const { guestMode } = useAuth();
  const { invalidate } = useTodoCache();
  return useMutation({
    mutationFn: (input: CreateTodoInput) =>
      guestMode ? guestApi.createTodo(input) : todosApi.createTodo(input),
    // Recurrence pre-expansion can create N rows — always refetch the list.
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateTodo() {
  const { guestMode } = useAuth();
  const { queryClient, key, replaceTodo } = useTodoCache();
  const syncHabits = useHabitTaskSync();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTodoInput }) =>
      guestMode ? guestApi.updateTodo(id, patch as GuestTodoPatch) : todosApi.patchTodo(id, patch),
    onSuccess: (updated) => {
      // A completed linked task moved to another day (or re-linked) must
      // recompute BOTH sides — the old day's ✓ may no longer be earned.
      const before = queryClient.getQueryData<Todo[]>(key)?.find((t) => t.id === updated.id);
      replaceTodo(updated);
      syncHabits(habitSyncTargets(before, updated), [updated]);
    },
  });
}

/** Complete/uncomplete via the dedicated endpoints (guest toggle just flips the flag). */
export function useToggleComplete() {
  const { guestMode } = useAuth();
  const { replaceTodo } = useTodoCache();
  const syncHabits = useHabitTaskSync();
  return useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      if (guestMode) return guestApi.toggleTodo(id);
      const { todo } = await (isCompleted
        ? todosApi.uncompleteTodo(id)
        : todosApi.completeTodo(id));
      return todo;
    },
    onSuccess: (todo) => {
      replaceTodo(todo);
      // Linked task toggled → recompute its habit's ✓ for the task's day.
      syncHabits(habitSyncTargets(todo), [todo]);
    },
  });
}

export function useToggleFlag() {
  const { guestMode } = useAuth();
  const { replaceTodo } = useTodoCache();
  return useMutation({
    mutationFn: ({ id, isFlagged }: { id: string; isFlagged: boolean }) =>
      guestMode ? guestApi.toggleFlag(id) : todosApi.patchTodo(id, { isFlagged: !isFlagged }),
    onSuccess: (todo) => replaceTodo(todo),
  });
}

/** DELETE = archive on the server; guest deletion is permanent (old behavior). */
export function useDeleteTodo() {
  const { guestMode } = useAuth();
  const { queryClient, key, removeTodo } = useTodoCache();
  const syncHabits = useHabitTaskSync();
  return useMutation({
    mutationFn: (id: string) => (guestMode ? guestApi.deleteTodo(id) : todosApi.archiveTodo(id)),
    onSuccess: (_result, id) => {
      // Deleting a completed linked task may un-earn its habit's ✓ (guest
      // deletion is already gone from storage truth; server archive drops it
      // from the recompute via the archived flag on the refetched row).
      const before = queryClient.getQueryData<Todo[]>(key)?.find((t) => t.id === id);
      removeTodo(id);
      syncHabits(habitSyncTargets(before), before ? [{ ...before, archived: true }] : []);
    },
  });
}

interface SubtasksContext {
  previous: Todo[] | undefined;
}

/**
 * Whole-array subtask update with OPTIMISTIC cache patch + rollback on error —
 * ports the old TaskCard `setTodos` optimistic semantics onto the query cache.
 */
export function useUpdateSubtasks() {
  const { guestMode } = useAuth();
  const { queryClient, key } = useTodoCache();
  return useMutation<Todo, Error, { id: string; subtasks: Subtask[] }, SubtasksContext>({
    mutationFn: ({ id, subtasks }) =>
      guestMode ? guestApi.updateTodo(id, { subtasks }) : todosApi.patchTodo(id, { subtasks }),
    onMutate: async ({ id, subtasks }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Todo[]>(key);
      queryClient.setQueryData<Todo[]>(key, (current) =>
        current?.map((todo) => (todo.id === id ? { ...todo, subtasks } : todo)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Todo[]>(key, (current) =>
        current?.map((todo) => (todo.id === updated.id ? updated : todo)),
      );
    },
  });
}

interface ReorderContext {
  previous: Todo[] | undefined;
}

interface ReorderVariables {
  sourceId: string;
  targetId: string;
  patches: OrderPatch[];
}

/**
 * Persisted drag-drop reorder (decision 05): optimistically move the card in
 * the cached array, assign order = index over the day's visible list, and
 * PATCH only the items whose order changed.
 *
 * The patch set is computed in `reorder()` BEFORE the optimistic cache update
 * (onMutate runs before mutationFn, so computing inside mutationFn would
 * always diff against the already-updated orders and emit nothing).
 */
export function useReorder() {
  const { guestMode } = useAuth();
  const { queryClient, key } = useTodoCache();
  const mutation = useMutation<unknown, Error, ReorderVariables, ReorderContext>({
    mutationFn: ({ patches }) =>
      Promise.all(
        patches.map((patch) =>
          guestMode
            ? guestApi.updateTodo(patch.id, { order: patch.order })
            : todosApi.patchTodo(patch.id, { order: patch.order }),
        ),
      ),
    onMutate: async ({ sourceId, targetId, patches }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Todo[]>(key);
      if (previous) {
        const orderById = new Map(patches.map((patch) => [patch.id, patch.order]));
        const moved = moveById(previous, sourceId, targetId).map((todo) => {
          const order = orderById.get(todo.id);
          return order !== undefined && order !== todo.order ? { ...todo, order } : todo;
        });
        queryClient.setQueryData<Todo[]>(key, moved);
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
  });

  const { mutate } = mutation;
  const reorder = useCallback(
    (sourceId: string, targetId: string, visibleIds: readonly string[]) => {
      if (sourceId === targetId) return;
      const reorderedIds = moveById(
        visibleIds.map((id) => ({ id })),
        sourceId,
        targetId,
      ).map((item) => item.id);
      const todos = queryClient.getQueryData<Todo[]>(key) ?? [];
      const patches = computeOrderPatches(reorderedIds, todos);
      if (patches.length === 0) return;
      mutate({ sourceId, targetId, patches });
    },
    [queryClient, key, mutate],
  );

  return { ...mutation, reorder };
}

export type BatchAction = 'complete' | 'uncomplete' | 'archive' | 'restore';

/**
 * Batch actions. Server: POST /todos/batch with per-item results. Guest:
 * mapped onto local ops (complete/uncomplete = conditional toggle, archive =
 * permanent delete, restore = no-op since guest mode has no archive).
 */
export function useBatch() {
  const { guestMode } = useAuth();
  const { queryClient, key, invalidate } = useTodoCache();
  const syncHabits = useHabitTaskSync();
  return useMutation<BatchResult | null, Error, { action: BatchAction; ids: string[] }>({
    mutationFn: async ({ action, ids }) => {
      if (!guestMode) return todosApi.batchTodos({ action, ids });
      const todos = queryClient.getQueryData<Todo[]>(key) ?? (await guestApi.fetchTodos());
      const byId = new Map(todos.map((todo) => [todo.id, todo]));
      for (const id of ids) {
        const todo = byId.get(id);
        if (!todo) continue;
        if (action === 'complete' && !todo.isCompleted) await guestApi.toggleTodo(id);
        else if (action === 'uncomplete' && todo.isCompleted) await guestApi.toggleTodo(id);
        else if (action === 'archive') await guestApi.deleteTodo(id);
        // 'restore' is a no-op in guest mode (nothing is archived locally).
      }
      return null;
    },
    onSuccess: async (_result, { ids }) => {
      // Batch complete/uncomplete/archive can flip linked tasks — collect the
      // affected (habit, day) pairs first (link/date don't change in a batch),
      // then recompute against the refreshed list (guest reads storage truth;
      // server relies on the invalidated query's refetch).
      const idSet = new Set(ids);
      const affected = (queryClient.getQueryData<Todo[]>(key) ?? []).filter((t) => idSet.has(t.id));
      await invalidate();
      syncHabits(habitSyncTargets(...affected), []);
    },
  });
}

/* ── lazy lookups ─────────────────────────────────────────────────────────── */

/** Lazy by-number lookup for the composer's load-template flow. */
export function useTodoByNumber() {
  const { guestMode } = useAuth();
  return useCallback(
    async (taskNumber: number): Promise<Todo | null> => {
      if (guestMode) {
        const todos = await guestApi.fetchTodos();
        return todos.find((todo) => todo.taskNumber === taskNumber) ?? null;
      }
      return todosApi.getTodoByNumber(taskNumber);
    },
    [guestMode],
  );
}

const SIMILAR_MIN_LENGTH = 2;
const SUGGESTION_LIMIT = 6;

/**
 * Type-ahead task suggestions for the composer's "reuse a previous task" flow.
 * Filters the already-loaded todo list (useAllTodos — cached for BOTH guest and
 * server mode) by title substring, prefix matches first, and dedupes by title
 * so recurring/repeated tasks surface once. Client-side + synchronous, so it is
 * instant and needs no debounce; it also sidesteps the server /todos/similar
 * trigram threshold, which silently dropped short prefixes of longer titles
 * (e.g. typing "Weekly" never matched "Weekly report review"). Takes the
 * caller's already-loaded todo list (the dashboard's useAllTodos data) so it
 * adds no query the composer wouldn't already have.
 */
export function useSimilar(title: string, allTodos: readonly Todo[]) {
  const needle = title.trim().toLowerCase();
  return useMemo(() => {
    if (needle.length < SIMILAR_MIN_LENGTH) return [];
    const rank = (todo: Todo) => (todo.title.toLowerCase().startsWith(needle) ? 0 : 1);
    const matched = allTodos
      .filter((todo) => todo.title.toLowerCase().includes(needle))
      .sort((a, b) => rank(a) - rank(b));
    const seen = new Set<string>();
    const unique: Todo[] = [];
    for (const todo of matched) {
      const key = todo.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(todo);
      if (unique.length >= SUGGESTION_LIMIT) break;
    }
    return unique;
  }, [needle, allTodos]);
}

/* ── tag mutations (guest-aware — decision 05 fix for the Settings manager) ── */

export function useCreateTag() {
  const { guestMode } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTagInput) =>
      guestMode ? guestApi.createTag(input) : todosApi.createTag(input),
    onSuccess: (created: Tag) => {
      queryClient.setQueryData<Tag[]>(tagsQueryKey(guestMode), (previous) =>
        previous ? [...previous, created] : [created],
      );
    },
  });
}

export function useUpdateTag() {
  const { guestMode } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTagInput }) =>
      guestMode ? guestApi.updateTag(id, patch) : todosApi.updateTag(id, patch),
    onSuccess: (updated: Tag) => {
      queryClient.setQueryData<Tag[]>(tagsQueryKey(guestMode), (previous) =>
        previous?.map((tag) => (tag.id === updated.id ? updated : tag)),
      );
      // Tag renames/recolors show on cards too.
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

export function useDeleteTag() {
  const { guestMode } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (guestMode ? guestApi.deleteTag(id) : todosApi.deleteTag(id)),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Tag[]>(tagsQueryKey(guestMode), (previous) =>
        previous?.filter((tag) => tag.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

/** Convenience: memoized map of tag id → Tag for chip rendering. */
export function useTagIndex(tags: readonly Tag[] | undefined) {
  return useMemo(() => new Map((tags ?? []).map((tag) => [tag.id, tag])), [tags]);
}
