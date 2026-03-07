function normalizeDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10) || null;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeTaskForInternalMcp(todo) {
  if (!todo) return null;

  return {
    id: todo.id,
    taskNumber: todo.taskNumber ?? null,
    title: todo.title,
    description: todo.description || '',
    dueDate: normalizeDateOnly(todo.dueDate),
    dueTime: todo.dueTime || null,
    isCompleted: !!todo.isCompleted,
    isFlagged: !!todo.isFlagged,
    duration: Number(todo.duration || 0),
    priority: todo.priority || 'medium',
    tags: Array.isArray(todo.tags)
      ? todo.tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      }))
      : [],
    subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
    recurrence: todo.recurrence || null,
    nextRecurrenceDue: todo.nextRecurrenceDue || null,
    originalId: todo.originalId || null,
    archived: !!todo.archived,
  };
}

function normalizeTaskListForInternalMcp(todos = []) {
  return Array.isArray(todos) ? todos.map(normalizeTaskForInternalMcp).filter(Boolean) : [];
}

module.exports = {
  normalizeDateOnly,
  normalizeTaskForInternalMcp,
  normalizeTaskListForInternalMcp,
};
