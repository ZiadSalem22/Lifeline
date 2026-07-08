import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { assertPrincipalScopes, LIFELINE_MCP_SCOPES, type McpPrincipal } from './auth.js';
import {
  createToolErrorResult,
  createToolSuccessResult,
  formatSingleTaskPreview,
  formatTaskListPreview,
  type ToolResult,
} from './previews.js';
import { describeSelector } from './selectors.js';
import type { McpToolService } from './service.js';

/**
 * The 28-tool surface, ported from the old
 * `services/lifeline-mcp/src/mcp/taskTools.js` — names, descriptions, input
 * schemas, and annotations preserved verbatim so existing configured clients
 * keep working (audit-mcp.md §5). Handlers call the in-process
 * {@link McpToolService} instead of the old HTTP backend client.
 */

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const tagReferenceSchema = z.union([
  z.string().trim().min(1),
  z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      name: z.string().trim().min(1).optional(),
      color: z.string().trim().min(1).optional(),
    })
    .loose()
    .refine((value) => value.id !== undefined || value.name, {
      message: 'Provide tag id or name.',
    }),
]);

const recurrenceSchema = z
  .union([z.object({}).loose(), z.string()])
  .nullable()
  .optional();

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
  tags: z.array(tagReferenceSchema).optional(),
  isFlagged: z.boolean().optional(),
  duration: z.coerce.number().int().min(0).max(1440).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  subtasks: z.array(z.object({}).loose()).optional(),
  recurrence: recurrenceSchema,
});

