import type { Todo } from '@lifeline/shared';

/** "Xh Ym" | "Xh" | "Ym" | "" — old App.jsx formatDuration. */
export function formatDuration(totalMinutes: number): string {
  if (!totalMinutes) return '';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface RecurrenceLike {
  mode?: unknown;
  type?: unknown;
}

/** Badge label: Daily | Range | Weekdays | <legacy type> | Recurring (old TaskCard). */
export function recurrenceLabel(recurrence: Todo['recurrence']): string | null {
  if (!recurrence) return null;
  const rec = recurrence as RecurrenceLike;
  if (rec.mode === 'daily') return 'Daily';
  if (rec.mode === 'dateRange') return 'Range';
  if (rec.mode === 'specificDays') return 'Weekdays';
  if (typeof rec.type === 'string' && rec.type.length > 0) return rec.type;
  return 'Recurring';
}

/** The old 10-color preset palette used for random default tag colors. */
export const TAG_PRESET_COLORS = [
  '#6366F1', // indigo
  '#22C55E', // green
  '#EF4444', // red
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#A855F7', // purple
  '#14B8A6', // teal
  '#EAB308', // yellow
  '#FB7185', // rose
  '#0EA5E9', // sky
] as const;

export function randomTagColor(): string {
  const index = Math.floor(Math.random() * TAG_PRESET_COLORS.length);
  return TAG_PRESET_COLORS[index] ?? TAG_PRESET_COLORS[0];
}

/** Old TaskCard hardcoded priority badge colors. */
export const PRIORITY_COLORS: Record<Todo['priority'], string> = {
  high: '#ef4444',
  medium: '#FDBA74',
  low: '#6EE7B7',
};

export const PRIORITY_LABELS: Record<Todo['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
