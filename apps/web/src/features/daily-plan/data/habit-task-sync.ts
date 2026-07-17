import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  dailyPlanSettingsSchema,
  type DailyPlanData,
  type DailyPlanDay,
  type DailyPlanSettings,
  type HabitMark,
  type Todo,
} from '@lifeline/shared';
import { useAuth } from '../../../app/providers/auth-context';
import { guestApi } from '../../../shared/guest/guest-api';
import { todosQueryKey } from '../../todos/data/keys';
import { materializeNewDay } from '../lib/templates';
import { weekStartOf } from '../lib/plan-model';
import { localPlanApi, serverPlanApi, type PlanApi } from './plan-api';
import { writePlanDayImmediate } from './hooks';

/**
 * Task → habit sync. A task can be linked to a Daily Plan habit (`habitId`);
 * the habit's check for a day is then EARNED BY RULE, recomputed on every
 * linked-task event:
 *
 *   ≥1 linked task due that day completed → habit ✓ for that day (doing the
 *   task IS doing the habit, so this overrides a manual ✗/skip)
 *   0 completed → only a ✓ is cleared — a manual 'skip'/✗ stands, and days
 *   with no linked-task activity are never visited
 *
 * The rule is order-independent, so several tasks feeding one habit stay
 * coherent: completing a second task is a no-op, unchecking one of two keeps
 * the ✓ (the other still earns it), unchecking the last clears it.
 *
 * Only tasks WITH a due date participate — the habit grid is per-day, and a
 * dateless task has no day to credit (the wire Todo carries no completedAt to
 * attribute it after the fact). The composer defaults a due date, so in
 * practice every linked task is dated.
 *
 * Runs from ANY surface that toggles/edits/deletes tasks (plan cards and the
 * Tasks page alike) and writes through the plan's shared day-write pipeline,
 * so it composes with — never races — the plan view's debounced edits.
 */

export interface HabitSyncTarget {
  habitId: string;
  date: string;
}

/** The (habit, day) pairs a todo's state change can affect. */
export function habitSyncTargets(...todos: (Todo | undefined | null)[]): HabitSyncTarget[] {
  const seen = new Set<string>();
  const targets: HabitSyncTarget[] = [];
  for (const todo of todos) {
    if (!todo?.habitId || !todo.dueDate) continue;
    const key = `${todo.habitId}|${todo.dueDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ habitId: todo.habitId, date: todo.dueDate });
  }
  return targets;
}

/** The recompute rule, pure: next mark for (habit, day) given the day's tasks. */
export function recomputeHabitMark(
  current: HabitMark | undefined,
  todos: readonly Todo[],
  habitId: string,
  date: string,
): HabitMark | undefined {
  const anyDone = todos.some(
    (t) => !t.archived && t.habitId === habitId && t.dueDate === date && t.isCompleted,
  );
  if (anyDone) return true;
  // Only a task-earnable ✓ is cleared; manual 'skip' (and explicit ✗) stand.
  return current === true ? undefined : current;
}

async function loadDay(
  queryClient: QueryClient,
  mode: string,
  planApi: PlanApi,
  date: string,
): Promise<DailyPlanData> {
  // Prefer the live week cache (includes any pending optimistic edits).
  const week = queryClient.getQueryData<DailyPlanDay[]>(['daily-plan', mode, weekStartOf(date)]);
  const cached = week?.find((row) => row.date === date);
  if (cached) return cached.data;
  const rows = await planApi.fetchRange(date, date);
  const stored = rows.find((row) => row.date === date);
  if (stored) return stored.data;
  // Absent day: materialize from templates exactly like the plan view would,
  // so storing a habit mark doesn't suppress that day's template prefill.
  const settings =
    queryClient.getQueryData<DailyPlanSettings>(['daily-plan-settings', mode]) ??
    dailyPlanSettingsSchema.parse(await planApi.fetchSettings());
  return materializeNewDay(settings, date);
}

async function syncOne(
  queryClient: QueryClient,
  mode: string,
  planApi: PlanApi,
  target: HabitSyncTarget,
  todos: readonly Todo[],
): Promise<void> {
  const day = await loadDay(queryClient, mode, planApi, target.date);
  const current = day.habits[target.habitId];
  const next = recomputeHabitMark(current, todos, target.habitId, target.date);
  if (next === current) return;
  const habits = { ...day.habits };
  if (next === undefined) delete habits[target.habitId];
  else habits[target.habitId] = next;
  writePlanDayImmediate(queryClient, mode, planApi, target.date, { ...day, habits });
}

/**
 * Recompute + persist habit marks for the given targets. `changed` carries the
 * row(s) the triggering mutation just wrote — merged over the base list so the
 * rule always sees the state it was triggered by, even if the list cache is
 * cold. Guest mode reads storage truth; server mode reads the todos cache
 * (always populated before any task UI exists). Fire-and-forget; failures are
 * swallowed (the next linked-task event recomputes, so state self-heals).
 */
export function useHabitTaskSync() {
  const { guestMode } = useAuth();
  const queryClient = useQueryClient();
  return useCallback(
    (targets: readonly HabitSyncTarget[], changed: readonly Todo[]) => {
      if (targets.length === 0) return;
      const mode = guestMode ? 'guest' : 'server';
      const planApi = guestMode ? localPlanApi : serverPlanApi;
      void (async () => {
        const base = guestMode
          ? await guestApi.fetchTodos()
          : (queryClient.getQueryData<Todo[]>(todosQueryKey(guestMode)) ?? []);
        const changedIds = new Set(changed.map((t) => t.id));
        const todos = [...base.filter((t) => !changedIds.has(t.id)), ...changed];
        for (const target of targets) {
          await syncOne(queryClient, mode, planApi, target, todos);
        }
      })().catch(() => {
        // Self-healing by design — see docstring.
      });
    },
    [guestMode, queryClient],
  );
}
