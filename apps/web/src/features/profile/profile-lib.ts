/** Small pure helpers for the profile cards (ported from ApiKeysCard.jsx). */

export function getScopeLabel(scopes: readonly string[]): string {
  const normalized = [...scopes].sort().join(',');
  if (normalized === 'tasks:read') return 'Read only';
  if (normalized === 'tasks:read,tasks:write') return 'Read and write';
  return scopes.length > 0 ? scopes.join(', ') : 'Unknown';
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

export function getBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
