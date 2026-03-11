import { BackendAdapterError, LifelineMcpError } from '../errors.js';

function createTextBlock(text) {
  return {
    type: 'text',
    text,
  };
}

function stringifyPayload(payload) {
  return JSON.stringify(payload, null, 2);
}

export function createToolSuccessResult(payload, summary = null) {
  return {
    content: [createTextBlock(summary || stringifyPayload(payload))],
    structuredContent: payload,
  };
}

// ---------------------------------------------------------------------------
// Task preview formatting (Phase 1 — model-usable read surface)
// ---------------------------------------------------------------------------

const MAX_PREVIEW_TASKS = 5;

function formatRecurrenceHint(recurrence) {
  if (!recurrence) return null;
  if (typeof recurrence === 'string') return `recurs ${recurrence}`;
  if (recurrence.frequency) return `recurs ${recurrence.frequency}`;
  return 'recurs';
}

function formatTaskPreviewLine(task) {
  const parts = [];
  if (task.taskNumber != null) parts.push(`#${task.taskNumber}`);
  if (task.title) parts.push(task.title);
  parts.push(task.isCompleted ? 'completed' : 'active');
  if (task.dueDate) {
    const due = task.dueTime ? `due ${task.dueDate} ${task.dueTime}` : `due ${task.dueDate}`;
    parts.push(due);
  }
  if (task.priority && task.priority !== 'medium') parts.push(task.priority);
  if (task.duration) parts.push(`${task.duration}m`);
  if (Array.isArray(task.tags) && task.tags.length > 0) {
    parts.push(`tags: ${task.tags.map((t) => t.name).join(', ')}`);
  }
  const recHint = formatRecurrenceHint(task.recurrence);
  if (recHint) parts.push(recHint);
  if (task.isFlagged) parts.push('flagged');
  return parts.join(' | ');
}

export function formatTaskListPreview(tasks, { total = null, label = null } = {}) {
  const count = Array.isArray(tasks) ? tasks.length : 0;
  const displayTotal = total != null ? total : count;

  if (count === 0) return `${label ? `${label}: ` : ''}No tasks found.`;

  const lines = [];
  const headerParts = [];
  if (label) headerParts.push(label);
  headerParts.push(`${displayTotal} task(s)`);
  lines.push(headerParts.join(': '));

  const shown = tasks.slice(0, MAX_PREVIEW_TASKS);
  for (const task of shown) {
    lines.push(formatTaskPreviewLine(task));
  }

  if (displayTotal > MAX_PREVIEW_TASKS) {
    lines.push(`Showing ${shown.length} of ${displayTotal} tasks. Use get_task with taskNumber for full detail or refine filters.`);
  }

  return lines.join('\n');
}

export function formatSingleTaskPreview(task) {
  if (!task) return 'Task not found.';

  const lines = [];
  lines.push(`Task #${task.taskNumber ?? '?'}: ${task.title || '(untitled)'}`);
  lines.push(`Status: ${task.isCompleted ? 'completed' : 'active'}${task.isFlagged ? ' | flagged' : ''}`);
  if (task.description) lines.push(`Description: ${task.description}`);
  if (task.dueDate) lines.push(`Due: ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''}`);
  lines.push(`Priority: ${task.priority || 'medium'}`);
  if (task.duration) lines.push(`Duration: ${task.duration}m`);
  if (Array.isArray(task.tags) && task.tags.length > 0) {
    lines.push(`Tags: ${task.tags.map((t) => t.name).join(', ')}`);
  }
  if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
    lines.push(`Subtasks: ${task.subtasks.length}`);
  }
  const recHint = formatRecurrenceHint(task.recurrence);
  if (recHint) lines.push(`Recurrence: ${recHint}`);
  if (task.nextRecurrenceDue) lines.push(`Next recurrence: ${task.nextRecurrenceDue}`);
  if (task.originalId) lines.push(`Recurrence origin: ${task.originalId}`);
  if (task.archived) lines.push('Archived: yes');
  return lines.join('\n');
}

function normalizeToolError(error) {
  if (error instanceof LifelineMcpError || error instanceof BackendAdapterError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      details: error.details || null,
    };
  }

  return {
    code: 'tool_execution_failed',
    status: 500,
    message: error?.message || 'Tool execution failed.',
    details: null,
  };
}

export function createToolErrorResult(error) {
  const normalizedError = normalizeToolError(error);

  return {
    isError: true,
    content: [createTextBlock(`${normalizedError.message} (${normalizedError.code})`)],
    structuredContent: {
      error: normalizedError,
    },
  };
}