const updateTaskSchema = baseSelectorSchema
  .extend({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    dueDate: z.string().optional().nullable(),
    dueTime: z.string().optional().nullable(),
    tags: z.array(tagReferenceSchema).optional(),
    isFlagged: z.boolean().optional(),
    duration: z.coerce.number().int().min(0).max(1440).optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    subtasks: z.array(z.object({}).loose()).optional(),
    // Not a mutable field: kept visible so the handler can reject it with an
    // explicit invalid_input instead of silently stripping it (old behavior).
    recurrence: z.unknown().optional(),
  })
  .superRefine((value, context) => {
    if (!value.taskNumber && !value.id) {
      context.addIssue({ code: 'custom', message: 'Provide taskNumber or id.' });
    }

    const updateFieldNames = [
      'title',
      'description',
      'dueDate',
      'dueTime',
      'tags',
      'isFlagged',
      'duration',
      'priority',
      'subtasks',
    ];
    const hasUpdates = updateFieldNames.some((fieldName) =>
      Object.prototype.hasOwnProperty.call(value, fieldName),
    );
    if (!hasUpdates) {
      context.addIssue({
        code: 'custom',
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

const batchTaskNumbersSchema = z.object({
  taskNumbers: z
    .array(z.coerce.number().int().positive())
    .min(1)
    .max(50)
    .describe('Array of task numbers to act on (1-50 items).'),
});

const subtaskSelectorSchema = z
  .object({
    taskNumber: z.coerce.number().int().positive().optional(),
    id: z.string().min(1).optional(),
    subtaskId: z.uuid(),
  })
  .refine((v) => v.taskNumber || v.id, {
    message: 'Provide taskNumber or id for the parent task.',
  });

const addSubtaskSchema = z
  .object({
    taskNumber: z.coerce.number().int().positive().optional(),
    id: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(500),
  })
  .refine((v) => v.taskNumber || v.id, {
    message: 'Provide taskNumber or id for the parent task.',
  });

const updateSubtaskSchema = z
  .object({
    taskNumber: z.coerce.number().int().positive().optional(),
    id: z.string().min(1).optional(),
    subtaskId: z.uuid(),
    title: z.string().trim().min(1).max(500).optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((v) => v.taskNumber || v.id, { message: 'Provide taskNumber or id for the parent task.' })
  .refine((v) => v.title !== undefined || v.isCompleted !== undefined, {
    message: 'Provide at least one field to update.',
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function runTool(action: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await action();
  } catch (error) {
    return createToolErrorResult(error);
  }
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

export interface RegisterTaskToolsDeps {
  principal: McpPrincipal;
  service: McpToolService;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTaskTools(
  server: McpServer,
  { principal, service }: RegisterTaskToolsDeps,
): void {
  const requireRead = (): void => {
    assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
  };
  const requireWrite = (): void => {
    assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
  };

  // -------------------------------------------------------------------
  // READ TOOLS
  // -------------------------------------------------------------------

  server.registerTool(
    'search_tasks',
    {
      description:
        "Search the current user's tasks. Supports: query/q (text search on title/description), tags (array of tag ID strings — use list_tags to find IDs), priority (low/medium/high), status (active/completed), startDate/endDate (YYYY-MM-DD date range), flagged, minDuration/maxDuration, sortBy (priority/duration/name/date_desc), page, limit (max 100), taskNumber (direct lookup). Returns compact previews — use get_task for full detail.",
      inputSchema: searchSchema,
      annotations: READ_ONLY,
    },
    async (input) =>
      runTool(async () => {
        requireRead();
        const result = await service.searchTasks(input);
        const preview = formatTaskListPreview(result.tasks, {
          total: result.total,
          label: 'Search results',
        });
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
      annotations: READ_ONLY,
    },
    async ({ taskNumber }) =>
      runTool(async () => {
        requireRead();
        const result = await service.getTaskByNumber(taskNumber);
        return createToolSuccessResult(result, formatSingleTaskPreview(result.task));
      }),
  );

  server.registerTool(
    'list_today',
    {
      description:
        "List the current user's tasks that occur today (based on due date range inclusion). Returns compact previews — use get_task with taskNumber for full detail on any specific task.",
      annotations: READ_ONLY,
    },
    async () =>
      runTool(async () => {
        requireRead();
        const result = await service.listToday();
        const preview = formatTaskListPreview(result.tasks, { label: "Today's tasks" });
        return createToolSuccessResult(result, preview);
      }),
  );

  server.registerTool(
    'list_upcoming',
    {
      description:
        "List the current user's upcoming tasks ordered by effective date. Optional: fromDate (YYYY-MM-DD, defaults to today), limit (max 100). Returns compact previews — use get_task with taskNumber for full detail on any specific task.",
      inputSchema: z.object({
        fromDate: z.string().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }),
      annotations: READ_ONLY,
    },
    async (input) =>
      runTool(async () => {
        requireRead();
        const result = await service.listUpcoming(input);
        const preview = formatTaskListPreview(result.tasks, {
          total: result.count,
          label: 'Upcoming tasks',
        });
        return createToolSuccessResult(result, preview);
      }),
  );

  server.registerTool(
    'get_statistics',
    {
      description:
        "Get task statistics for the current user, including counts of active, completed, overdue, and flagged tasks. Useful for getting a quick overview of the user's task state.",
      annotations: READ_ONLY,
    },
    async () =>
      runTool(async () => {
        requireRead();
        const result = await service.getStatistics();
        const lines = ['Task statistics:'];
        for (const [key, value] of Object.entries(result)) {
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
      annotations: READ_ONLY,
    },
    async () =>
      runTool(async () => {
        requireRead();
        const result = await service.listTags();
        const tagList = result.tags;
        if (tagList.length === 0) return createToolSuccessResult(result, 'No tags found.');
        const lines = [`${tagList.length} tag(s):`];
        for (const tag of tagList) {
          lines.push(
            `  ${tag.name} [id: ${tag.id}] (${tag.color})${tag.isDefault ? ' [default]' : ''}`,
          );
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
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.createTag(input);
        return createToolSuccessResult(
          result,
          `Created tag "${result.tag.name}" (${result.tag.color}).`,
        );
      }),
  );

  server.registerTool(
    'update_tag',
    {
      description:
        "Update an existing tag's name and color. Provide the tag id, new name, and new color. Cannot update default tags.",
      inputSchema: tagUpdateSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.updateTag(input);
        return createToolSuccessResult(
          result,
          `Updated tag "${result.tag.name}" (${result.tag.color}).`,
        );
      }),
  );

  server.registerTool(
    'delete_tag',
    {
      description:
        "Delete a tag by id. This removes the tag from the user's tag list. Cannot delete default tags. Tasks that had this tag will lose it.",
      inputSchema: tagDeleteSchema,
      annotations: DESTRUCTIVE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.deleteTag(input);
        return createToolSuccessResult(result, `Deleted tag ${input.id}.`);
      }),
  );

  // -------------------------------------------------------------------
  // WRITE TOOLS
  // -------------------------------------------------------------------

  server.registerTool(
    'create_task',
    {
      description:
        'Create a new Lifeline task. Required: title. Optional: description, dueDate (YYYY-MM-DD), dueTime, tags (tag names like ["Personal"] or tag objects with id/name/color from list_tags), isFlagged, duration (minutes 0-1440), priority (high/medium/low), subtasks [{title}] (subtaskId and position are auto-assigned), recurrence. Recurrence shapes: { mode: "daily", startDate, endDate } for daily instances; { mode: "dateRange", startDate, endDate } for a spanning task; { mode: "specificDays", days: ["monday","wednesday"], startDate, endDate } for selected days. Recurrence cannot be changed after creation.',
      inputSchema: createTaskSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.createTask(input);
        return createToolSuccessResult(
          result,
          `Created task #${result.task.taskNumber ?? 'new'}: ${result.task.title || input.title}`,
        );
      }),
  );

  server.registerTool(
    'update_task',
    {
      description:
        'Update a Lifeline task. Identify by taskNumber (preferred) or id. Mutable fields: title, description, dueDate, dueTime, tags, isFlagged, duration, priority, subtasks (whole-array replacement). Tags may be passed as names or as tag objects from list_tags. Recurrence cannot be changed after creation. Archived tasks must be restored first.',
      inputSchema: updateTaskSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const { taskNumber, id, ...updates } = input;
        const result = await service.updateTask({ taskNumber, id }, updates);
        const label = taskNumber ? `#${taskNumber}` : (id ?? result.task.id);
        return createToolSuccessResult(result, `Updated task ${label}: ${result.task.title || ''}`);
      }),
  );

  const runCompletionTool = (
    input: { taskNumber?: number | undefined; id?: string | undefined },
    completed: boolean,
  ): Promise<ToolResult> =>
    runTool(async () => {
      requireWrite();
      const result = await service.setTaskCompletion(input, completed);
      const label = describeSelector(input, result.task.id);
      return createToolSuccessResult(
        result,
        `${completed ? 'Completed' : 'Uncompleted'} task ${label}: ${result.task.title || ''}`,
      );
    });

  server.registerTool(
    'complete_task',
    {
      description:
        'Mark a Lifeline task as completed. Identify by taskNumber (preferred) or id. Returns the updated task.',
      inputSchema: selectorSchema,
      annotations: WRITE,
    },
    async (input) => runCompletionTool(input, true),
  );

  server.registerTool(
    'uncomplete_task',
    {
      description:
        'Mark a Lifeline task as not completed (reopen). Identify by taskNumber (preferred) or id. Returns the updated task.',
      inputSchema: selectorSchema,
      annotations: WRITE,
    },
    async (input) => runCompletionTool(input, false),
  );

  server.registerTool(
    'delete_task',
    {
      description:
        'Deprecated — use archive_task instead. Archives a Lifeline task (soft-delete, not permanent). Identify by taskNumber (preferred) or id. Use restore_task to undo.',
      inputSchema: selectorSchema,
      annotations: DESTRUCTIVE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.deleteTask(input);
        const label = describeSelector(input, result.id);
        return createToolSuccessResult(
          result,
          `Archived task ${label}. The task has been removed from the active set (archived, not permanently deleted).`,
        );
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
      annotations: READ_ONLY,
    },
    async () =>
      runTool(async () => {
        requireRead();
        const result = await service.exportTasks();
        return createToolSuccessResult(
          result,
          `Exported ${result.todos.length} task(s) at ${result.exported_at || 'now'}.`,
        );
      }),
  );

  // -------------------------------------------------------------------
  // BATCH TOOLS
  // -------------------------------------------------------------------

  const runBatchTool = (
    action: 'complete' | 'uncomplete' | 'delete' | 'restore',
    label: string,
    taskNumbers: number[],
  ): Promise<ToolResult> =>
    runTool(async () => {
      requireWrite();
      const result = await service.batchAction(action, taskNumbers);
      const summary = result.results.map((r) => `#${r.taskNumber}: ${r.status}`).join(', ');
      return createToolSuccessResult(result, `${label}: ${summary}`);
    });

  server.registerTool(
    'batch_complete',
    {
      description:
        'Mark multiple tasks as completed in one call. Provide an array of task numbers. Returns per-task results. Use this when the user says they finished several tasks at once.',
      inputSchema: batchTaskNumbersSchema,
      annotations: WRITE,
    },
    async (input) => runBatchTool('complete', 'Batch complete', input.taskNumbers),
  );

  server.registerTool(
    'batch_uncomplete',
    {
      description:
        'Mark multiple tasks as not completed in one call. Provide an array of task numbers. Returns per-task results.',
      inputSchema: batchTaskNumbersSchema,
      annotations: WRITE,
    },
    async (input) => runBatchTool('uncomplete', 'Batch uncomplete', input.taskNumbers),
  );

  server.registerTool(
    'batch_archive',
    {
      description:
        'Archive-remove multiple tasks in one call. Provide an array of task numbers. Each task is archived (not permanently deleted). This is destructive and cannot be easily undone from MCP.',
      inputSchema: batchTaskNumbersSchema,
      annotations: DESTRUCTIVE,
    },
    async (input) => runBatchTool('delete', 'Batch archive', input.taskNumbers),
  );

  // -------------------------------------------------------------------
  // ARCHIVE/RESTORE TOOLS (Phase 2 — archive-first lifecycle)
  // -------------------------------------------------------------------

  server.registerTool(
    'archive_task',
    {
      description:
        'Archive a Lifeline task, removing it from the active set. This is the recommended way to remove tasks. The task can be restored later with restore_task. Identify by taskNumber (preferred) or id.',
      inputSchema: selectorSchema,
      annotations: DESTRUCTIVE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.deleteTask(input);
        const label = describeSelector(input, result.id);
        return createToolSuccessResult(result, `Archived task ${label}.`);
      }),
  );

  server.registerTool(
    'restore_task',
    {
      description:
        'Restore an archived Lifeline task back to the active set. Identify by taskNumber (preferred) or id. Use this to undo an archive_task or delete_task operation.',
      inputSchema: selectorSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.restoreTask(input);
        const label = describeSelector(input, result.task.id);
        return createToolSuccessResult(
          result,
          `Restored task ${label}: ${result.task.title || ''}`,
        );
      }),
  );

  server.registerTool(
    'batch_restore',
    {
      description:
        'Restore multiple archived tasks back to the active set in one call. Provide an array of task numbers.',
      inputSchema: batchTaskNumbersSchema,
      annotations: WRITE,
    },
    async (input) => runBatchTool('restore', 'Batch restore', input.taskNumbers),
  );

  // -------------------------------------------------------------------
  // WINDOW QUERY TOOL (Phase 2 — date-window queries)
  // -------------------------------------------------------------------

  server.registerTool(
    'list_tasks',
    {
      description:
        'List tasks in a date window. Supported windows: this_week, next_week, this_month, next_month, overdue, or YYYY-MM (specific month). Optional: includeCompleted (boolean). Returns compact previews — use get_task for full detail.',
      inputSchema: z.object({
        window: z
          .string()
          .min(1)
          .describe(
            'Window token: this_week, next_week, this_month, next_month, overdue, or YYYY-MM',
          ),
        includeCompleted: z.boolean().optional(),
      }),
      annotations: READ_ONLY,
    },
    async (input) =>
      runTool(async () => {
        requireRead();
        const result = await service.listTasksByWindow(
          input.window,
          input.includeCompleted === true,
        );
        const preview = formatTaskListPreview(result.tasks, {
          total: result.count,
          label: `${input.window} tasks`,
        });
        return createToolSuccessResult(result, preview);
      }),
  );

  // -------------------------------------------------------------------
  // SIMILARITY TOOL (Phase 2 — history-aware retrieval)
  // -------------------------------------------------------------------

  server.registerTool(
    'find_similar_tasks',
    {
      description:
        'Find tasks with titles similar to the given text using fuzzy matching. Useful for detecting duplicates before creating a new task, or finding related past tasks. Returns tasks ranked by similarity.',
      inputSchema: z.object({
        title: z.string().min(1).max(200).describe('Text to find similar tasks for'),
        limit: z.coerce.number().int().positive().max(20).optional(),
        threshold: z.coerce.number().min(0.1).max(1.0).optional(),
      }),
      annotations: READ_ONLY,
    },
    async (input) =>
      runTool(async () => {
        requireRead();
        const result = await service.findSimilarTasks(input);
        const preview = formatTaskListPreview(result.tasks, {
          total: result.count,
          label: 'Similar tasks',
        });
        return createToolSuccessResult(result, preview);
      }),
  );

  // -------------------------------------------------------------------
  // SUBTASK TOOLS (Phase 2 — subtask operations)
  // -------------------------------------------------------------------

  server.registerTool(
    'add_subtask',
    {
      description:
        'Add a new subtask to a Lifeline task. Identify the parent task by taskNumber (preferred) or id. Provide a title for the new subtask. Returns the updated parent task with all subtasks.',
      inputSchema: addSubtaskSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.addSubtask(input, input.title);
        const label = describeSelector(input, result.task.id);
        return createToolSuccessResult(result, `Added subtask "${input.title}" to task ${label}`);
      }),
  );

  server.registerTool(
    'complete_subtask',
    {
      description:
        'Mark a specific subtask as completed. Identify the parent task by taskNumber or id, and the subtask by its subtaskId (UUID). Returns the updated parent task.',
      inputSchema: subtaskSelectorSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.setSubtaskCompletion(input, input.subtaskId, true);
        const label = describeSelector(input, result.task.id);
        return createToolSuccessResult(
          result,
          `Completed subtask ${input.subtaskId} on task ${label}`,
        );
      }),
  );

  server.registerTool(
    'uncomplete_subtask',
    {
      description:
        'Mark a specific subtask as not completed. Identify the parent task by taskNumber or id, and the subtask by its subtaskId (UUID). Returns the updated parent task.',
      inputSchema: subtaskSelectorSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.setSubtaskCompletion(input, input.subtaskId, false);
        const label = describeSelector(input, result.task.id);
        return createToolSuccessResult(
          result,
          `Uncompleted subtask ${input.subtaskId} on task ${label}`,
        );
      }),
  );

  server.registerTool(
    'update_subtask',
    {
      description:
        "Update a specific subtask's title or completion state. Identify the parent task by taskNumber or id, and the subtask by its subtaskId (UUID). Returns the updated parent task.",
      inputSchema: updateSubtaskSchema,
      annotations: WRITE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.updateSubtask(input, input.subtaskId, {
          title: input.title,
          isCompleted: input.isCompleted,
        });
        const label = describeSelector(input, result.task.id);
        return createToolSuccessResult(
          result,
          `Updated subtask ${input.subtaskId} on task ${label}`,
        );
      }),
  );

  server.registerTool(
    'remove_subtask',
    {
      description:
        'Remove a subtask from a Lifeline task. Identify the parent task by taskNumber or id, and the subtask by its subtaskId (UUID). This permanently removes the subtask. Returns the updated parent task.',
      inputSchema: subtaskSelectorSchema,
      annotations: DESTRUCTIVE,
    },
    async (input) =>
      runTool(async () => {
        requireWrite();
        const result = await service.removeSubtask(input, input.subtaskId);
        const label = describeSelector(input, result.task.id);
        return createToolSuccessResult(
          result,
          `Removed subtask ${input.subtaskId} from task ${label}`,
        );
      }),
  );
}
