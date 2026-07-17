import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { PRIORITIES, type Priority, type Tag, type Todo } from '@lifeline/shared';
import { ForbiddenError, NotFoundError } from '../../domain/errors.js';
import { parseUtcDate } from '../../domain/recurrence.js';
import type {
  CreateTodoOptions,
  ImportPlan,
  ImportTodoData,
  ImportTodoWriter,
  NewTodoData,
  TodoListFilters,
  TodoRepository,
  TodoUpdateData,
} from '../../application/ports.js';
import type { Db } from '../db/client.js';
import type * as schema from '../db/schema.js';
import { tags, todos, todoTags } from '../db/schema.js';
import { isUniqueViolation } from './pg-errors.js';

type TodoRow = typeof todos.$inferSelect;
type Tx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
type Executor = Db | Tx;

const MAX_TASK_NUMBER_QUERY = 2_147_483_647; // int4 upper bound for q-as-number matching

function toDbDate(value: string | null): Date | null {
  return value === null ? null : parseUtcDate(value);
}

function toPriority(value: string): Priority {
  // Old-repo parity: unknown priorities coerce to 'medium'.
  return (PRIORITIES as readonly string[]).includes(value) ? (value as Priority) : 'medium';
}

function toTodoDto(row: TodoRow, tagList: Tag[]): Todo {
  return {
    id: row.id,
    taskNumber: row.taskNumber,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate === null ? null : row.dueDate.toISOString().slice(0, 10),
    dueTime: row.dueTime,
    isCompleted: row.isCompleted,
    isFlagged: row.isFlagged,
    duration: row.duration,
    priority: toPriority(row.priority),
    tags: tagList,
    subtasks: row.subtasks,
    order: row.order,
    recurrence: row.recurrence ?? null,
    habitId: row.habitId,
    originalId: row.originalId,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Tags for a set of todos in one query, grouped by todo id (defaults first). */
async function loadTagsByTodoIds(ex: Executor, todoIds: string[]): Promise<Map<string, Tag[]>> {
  const map = new Map<string, Tag[]>();
  if (todoIds.length === 0) return map;
  const rows = await ex
    .select({
      todoId: todoTags.todoId,
      id: tags.id,
      name: tags.name,
      color: tags.color,
      userId: tags.userId,
      isDefault: tags.isDefault,
    })
    .from(todoTags)
    .innerJoin(tags, eq(tags.id, todoTags.tagId))
    .where(inArray(todoTags.todoId, todoIds))
    .orderBy(desc(tags.isDefault), sql`lower(${tags.name}) ASC`);
  for (const row of rows) {
    const list = map.get(row.todoId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      color: row.color,
      userId: row.userId,
      isDefault: row.isDefault,
    });
    map.set(row.todoId, list);
  }
  return map;
}

/**
 * Filter candidate tag ids down to the ones visible to the user (global
 * defaults + own custom). Unknown ids are silently dropped (old-app parity).
 */
async function resolveVisibleTagIds(
  ex: Executor,
  userId: string,
  tagIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return [];
  const rows = await ex
    .select({ id: tags.id })
    .from(tags)
    .where(and(inArray(tags.id, unique), or(eq(tags.isDefault, true), eq(tags.userId, userId))));
  const visible = new Set(rows.map((row) => row.id));
  return unique.filter((id) => visible.has(id));
}

/**
 * INSERT with the task number assigned inside the statement:
 * `(SELECT COALESCE(MAX(task_number), 0) + 1 ... )` — within the surrounding
 * transaction earlier inserts of the same transaction are visible, so
 * multi-row creates number sequentially.
 */
async function insertTodoRow(tx: Tx, userId: string, data: NewTodoData): Promise<TodoRow> {
  const rows = await tx
    .insert(todos)
    .values({
      id: randomUUID(),
      userId,
      taskNumber: sql`(SELECT COALESCE(MAX(t.task_number), 0) + 1 FROM todos t WHERE t.user_id = ${userId})`,
      title: data.title,
      description: data.description,
      dueDate: toDbDate(data.dueDate),
      dueTime: data.dueTime,
      isFlagged: data.isFlagged,
      duration: data.duration,
      priority: data.priority,
      subtasks: data.subtasks,
      order: data.order,
      recurrence: data.recurrence,
      habitId: data.habitId,
      originalId: data.originalId,
    })
    .returning();
  const row = rows[0];
  if (row === undefined) throw new Error('Todo insert returned no row');
  return row;
}

/** Per-user advisory xact lock — serializes concurrent numbering per user. */
async function acquireUserLock(tx: Tx, userId: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`todos:${userId}`}::text, 0))`,
  );
}

/**
 * Insert-or-overwrite one imported todo INSIDE the caller's transaction (the
 * per-user advisory lock must already be held). Task number is reassigned on
 * insert / kept on overwrite; an incoming id owned by another user gets a fresh
 * uuid; `originalId` is kept only when it resolves to one of the user's todos;
 * tag links are replaced with the resolved visible ids.
 */
async function writeImportedRow(tx: Tx, userId: string, data: ImportTodoData): Promise<TodoRow> {
  let originalId = data.originalId;
  if (originalId !== null) {
    const target = await tx
      .select({ id: todos.id })
      .from(todos)
      .where(and(eq(todos.id, originalId), eq(todos.userId, userId)))
      .limit(1);
    if (target.length === 0) originalId = null;
  }

  const existing = await tx
    .select({ id: todos.id, userId: todos.userId })
    .from(todos)
    .where(eq(todos.id, data.id))
    .limit(1);
  const owned = existing[0]?.userId === userId;

  const values = {
    title: data.title,
    description: data.description,
    dueDate: toDbDate(data.dueDate),
    dueTime: data.dueTime,
    isCompleted: data.isCompleted,
    isFlagged: data.isFlagged,
    duration: data.duration,
    priority: data.priority,
    subtasks: data.subtasks,
    order: data.order,
    recurrence: data.recurrence,
    originalId,
  };

  let row: TodoRow | undefined;
  if (owned) {
    const rows = await tx
      .update(todos)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(todos.id, data.id), eq(todos.userId, userId)))
      .returning();
    row = rows[0];
  } else {
    const rows = await tx
      .insert(todos)
      .values({
        ...values,
        id: existing.length === 0 ? data.id : randomUUID(),
        userId,
        taskNumber: sql`(SELECT COALESCE(MAX(t.task_number), 0) + 1 FROM todos t WHERE t.user_id = ${userId})`,
      })
      .returning();
    row = rows[0];
  }
  if (row === undefined) throw new Error('Imported todo write returned no row');
  const written = row;

  await tx.delete(todoTags).where(eq(todoTags.todoId, written.id));
  const resolved = await resolveVisibleTagIds(tx, userId, data.tagIds);
  if (resolved.length > 0) {
    await tx.insert(todoTags).values(resolved.map((tagId) => ({ todoId: written.id, tagId })));
  }
  return written;
}

/**
 * Build the old-id → new-id tag map INSIDE the transaction (mirrors the old
 * import remap): default tags match an existing default by lower(name) (else
 * dropped); custom tags match the user's custom by lower(name) else are created
 * on demand. A creation failure drops the tag silently (old parity). Must run
 * AFTER the replace-mode purge so recreated customs survive.
 */
async function buildImportTagMap(
  tx: Tx,
  userId: string,
  tagInputs: ImportPlan['tags'],
  generateTagId: () => string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (tagInputs.length === 0) return map;

  const visible = await tx
    .select()
    .from(tags)
    .where(or(eq(tags.isDefault, true), eq(tags.userId, userId)));
  const defaultByName = new Map<string, Tag>();
  const customByName = new Map<string, Tag>();
  for (const row of visible) {
    const tag: Tag = {
      id: row.id,
      name: row.name,
      color: row.color,
      userId: row.userId,
      isDefault: row.isDefault,
    };
    (tag.isDefault ? defaultByName : customByName).set(tag.name.toLowerCase(), tag);
  }

  for (const input of tagInputs) {
    const nameKey = input.name.toLowerCase();
    if (input.isDefault) {
      const match = defaultByName.get(nameKey);
      if (match) map.set(input.oldId, match.id);
      continue;
    }
    let target = customByName.get(nameKey) ?? null;
    if (target === null) {
      try {
        const rows = await tx
          .insert(tags)
          .values({
            id: generateTagId(),
            name: input.name,
            color: input.color,
            userId,
            isDefault: false,
          })
          .returning();
        const created = rows[0];
        if (created !== undefined) {
          target = {
            id: created.id,
            name: created.name,
            color: created.color,
            userId: created.userId,
            isDefault: created.isDefault,
          };
          customByName.set(nameKey, target);
        }
      } catch (error) {
        // A blank color etc. would violate a CHECK; drop the tag (old parity).
        // A unique violation would poison the surrounding transaction, so only
        // swallow non-unique errors here.
        if (isUniqueViolation(error)) throw error;
        target = null;
      }
    }
    if (target) map.set(input.oldId, target.id);
  }
  return map;
}

function listOrder(sortBy: TodoListFilters['sortBy']): SQL[] {
  const tie: SQL[] = [asc(todos.order), asc(todos.taskNumber)];
  switch (sortBy) {
    case 'priority':
      return [
        sql`CASE ${todos.priority} WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC`,
        ...tie,
      ];
    case 'duration':
      return [desc(todos.duration), ...tie];
    case 'name':
      return [sql`lower(${todos.title}) ASC`, ...tie];
    case 'date_desc':
      return [sql`${todos.dueDate} DESC NULLS LAST`, ...tie];
    default:
      return [sql`${todos.dueDate} ASC NULLS LAST`, ...tie];
  }
}

/**
 * Drizzle TodoRepository. Fixes carried per 05-decisions.md: task numbers are
 * assigned inside the INSERT under a per-user advisory lock (plus one retry
 * on 23505) instead of the old racy app-side MAX+1; `archived` is mapped and
 * never flipped implicitly; archive/DELETE always preserve tag links.
 */
export class DrizzleTodoRepository implements TodoRepository, ImportTodoWriter {
  constructor(private readonly db: Db) {}

  async list(
    userId: string,
    filters: TodoListFilters,
  ): Promise<{ items: Todo[]; totalItems: number }> {
    const conditions = this.listConditions(userId, filters);
    const offset = (filters.page - 1) * filters.pageSize;
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(todos)
        .where(and(...conditions))
        .orderBy(...listOrder(filters.sortBy))
        .limit(filters.pageSize)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(todos)
        .where(and(...conditions)),
    ]);
    const tagMap = await loadTagsByTodoIds(
      this.db,
      rows.map((row) => row.id),
    );
    return {
      items: rows.map((row) => toTodoDto(row, tagMap.get(row.id) ?? [])),
      totalItems: totals[0]?.value ?? 0,
    };
  }

  async listAll(
    userId: string,
    options?: { includeArchived?: boolean | undefined },
  ): Promise<Todo[]> {
    const conditions: SQL[] = [eq(todos.userId, userId)];
    if (options?.includeArchived !== true) conditions.push(eq(todos.archived, false));
    const rows = await this.db
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(...listOrder(undefined));
    const tagMap = await loadTagsByTodoIds(
      this.db,
      rows.map((row) => row.id),
    );
    return rows.map((row) => toTodoDto(row, tagMap.get(row.id) ?? []));
  }

  create(userId: string, data: NewTodoData, options?: CreateTodoOptions): Promise<Todo> {
    return this.createManyInternal(userId, [data], options).then((created) => {
      const todo = created[0];
      if (todo === undefined) throw new Error('Todo creation returned no rows');
      return todo;
    });
  }

  async createMany(
    userId: string,
    data: NewTodoData[],
    options?: CreateTodoOptions,
  ): Promise<Todo[]> {
    if (data.length === 0) return [];
    return this.createManyInternal(userId, data, options);
  }

  async findById(userId: string, id: string): Promise<Todo | null> {
    const rows = await this.db
      .select()
      .from(todos)
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
      .limit(1);
    return this.mapOne(rows[0]);
  }

  async findByTaskNumber(userId: string, taskNumber: number): Promise<Todo | null> {
    const rows = await this.db
      .select()
      .from(todos)
      .where(and(eq(todos.taskNumber, taskNumber), eq(todos.userId, userId)))
      .limit(1);
    return this.mapOne(rows[0]);
  }

  async findByIds(userId: string, ids: string[]): Promise<Todo[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(todos)
      .where(and(inArray(todos.id, ids), eq(todos.userId, userId)));
    const tagMap = await loadTagsByTodoIds(
      this.db,
      rows.map((row) => row.id),
    );
    return rows.map((row) => toTodoDto(row, tagMap.get(row.id) ?? []));
  }

  async findSimilarByTitle(
    userId: string,
    title: string,
    limit: number,
    threshold: number,
  ): Promise<Todo[]> {
    // No archived filter — old-app parity (audit-domain-logic.md §6).
    const rows = await this.db
      .select()
      .from(todos)
      .where(
        and(eq(todos.userId, userId), sql`similarity(${todos.title}, ${title}) > ${threshold}`),
      )
      .orderBy(sql`similarity(${todos.title}, ${title}) DESC`)
      .limit(limit);
    const tagMap = await loadTagsByTodoIds(
      this.db,
      rows.map((row) => row.id),
    );
    return rows.map((row) => toTodoDto(row, tagMap.get(row.id) ?? []));
  }

  async update(userId: string, id: string, changes: TodoUpdateData): Promise<Todo> {
    return this.db.transaction(async (tx) => {
      const set: Partial<typeof todos.$inferInsert> = { updatedAt: new Date() };
      if (changes.title !== undefined) set.title = changes.title;
      if (changes.description !== undefined) set.description = changes.description;
      if (changes.dueDate !== undefined) set.dueDate = toDbDate(changes.dueDate);
      if (changes.dueTime !== undefined) set.dueTime = changes.dueTime;
      if (changes.isFlagged !== undefined) set.isFlagged = changes.isFlagged;
      if (changes.duration !== undefined) set.duration = changes.duration;
      if (changes.priority !== undefined) set.priority = changes.priority;
      if (changes.subtasks !== undefined) set.subtasks = changes.subtasks;
      if (changes.order !== undefined) set.order = changes.order;
      if (changes.habitId !== undefined) set.habitId = changes.habitId;

      const rows = await tx
        .update(todos)
        .set(set)
        .where(and(eq(todos.id, id), eq(todos.userId, userId)))
        .returning();
      const row = rows[0];
      if (row === undefined) throw new NotFoundError('Task not found.');

      if (changes.tagIds !== undefined) {
        await tx.delete(todoTags).where(eq(todoTags.todoId, id));
        const resolved = await resolveVisibleTagIds(tx, userId, changes.tagIds);
        if (resolved.length > 0) {
          await tx.insert(todoTags).values(resolved.map((tagId) => ({ todoId: id, tagId })));
        }
      }

      const tagMap = await loadTagsByTodoIds(tx, [id]);
      return toTodoDto(row, tagMap.get(id) ?? []);
    });
  }

  async setCompleted(userId: string, id: string, isCompleted: boolean): Promise<Todo> {
    const rows = await this.db
      .update(todos)
      .set({ isCompleted, updatedAt: new Date() })
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
      .returning();
    return this.mapOneOrThrow(rows[0]);
  }

  async setArchived(userId: string, id: string, archived: boolean): Promise<Todo> {
    // Tag links untouched in BOTH directions (decisions #4).
    const rows = await this.db
      .update(todos)
      .set({ archived, updatedAt: new Date() })
      .where(and(eq(todos.id, id), eq(todos.userId, userId)))
      .returning();
    return this.mapOneOrThrow(rows[0]);
  }

  async countActiveByUser(userId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.archived, false)));
    return rows[0]?.value ?? 0;
  }

  async deleteAllByUser(userId: string): Promise<void> {
    await this.db.delete(todos).where(eq(todos.userId, userId));
  }

  /**
   * Import writer (ports.ts ImportTodoWriter): insert-or-overwrite by id.
   * The task number is ALWAYS assigned server-side (decisions #10) — fresh
   * MAX+1 on insert, the existing number kept on overwrite. An incoming id
   * owned by ANOTHER user gets a fresh uuid instead of clobbering foreign
   * data (v1 hardening over the old unscoped upsert). `originalId` is kept
   * only when it resolves to one of the user's own todos (FK safety).
   */
  async upsertImported(userId: string, data: ImportTodoData): Promise<Todo> {
    const run = (): Promise<Todo> =>
      this.db.transaction(async (tx) => {
        await acquireUserLock(tx, userId);
        const written = await writeImportedRow(tx, userId, data);
        const tagMap = await loadTagsByTodoIds(tx, [written.id]);
        return toTodoDto(written, tagMap.get(written.id) ?? []);
      });
    try {
      return await run();
    } catch (error) {
      if (isUniqueViolation(error)) return run();
      throw error;
    }
  }

  /**
   * Atomic import (decisions #10 + contract 'transactional'). The ENTIRE unit
   * of work — replace-mode purge of todos+custom tags, tag remap/creation, and
   * every row upsert — runs inside ONE transaction under the per-user advisory
   * lock, so a mid-import failure rolls everything back (replace mode can never
   * lose the pre-existing data). Rows arrive already normalized/validated by
   * the use-case, so no user-payload error can surface here. One 23505 retry
   * mirrors the create path.
   */
  async importAll(userId: string, plan: ImportPlan): Promise<{ importedCount: number }> {
    const run = (): Promise<{ importedCount: number }> =>
      this.db.transaction(async (tx) => {
        await acquireUserLock(tx, userId);

        if (plan.replace) {
          await tx.delete(todos).where(eq(todos.userId, userId));
          await tx.delete(tags).where(and(eq(tags.userId, userId), eq(tags.isDefault, false)));
        }

        const tagIdMap = await buildImportTagMap(tx, userId, plan.tags, plan.generateTagId);

        let importedCount = 0;
        for (const item of plan.todos) {
          const resolvedTagIds: string[] = [];
          for (const ref of item.tagRefs) {
            const mapped = tagIdMap.get(ref);
            if (mapped !== undefined && !resolvedTagIds.includes(mapped)) {
              resolvedTagIds.push(mapped);
            }
          }
          const { tagRefs: _tagRefs, ...rest } = item;
          await writeImportedRow(tx, userId, { ...rest, tagIds: resolvedTagIds });
          importedCount += 1;
        }
        return { importedCount };
      });
    try {
      return await run();
    } catch (error) {
      if (isUniqueViolation(error)) return run();
      throw error;
    }
  }

  private async mapOne(row: TodoRow | undefined): Promise<Todo | null> {
    if (row === undefined) return null;
    const tagMap = await loadTagsByTodoIds(this.db, [row.id]);
    return toTodoDto(row, tagMap.get(row.id) ?? []);
  }

  private async mapOneOrThrow(row: TodoRow | undefined): Promise<Todo> {
    const todo = await this.mapOne(row);
    if (todo === null) throw new NotFoundError('Task not found.');
    return todo;
  }

  /**
   * All rows in ONE transaction. A per-user advisory xact lock serializes
   * concurrent creates so inline MAX+1 numbering never collides; a single
   * fresh-transaction retry on 23505 covers writers that bypass the lock.
   * When `options.activeCap` is set the active-todo count is read and asserted
   * INSIDE this transaction (after the lock), so concurrent creates can never
   * jointly cross the free-tier cap (confirmed-findings-round1 #4).
   */
  private async createManyInternal(
    userId: string,
    data: readonly NewTodoData[],
    options?: CreateTodoOptions,
  ): Promise<Todo[]> {
    const run = (): Promise<Todo[]> =>
      this.db.transaction(async (tx) => {
        await acquireUserLock(tx, userId);

        if (options?.activeCap !== undefined) {
          const activeRows = await tx
            .select({ value: count() })
            .from(todos)
            .where(and(eq(todos.userId, userId), eq(todos.archived, false)));
          const activeCount = activeRows[0]?.value ?? 0;
          if (activeCount + data.length > options.activeCap) {
            throw new ForbiddenError('Free tier max tasks reached.');
          }
        }

        const created: TodoRow[] = [];
        const resolvedCache = new Map<string, string[]>();
        for (const item of data) {
          const row = await insertTodoRow(tx, userId, item);
          const cacheKey = item.tagIds.join(' ');
          let resolved = resolvedCache.get(cacheKey);
          if (resolved === undefined) {
            resolved = await resolveVisibleTagIds(tx, userId, item.tagIds);
            resolvedCache.set(cacheKey, resolved);
          }
          if (resolved.length > 0) {
            await tx.insert(todoTags).values(resolved.map((tagId) => ({ todoId: row.id, tagId })));
          }
          created.push(row);
        }
        const tagMap = await loadTagsByTodoIds(
          tx,
          created.map((row) => row.id),
        );
        return created.map((row) => toTodoDto(row, tagMap.get(row.id) ?? []));
      });
    try {
      return await run();
    } catch (error) {
      if (isUniqueViolation(error)) return run();
      throw error;
    }
  }

  private listConditions(userId: string, filters: TodoListFilters): SQL[] {
    const conditions: SQL[] = [eq(todos.userId, userId)];
    if (filters.includeArchived !== true) conditions.push(eq(todos.archived, false));

    if (filters.q !== undefined && filters.q !== '') {
      const pattern = `%${filters.q}%`;
      const textMatch = or(
        ilike(todos.title, pattern),
        sql`COALESCE(${todos.description}, '') ILIKE ${pattern}`,
        sql`CAST(${todos.subtasks} AS text) ILIKE ${pattern}`,
      );
      // A pure-numeric q (optionally #-prefixed) ALSO matches the task number.
      const numeric = /^#?(\d+)$/.exec(filters.q);
      const parsed = numeric ? Number.parseInt(numeric[1] ?? '', 10) : Number.NaN;
      const qCondition =
        Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_TASK_NUMBER_QUERY
          ? or(textMatch, eq(todos.taskNumber, parsed))
          : textMatch;
      if (qCondition !== undefined) conditions.push(qCondition);
    }

    if (filters.tags !== undefined) {
      const ids = filters.tags
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== '');
      if (ids.length > 0) {
        conditions.push(
          exists(
            this.db
              .select({ one: sql`1` })
              .from(todoTags)
              .where(and(eq(todoTags.todoId, todos.id), inArray(todoTags.tagId, ids))),
          ),
        );
      }
    }

    if (filters.priority !== undefined) conditions.push(eq(todos.priority, filters.priority));
    if (filters.status === 'completed') conditions.push(eq(todos.isCompleted, true));
    if (filters.status === 'active') conditions.push(eq(todos.isCompleted, false));
    if (filters.flagged !== undefined) conditions.push(eq(todos.isFlagged, filters.flagged));

    if (filters.startDate !== undefined) {
      const start = parseUtcDate(filters.startDate);
      if (start !== null) conditions.push(gte(todos.dueDate, start));
    }
    if (filters.endDate !== undefined) {
      // endDate is inclusive on the wire → exclusive next-day UTC in SQL.
      const end = parseUtcDate(filters.endDate);
      if (end !== null) conditions.push(lt(todos.dueDate, new Date(end.getTime() + 86_400_000)));
    }

    if (filters.minDuration !== undefined) {
      conditions.push(gte(todos.duration, filters.minDuration));
    }
    if (filters.maxDuration !== undefined) {
      conditions.push(lte(todos.duration, filters.maxDuration));
    }
    if (filters.taskNumber !== undefined) {
      conditions.push(eq(todos.taskNumber, filters.taskNumber));
    }
    return conditions;
  }
}
