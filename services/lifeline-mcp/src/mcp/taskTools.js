import { z } from 'zod';
import { LIFELINE_MCP_SCOPES } from '../constants.js';
import { assertPrincipalScopes } from '../auth/principal.js';
import { ToolInputError } from '../errors.js';
import {
  createToolErrorResult,
  createToolSuccessResult,
  formatTaskListPreview,
  formatSingleTaskPreview,
} from './toolResults.js';
import { resolveTaskIdForMutation } from './taskSelectors.js';

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const tagSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  color: z.string().min(1),
}).passthrough();

const recurrenceSchema = z.union([
  z.object({}).passthrough(),
  z.string(),
]).nullable().optional();

const baseSelectorSchema = z.object({
  taskNumber: z.coerce.number().int().positive().optional(),
  id: z.string().min(1).optional(),
});

const selectorSchema = baseSelectorSchema.refine((value) => value.taskNumber || value.id, {
  message: 'Provide taskNumber or id.',
});

const searchSchema = z.object({
  query: z.string().trim().optional(),
  q: z.string().trim().optional(),
  tags: z.array(z.string().min(1)).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['active', 'completed']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  flagged: z.boolean().optional(),
  minDuration: z.coerce.number().int().positive().optional(),
  maxDuration: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['priority', 'duration', 'name', 'date_desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  taskNumber: z.coerce.number().int().positive().optional(),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable(),
  tags: z.array(tagSchema).optional(),
  isFlagged: z.boolean().optional(),
  duration: z.coerce.number().int().min(0).max(1440).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  subtasks: z.array(z.object({}).passthrough()).optional(),
  recurrence: recurrenceSchema,
});

const updateTaskSchema = baseSelectorSchema.extend({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable(),
  tags: z.array(tagSchema).optional(),
  isFlagged: z.boolean().optional(),
  duration: z.coerce.number().int().min(0).max(1440).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  subtasks: z.array(z.object({}).passthrough()).optional(),
}).superRefine((value, context) => {
  if (!value.taskNumber && !value.id) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide taskNumber or id.',
    });
  }

  const updateFieldNames = ['title', 'description', 'dueDate', 'dueTime', 'tags', 'isFlagged', 'duration', 'priority', 'subtasks'];
  const hasUpdates = updateFieldNames.some((fieldName) => Object.prototype.hasOwnProperty.call(value, fieldName));
  if (!hasUpdates) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide at least one mutable field to update.',
    });
  }
});

const tagManagementSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(30),
});

const tagUpdateSchema = z.object({
  id: z.union([z.string(), z.coerce.number()]),
  name: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(30),
});

