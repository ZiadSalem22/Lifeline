import {
  MAX_PLAN_METRICS_DAYS,
  dailyPlanDataSchema,
  dailyPlanSettingsSchema,
  defaultDailyPlanSettings,
  emptyDailyPlanData,
  extractDayMetrics,
  type DailyPlanData,
  type DailyPlanDay,
  type DailyPlanSettings,
  type PlanMetricsResponse,
} from '@lifeline/shared';
import { api } from '../../../shared/api/client';
import { daysBefore } from '../lib/plan-model';

/**
 * Daily Plan data access — one interface, two adapters:
 * - server mode: /api/v1/daily-plan (synced across devices);
 * - guest mode: localStorage rows (`daily_plan:<date>` / `daily_plan_settings`),
 *   mirroring the guest-api idiom (injected storage, try/catch reads,
 *   schema-normalized self-heal on read).
 */
export interface PlanApi {
  fetchRange(start: string, end: string): Promise<DailyPlanDay[]>;
  /** Compact per-day metrics (Statistics feed) — ≤ MAX_PLAN_METRICS_DAYS. */
  fetchMetrics(start: string, end: string): Promise<PlanMetricsResponse>;
  putDay(date: string, data: DailyPlanData): Promise<DailyPlanDay>;
  fetchSettings(): Promise<DailyPlanSettings>;
  putSettings(data: DailyPlanSettings): Promise<DailyPlanSettings>;
}

export const serverPlanApi: PlanApi = {
  async fetchRange(start, end) {
    const res = await api.get<{ items: DailyPlanDay[] }>(`/daily-plan?start=${start}&end=${end}`);
    return res.items;
  },
  fetchMetrics(start, end) {
    return api.get<PlanMetricsResponse>(`/daily-plan/metrics?start=${start}&end=${end}`);
  },
  // keepalive: plan writes are debounced and flushed on pagehide — the PUT
  // must survive a tab close mid-flight (blobs stay well under the 64KB cap).
  putDay(date, data) {
    return api.put<DailyPlanDay>(`/daily-plan/${date}`, { data }, { keepalive: true });
  },
  fetchSettings() {
    return api.get<DailyPlanSettings>('/daily-plan/settings');
  },
  putSettings(data) {
    return api.put<DailyPlanSettings>('/daily-plan/settings', { data }, { keepalive: true });
  },
};

export const PLAN_DAY_KEY_PREFIX = 'daily_plan:';
export const PLAN_SETTINGS_KEY = 'daily_plan_settings';

interface PlanStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createLocalPlanApi(storage: PlanStorage): PlanApi {
  function readDay(date: string): DailyPlanData | null {
    try {
      const raw = storage.getItem(`${PLAN_DAY_KEY_PREFIX}${date}`);
      if (raw === null) return null;
      return dailyPlanDataSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  return {
    fetchRange(start, end) {
      // Enumerate every date in [start, end], capped like the server (62 days).
      const items: DailyPlanDay[] = [];
      for (let i = 0; i < 62; i += 1) {
        const date = daysBefore(end, i);
        if (date < start) break;
        const data = readDay(date);
        if (data !== null) items.push({ date, data });
      }
      items.sort((a, b) => a.date.localeCompare(b.date));
      return Promise.resolve(items);
    },
    fetchMetrics(start, end) {
      // Same shared extractor as the server endpoint — parity by construction.
      const items = [];
      for (let i = 0; i < MAX_PLAN_METRICS_DAYS; i += 1) {
        const date = daysBefore(end, i);
        if (date < start) break;
        const data = readDay(date);
        if (data !== null) items.push(extractDayMetrics(date, data));
      }
      items.sort((a, b) => a.date.localeCompare(b.date));
      return Promise.resolve({ items });
    },
    putDay(date, data) {
      const parsed = dailyPlanDataSchema.parse(data);
      try {
        storage.setItem(`${PLAN_DAY_KEY_PREFIX}${date}`, JSON.stringify(parsed));
      } catch {
        // storage unavailable — the in-memory cache still has the value
      }
      return Promise.resolve({ date, data: parsed });
    },
    fetchSettings() {
      try {
        const raw = storage.getItem(PLAN_SETTINGS_KEY);
        if (raw === null) return Promise.resolve(defaultDailyPlanSettings());
        return Promise.resolve(dailyPlanSettingsSchema.parse(JSON.parse(raw)));
      } catch {
        return Promise.resolve(defaultDailyPlanSettings());
      }
    },
    putSettings(data) {
      const parsed = dailyPlanSettingsSchema.parse(data);
      try {
        storage.setItem(PLAN_SETTINGS_KEY, JSON.stringify(parsed));
      } catch {
        // storage unavailable
      }
      return Promise.resolve(parsed);
    },
  };
}

export const localPlanApi: PlanApi = createLocalPlanApi(window.localStorage);

export { emptyDailyPlanData };
