import type { DailyPlanData, MealItem } from '@lifeline/shared';

/**
 * Personal suggestions mined from the user's own recent plan days — every
 * user's patterns are their own. Pools are unique, ordered by frequency then
 * recency (days arrive oldest → newest; later occurrences win ties).
 */

const CAP = 6;

function rank(values: string[]): string[] {
  const freq = new Map<string, { count: number; lastIdx: number }>();
  values.forEach((raw, idx) => {
    const text = raw.trim();
    if (!text) return;
    const key = text.toLowerCase();
    const entry = freq.get(key);
    if (entry) {
      entry.count += 1;
      entry.lastIdx = idx;
    } else {
      freq.set(key, { count: 1, lastIdx: idx });
    }
  });
  return [...freq.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].lastIdx - a[1].lastIdx)
    .slice(0, CAP)
    .map(([key]) => {
      // Return the last-seen original casing for the key.
      for (let i = values.length - 1; i >= 0; i -= 1) {
        if (values[i]?.trim().toLowerCase() === key) return values[i]?.trim() ?? key;
      }
      return key;
    });
}

/** What you usually put at this hour ("06:00" → "Gym — Push", …). */
export function scheduleSuggestions(days: DailyPlanData[], hour: string): string[] {
  return rank(days.map((d) => d.schedule[hour] ?? ''));
}

export function prioritySuggestions(days: DailyPlanData[]): string[] {
  return rank(days.flatMap((d) => d.priorities.map((p) => p.t)));
}

export function quickSuggestions(days: DailyPlanData[]): string[] {
  return rank(days.flatMap((d) => d.quick.map((q) => q.t)));
}

/** Recently logged meal items, unique by name, newest first (for 1-tap re-log). */
export function recentMealItems(days: DailyPlanData[], cap = 8): MealItem[] {
  const seen = new Set<string>();
  const out: MealItem[] = [];
  for (let i = days.length - 1; i >= 0 && out.length < cap; i -= 1) {
    const meals = days[i]?.meals;
    if (!meals) continue;
    const items = [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snacks];
    for (let j = items.length - 1; j >= 0 && out.length < cap; j -= 1) {
      const item = items[j];
      if (!item) continue;
      const key = item.n.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...item });
    }
  }
  return out;
}
