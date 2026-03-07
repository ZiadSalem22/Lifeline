import { z } from 'zod';
import { LIFELINE_MCP_SCOPES } from '../constants.js';
import { assertPrincipalScopes } from '../auth/principal.js';
import { ToolInputError } from '../errors.js';
import { createToolErrorResult, createToolSuccessResult } from './toolResults.js';
import { resolveTaskIdForMutation } from './taskSelectors.js';

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

function summarizeTasks(tasks = []) {
  return `${tasks.length} task(s) returned.`;
}

async function runTool(action) {
  try {
    return await action();
  } catch (error) {
    return createToolErrorResult(error);
  }
}

export function registerTaskTools(server, { principal, backendClient }) {
  server.registerTool(
    'search_tasks',
    {
      description: 'Search the current user\'s Lifeline tasks using the backend adapter search semantics.',
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
      return createToolSuccessResult(result, `Found ${result.total || 0} matching task(s).`);
    }),
  );

  server.registerTool(
    'get_task',
    {
      description: 'Get a single Lifeline task by taskNumber.',
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
      return createToolSuccessResult(result, `Fetched task #${taskNumber}.`);
    }),
  );

  server.registerTool(
    'list_today',
    {
      description: 'List the current user\'s tasks that occur today using backend date-range inclusion rules.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_READ]);
      const result = await backendClient.listToday(principal);
      return createToolSuccessResult(result, summarizeTasks(result.tasks));
    }),
  );

  server.registerTool(
    'list_upcoming',
    {
      description: 'List the current user\'s upcoming tasks using backend ordering and inclusion semantics.',
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
      return createToolSuccessResult(result, summarizeTasks(result.tasks));
    }),
  );

  server.registerTool(
    'create_task',
    {
      description: 'Create a new Lifeline task for the current user.',
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
      return createToolSuccessResult(result, `Created task #${result.task?.taskNumber ?? 'new'}.`);
    }),
  );

  server.registerTool(
    'update_task',
    {
      description: 'Update a Lifeline task by preferred taskNumber handle or exact id.',
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
      return createToolSuccessResult(result, `Updated task ${taskNumber ? `#${taskNumber}` : resolvedId}.`);
    }),
  );

  async function runCompletionTool(input, completed) {
    return runTool(async () => {
      assertPrincipalScopes(principal, [LIFELINE_MCP_SCOPES.TASKS_WRITE]);
      const resolvedId = await resolveTaskIdForMutation({ backendClient, principal, taskNumber: input.taskNumber, id: input.id });
      const result = completed
        ? await backendClient.completeTask(principal, resolvedId)
        : await backendClient.uncompleteTask(principal, resolvedId);
      return createToolSuccessResult(result, `${completed ? 'Completed' : 'Uncompleted'} task ${input.taskNumber ? `#${input.taskNumber}` : resolvedId}.`);
    });
  }

  server.registerTool(
    'complete_task',
    {
      description: 'Mark a Lifeline task as completed using taskNumber or exact id.',
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
      description: 'Mark a Lifeline task as not completed using taskNumber or exact id.',
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
      description: 'Archive-remove a Lifeline task from the active set using taskNumber or exact id.',
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
      return createToolSuccessResult(result, `Deleted task ${input.taskNumber ? `#${input.taskNumber}` : resolvedId}.`);
    }),
  );
}
