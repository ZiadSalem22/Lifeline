import type { CreateTodoInput, Priority, Todo, UpdateTodoInput } from '@lifeline/shared';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import type {
  ProfileRepository,
  SettingsRepository,
  TodoRepository,
  UserRepository,
} from '../application/ports.js';
import type { CreateTodo } from '../application/todos/create-todo.js';
import type { ListTodos } from '../application/todos/list-todos.js';
import type { GetTodo } from '../application/todos/get-todo.js';
import type { UpdateTodo, UpdateTodoRequest } from '../application/todos/update-todo.js';
import type { SetTodoCompletion } from '../application/todos/set-todo-completion.js';
import type { ArchiveTodo } from '../application/todos/archive-todo.js';
import type { FindSimilarTodos } from '../application/todos/find-similar-todos.js';
import type { SubtaskOps } from '../application/todos/subtask-ops.js';
import type { ListTags } from '../application/tags/list-tags.js';
import type { CreateTag } from '../application/tags/create-tag.js';
import type { UpdateTag } from '../application/tags/update-tag.js';
import type { DeleteTag } from '../application/tags/delete-tag.js';
import { McpToolInputError } from './errors.js';
import { resolveCreateDueDate, resolveUpdateDueDate } from './due-date.js';
import {
  normalizeTag,
  normalizeTask,
  normalizeTaskList,
  type McpTagPayload,
  type McpTaskPayload,
} from './payloads.js';
import { resolveMcpTaskTags, type McpTagReference } from './tag-refs.js';
import { resolveTaskForMutation, type TaskSelector } from './selectors.js';
import {
  DEFAULT_WEEK_STARTS_ON,
  ISO_DATE_TOKEN_PATTERN,
  compareTasksForUpcoming,
  dayNameToWeekStart,
  doesTaskOccurInRange,
  doesTaskOccurOnDate,
  isTaskEligibleForUpcoming,
  resolveDateToken,
  resolveWindowToken,
  weekStartIndexFrom,
} from './windows.js';

/**
 * In-process replacement for the old MCP service's `internalBackendClient` +
 * the backend `internal/mcp/*` handlers: every method returns the EXACT wire
 * payload the old backend produced (audit-mcp.md §5), but calls the rebuilt
 * use-cases directly — no HTTP hop, no shared secret, no principal headers.
 */

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export interface McpServiceDeps {
  useCases: {
    createTodo: CreateTodo;
    listTodos: ListTodos;
    getTodo: GetTodo;
    updateTodo: UpdateTodo;
    setTodoCompletion: SetTodoCompletion;
    archiveTodo: ArchiveTodo;
    findSimilarTodos: FindSimilarTodos;
    subtaskOps: SubtaskOps;
    listTags: ListTags;
    createTag: CreateTag;
    updateTag: UpdateTag;
    deleteTag: DeleteTag;
  };
  repos: {
    users: Pick<UserRepository, 'findById'>;
    profiles: Pick<ProfileRepository, 'get'>;
    settings: Pick<SettingsRepository, 'get'>;
    todos: Pick<TodoRepository, 'listAll'>;
  };
  now?: (() => Date) | undefined;
}

export interface SearchTasksInput {
  query?: string | undefined;
  q?: string | undefined;
  tags?: string[] | undefined;
  priority?: Priority | undefined;
  status?: 'active' | 'completed' | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  flagged?: boolean | undefined;
  minDuration?: number | undefined;
  maxDuration?: number | undefined;
  sortBy?: 'priority' | 'duration' | 'name' | 'date_desc' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  taskNumber?: number | undefined;
}

export interface McpCreateTaskInput {
  title: string;
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  dueTime?: string | null | undefined;
  tags?: McpTagReference[] | undefined;
  isFlagged?: boolean | undefined;
  duration?: number | undefined;
  priority?: Priority | undefined;
  subtasks?: Record<string, unknown>[] | undefined;
  recurrence?: unknown;
}

export interface McpUpdateTaskInput {
  title?: string | undefined;
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  dueTime?: string | null | undefined;
  tags?: McpTagReference[] | undefined;
  isFlagged?: boolean | undefined;
  duration?: number | undefined;
  priority?: Priority | undefined;
  subtasks?: Record<string, unknown>[] | undefined;
  recurrence?: unknown;
}

