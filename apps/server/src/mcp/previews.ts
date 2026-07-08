import { normalizeToolError } from './errors.js';
import type { McpTaskPayload } from './payloads.js';

/**
 * Tool result construction + human preview formatting, ported VERBATIM from
 * the old `services/lifeline-mcp/src/mcp/toolResults.js`. Success results are
 * `{content:[{type:'text',text}], structuredContent}`; tool failures are
 * error RESULTS (`isError: true`) carrying `structuredContent.error`, never
 * JSON-RPC protocol errors.
 */

interface TextBlock {
  type: 'text';
  text: string;
}

/** Object-literal types (not interfaces) so they satisfy the SDK's CallToolResult index signature. */
export type ToolSuccessResult = {
  content: TextBlock[];
  structuredContent: Record<string, unknown>;
};

export type ToolErrorResult = {
  isError: true;
  content: TextBlock[];
  structuredContent: {
    error: { code: string; status: number; message: string; details: unknown };
  };
};

export type ToolResult = ToolSuccessResult | ToolErrorResult;

function createTextBlock(text: string): TextBlock {
  return { type: 'text', text };
}

export function createToolSuccessResult(
  payload: Record<string, unknown>,
  summary: string | null = null,
): ToolSuccessResult {
  return {
    content: [createTextBlock(summary ?? JSON.stringify(payload, null, 2))],
    structuredContent: payload,
  };
}

// ---------------------------------------------------------------------------
// Task preview formatting (Phase 1 — model-usable read surface)
// ---------------------------------------------------------------------------

const MAX_PREVIEW_TASKS = 5;

function formatRecurrenceHint(recurrence: unknown): string | null {
  if (!recurrence) return null;
  if (typeof recurrence === 'string') return `recurs ${recurrence}`;
  const frequency = (recurrence as { frequency?: unknown }).frequency;
  if (typeof frequency === 'string' && frequency !== '') return `recurs ${frequency}`;
  return 'recurs';
}

function formatTaskPreviewLine(task: McpTaskPayload): string {
  const parts: string[] = [];
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

export interface TaskListPreviewOptions {
  total?: number | null | undefined;
  label?: string | null | undefined;
}

export function formatTaskListPreview(
  tasks: readonly McpTaskPayload[],
  { total = null, label = null }: TaskListPreviewOptions = {},
): string {
  const count = Array.isArray(tasks) ? tasks.length : 0;
  const displayTotal = total != null ? total : count;

  if (count === 0) return `${label ? `${label}: ` : ''}No tasks found.`;

  const lines: string[] = [];
  const headerParts: string[] = [];
  if (label) headerParts.push(label);
  headerParts.push(`${displayTotal} task(s)`);
  lines.push(headerParts.join(': '));

  const shown = tasks.slice(0, MAX_PREVIEW_TASKS);
  for (const task of shown) {
    lines.push(formatTaskPreviewLine(task));
  }

  if (displayTotal > MAX_PREVIEW_TASKS) {
    lines.push(
      `Showing ${shown.length} of ${displayTotal} tasks. Use get_task with taskNumber for full detail or refine filters.`,
    );
  }

  return lines.join('\n');
}

export function formatSingleTaskPreview(task: McpTaskPayload | null | undefined): string {
  if (!task) return 'Task not found.';

  const lines: string[] = [];
  lines.push(`Task #${task.taskNumber ?? '?'}: ${task.title || '(untitled)'}`);
  lines.push(
    `Status: ${task.isCompleted ? 'completed' : 'active'}${task.isFlagged ? ' | flagged' : ''}`,
  );
  if (task.description) lines.push(`Description: ${task.description}`);
  if (task.dueDate) lines.push(`Due: ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''}`);
  lines.push(`Priority: ${task.priority || 'medium'}`);
  if (task.duration) lines.push(`Duration: ${task.duration}m`);
  if (Array.isArray(task.tags) && task.tags.length > 0) {
    lines.push(`Tags: ${task.tags.map((t) => t.name).join(', ')}`);
  }
  if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
    const completed = task.subtasks.filter((s) => s.isCompleted).length;
    lines.push(`Subtasks: ${completed}/${task.subtasks.length} completed`);
    for (const st of task.subtasks) {
      const check = st.isCompleted ? '[x]' : '[ ]';
      const sid = st.subtaskId ? ` (${st.subtaskId})` : '';
      lines.push(`  ${check} ${st.title || '(untitled)'}${sid}`);
    }
  }
  const recHint = formatRecurrenceHint(task.recurrence);
  if (recHint) lines.push(`Recurrence: ${recHint}`);
  if (task.nextRecurrenceDue) lines.push(`Next recurrence: ${task.nextRecurrenceDue}`);
  if (task.originalId) lines.push(`Recurrence origin: ${task.originalId}`);
  if (task.archived) lines.push('Archived: yes');
  return lines.join('\n');
}

export function createToolErrorResult(error: unknown): ToolErrorResult {
  const normalizedError = normalizeToolError(error);

  return {
    isError: true,
    content: [createTextBlock(`${normalizedError.message} (${normalizedError.code})`)],
    structuredContent: {
      error: normalizedError,
    },
  };
}