const tagDeleteSchema = z.object({
  id: z.union([z.string(), z.coerce.number()]),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runTool(action) {
  try {
    return await action();
  } catch (error) {
    return createToolErrorResult(error);
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTaskTools(server, { principal, backendClient }) {
  // -------------------------------------------------------------------
  // READ TOOLS
  // -------------------------------------------------------------------

  server.registerTool(
    'search_tasks',
    {
      description:
        'Search the current user\'s Lifeline tasks. Supports filters: query/q (text search), tags, priority (low/medium/high), status (active/completed), startDate, endDate, flagged, minDuration, maxDuration, sortBy (priority/duration/name/date_desc), page, limit (max 100), taskNumber. Returns compact previews — use get_task with taskNumber for full detail on any specific task.',
      inputSchema: searchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.searchTasks(principal, input);
      const tasks = result.tasks || [];
      const preview = formatTaskListPreview(tasks, { total: result.total, label: 'Search results' });
      return createToolSuccessResult(result, preview);
    }),
  );

  server.registerTool(
    'get_task',
    {
      description:
        'Get full detail for a single Lifeline task by taskNumber. This is the canonical deep-read tool — use it whenever you need complete task information including description, subtasks, tags, recurrence details, priority, duration, flagged state, and archived state. List and search tools return compact previews; call get_task for the full picture.',
      inputSchema: z.object({
        taskNumber: z.coerce.number().int().positive(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ taskNumber }) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.getTaskByNumber(principal, taskNumber);
      const task = result.task || result;
      const preview = formatSingleTaskPreview(task);
      return createToolSuccessResult(result, preview);
    }),
  );

  server.registerTool(
    'list_today',
    {
      description:
        'List the current user\'s tasks that occur today (based on due date range inclusion). Returns compact previews — use get_task with taskNumber for full detail on any specific task.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.listToday(principal);
      const tasks = result.tasks || [];
      const preview = formatTaskListPreview(tasks, { label: "Today's tasks" });
      return createToolSuccessResult(result, preview);
    }),
  );

  server.registerTool(
    'list_upcoming',
    {
      description:
        'List the current user\'s upcoming tasks ordered by effective date. Optional: fromDate (YYYY-MM-DD, defaults to today), limit (max 100). Returns compact previews — use get_task with taskNumber for full detail on any specific task.',
      inputSchema: z.object({
        fromDate: z.string().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.listUpcoming(principal, input);
      const tasks = result.tasks || [];
      const preview = formatTaskListPreview(tasks, { total: result.count, label: 'Upcoming tasks' });
      return createToolSuccessResult(result, preview);
    }),
  );

  server.registerTool(
    'get_statistics',
    {
      description:
        'Get task statistics for the current user, including counts of active, completed, overdue, and flagged tasks. Useful for getting a quick overview of the user\'s task state.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.getStatistics(principal);
      const stats = result || {};
      const lines = ['Task statistics:'];
      for (const [key, value] of Object.entries(stats)) {
        if (key !== 'error') lines.push(`  ${key}: ${value}`);
      }
      return createToolSuccessResult(result, lines.join('\n'));
    }),
  );

  // -------------------------------------------------------------------
  // TAG MANAGEMENT TOOLS (Phase 2)
  // -------------------------------------------------------------------

  server.registerTool(
    'list_tags',
    {
      description:
        'List all tags available for the current user. Tags can be used with create_task and update_task to categorize tasks.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.listTags(principal);
      const tags = result.tags || result || [];
      const tagList = Array.isArray(tags) ? tags : [];
      if (tagList.length === 0) return createToolSuccessResult(result, 'No tags found.');
      const lines = [`${tagList.length} tag(s):`];
      for (const tag of tagList) {
        lines.push(`  ${tag.name} (${tag.color})${tag.isDefault ? ' [default]' : ''}`);
      }
      return createToolSuccessResult(result, lines.join('\n'));
    }),
  );

  server.registerTool(
    'create_tag',
    {
      description:
        'Create a new tag for the current user. Provide name and color. Tags can then be attached to tasks using create_task or update_task.',
      inputSchema: tagManagementSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const result = await backendClient.createTag(principal, input);
      const tag = result.tag || result;
      return createToolSuccessResult(result, `Created tag "${tag.name}" (${tag.color}).`);
    }),
  );

  server.registerTool(
    'update_tag',
    {
      description:
        'Update an existing tag\'s name and color. Provide the tag id, new name, and new color. Cannot update default tags.',
      inputSchema: tagUpdateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const result = await backendClient.updateTag(principal, input.id, { name: input.name, color: input.color });
      const tag = result.tag || result;
      return createToolSuccessResult(result, `Updated tag "${tag.name}" (${tag.color}).`);
    }),
  );

  server.registerTool(
    'delete_tag',
    {
      description:
        'Delete a tag by id. This removes the tag from the user\'s tag list. Cannot delete default tags. Tasks that had this tag will lose it.',
      inputSchema: tagDeleteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const result = await backendClient.deleteTag(principal, input.id);
      return createToolSuccessResult(result || { deleted: true, id: input.id }, `Deleted tag ${input.id}.`);
    }),
  );

  // -------------------------------------------------------------------
  // WRITE TOOLS
  // -------------------------------------------------------------------

  server.registerTool(
    'create_task',
    {
      description:
        'Create a new Lifeline task for the current user. Required: title. Optional: description, dueDate (YYYY-MM-DD), dueTime, tags (array of {id, name, color}), isFlagged, duration (minutes, 0-1440), priority (high/medium/low), subtasks, recurrence. Returns the created task with its assigned taskNumber.',
      inputSchema: createTaskSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const result = await backendClient.createTask(principal, input);
      const task = result.task || result;
      return createToolSuccessResult(result, `Created task #${task.taskNumber ?? 'new'}: ${task.title || input.title}`);
    }),
  );

  server.registerTool(
    'update_task',
    {
      description:
        'Update a Lifeline task. Identify by taskNumber (preferred) or id. Mutable fields: title, description, dueDate, dueTime, tags, isFlagged, duration, priority, subtasks. Provide at least one selector and one field to update.',
      inputSchema: updateTaskSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const { taskNumber, id, ...updates } = input;
      const resolvedId = await resolveTaskIdForMutation({ backendClient, principal, taskNumber, id });
      const result = await backendClient.updateTask(principal, resolvedId, updates);
      const task = result.task || result;
      return createToolSuccessResult(result, `Updated task ${taskNumber ? `#${taskNumber}` : resolvedId}: ${task.title || ''}`);
    }),
  );

  async function runCompletionTool(input, completed) {
    return runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const resolvedId = await resolveTaskIdForMutation({ backendClient, principal, taskNumber: input.taskNumber, id: input.id });
      const result = completed
        ? await backendClient.completeTask(principal, resolvedId)
        : await backendClient.uncompleteTask(principal, resolvedId);
      const task = result.task || result;
      const label = input.taskNumber ? `#${input.taskNumber}` : resolvedId;
      return createToolSuccessResult(result, `${completed ? 'Completed' : 'Uncompleted'} task ${label}: ${task.title || ''}`);
    });
  }

  server.registerTool(
    'complete_task',
    {
      description:
        'Mark a Lifeline task as completed. Identify by taskNumber (preferred) or id. Returns the updated task.',
      inputSchema: selectorSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runCompletionTool(input, true),
  );

  server.registerTool(
    'uncomplete_task',
    {
      description:
        'Mark a Lifeline task as not completed (reopen). Identify by taskNumber (preferred) or id. Returns the updated task.',
      inputSchema: selectorSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runCompletionTool(input, false),
  );

  server.registerTool(
    'delete_task',
    {
      description:
        'Archive-remove a Lifeline task from the active set. This archives the task — it does not permanently delete it. Identify by taskNumber (preferred) or id. This action is destructive and cannot be easily undone from MCP.',
      inputSchema: selectorSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const resolvedId = await resolveTaskIdForMutation({ backendClient, principal, taskNumber: input.taskNumber, id: input.id });
      const result = await backendClient.deleteTask(principal, resolvedId);
      if (!result?.deleted) {
        throw new ToolInputError('Delete did not complete as expected.', {
          code: 'delete_not_confirmed',
          status: 502,
        });
      }
      return createToolSuccessResult(result, `Archived task ${input.taskNumber ? `#${input.taskNumber}` : resolvedId}. The task has been removed from the active set (archived, not permanently deleted).`);
    }),
  );

  // -------------------------------------------------------------------
  // EXPORT TOOL
  // -------------------------------------------------------------------

  server.registerTool(
    'export_tasks',
    {
      description:
        'Export all tasks for the current user as a JSON snapshot. Returns all tasks with full detail, stats, and export timestamp. Use for backup, bulk review, or data analysis. This is a read-only operation.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.exportTasks(principal);
      const count = result?.todos?.length ?? 0;
      return createToolSuccessResult(result, `Exported ${count} task(s) at ${result?.exported_at || 'now'}.`);
    }),
  );

  // -------------------------------------------------------------------
  // BATCH TOOLS
  // -------------------------------------------------------------------

  const batchTaskNumbersSchema = z.object({
    taskNumbers: z.array(z.coerce.number().int().positive()).min(1).max(50)
      .describe('Array of task numbers to act on (1-50 items).'),
  });

  server.registerTool(
    'batch_complete',
    {
      description:
        'Mark multiple tasks as completed in one call. Provide an array of task numbers. Returns per-task results. Use this when the user says they finished several tasks at once.',
      inputSchema: batchTaskNumbersSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const result = await backendClient.batchAction(principal, { action: 'complete', taskNumbers: input.taskNumbers });
      const summary = (result.results || []).map((r) => `#${r.taskNumber}: ${r.status}`).join(', ');
      return createToolSuccessResult(result, `Batch complete: ${summary}`);
    }),
  );

  server.registerTool(
    'batch_uncomplete',
    {
      description:
        'Mark multiple tasks as not completed in one call. Provide an array of task numbers. Returns per-task results.',
      inputSchema: batchTaskNumbersSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const result = await backendClient.batchAction(principal, { action: 'uncomplete', taskNumbers: input.taskNumbers });
      const summary = (result.results || []).map((r) => `#${r.taskNumber}: ${r.status}`).join(', ');
      return createToolSuccessResult(result, `Batch uncomplete: ${summary}`);
    }),
  );

  server.registerTool(
    'batch_archive',
    {
      description:
        'Archive-remove multiple tasks in one call. Provide an array of task numbers. Each task is archived (not permanently deleted). This is destructive and cannot be easily undone from MCP.',
      inputSchema: batchTaskNumbersSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (input) => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const result = await backendClient.batchAction(principal, { action: 'delete', taskNumbers: input.taskNumbers });
      const summary = (result.results || []).map((r) => `#${r.taskNumber}: ${r.status}`).join(', ');
      return createToolSuccessResult(result, `Batch archive: ${summary}`);
    }),
  );
}
