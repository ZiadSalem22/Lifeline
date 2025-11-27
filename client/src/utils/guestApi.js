// guestApi.js
// API drop-in for guest mode: all CRUD ops use localStorage
import { v4 as uuidv4 } from 'uuid';
import { getGuestTodos, saveGuestTodos, getGuestTags, saveGuestTags } from '../hooks/useGuestStorage';

export const fetchTodos = async () => getGuestTodos();
export const createTodo = async (title, dueDate, tags = [], isFlagged = false, duration = 0, priority = 'medium', dueTime = null, subtasks = [], description = '', recurrence = null) => {
  const todos = getGuestTodos();
  const todo = {
    id: uuidv4(),
    title,
    dueDate,
    tags,
    isFlagged,
    duration,
    priority,
    dueTime,
    subtasks,
    description,
    recurrence,
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  todos.push(todo);
  saveGuestTodos(todos);
  return todo;
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
  todos[idx].isCompleted = !todos[idx].isCompleted;
  todos[idx].updatedAt = new Date().toISOString();
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
