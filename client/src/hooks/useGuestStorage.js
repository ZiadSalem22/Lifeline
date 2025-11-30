// useGuestStorage.js
// React hook for guest mode localStorage CRUD for todos and tags
import { useCallback } from 'react';

// Default tags for first-time guest users
// Mirrors backend seeded defaults (see migration 1660000040000-AddDefaultTagsSupport)
const DEFAULT_GUEST_TAGS = [
  { id: 'tag-work', name: 'Work', color: '#3B82F6' },
  { id: 'tag-personal', name: 'Personal', color: '#10B981' },
  { id: 'tag-health', name: 'Health', color: '#EF4444' },
  { id: 'tag-finance', name: 'Finance', color: '#F59E0B' },
  { id: 'tag-study', name: 'Study', color: '#6366F1' },
  { id: 'tag-family', name: 'Family', color: '#EC4899' },
  { id: 'tag-errands', name: 'Errands', color: '#6B7280' },
  { id: 'tag-ideas', name: 'Ideas', color: '#8B5CF6' },
  { id: 'tag-important', name: 'Important', color: '#DC2626' },
  { id: 'tag-misc', name: 'Misc', color: '#9CA3AF' },
];

const TODOS_KEY = 'guest_todos';
const TAGS_KEY = 'guest_tags';

export function getGuestTodos() {
  try {
    const data = localStorage.getItem(TODOS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveGuestTodos(todos) {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

export function getGuestTags() {
  try {
    const data = localStorage.getItem(TAGS_KEY);
    if (!data) {
      // Seed defaults on first run
      localStorage.setItem(TAGS_KEY, JSON.stringify(DEFAULT_GUEST_TAGS));
      return DEFAULT_GUEST_TAGS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        // If empty array present, seed defaults for better UX
        localStorage.setItem(TAGS_KEY, JSON.stringify(DEFAULT_GUEST_TAGS));
        return DEFAULT_GUEST_TAGS;
      }
      // Ensure all default tags exist by name (case-insensitive)
      const nameSet = new Set(parsed.map(t => (t.name || '').toLowerCase()));
      const missing = DEFAULT_GUEST_TAGS.filter(def => !nameSet.has(def.name.toLowerCase()));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        localStorage.setItem(TAGS_KEY, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
    // Non-array: reset to defaults
    localStorage.setItem(TAGS_KEY, JSON.stringify(DEFAULT_GUEST_TAGS));
    return DEFAULT_GUEST_TAGS;
  } catch {
    // On parse error, reset to defaults
    localStorage.setItem(TAGS_KEY, JSON.stringify(DEFAULT_GUEST_TAGS));
    return DEFAULT_GUEST_TAGS;
  }
}

export function saveGuestTags(tags) {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export function useGuestStorage() {
  // CRUD for todos
  const loadTodos = useCallback(() => getGuestTodos(), []);
  const saveTodos = useCallback((todos) => saveGuestTodos(todos), []);
  // CRUD for tags
  const loadTags = useCallback(() => getGuestTags(), []);
  const saveTags = useCallback((tags) => saveGuestTags(tags), []);
  return {
    getGuestTodos: loadTodos,
    saveGuestTodos: saveTodos,
    getGuestTags: loadTags,
    saveGuestTags: saveTags,
  };
}
