// useGuestStorage.js
// React hook for guest mode localStorage CRUD for todos and tags
import { useCallback } from 'react';

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
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
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
