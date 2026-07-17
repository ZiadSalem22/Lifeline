import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  defaultDailyPlanSettings,
  extractDayMetrics,
  type DailyPlanData,
  type DailyPlanDay,
  type DailyPlanSettings,
  type PlanMetricsResponse,
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

/* ── save status (Saving… / Saved ✓ indicator) ───────────────────────────── */

export type PlanSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Module-level store: useSaveDay/useSaveSettings mark keys dirty when an edit
// is queued and settle them when the PUT lands, so any component can show an
// honest write indicator without prop-drilling through the card tree.
const dirtyKeys = new Set<string>();
let saveStatus: PlanSaveStatus = 'idle';
const saveListeners = new Set<() => void>();

function setSaveStatus(next: PlanSaveStatus) {
  if (saveStatus === next) return;
  saveStatus = next;
  for (const listener of saveListeners) listener();
}

function markDirty(key: string) {
  dirtyKeys.add(key);
  setSaveStatus('saving');
}

function markSettled(key: string, ok: boolean) {
  dirtyKeys.delete(key);
  if (!ok) setSaveStatus('error');
  else if (dirtyKeys.size === 0 && saveStatus === 'saving') setSaveStatus('saved');
}

const subscribeSaveStatus = (listener: () => void) => {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
};

/** Live plan write status: idle → saving → saved (or error, sticky until the next success). */
export function usePlanSaveStatus(): PlanSaveStatus {
  return useSyncExternalStore(
    subscribeSaveStatus,
    () => saveStatus,
    () => saveStatus,
  );
}

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

  return {
    days,
    weekDates,
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    // Data-presence gate for writes: a whole-blob save composed before the
    // stored rows arrive would overwrite the server copy with template/blank
    // data. NOT isFetched — that also turns true after an errored fetch.
    ready: query.data !== undefined,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Stored plan rows for an arbitrary date range (≤ the raw endpoint's 62-day
 * cap — a month fits). Read-only feed for the Monthly Review; unlike the
 * week hook it is NOT patched by useSaveDay, so keep staleTime short.
 */
export function useDailyPlanRange(start: string, end: string) {
  const { planApi, mode } = usePlanApi();
  const { checkedIdentity } = useAuth();
  const query = useQuery({
    queryKey: ['daily-plan-range', mode, start, end],
    enabled: checkedIdentity,
    staleTime: 30_000,
    queryFn: () => planApi.fetchRange(start, end),
  });
  const days = useMemo(() => {
    const out: Record<string, DailyPlanData> = {};
    for (const row of query.data ?? []) out[row.date] = row.data;
    return out;
  }, [query.data]);
  return { days, isLoading: query.isLoading };
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
  const recentByDate = useMemo(() => {
    const out: Record<string, DailyPlanData> = {};
    for (const row of query.data ?? []) out[row.date] = row.data;
    return out;
  }, [query.data]);
  return {
    recentDays: rows.map((row) => row.data),
    /** Same rows keyed by date — streak/history math needs the dates. */
    recentByDate,
    yesterday: rows.find((row) => row.date === end)?.data ?? null,
    isFetched: query.isFetched,
  };
}

/**
 * Compact per-day life metrics for a range (the Statistics feed). Server
 * mode hits GET /daily-plan/metrics; guest mode maps localStorage days
 * through the SAME shared extractor. Historical data, low churn — edits to
 * today are patched into matching caches by useSaveDay below.
 */
export function usePlanMetrics(range: { startDate: string; endDate: string }) {
  const { planApi, mode } = usePlanApi();
  const { checkedIdentity } = useAuth();
  const query = useQuery({
    queryKey: ['plan-metrics', mode, range.startDate, range.endDate],
    enabled: checkedIdentity,
    staleTime: 5 * 60_000,
    // Keep the previous range's charts on screen while a new range loads —
    // ‹ › chevron steps otherwise unmount every tile behind a spinner and
    // collapse the page height on each press.
    placeholderData: keepPreviousData,
    queryFn: () => planApi.fetchMetrics(range.startDate, range.endDate),
  });
  return {
    metrics: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    ready: query.data !== undefined,
  };
}

/* ── shared day-write pipeline ────────────────────────────────────────────────
 * ONE pending snapshot per (mode, date) at module level, so every writer —
 * the plan view's debounced edits AND out-of-view writers like the task→habit
 * sync — composes from the same cache state and flushes through the same
 * queue. Two independent pipelines racing the same date could PUT snapshots
 * that silently drop each other's changes. */

interface PendingDayWrite {
  planApi: PlanApi;
  mode: string;
  date: string;
  data: DailyPlanData;
}

const dayWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();
const dayWritePending = new Map<string, PendingDayWrite>();

const dayWriteKey = (mode: string, date: string) => `${mode}|${date}`;

function flushDayWrite(key: string, queryClient?: QueryClient) {
  const timer = dayWriteTimers.get(key);
  if (timer) clearTimeout(timer);
  dayWriteTimers.delete(key);
  const entry = dayWritePending.get(key);
  if (!entry) return;
  dayWritePending.delete(key);
  entry.planApi
    .putDay(entry.date, entry.data)
    .then(() => markSettled(`day:${entry.date}`, true))
    .catch(() => {
      markSettled(`day:${entry.date}`, false);
      // Server rejected/failed — refetch the truth for that week.
      void queryClient?.invalidateQueries({
        queryKey: weekKey(entry.mode, weekStartOf(entry.date)),
      });
    });
}

/** Patch every read-model cache (week, recent windows, metrics) for one day. */
function patchDayCaches(queryClient: QueryClient, mode: string, date: string, next: DailyPlanData) {
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
  // Statistics metrics caches covering this date update too — the shared
  // extractor makes today's edits show up in charts without a refetch.
  queryClient.setQueriesData<PlanMetricsResponse>(
    {
      predicate: (query) => {
        const key = query.queryKey;
        return (
          Array.isArray(key) &&
          key[0] === 'plan-metrics' &&
          key[1] === mode &&
          typeof key[2] === 'string' &&
          typeof key[3] === 'string' &&
          key[2] <= date &&
          date <= key[3]
        );
      },
    },
    (response) => {
      if (!response) return response;
      const metric = extractDayMetrics(date, next);
      const items = [...response.items];
      const index = items.findIndex((m) => m.date === date);
      if (index === -1) {
        items.push(metric);
        items.sort((a, b) => a.date.localeCompare(b.date));
      } else {
        items[index] = metric;
      }
      return { items };
    },
  );
}

/**
 * Immediate write-through for out-of-view writers (task→habit sync): patches
 * the caches, takes over any pending debounced snapshot for the date (the
 * caller composed `next` from the cache, which already contains it), and PUTs
 * right away — no debounce, since these are single event-driven writes.
 */
export function writePlanDayImmediate(
  queryClient: QueryClient,
  mode: string,
  planApi: PlanApi,
  date: string,
  next: DailyPlanData,
) {
  patchDayCaches(queryClient, mode, date, next);
  const key = dayWriteKey(mode, date);
  dayWritePending.set(key, { planApi, mode, date, data: next });
  markDirty(`day:${date}`);
  flushDayWrite(key, queryClient);
}

/**
 * Debounced day writer. `saveDay(date, next)` patches the week cache
 * immediately and schedules the PUT; pending writes flush on unmount.
 */
export function useSaveDay() {
  const { planApi, mode } = usePlanApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Refresh/close/app-switch would silently drop the 800ms debounce window:
    // React cleanups do not run on unload. Flush everything the moment the
    // page hides (the PUTs are keepalive, so they outlive a closing tab).
    const flushAll = () => {
      for (const key of [...dayWritePending.keys()]) flushDayWrite(key, queryClient);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      document.removeEventListener('visibilitychange', onHide);
      // Fire-and-forget the unsaved blobs so day/mode switches never lose data.
      flushAll();
    };
  }, [queryClient]);

  return useCallback(
    (date: string, next: DailyPlanData) => {
      patchDayCaches(queryClient, mode, date, next);
      const key = dayWriteKey(mode, date);
      dayWritePending.set(key, { planApi, mode, date, data: next });
      markDirty(`day:${date}`);
      const existing = dayWriteTimers.get(key);
      if (existing) clearTimeout(existing);
      dayWriteTimers.set(
        key,
        setTimeout(() => flushDayWrite(key, queryClient), PLAN_SAVE_DEBOUNCE_MS),
      );
    },
    [queryClient, mode, planApi],
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
    // Same data-presence gate as useDailyPlanWeek: a settings PUT composed
    // from the defaults (fetch still in flight or errored) would wipe every
    // customization with a default-based blob.
    ready: query.data !== undefined,
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
    planApi
      .putSettings(data)
      .then(() => markSettled('settings', true))
      .catch(() => {
        markSettled('settings', false);
        void queryClient.invalidateQueries({ queryKey: settingsKey(mode) });
      });
  }, [planApi, queryClient, mode]);

  useEffect(() => {
    const flushNow = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const data = pending.current;
      pending.current = null;
      if (data) {
        void planApi
          .putSettings(data)
          .then(() => markSettled('settings', true))
          .catch(() => markSettled('settings', false));
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onHide);
      flushNow();
    };
  }, [planApi]);

  return useCallback(
    (next: DailyPlanSettings) => {
      queryClient.setQueryData(settingsKey(mode), next);
      pending.current = next;
      markDirty('settings');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, PLAN_SAVE_DEBOUNCE_MS);
    },
    [queryClient, mode, flush],
  );
}
