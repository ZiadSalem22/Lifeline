import type { TagReference } from '@lifeline/shared';
import { parseUtcDate } from '../../domain/recurrence.js';
import type { TagRepository } from '../ports.js';

/**
 * Input normalization shared by the todo use-cases (old-app parity,
 * audit-domain-logic.md §11): empty strings mean "clear", ISO datetimes are
 * truncated to date-only, and tag references resolve leniently.
 */

/** `''`/null → null; full ISO datetimes → `YYYY-MM-DD` (UTC). */
export function normalizeDueDate(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseUtcDate(value);
  return parsed === null ? null : parsed.toISOString().slice(0, 10);
}

/** `''`/null → null; otherwise the validated HH:mm string passes through. */
export function normalizeDueTime(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

/**
 * Tag references (id strings or `{id?, name?}` objects) → candidate tag ids.
 * Name-only references resolve case-insensitively against the user's visible
 * tags; unknown names are silently dropped here and unknown ids are silently
 * dropped by the repository (old-app parity — no 400s for stale tags).
 */
export async function resolveTagReferenceIds(
  tags: TagRepository,
  userId: string,
  refs: readonly TagReference[] | undefined,
): Promise<string[]> {
  if (refs === undefined || refs.length === 0) return [];
  const ids: string[] = [];
  const names: string[] = [];
  for (const ref of refs) {
    if (typeof ref === 'string') {
      ids.push(ref);
    } else if (ref.id !== undefined) {
      ids.push(String(ref.id));
    } else if (ref.name !== undefined) {
      names.push(ref.name);
    }
  }
  if (names.length > 0) {
    const visible = await tags.listVisible(userId);
    for (const name of names) {
      const wanted = name.trim().toLowerCase();
      const match = visible.find((tag) => tag.name.toLowerCase() === wanted);
      if (match !== undefined) ids.push(match.id);
    }
  }
  return [...new Set(ids)];
}
