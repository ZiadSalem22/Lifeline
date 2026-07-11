import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultDailyPlanSettings,
  type DailyPlanData,
  type DailyPlanDay,
  type DailyPlanSettings,
} from '@lifeline/shared';
import { useAuth } from '../../../app/providers/auth-context';
import { daysBefore, weekDatesOf, weekStartOf } from '../lib/plan-model';
import { localPlanApi, serverPlanApi, type PlanApi } from './plan-api';

/**
 * Daily Plan data hooks. Reads are React Query; writes are optimistic cache
 * patches + a debounced whole-blob PUT (the store is small and single-writer,
 * so last-write-wins is fine). Guest mode persists to localStorage through
 * the same PlanApi interface.
 */

export const PLAN_SAVE_DEBOUNCE_MS = 800;

function usePlanApi(): { planApi: PlanApi; mode: 'guest' | 'server' } {
  const { guestMode } = useAuth();
  return guestMode
    ? { planApi: localPlanApi, mode: 'guest' }
    : { planApi: serverPlanApi, mode: 'server' };
}

const weekKey = (mode: string, weekStart: string) => ['daily-plan', mode, weekStart] as const;
const settingsKey = (mode: string) => ['daily-plan-settings', mode] as const;

/** The 7 plan rows of the week containing dateStr (missing days = empty). */
export function useDailyPlanWeek(dateStr: string) {
  const { planApi, mode } = usePlanApi();
  const { checkedIdentity } = useAuth();
  const weekStart = weekStartOf(dateStr);
  const weekDates = useMemo(() => weekDatesOf(dateStr), [dateStr]);
  const weekEnd = weekDates[6] ?? weekStart;

  const query = useQuery({
    queryKey: weekKey(mode, weekStart),
    enabled: checkedIdentity,
    staleTime: 30_000,
    queryFn: () => planApi.fetchRange(weekStart, weekEnd),
  });

  // STORED rows only — callers decide what an absent day means (the view
  // materializes new days from templates + yesterday's tomorrow-plan).
  const days = useMemo(() => {
    const out: Record<string, DailyPlanData> = {};
    for (const row of query.data ?? []) out[row.date] = row.data;
    return out;
  }, [query.data]);

  return { days, weekDates, isLoading: query.isLoading, isFetched: query.isFetched };
}

/**
 * The last `windowDays` of plan rows ENDING YESTERDAY (relative to dateStr) —
 * the source for personal suggestions, templates-from-history, and the
 * tomorrow→today / carry-over flows. Oldest → newest; missing days omitted.
 */
export function useRecentPlanDays(dateStr: string, windowDays = 28) {
  const { planApi, mode } = usePlanApi();
  const { checkedIdentity } = useAuth();
  const end = daysBefore(dateStr, 1);
  const start = daysBefore(dateStr, windowDays);
  const query = useQuery({
    queryKey: ['daily-plan-recent', mode, start, end],
    enabled: checkedIdentity,
    staleTime: 5 * 60_000,
    queryFn: () => planApi.fetchRange(start, end),
  });
  const rows = query.data ?? [];
  return {
    recentDays: rows.map((row) => row.data),
    yesterday: rows.find((row) => row.date === end)?.data ?? null,
    isFetched: query.isFetched,
  };
}

/**
 * Debounced day writer. `saveDay(date, next)` patches the week cache
 * immediately and schedules the PUT; pending writes flush on unmount.
 */
export function useSaveDay() {
  const { planApi, mode } = usePlanApi();
  const queryClient = useQueryClient();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, DailyPlanData>());

  const flush = useCallback(
    (date: string) => {
      const timer = timers.current.get(date);
      if (timer) clearTimeout(timer);
      timers.current.delete(date);
      const data = pending.current.get(date);
      if (!data) return;
      pending.current.delete(date);
      planApi.putDay(date, data).catch(() => {
        // Server rejected/failed — refetch the truth for that week.
        void queryClient.invalidateQueries({ queryKey: weekKey(mode, weekStartOf(date)) });
      });
    },
    [planApi, queryClient, mode],
  );

  useEffect(() => {
    const timerMap = timers.current;
    const pendingMap = pending.current;
    return () => {
      for (const timer of timerMap.values()) clearTimeout(timer);
      timerMap.clear();
      // Fire-and-forget the unsaved blobs so day/mode switches never lose data.
      for (const [date, data] of pendingMap) void planApi.putDay(date, data).catch(() => {});
      pendingMap.clear();
    };
  }, [planApi]);

  return useCallback(
    (date: string, next: DailyPlanData) => {
      const upsert = (rows: DailyPlanDay[] | undefined): DailyPlanDay[] => {
        const list = rows ? [...rows] : [];
        const index = list.findIndex((row) => row.date === date);
        if (index === -1) {
          list.push({ date, data: next });
          list.sort((a, b) => a.date.localeCompare(b.date));
        } else {
          list[index] = { date, data: next };
        }
        return list;
      };
      queryClient.setQueryData<DailyPlanDay[]>(weekKey(mode, weekStartOf(date)), upsert);
      // Keep recent-days windows fresh too, so same-session edits to a past
      // day (e.g. yesterday's Tomorrow Plan) flow straight into today's
      // continuity/suggestions instead of waiting out staleTime.
      queryClient.setQueriesData<DailyPlanDay[]>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === 'daily-plan-recent' &&
              key[1] === mode &&
              typeof key[2] === 'string' &&
              typeof key[3] === 'string' &&
              key[2] <= date &&
              date <= key[3]
            );
          },
        },
        upsert,
      );
      pending.current.set(date, next);
      const existing = timers.current.get(date);
      if (existing) clearTimeout(existing);
      timers.current.set(
        date,
        setTimeout(() => flush(date), PLAN_SAVE_DEBOUNCE_MS),
      );
    },
    [queryClient, mode, flush],
  );
}

export function usePlanSettings() {
  const { planApi, mode } = usePlanApi();
  const { checkedIdentity } = useAuth();
  const query = useQuery({
    queryKey: settingsKey(mode),
    enabled: checkedIdentity,
    staleTime: 60_000,
    queryFn: () => planApi.fetchSettings(),
  });
  return {
    settings: query.data ?? defaultDailyPlanSettings(),
    isLoading: query.isLoading,
    isFetched: query.isFetched,
  };
}

/** Debounced settings writer (same optimistic pattern as useSaveDay). */
export function useSaveSettings() {
  const { planApi, mode } = usePlanApi();
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<DailyPlanSettings | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const data = pending.current;
    if (!data) return;
    pending.current = null;
    planApi.putSettings(data).catch(() => {
      void queryClient.invalidateQueries({ queryKey: settingsKey(mode) });
    });
  }, [planApi, queryClient, mode]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      const data = pending.current;
      pending.current = null;
      if (data) void planApi.putSettings(data).catch(() => {});
    };
  }, [planApi]);

  return useCallback(
    (next: DailyPlanSettings) => {
      queryClient.setQueryData(settingsKey(mode), next);
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, PLAN_SAVE_DEBOUNCE_MS);
    },
    [queryClient, mode, flush],
  );
}
