/** Product limits and fixed vocabularies shared by server, web, and MCP. */

export const LIMITS = {
  todoTitleMax: 200,
  descriptionMax: 2000,
  durationMaxMinutes: 1440,
  subtasksPerTodoMax: 50,
  subtaskTitleMax: 500,
  tagNameMax: 50,
  mcpKeyNameMax: 100,
  freeTierActiveTodosMax: 200,
  freeTierCustomTagsMax: 50,
  batchIdsMax: 100,
  batchTaskNumbersMax: 50,
} as const;

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export type DayName = (typeof DAY_NAMES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ROLES = ['free', 'paid', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** Seeded by the baseline migration; global, immutable, user_id NULL. */
export const DEFAULT_TAGS = [
  { id: 'default-work', name: 'Work', color: '#3B82F6' },
  { id: 'default-personal', name: 'Personal', color: '#10B981' },
  { id: 'default-health', name: 'Health', color: '#EF4444' },
  { id: 'default-finance', name: 'Finance', color: '#F59E0B' },
  { id: 'default-study', name: 'Study', color: '#6366F1' },
  { id: 'default-family', name: 'Family', color: '#EC4899' },
  { id: 'default-errands', name: 'Errands', color: '#6B7280' },
  { id: 'default-ideas', name: 'Ideas', color: '#8B5CF6' },
  { id: 'default-important', name: 'Important', color: '#DC2626' },
  { id: 'default-misc', name: 'Misc', color: '#9CA3AF' },
] as const;

export const MCP_SCOPES = ['tasks:read', 'tasks:write', 'tasks:*', '*'] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const GUEST_LOGIN_REQUIRED_MESSAGE =
  'Please log in to use this feature. Guest mode works only locally.';
