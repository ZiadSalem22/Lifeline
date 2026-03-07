// guestApi.js
// API drop-in for guest mode: all CRUD ops use localStorage
import { v4 as uuidv4 } from 'uuid';
import { getGuestTodos, saveGuestTodos, getGuestTags, saveGuestTags } from '../hooks/useGuestStorage';

export const fetchTodos = async () => getGuestTodos();
export const createTodo = async (title, dueDate, tags = [], isFlagged = false, duration = 0, priority = 'medium', dueTime = null, subtasks = [], description = '', recurrence = null) => {
  const todos = getGuestTodos();

  const baseProps = {
    title,
    tags,
    isFlagged,
    duration,
    priority,
    dueTime,
    subtasks,
    description,
    recurrence,
    isCompleted: false,
  };

  const addOne = (date) => {
    const now = new Date().toISOString();
    const taskNumber = (() => {
      try {
        const max = todos.reduce((acc, t) => {
          const v = Number.isFinite(Number(t.taskNumber)) ? Number(t.taskNumber) : 0;
          return Math.max(acc, v);
        }, 0);
        return max + 1;
      } catch (e) { return null; }
    })();

    const todo = {
      id: uuidv4(),
      dueDate: date,
      createdAt: now,
      updatedAt: now,
      ...baseProps,
      taskNumber,
    };
    todos.push(todo);
    return todo;
  };
  // Expand recurrence into multiple dates similar to backend CreateTodo
  let createdFirst = null;
  if (!recurrence) {
    createdFirst = addOne(dueDate);
  } else if (recurrence.mode === 'daily' || recurrence.mode === 'dateRange') {
    const startStr = (recurrence.startDate || dueDate);
    const endStr = (recurrence.endDate || dueDate);
    let current = new Date(startStr + 'T00:00:00Z');
    const end = new Date(endStr + 'T00:00:00Z');
    while (current <= end) {
      const date = current.toISOString().slice(0, 10);
      const t = addOne(date);
      if (!createdFirst) createdFirst = t;
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else if (recurrence.mode === 'specificDays') {
    const startStr = (recurrence.startDate || dueDate);
    const endStr = (recurrence.endDate || dueDate);
    let current = new Date(startStr + 'T00:00:00Z');
    const end = new Date(endStr + 'T00:00:00Z');
    const selectedDays = (recurrence.selectedDays || []).map(d => d.toLowerCase());
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    while (current <= end) {
      const dayName = days[current.getUTCDay()];
      if (selectedDays.includes(dayName)) {
        const date = current.toISOString().slice(0, 10);
        const t = addOne(date);
        if (!createdFirst) createdFirst = t;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else if (recurrence.type === 'daily' || recurrence.type === 'weekly' || recurrence.type === 'monthly' || recurrence.type === 'custom') {
    const interval = recurrence.interval || 1;
    let current = new Date(dueDate + 'T00:00:00Z');
    const end = recurrence.endDate ? new Date(recurrence.endDate + 'T00:00:00Z') : new Date(dueDate + 'T00:00:00Z');
    while (current <= end) {
      const date = current.toISOString().slice(0, 10);
      const t = addOne(date);
      if (!createdFirst) createdFirst = t;
      if (recurrence.type === 'weekly') current.setUTCDate(current.getUTCDate() + 7 * interval);
      else if (recurrence.type === 'monthly') current.setUTCMonth(current.getUTCMonth() + interval);
      else current.setUTCDate(current.getUTCDate() + interval);
    }
  } else {
    createdFirst = addOne(dueDate);
  }

  saveGuestTodos(todos);
  return createdFirst;
};
export const updateTodo = async (id, updates) => {
  const todos = getGuestTodos();
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Todo not found');
  todos[idx] = { ...todos[idx], ...updates, updatedAt: new Date().toISOString() };
  saveGuestTodos(todos);
  return todos[idx];
};
export const deleteTodo = async (id) => {
  let todos = getGuestTodos();
  todos = todos.filter(t => t.id !== id);
  saveGuestTodos(todos);
};
export const toggleTodo = async (id) => {
  const todos = getGuestTodos();
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Todo not found');
  const wasCompleted = todos[idx].isCompleted;
  todos[idx].isCompleted = !todos[idx].isCompleted;
  todos[idx].updatedAt = new Date().toISOString();

  // If marking completed and recurrence exists, create next occurrence (single next based on mode)
  if (!wasCompleted && todos[idx].recurrence) {
    const rec = todos[idx].recurrence;
    const currentDate = todos[idx].dueDate;
    const nowIso = new Date().toISOString();
    const addNext = (date) => {
      const newTodo = {
        id: uuidv4(),
        title: todos[idx].title,
        dueDate: date,
        tags: todos[idx].tags,
        isFlagged: todos[idx].isFlagged,
        duration: todos[idx].duration,
        priority: todos[idx].priority,
        dueTime: todos[idx].dueTime,
        subtasks: (todos[idx].subtasks || []).map(st => ({ ...st, isCompleted: false, id: uuidv4() })),
        description: todos[idx].description,
        recurrence: rec,
        isCompleted: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      todos.push(newTodo);
    };

    let nextDate = null;
    if (rec.mode === 'daily' || rec.mode === 'dateRange') {
      const next = new Date(currentDate + 'T00:00:00Z');
      next.setUTCDate(next.getUTCDate() + 1);
      const end = rec.endDate ? new Date(rec.endDate + 'T00:00:00Z') : null;
      if (!end || next <= end) nextDate = next.toISOString().slice(0, 10);
    } else if (rec.mode === 'specificDays') {
      const selectedDays = (rec.selectedDays || []).map(d => d.toLowerCase());
      const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      let probe = new Date(currentDate + 'T00:00:00Z');
      const end = rec.endDate ? new Date(rec.endDate + 'T00:00:00Z') : null;
      for (let i = 1; i <= 365; i++) {
        probe.setUTCDate(probe.getUTCDate() + 1);
        if (end && probe > end) break;
        if (selectedDays.includes(days[probe.getUTCDay()])) { nextDate = probe.toISOString().slice(0,10); break; }
      }
    } else if (rec.type === 'weekly' || rec.type === 'monthly' || rec.type === 'daily' || rec.type === 'custom') {
      const interval = rec.interval || 1;
      const next = new Date(currentDate + 'T00:00:00Z');
      if (rec.type === 'weekly') next.setUTCDate(next.getUTCDate() + 7 * interval);
      else if (rec.type === 'monthly') next.setUTCMonth(next.getUTCMonth() + interval);
      else next.setUTCDate(next.getUTCDate() + interval);
      const end = rec.endDate ? new Date(rec.endDate + 'T00:00:00Z') : null;
      if (!end || next <= end) nextDate = next.toISOString().slice(0,10);
    }

    if (nextDate) addNext(nextDate);
  }

  saveGuestTodos(todos);
  return todos[idx];
};
export const toggleFlag = async (id) => {
  const todos = getGuestTodos();
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Todo not found');
  todos[idx].isFlagged = !todos[idx].isFlagged;
  todos[idx].updatedAt = new Date().toISOString();
  saveGuestTodos(todos);
  return todos[idx];
};
export const fetchTags = async () => getGuestTags();
export const createTag = async (name, color) => {
  const tags = getGuestTags();
  const tag = { id: uuidv4(), name, color };
  tags.push(tag);
  saveGuestTags(tags);
  return tag;
};
export const updateTag = async (id, name, color) => {
  const tags = getGuestTags();
  const idx = tags.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Tag not found');
  tags[idx] = { ...tags[idx], name, color };
  saveGuestTags(tags);
  return tags[idx];
};
export const deleteTag = async (id) => {
  let tags = getGuestTags();
  tags = tags.filter(t => t.id !== id);
  saveGuestTags(tags);
};