export type BatchWireAction = 'complete' | 'uncomplete' | 'delete' | 'restore';

export interface BatchItemResult {
  taskNumber: number;
  status:
    | 'completed'
    | 'uncompleted'
    | 'archived'
    | 'restored'
    | 'already_active'
    | 'not_found'
    | 'error';
  reason?: string;
}

export class McpToolService {
  private readonly now: () => Date;

  constructor(
    private readonly deps: McpServiceDeps,
    private readonly userId: string,
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  // -------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------

  async searchTasks(input: SearchTasksInput): Promise<{
    tasks: McpTaskPayload[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (input.startDate !== undefined && !ISO_DATE_TOKEN_PATTERN.test(input.startDate)) {
      throw new McpToolInputError('Invalid startDate. Use YYYY-MM-DD format.');
    }
    if (input.endDate !== undefined && !ISO_DATE_TOKEN_PATTERN.test(input.endDate)) {
      throw new McpToolInputError('Invalid endDate. Use YYYY-MM-DD format.');
    }
    if (
      input.minDuration !== undefined &&
      input.maxDuration !== undefined &&
      input.minDuration > input.maxDuration
    ) {
      throw new McpToolInputError('minDuration cannot be greater than maxDuration.');
    }

    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const q = (input.query ?? input.q ?? '').trim();
    const tagsCsv = (input.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag !== '');

    const result = await this.deps.useCases.listTodos.execute(this.userId, {
      page,
      pageSize: limit,
      ...(q !== '' ? { q } : {}),
      ...(tagsCsv.length > 0 ? { tags: tagsCsv.join(',') } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.flagged !== undefined ? { flagged: input.flagged } : {}),
      ...(input.minDuration !== undefined ? { minDuration: input.minDuration } : {}),
      ...(input.maxDuration !== undefined ? { maxDuration: input.maxDuration } : {}),
      ...(input.sortBy !== undefined ? { sortBy: input.sortBy } : {}),
      ...(input.taskNumber !== undefined ? { taskNumber: input.taskNumber } : {}),
    });

    return {
      tasks: normalizeTaskList(result.items),
      total: result.totalItems,
      page,
      limit,
    };
  }

  /** Resolves archived tasks too (old parity — deep read never 404s on archive). */
  async getTaskByNumber(taskNumber: number): Promise<{ task: McpTaskPayload }> {
    const task = await this.deps.useCases.getTodo.byTaskNumber(this.userId, taskNumber);
    return { task: normalizeTask(task) };
  }

  async listToday(): Promise<{
    dateToken: 'today';
    resolvedDate: string;
    tasks: McpTaskPayload[];
  }> {
    const resolvedDate = resolveDateToken('today', this.now());
    const todos = await this.listActive();
    const matching = todos.filter((todo) => doesTaskOccurOnDate(todo, resolvedDate));
    return { dateToken: 'today', resolvedDate, tasks: normalizeTaskList(matching) };
  }

  async listUpcoming(input: {
    fromDate?: string | undefined;
    limit?: number | undefined;
  }): Promise<{
    fromDate: string;
    includesUnscheduled: false;
    ordering: string;
    tasks: McpTaskPayload[];
    count: number;
  }> {
    let fromDate: string;
    if (input.fromDate !== undefined && input.fromDate.trim() !== '') {
      const value = input.fromDate.trim();
      if (!ISO_DATE_TOKEN_PATTERN.test(value)) {
        throw new McpToolInputError('Invalid fromDate. Use YYYY-MM-DD.');
      }
      fromDate = value;
    } else {
      fromDate = resolveDateToken('today', this.now());
    }

    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const todos = await this.listActive();
    const upcoming = todos
      .filter((todo) => isTaskEligibleForUpcoming(todo, fromDate))
      .sort((left, right) => compareTasksForUpcoming(left, right, fromDate))
      .slice(0, limit);

    return {
      fromDate,
      includesUnscheduled: false,
      ordering: 'effectiveDateAsc,orderAsc,taskNumberAsc',
      tasks: normalizeTaskList(upcoming),
      count: upcoming.length,
    };
  }

  async getStatistics(): Promise<{
    total: number;
    active: number;
    completed: number;
    flagged: number;
    overdue: number;
    totalActiveMinutes: number;
  }> {
    const tasks = await this.listActive();
    const todayStr = this.now().toISOString().slice(0, 10);

    const total = tasks.length;
    const completed = tasks.filter((t) => t.isCompleted).length;
    const active = total - completed;
    const flagged = tasks.filter((t) => t.isFlagged && !t.isCompleted).length;
    const overdue = tasks.filter((t) => {
      if (t.isCompleted || t.dueDate === null) return false;
      return t.dueDate.slice(0, 10) < todayStr;
    }).length;
    const totalActiveMinutes = tasks
      .filter((t) => !t.isCompleted && t.duration > 0)
      .reduce((sum, t) => sum + t.duration, 0);

    return { total, active, completed, flagged, overdue, totalActiveMinutes };
  }

  async listTasksByWindow(
    windowToken: string,
    includeCompleted: boolean,
  ): Promise<{
    windowToken: string;
    resolvedStart: string;
    resolvedEnd: string;
    tasks: McpTaskPayload[];
    count: number;
  }> {
    const weekStartsOn = await this.resolveWeekStart();
    const window = resolveWindowToken(windowToken, this.now(), { weekStartsOn });
    const todos = await this.listActive();
    let matched = todos.filter((todo) => doesTaskOccurInRange(todo, window.start, window.end));

    if (!includeCompleted) {
      matched = matched.filter((task) => !task.isCompleted);
    }
    // Overdue window is always incomplete-only (old parity).
    if (windowToken === 'overdue') {
      matched = matched.filter((task) => !task.isCompleted);
    }

    return {
      windowToken,
      resolvedStart: window.start,
      resolvedEnd: window.end,
      tasks: normalizeTaskList(matched),
      count: matched.length,
    };
  }

  async findSimilarTasks(input: {
    title: string;
    limit?: number | undefined;
    threshold?: number | undefined;
  }): Promise<{ query: string; tasks: McpTaskPayload[]; count: number }> {
    const title = input.title.trim();
    const result = await this.deps.useCases.findSimilarTodos.execute(this.userId, {
      title,
      limit: input.limit ?? 5,
      threshold: input.threshold ?? 0.3,
    });
    return {
      query: title,
      tasks: normalizeTaskList(result.items),
      count: result.items.length,
    };
  }

  async exportTasks(): Promise<{
    exported_at: string;
    todos: McpTaskPayload[];
    stats: { totalTodos: number; completedCount: number; completionRate: number };
  }> {
    const tasks = await this.listActive();
    const total = tasks.length;
    const completedCount = tasks.filter((t) => t.isCompleted).length;
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      exported_at: this.now().toISOString(),
      todos: normalizeTaskList(tasks),
      stats: { totalTodos: total, completedCount, completionRate },
    };
  }

  async listTags(): Promise<{ tags: McpTagPayload[] }> {
    const tags = await this.deps.useCases.listTags.execute(this.userId);
    return { tags: tags.map(normalizeTag) };
  }

  // -------------------------------------------------------------------
  // Write operations
  // -------------------------------------------------------------------

  async createTask(input: McpCreateTaskInput): Promise<{ task: McpTaskPayload }> {
    const role = await this.resolveRole();
    const now = this.now();
    const tags = await resolveMcpTaskTags(input.tags, {
      userId: this.userId,
      listTags: this.deps.useCases.listTags,
    });

    const createInput: CreateTodoInput = {
      title: input.title,
      description: input.description ?? null,
      dueDate: resolveCreateDueDate(input.dueDate, now),
      dueTime: input.dueTime ?? null,
      ...(tags !== undefined ? { tags } : {}),
      ...(input.isFlagged !== undefined ? { isFlagged: input.isFlagged } : {}),
      ...(input.duration !== undefined ? { duration: input.duration } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.subtasks !== undefined
        ? { subtasks: input.subtasks as CreateTodoInput['subtasks'] }
        : {}),
      recurrence: (input.recurrence ?? null) as CreateTodoInput['recurrence'],
    };

    const { todo } = await this.deps.useCases.createTodo.execute(this.userId, role, createInput);
    return { task: normalizeTask(todo) };
  }

  async updateTask(
    selector: TaskSelector,
    updates: McpUpdateTaskInput,
  ): Promise<{ task: McpTaskPayload }> {
    const existing = await this.resolveSelector(selector);
    if (existing.archived) {
      throw new ConflictError('Cannot update an archived task. Restore it first.');
    }
    if ('recurrence' in updates) {
      throw new McpToolInputError('Unsupported update fields: recurrence.');
    }

    const tags = await resolveMcpTaskTags(updates.tags, {
      userId: this.userId,
      listTags: this.deps.useCases.listTags,
    });

    const patch: UpdateTodoRequest = {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...('description' in updates ? { description: updates.description ?? null } : {}),
      // Patch semantics (fix 9633bd3e): absent dueDate is untouched, '' clears.
      ...('dueDate' in updates
        ? { dueDate: resolveUpdateDueDate(updates.dueDate, this.now()) }
        : {}),
      ...('dueTime' in updates ? { dueTime: updates.dueTime ?? null } : {}),
      ...(tags !== undefined ? { tags } : {}),
      ...(updates.isFlagged !== undefined ? { isFlagged: updates.isFlagged } : {}),
      ...(updates.duration !== undefined ? { duration: updates.duration } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
      ...(updates.subtasks !== undefined
        ? { subtasks: updates.subtasks as UpdateTodoInput['subtasks'] }
        : {}),
    };

    const todo = await this.deps.useCases.updateTodo.execute(this.userId, existing.id, patch);
    return { task: normalizeTask(todo) };
  }

  async setTaskCompletion(
    selector: TaskSelector,
    completed: boolean,
  ): Promise<{ task: McpTaskPayload; completed: boolean }> {
    const existing = await this.resolveSelector(selector);
    if (existing.archived) {
      throw new ConflictError(
        `Cannot ${completed ? 'complete' : 'uncomplete'} an archived task. Restore it first.`,
      );
    }
    const todo = await this.deps.useCases.setTodoCompletion.execute(
      this.userId,
      existing.id,
      completed,
    );
    return { task: normalizeTask(todo), completed };
  }

  /** DELETE = archive (archive-first lifecycle; tags always preserved). */
  async deleteTask(selector: TaskSelector): Promise<{
    id: string;
    taskNumber: number | null;
    deleted: true;
    deleteMode: 'archived';
  }> {
    const existing = await this.resolveSelector(selector);
    await this.deps.useCases.archiveTodo.archive(this.userId, existing.id);
    return {
      id: existing.id,
      taskNumber: existing.taskNumber ?? null,
      deleted: true,
      deleteMode: 'archived',
    };
  }

  async restoreTask(selector: TaskSelector): Promise<{
    task: McpTaskPayload;
    restored: true;
    note?: string;
  }> {
    const existing = await this.resolveSelector(selector);
    const result = await this.deps.useCases.archiveTodo.restore(this.userId, existing.id);
    return {
      task: normalizeTask(result.todo),
      restored: true,
      ...(result.note !== undefined ? { note: result.note } : {}),
    };
  }

  async batchAction(
    action: BatchWireAction,
    taskNumbers: readonly number[],
  ): Promise<{ action: BatchWireAction; results: BatchItemResult[] }> {
    const results: BatchItemResult[] = [];
    for (const taskNumber of taskNumbers) {
      results.push(await this.batchOne(action, taskNumber));
    }
    return { action, results };
  }

  private async batchOne(action: BatchWireAction, taskNumber: number): Promise<BatchItemResult> {
    try {
      let task: Todo;
      try {
        task = await this.deps.useCases.getTodo.byTaskNumber(this.userId, taskNumber);
      } catch (error) {
        if (error instanceof NotFoundError) return { taskNumber, status: 'not_found' };
        throw error;
      }

      if (action === 'complete' || action === 'uncomplete') {
        if (task.archived) {
          return {
            taskNumber,
            status: 'error',
            reason: `Cannot ${action} an archived task.`,
          };
        }
        await this.deps.useCases.setTodoCompletion.execute(
          this.userId,
          task.id,
          action === 'complete',
        );
        return { taskNumber, status: action === 'complete' ? 'completed' : 'uncompleted' };
      }

      if (action === 'delete') {
        await this.deps.useCases.archiveTodo.archive(this.userId, task.id);
        return { taskNumber, status: 'archived' };
      }

      // restore
      if (!task.archived) return { taskNumber, status: 'already_active' };
      await this.deps.useCases.archiveTodo.restore(this.userId, task.id);
      return { taskNumber, status: 'restored' };
    } catch (error) {
      return {
        taskNumber,
        status: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createTag(input: { name: string; color: string }): Promise<{ tag: McpTagPayload }> {
    const role = await this.resolveRole();
    const tag = await this.deps.useCases.createTag.execute(this.userId, role, {
      name: input.name,
      color: input.color,
    });
    return { tag: normalizeTag(tag) };
  }

  async updateTag(input: {
    id: string | number;
    name: string;
    color: string;
  }): Promise<{ tag: McpTagPayload }> {
    const tag = await this.deps.useCases.updateTag.execute(this.userId, String(input.id), {
      name: input.name,
      color: input.color,
    });
    return { tag: normalizeTag(tag) };
  }

  async deleteTag(input: { id: string | number }): Promise<{ deleted: true; id: string }> {
    const id = String(input.id);
    await this.deps.useCases.deleteTag.execute(this.userId, id);
    return { deleted: true, id };
  }

  // -------------------------------------------------------------------
  // Subtask operations (all return the updated parent task)
  // -------------------------------------------------------------------

  async addSubtask(selector: TaskSelector, title: string): Promise<{ task: McpTaskPayload }> {
    const existing = await this.resolveSelector(selector);
    const todo = await this.deps.useCases.subtaskOps.add(this.userId, existing.id, title);
    return { task: normalizeTask(todo) };
  }

  async setSubtaskCompletion(
    selector: TaskSelector,
    subtaskId: string,
    isCompleted: boolean,
  ): Promise<{ task: McpTaskPayload }> {
    const existing = await this.resolveSelector(selector);
    const todo = await this.deps.useCases.subtaskOps.setCompletion(
      this.userId,
      existing.id,
      subtaskId,
      isCompleted,
    );
    return { task: normalizeTask(todo) };
  }

  async updateSubtask(
    selector: TaskSelector,
    subtaskId: string,
    patch: { title?: string | undefined; isCompleted?: boolean | undefined },
  ): Promise<{ task: McpTaskPayload }> {
    const existing = await this.resolveSelector(selector);
    const todo = await this.deps.useCases.subtaskOps.update(this.userId, existing.id, subtaskId, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.isCompleted !== undefined ? { isCompleted: patch.isCompleted } : {}),
    });
    return { task: normalizeTask(todo) };
  }

  async removeSubtask(
    selector: TaskSelector,
    subtaskId: string,
  ): Promise<{ task: McpTaskPayload; removed: true }> {
    const existing = await this.resolveSelector(selector);
    const todo = await this.deps.useCases.subtaskOps.remove(this.userId, existing.id, subtaskId);
    return { task: normalizeTask(todo), removed: true };
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private resolveSelector(selector: TaskSelector): Promise<Todo> {
    return resolveTaskForMutation(this.deps.useCases.getTodo, this.userId, selector);
  }

  /** All of the user's non-archived todos (old `listTodos.execute` parity). */
  private listActive(): Promise<Todo[]> {
    return this.deps.repos.todos.listAll(this.userId, { includeArchived: false });
  }

  private async resolveRole(): Promise<'free' | 'paid' | 'admin'> {
    const user = await this.deps.repos.users.findById(this.userId);
    return user?.role ?? 'free';
  }

  /**
   * Week-start preference: profile `startDayOfWeek`, falling back to
   * `settings.layout.weekStart`, falling back to Monday (fixes the old
   * hardcoded-Sunday bug, audit-mcp.md §8.2).
   */
  private async resolveWeekStart(): Promise<number> {
    const profile = await this.deps.repos.profiles.get(this.userId);
    const fromProfile = profile !== null ? dayNameToWeekStart(profile.startDayOfWeek) : null;
    if (fromProfile !== null) return fromProfile;

    const settings = await this.deps.repos.settings.get(this.userId);
    const fromSettings = weekStartIndexFrom(settings?.layout['weekStart']);
    if (fromSettings !== null) return fromSettings;

    return DEFAULT_WEEK_STARTS_ON;
  }
}
