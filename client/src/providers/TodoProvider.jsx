import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { useApi } from '../hooks/useApi';
import * as guestApi from '../utils/guestApi';
import { fetchTodos as apiFetchTodos, createTodo as apiCreateTodo, toggleTodo as apiToggleTodo, deleteTodo as apiDeleteTodo, fetchTags as apiFetchTags, updateTodo as apiUpdateTodo, toggleFlag as apiToggleFlag } from '../utils/api';
import { useAuthContext } from './AuthProvider';

const TodoContext = createContext(null);

export function TodoProvider({ children }) {
  const { guestMode, setGuestMode, checkedIdentity, authLoading } = useAuthContext();
  const { fetchWithAuth } = useApi();
  const [todos, setTodos] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedDate, setSelectedDate] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('date');
  const [selectedFilterTags, setSelectedFilterTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const guestFallbackAppliedRef = useRef(false);

  const normalize = (t) => {
    if (!t) return t;
    try {
      if (!t.dueDate) return { ...t, dueDate: null };
      // if already YYYY-MM-DD, keep as is
      if (typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate)) return { ...t, dueDate: t.dueDate };
      const d = new Date(t.dueDate);
      if (isNaN(d.getTime())) return { ...t, dueDate: String(t.dueDate).slice(0,10) };
      return { ...t, dueDate: d.toISOString().slice(0,10) };
    } catch (_) {
      return { ...t, dueDate: t && t.dueDate ? String(t.dueDate).slice(0,10) : null };
    }
  };

  const normalizeSingle = normalize;

  const loadTodos = useCallback(async () => {
    if (guestFallbackAppliedRef.current && guestMode) {
      // Already in guest fallback; avoid redundant auth attempts
      const data = await guestApi.fetchTodos();
      setTodos(Array.isArray(data) ? data : []);
      return;
    }
    // Normalize todos to ensure consistent dueDate format (YYYY-MM-DD or null)
    try {
      let data = guestMode ? await guestApi.fetchTodos() : await apiFetchTodos(fetchWithAuth);
      if (data && data.mode === 'guest') {
        data = await guestApi.fetchTodos();
      }
      setTodos(Array.isArray(data) ? data.map(normalize) : []);
    } catch (e) {
      const msg = e?.message || '';
      const shouldFallback = !guestMode && (e?.status === 401 || /Missing Refresh Token/i.test(msg) || /login_required/i.test(msg));
      if (shouldFallback && !guestFallbackAppliedRef.current) {
        try {
          setGuestMode(true);
          guestFallbackAppliedRef.current = true;
          const data = await guestApi.fetchTodos();
          setTodos(Array.isArray(data) ? data : []);
          setError('Session expired. Using guest mode.');
          return;
        } catch (inner) {
          setError(inner.message || 'Guest fallback failed');
        }
      }
      setError(msg || 'Failed to load todos');
    }
  }, [fetchWithAuth, guestMode, setGuestMode]);

  const loadTags = useCallback(async () => {
    if (guestFallbackAppliedRef.current && guestMode) {
      const data = await guestApi.fetchTags();
      setTags(Array.isArray(data) ? data : []);
      return;
    }
    try {
      let data = guestMode ? await guestApi.fetchTags() : await apiFetchTags(fetchWithAuth);
      if (data && data.mode === 'guest') {
        data = await guestApi.fetchTags();
      }
      setTags(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || '';
      const shouldFallback = !guestMode && (e?.status === 401 || /Missing Refresh Token/i.test(msg) || /login_required/i.test(msg));
      if (shouldFallback && !guestFallbackAppliedRef.current) {
        try {
          setGuestMode(true);
          guestFallbackAppliedRef.current = true;
          const data = await guestApi.fetchTags();
          setTags(Array.isArray(data) ? data : []);
          setError('Session expired. Using guest mode.');
          return;
        } catch (inner) {
          setError(inner.message || 'Guest tag fallback failed');
        }
      }
      setError(msg || 'Failed to load tags');
    }
  }, [fetchWithAuth, guestMode, setGuestMode]);

  useEffect(() => {
    if (authLoading || !checkedIdentity) return; // wait for identity resolution
    (async () => {
      setLoading(true);
      if (guestMode) {
        // Direct guest load without hitting auth API
        const [gt, tg] = await Promise.all([guestApi.fetchTodos(), guestApi.fetchTags()]);
        setTodos(Array.isArray(gt) ? gt : []);
        setTags(Array.isArray(tg) ? tg : []);
      } else {
        await Promise.all([loadTodos(), loadTags()]);
      }
      setLoading(false);
    })();
  }, [loadTodos, loadTags, guestMode, authLoading, checkedIdentity]);

  useEffect(() => {
    if (authLoading || !checkedIdentity) return;
    // Refetch on date change to refresh recurrences (skip if guest mode uses local already)
    if (!guestMode) {
      (async () => { await loadTodos(); })();
    }
  }, [selectedDate, loadTodos, guestMode, authLoading, checkedIdentity]);

  const createTodo = useCallback(async (payload) => {
    try {
      const { title, dueDate, tags = [], isFlagged = false, duration = 0, priority = 'medium', dueTime = null, subtasks = [], description = '', recurrence = null } = payload || {};
      let newTodo = guestMode
        ? await guestApi.createTodo(title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence)
        : await apiCreateTodo(title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence, fetchWithAuth);
      setTodos(prev => [normalizeSingle(newTodo), ...prev]);
      return newTodo;
    } catch (e) { setError(e.message || 'Create failed'); throw e; }
  }, [guestMode, fetchWithAuth]);

  const updateTodo = useCallback(async (id, updates) => {
    try {
      let updated = guestMode ? await guestApi.updateTodo(id, updates) : await apiUpdateTodo(id, updates, fetchWithAuth);
      setTodos(prev => prev.map(t => t.id === id ? normalizeSingle(updated) : t));
      return updated;
    } catch (e) { setError(e.message || 'Update failed'); throw e; }
  }, [guestMode, fetchWithAuth]);

  const toggleTodo = useCallback(async (id) => {
    try {
      let toggled = guestMode ? await guestApi.toggleTodo(id) : await apiToggleTodo(id, fetchWithAuth);
      setTodos(prev => prev.map(t => t.id === id ? normalizeSingle(toggled) : t));
      return toggled;
    } catch (e) { setError(e.message || 'Toggle failed'); throw e; }
  }, [guestMode, fetchWithAuth]);

  const toggleFlag = useCallback(async (id) => {
    try {
      let updated = guestMode ? await guestApi.toggleFlag(id) : await apiToggleFlag(id, fetchWithAuth);
      setTodos(prev => prev.map(t => t.id === id ? normalizeSingle(updated) : t));
      return updated;
    } catch (e) { setError(e.message || 'Flag toggle failed'); throw e; }
  }, [guestMode, fetchWithAuth]);

  const deleteTodo = useCallback(async (id) => {
    try {
      await (guestMode ? guestApi.deleteTodo(id) : apiDeleteTodo(id, fetchWithAuth));
      setTodos(prev => prev.filter(t => t.id !== id));
    } catch (e) { setError(e.message || 'Delete failed'); throw e; }
  }, [guestMode, fetchWithAuth]);

  const handleSelectDate = useCallback((date) => {
    setSelectedDate(date);
    setSearchQuery('');
  }, []);

  const filteredTodos = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    return todos.filter(todo => {
      // Date filter
      if (selectedDate === 'today' && todo.dueDate !== today) return false;
      if (selectedDate === 'tomorrow' && todo.dueDate !== tomorrow) return false;
      if (typeof selectedDate === 'string' && selectedDate.includes('-') && selectedDate !== 'today' && selectedDate !== 'tomorrow' && todo.dueDate !== selectedDate) return false;
      // Search filter
      if (searchQuery.trim().length) {
        const q = searchQuery.toLowerCase();
        if (!todo.title?.toLowerCase().includes(q) && !todo.description?.toLowerCase().includes(q)) return false;
      }
      // Tag filter
      if (selectedFilterTags.length) {
        const hasAll = selectedFilterTags.every(tagId => (todo.tags || []).some(t => t.id === tagId));
        if (!hasAll) return false;
      }
      return true;
    }).sort((a, b) => {
      switch (sortOption) {
        case 'priority': return (b.priority || '').localeCompare(a.priority || '');
        case 'duration': return (b.duration || 0) - (a.duration || 0);
        case 'name': return (a.title || '').localeCompare(b.title || '');
        default: return (a.dueDate || '').localeCompare(b.dueDate || '');
      }
    });
  }, [todos, selectedDate, searchQuery, selectedFilterTags, sortOption]);

  const value = {
    loading,
    error,
    todos,
    tags,
    filteredTodos,
    selectedDate,
    searchQuery,
    sortOption,
    selectedFilterTags,
    setSearchQuery,
    setSortOption,
    setSelectedFilterTags,
    handleSelectDate,
    createTodo,
    updateTodo,
    toggleTodo,
    toggleFlag,
    deleteTodo,
    setTodos,
    setTags
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
}

export function useTodos() {
  const ctx = useContext(TodoContext);
  if (!ctx) throw new Error('useTodos must be used within TodoProvider');
  return ctx;
}
