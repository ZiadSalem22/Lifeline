import type { ExportPayload, Todo } from '@lifeline/shared';
import type { CurrentUser, DailyPlanRepository, TagRepository, TodoRepository } from '../ports.js';
import { toProfileDto, toSettingsDto } from '../identity/mappers.js';
import { buildPeriodTotals, buildTopTags, type TagCount } from '../stats/get-stats.js';

/**
 * GET /api/v1/export — ported from the old `/api/export` (audit-domain-logic
 * §10): NON-ARCHIVED todos only, camelCase v1 user block, `exportedAt`
 * (renamed from `exported_at`), stats via the old `_buildStatsFromTodos`
 * semantics including `tasksPerDay` (last 30 days, zero-filled).
 */

const DAY_MS = 86_400_000;

export const CSV_HEADER =
  'id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags,subtasks,recurrence';

export interface ExportStats {
  totalTodos: number;
  completedCount: number;
  completionRate: number;
  avgDuration: number;
  timeSpentTotal: number;
  topTags: TagCount[];
  tasksPerDay: { day: string; count: number }[];
}

/** Last 30 days ending today (UTC), zero-filled, counted by dueDate. */
export function buildTasksPerDay(
  todos: readonly Todo[],
  now: Date,
): { day: string; count: number }[] {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const startMs = end.getTime() - 29 * DAY_MS;
  const counts = new Map<string, number>();
  for (const todo of todos) {
    if (todo.dueDate === null) continue;
    counts.set(todo.dueDate, (counts.get(todo.dueDate) ?? 0) + 1);
  }
  const results: { day: string; count: number }[] = [];
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(startMs + i * DAY_MS).toISOString().slice(0, 10);
    results.push({ day, count: counts.get(day) ?? 0 });
  }
  return results;
}

/** RFC 4180: quote (and double embedded quotes) when the cell needs it. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function todoToCsvRow(todo: Todo): string {
  const tags = todo.tags.map((tag) => tag.name).join(';');
  const subtasks = todo.subtasks
    .map((subtask) => `${subtask.title}(${subtask.isCompleted ? 'done' : 'pending'})`)
    .join(';');
  // Old-format parity: recurrence JSON keeps its `"` → `\"` escaping as the
  // cell VALUE; RFC 4180 quoting is then applied on top (round-trippable).
  const recurrence = todo.recurrence ? JSON.stringify(todo.recurrence).replace(/"/g, '\\"') : '';
  return [
    csvCell(todo.id),
    csvCell(todo.title),
    csvCell(todo.description ?? ''),
    csvCell(todo.dueDate ?? ''),
    csvCell(todo.dueTime ?? ''),
    todo.isCompleted ? '1' : '0',
    todo.isFlagged ? '1' : '0',
    csvCell(todo.priority),
    String(todo.duration),
    csvCell(tags),
    csvCell(subtasks),
    csvCell(recurrence),
  ].join(',');
}

export interface ExportDataDeps {
  todos: Pick<TodoRepository, 'listAll'>;
  tags: Pick<TagRepository, 'listVisible'>;
  dailyPlans: Pick<DailyPlanRepository, 'getAllDays' | 'getSettings'>;
}

export class ExportData {
  constructor(
    private readonly deps: ExportDataDeps,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async buildJson(user: CurrentUser): Promise<ExportPayload> {
    const [todos, tags, planDays, planSettings] = await Promise.all([
      this.deps.todos.listAll(user.id, { includeArchived: false }),
      this.deps.tags.listVisible(user.id),
      this.deps.dailyPlans.getAllDays(user.id),
      this.deps.dailyPlans.getSettings(user.id),
    ]);
    const now = this.now();
    const stats: ExportStats = {
      ...buildPeriodTotals(todos),
      topTags: buildTopTags(todos),
      tasksPerDay: buildTasksPerDay(todos, now),
    };
    return {
      exportedAt: now.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile ? toProfileDto(user.profile) : null,
        settings: user.settings ? toSettingsDto(user.settings) : null,
      },
      todos: todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        dueDate: todo.dueDate,
        dueTime: todo.dueTime,
        isCompleted: todo.isCompleted,
        isFlagged: todo.isFlagged,
        priority: todo.priority,
        duration: todo.duration,
        tags: todo.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
        subtasks: todo.subtasks,
        recurrence: todo.recurrence,
        originalId: todo.originalId,
        taskNumber: todo.taskNumber,
      })),
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        isDefault: tag.isDefault,
      })),
      stats: stats as unknown as Record<string, unknown>,
      // Daily plans are the user's journal/health data — an export without
      // them is misleadingly incomplete. Import ignores these for now (merge
      // semantics for day blobs is its own design).
      dailyPlans: planDays.map((row) => ({ date: row.planDate, data: row.data })),
      dailyPlanSettings: planSettings,
    };
  }

  async buildCsv(userId: string): Promise<string> {
    const todos = await this.deps.todos.listAll(userId, { includeArchived: false });
    return [CSV_HEADER, ...todos.map(todoToCsvRow)].join('\n') + '\n';
  }
}
