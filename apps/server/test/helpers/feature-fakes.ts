import { randomUUID } from 'node:crypto';
import { DEFAULT_TAGS, type Tag, type Todo } from '@lifeline/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../../src/domain/errors.js';
import type {
  CreateTodoOptions,
  ImportPlan,
  ImportTodoData,
  ImportTodoWriter,
  McpKeyRecord,
  McpKeyRepository,
  NewTodoData,
  TagRepository,
  TodoListFilters,
  TodoRepository,
  TodoUpdateData,
} from '../../src/application/ports.js';

/**
 * In-memory fakes for the feature slices (todos/tags/mcp-keys) — NO real
 * database in unit/router tests. Where behavior matters to the contract the
 * fakes mirror the Drizzle repositories: visible-tag resolution drops unknown
 * ids, duplicate tag names / key prefixes throw ConflictError, revoke is
 * idempotent, list filters follow audit-domain-logic.md §7 semantics.
 */

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export class InMemoryTagRepository implements TagRepository {
  readonly rows = new Map<string, Tag>();
  /** Import parity hook: force create() to fail (tag silently dropped). */
  failCreate = false;
  readonly calls: string[] = [];

  /** Seed the 10 global defaults from the baseline migration. */
  seedDefaults(): void {
    for (const tag of DEFAULT_TAGS) {
      this.rows.set(tag.id, { ...tag, userId: null, isDefault: true });
    }
  }

  seedCustom(userId: string, tag: { id?: string; name: string; color?: string }): Tag {
    const full: Tag = {
      id: tag.id ?? randomUUID(),
      name: tag.name,
      color: tag.color ?? '#123456',
      userId,
      isDefault: false,
    };
    this.rows.set(full.id, full);
    return full;
  }

  listVisible(userId: string): Promise<Tag[]> {
    const visible = [...this.rows.values()].filter((tag) => tag.isDefault || tag.userId === userId);
    visible.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    return Promise.resolve(visible.map((tag) => ({ ...tag })));
  }

  findById(id: string): Promise<Tag | null> {
    const tag = this.rows.get(id);
    return Promise.resolve(tag === undefined ? null : { ...tag });
  }

  countCustomByUser(userId: string): Promise<number> {
    let total = 0;
    for (const tag of this.rows.values()) {
      if (!tag.isDefault && tag.userId === userId) total += 1;
    }
    return Promise.resolve(total);
  }

  create(userId: string, data: { id: string; name: string; color: string }): Promise<Tag> {
    if (this.failCreate) return Promise.reject(new Error('tag creation disabled'));
    this.assertUniqueName(userId, data.name, data.id);
    const tag: Tag = { ...data, userId, isDefault: false };
    this.rows.set(tag.id, tag);
    return Promise.resolve({ ...tag });
  }

  update(
    userId: string,
    tagId: string,
    changes: { name?: string | undefined; color?: string | undefined },
  ): Promise<Tag> {
    const existing = this.rows.get(tagId);
    if (existing === undefined || existing.isDefault || existing.userId !== userId) {
      return Promise.reject(new NotFoundError('Tag not found.'));
    }
    if (changes.name !== undefined) this.assertUniqueName(userId, changes.name, tagId);
    const next: Tag = {
      ...existing,
      name: changes.name ?? existing.name,
      color: changes.color ?? existing.color,
    };
    this.rows.set(tagId, next);
    return Promise.resolve({ ...next });
  }

  delete(userId: string, tagId: string): Promise<void> {
    const existing = this.rows.get(tagId);
    if (existing !== undefined && !existing.isDefault && existing.userId === userId) {
      this.rows.delete(tagId);
    }
    return Promise.resolve();
  }

  deleteCustomByUser(userId: string): Promise<void> {
    this.calls.push('deleteCustomByUser');
    for (const [id, tag] of this.rows) {
      if (!tag.isDefault && tag.userId === userId) this.rows.delete(id);
    }
    return Promise.resolve();
  }

  private assertUniqueName(userId: string, name: string, exceptId: string): void {
    const wanted = name.toLowerCase();
    for (const tag of this.rows.values()) {
      if (
        tag.id !== exceptId &&
        !tag.isDefault &&
        tag.userId === userId &&
        tag.name.toLowerCase() === wanted
      ) {
        throw new ConflictError('A tag with this name already exists.');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------

interface StoredTodo {
  userId: string;
  todo: Todo;
}

export class InMemoryTodoRepository implements TodoRepository, ImportTodoWriter {
  private readonly store = new Map<string, StoredTodo>();
  /** Mutation log for idempotency assertions (e.g. `setArchived:<id>:true`). */
  readonly calls: string[] = [];

  constructor(private readonly tagRepo?: InMemoryTagRepository) {}

  seed(userId: string, partial: Partial<Todo> = {}): Todo {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: randomUUID(),
      taskNumber: this.nextTaskNumber(userId),
      title: 'Seeded task',
      description: null,
      dueDate: null,
      dueTime: null,
      isCompleted: false,
      isFlagged: false,
      duration: 0,
      priority: 'medium',
      tags: [],
      subtasks: [],
      order: 0,
      recurrence: null,
      originalId: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    this.store.set(todo.id, { userId, todo });
    return { ...todo };
  }

  rowsFor(userId: string): Todo[] {
    return [...this.store.values()]
      .filter((entry) => entry.userId === userId)
      .map((entry) => ({ ...entry.todo }));
  }

  list(userId: string, filters: TodoListFilters): Promise<{ items: Todo[]; totalItems: number }> {
    let rows = this.rowsFor(userId);
    if (filters.includeArchived !== true) rows = rows.filter((todo) => !todo.archived);

    if (filters.q !== undefined && filters.q !== '') {
      const q = filters.q.toLowerCase();
      const numeric = /^#?(\d+)$/.exec(filters.q);
      const taskNumber = numeric ? Number.parseInt(numeric[1] ?? '', 10) : null;
      rows = rows.filter(
        (todo) =>
          todo.title.toLowerCase().includes(q) ||
          (todo.description ?? '').toLowerCase().includes(q) ||
          JSON.stringify(todo.subtasks).toLowerCase().includes(q) ||
          (taskNumber !== null && todo.taskNumber === taskNumber),
      );
    }
    if (filters.tags !== undefined) {
      const ids = filters.tags
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== '');
      if (ids.length > 0) {
        rows = rows.filter((todo) => todo.tags.some((tag) => ids.includes(tag.id)));
      }
    }
    if (filters.priority !== undefined) {
      rows = rows.filter((todo) => todo.priority === filters.priority);
    }
    if (filters.status === 'completed') rows = rows.filter((todo) => todo.isCompleted);
    if (filters.status === 'active') rows = rows.filter((todo) => !todo.isCompleted);
    if (filters.flagged !== undefined) {
      rows = rows.filter((todo) => todo.isFlagged === filters.flagged);
    }
    if (filters.startDate !== undefined) {
      const start = filters.startDate;
      rows = rows.filter((todo) => todo.dueDate !== null && todo.dueDate >= start);
    }
    if (filters.endDate !== undefined) {
      const end = filters.endDate; // inclusive on the wire
      rows = rows.filter((todo) => todo.dueDate !== null && todo.dueDate <= end);
    }
    if (filters.minDuration !== undefined) {
      const min = filters.minDuration;
      rows = rows.filter((todo) => todo.duration >= min);
    }
    if (filters.maxDuration !== undefined) {
      const max = filters.maxDuration;
      rows = rows.filter((todo) => todo.duration <= max);
    }
    if (filters.taskNumber !== undefined) {
      rows = rows.filter((todo) => todo.taskNumber === filters.taskNumber);
    }

    rows.sort(comparatorFor(filters.sortBy));
    const totalItems = rows.length;
    const offset = (filters.page - 1) * filters.pageSize;
    return Promise.resolve({ items: rows.slice(offset, offset + filters.pageSize), totalItems });
  }

  listAll(userId: string, options?: { includeArchived?: boolean | undefined }): Promise<Todo[]> {
    let rows = this.rowsFor(userId);
    if (options?.includeArchived !== true) rows = rows.filter((todo) => !todo.archived);
    rows.sort(comparatorFor(undefined));
    return Promise.resolve(rows);
  }

  create(userId: string, data: NewTodoData, options?: CreateTodoOptions): Promise<Todo> {
    this.calls.push('create');
    this.assertCapacity(userId, 1, options);
    return Promise.resolve(this.insertRow(userId, data));
  }

  createMany(userId: string, data: NewTodoData[], options?: CreateTodoOptions): Promise<Todo[]> {
    this.calls.push('createMany');
    this.assertCapacity(userId, data.length, options);
    return Promise.resolve(data.map((item) => this.insertRow(userId, item)));
  }

  /** Mirrors the repo's in-transaction cap check (round1 #4). */
  private assertCapacity(userId: string, adding: number, options?: CreateTodoOptions): void {
    if (options?.activeCap === undefined) return;
    const active = this.rowsFor(userId).filter((todo) => !todo.archived).length;
    if (active + adding > options.activeCap) {
      throw new ForbiddenError('Free tier max tasks reached.');
    }
  }

  findById(userId: string, id: string): Promise<Todo | null> {
    const entry = this.store.get(id);
    return Promise.resolve(
      entry !== undefined && entry.userId === userId ? { ...entry.todo } : null,
    );
  }

  findByTaskNumber(userId: string, taskNumber: number): Promise<Todo | null> {
    const found = this.rowsFor(userId).find((todo) => todo.taskNumber === taskNumber);
    return Promise.resolve(found ?? null);
  }

  findByIds(userId: string, ids: string[]): Promise<Todo[]> {
    return Promise.resolve(this.rowsFor(userId).filter((todo) => ids.includes(todo.id)));
  }

  findSimilarByTitle(
    userId: string,
    title: string,
    limit: number,
    threshold: number,
  ): Promise<Todo[]> {
    // Crude similarity stand-in: substring containment either way, with a
    // ratio proxy so high thresholds exclude weak matches (archived included).
    const needle = title.toLowerCase();
    const scored = this.rowsFor(userId)
      .map((todo) => {
        const hay = todo.title.toLowerCase();
        const contains = hay.includes(needle) || needle.includes(hay);
        const score = contains
          ? Math.min(needle.length, hay.length) / Math.max(needle.length, hay.length)
          : 0;
        return { todo, score };
      })
      .filter((entry) => entry.score > threshold)
      .sort((a, b) => b.score - a.score);
    return Promise.resolve(scored.slice(0, limit).map((entry) => entry.todo));
  }

  update(userId: string, id: string, changes: TodoUpdateData): Promise<Todo> {
    const entry = this.store.get(id);
    if (entry === undefined || entry.userId !== userId) {
      return Promise.reject(new NotFoundError('Task not found.'));
    }
    const todo = { ...entry.todo };
    if (changes.title !== undefined) todo.title = changes.title;
    if (changes.description !== undefined) todo.description = changes.description;
    if (changes.dueDate !== undefined) todo.dueDate = changes.dueDate;
    if (changes.dueTime !== undefined) todo.dueTime = changes.dueTime;
    if (changes.isFlagged !== undefined) todo.isFlagged = changes.isFlagged;
    if (changes.duration !== undefined) todo.duration = changes.duration;
    if (changes.priority !== undefined) todo.priority = changes.priority;
    if (changes.subtasks !== undefined) todo.subtasks = changes.subtasks;
    if (changes.order !== undefined) todo.order = changes.order;
    if (changes.tagIds !== undefined) todo.tags = this.resolveTags(userId, changes.tagIds);
    todo.updatedAt = new Date().toISOString();
    this.store.set(id, { userId, todo });
    return Promise.resolve({ ...todo });
  }

  setCompleted(userId: string, id: string, isCompleted: boolean): Promise<Todo> {
    this.calls.push(`setCompleted:${id}:${String(isCompleted)}`);
    return this.mutate(userId, id, (todo) => {
      todo.isCompleted = isCompleted;
    });
  }

  setArchived(userId: string, id: string, archived: boolean): Promise<Todo> {
    this.calls.push(`setArchived:${id}:${String(archived)}`);
    // Tag links preserved in both directions (decisions #4).
    return this.mutate(userId, id, (todo) => {
      todo.archived = archived;
    });
  }

  countActiveByUser(userId: string): Promise<number> {
    return Promise.resolve(this.rowsFor(userId).filter((todo) => !todo.archived).length);
  }

  deleteAllByUser(userId: string): Promise<void> {
    this.calls.push('deleteAllByUser');
    for (const [id, entry] of this.store) {
      if (entry.userId === userId) this.store.delete(id);
    }
    return Promise.resolve();
  }

  upsertImported(userId: string, data: ImportTodoData): Promise<Todo> {
    const existing = this.store.get(data.id);
    const ownedEntry = existing !== undefined && existing.userId === userId ? existing : null;
    const tags = this.resolveTags(userId, data.tagIds);
    const now = new Date().toISOString();
    const base: Todo = ownedEntry
      ? ownedEntry.todo
      : {
          id: existing === undefined ? data.id : randomUUID(),
          taskNumber: this.nextTaskNumber(userId),
          title: '',
          description: null,
          dueDate: null,
          dueTime: null,
          isCompleted: false,
          isFlagged: false,
          duration: 0,
          priority: 'medium',
          tags: [],
          subtasks: [],
          order: 0,
          recurrence: null,
          originalId: null,
          archived: false,
          createdAt: now,
          updatedAt: now,
        };
    const todo: Todo = {
      ...base,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      isCompleted: data.isCompleted,
      isFlagged: data.isFlagged,
      duration: data.duration,
      priority: data.priority,
      subtasks: data.subtasks,
      order: data.order,
      recurrence: data.recurrence,
      originalId: data.originalId,
      tags,
      updatedAt: now,
    };
    this.store.set(todo.id, { userId, todo });
    return Promise.resolve({ ...todo });
  }

  /**
   * Atomic import mirror. Rows are pre-validated by the use-case, so this never
   * throws mid-loop in practice; if it did, the in-memory store would be left
   * partially written — the real repo's DB transaction is what guarantees
   * rollback. Tests assert the ORDER of calls and the zero-side-effect
   * property by throwing BEFORE calling importAll (see import-data.test.ts).
   */
  async importAll(userId: string, plan: ImportPlan): Promise<{ importedCount: number }> {
    this.calls.push('importAll');
    if (plan.replace) {
      await this.deleteAllByUser(userId);
      if (this.tagRepo !== undefined) await this.tagRepo.deleteCustomByUser(userId);
    }

    const tagIdMap = new Map<string, string>();
    if (this.tagRepo !== undefined && plan.tags.length > 0) {
      const visible = await this.tagRepo.listVisible(userId);
      const defaultByName = new Map<string, Tag>();
      const customByName = new Map<string, Tag>();
      for (const tag of visible) {
        (tag.isDefault ? defaultByName : customByName).set(tag.name.toLowerCase(), tag);
      }
      for (const input of plan.tags) {
        const nameKey = input.name.toLowerCase();
        if (input.isDefault) {
          const match = defaultByName.get(nameKey);
          if (match) tagIdMap.set(input.oldId, match.id);
          continue;
        }
        let target = customByName.get(nameKey) ?? null;
        if (target === null) {
          try {
            target = await this.tagRepo.create(userId, {
              id: plan.generateTagId(),
              name: input.name,
              color: input.color,
            });
            customByName.set(nameKey, target);
          } catch {
            target = null; // creation failure → tag silently dropped
          }
        }
        if (target) tagIdMap.set(input.oldId, target.id);
      }
    }

    let importedCount = 0;
    for (const item of plan.todos) {
      const resolvedTagIds: string[] = [];
      for (const ref of item.tagRefs) {
        const mapped = tagIdMap.get(ref);
        if (mapped !== undefined && !resolvedTagIds.includes(mapped)) resolvedTagIds.push(mapped);
      }
      const { tagRefs: _tagRefs, ...rest } = item;
      await this.upsertImported(userId, { ...rest, tagIds: resolvedTagIds });
      importedCount += 1;
    }
    return { importedCount };
  }

  private mutate(userId: string, id: string, apply: (todo: Todo) => void): Promise<Todo> {
    const entry = this.store.get(id);
    if (entry === undefined || entry.userId !== userId) {
      return Promise.reject(new NotFoundError('Task not found.'));
    }
    const todo = { ...entry.todo };
    apply(todo);
    todo.updatedAt = new Date().toISOString();
    this.store.set(id, { userId, todo });
    return Promise.resolve({ ...todo });
  }

  private insertRow(userId: string, data: NewTodoData): Todo {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: randomUUID(),
      taskNumber: this.nextTaskNumber(userId),
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      isCompleted: false,
      isFlagged: data.isFlagged,
      duration: data.duration,
      priority: data.priority,
      tags: this.resolveTags(userId, data.tagIds),
      subtasks: data.subtasks,
      order: data.order,
      recurrence: data.recurrence,
      originalId: data.originalId,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(todo.id, { userId, todo });
    return { ...todo };
  }

  /** MAX+1 over the user's current rows — mirrors the SQL numbering. */
  private nextTaskNumber(userId: string): number {
    let max = 0;
    for (const entry of this.store.values()) {
      if (entry.userId === userId && entry.todo.taskNumber > max) max = entry.todo.taskNumber;
    }
    return max + 1;
  }

  /** Visible tags only (defaults + own custom); unknown ids silently dropped. */
  private resolveTags(userId: string, tagIds: readonly string[]): Tag[] {
    if (this.tagRepo === undefined) return [];
    const out: Tag[] = [];
    for (const id of new Set(tagIds)) {
      const tag = this.tagRepo.rows.get(id);
      if (tag !== undefined && (tag.isDefault || tag.userId === userId)) out.push({ ...tag });
    }
    return out;
  }
}

function comparatorFor(sortBy: TodoListFilters['sortBy']): (a: Todo, b: Todo) => number {
  const tie = (a: Todo, b: Todo): number => a.order - b.order || a.taskNumber - b.taskNumber;
  const rank = (todo: Todo): number =>
    todo.priority === 'high' ? 3 : todo.priority === 'medium' ? 2 : 1;
  switch (sortBy) {
    case 'priority':
      return (a, b) => rank(b) - rank(a) || tie(a, b);
    case 'duration':
      return (a, b) => b.duration - a.duration || tie(a, b);
    case 'name':
      return (a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || tie(a, b);
    case 'date_desc':
      return (a, b) => {
        if (a.dueDate === b.dueDate) return tie(a, b);
        if (a.dueDate === null) return 1; // NULLS LAST
        if (b.dueDate === null) return -1;
        return b.dueDate.localeCompare(a.dueDate) || tie(a, b);
      };
    default:
      return (a, b) => {
        if (a.dueDate === b.dueDate) return tie(a, b);
        if (a.dueDate === null) return 1; // NULLS LAST
        if (b.dueDate === null) return -1;
        return a.dueDate.localeCompare(b.dueDate) || tie(a, b);
      };
  }
}

// ---------------------------------------------------------------------------
// MCP API keys
// ---------------------------------------------------------------------------

export interface RecordedUsage {
  keyId: string;
  at?: Date | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export class InMemoryMcpKeyRepository implements McpKeyRepository {
  readonly rows = new Map<string, McpKeyRecord>();
  readonly usageCalls: RecordedUsage[] = [];
  /** Resolution parity hook: recordUsage failures must never block auth. */
  failRecordUsage = false;
  private seq = 0;

  seed(partial: Partial<McpKeyRecord> & { userId: string }): McpKeyRecord {
    const now = new Date(Date.now() + this.seq);
    this.seq += 1;
    const record: McpKeyRecord = {
      id: randomUUID(),
      name: 'Seeded key',
      keyPrefix: `lk_${this.seq.toString(16).padStart(8, '0')}`,
      keyHash: 'seeded-hash',
      scopes: ['tasks:read'],
      status: 'active',
      expiresAt: null,
      lastUsedAt: null,
      lastUsedIp: null,
      lastUsedUserAgent: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    this.rows.set(record.id, record);
    return { ...record };
  }

  create(
    data: Pick<McpKeyRecord, 'id' | 'userId' | 'name' | 'keyPrefix' | 'keyHash' | 'scopes'> & {
      expiresAt: Date | null;
    },
  ): Promise<McpKeyRecord> {
    for (const row of this.rows.values()) {
      if (row.keyPrefix === data.keyPrefix) {
        return Promise.reject(new ConflictError('MCP API key prefix already exists'));
      }
    }
    const now = new Date(Date.now() + this.seq);
    this.seq += 1;
    const record: McpKeyRecord = {
      ...data,
      scopes: [...data.scopes],
      status: 'active',
      lastUsedAt: null,
      lastUsedIp: null,
      lastUsedUserAgent: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, record);
    return Promise.resolve({ ...record });
  }

  list(userId: string, limit: number): Promise<McpKeyRecord[]> {
    const rows = [...this.rows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    return Promise.resolve(rows.map((row) => ({ ...row })));
  }

  findById(userId: string, keyId: string): Promise<McpKeyRecord | null> {
    const row = this.rows.get(keyId);
    return Promise.resolve(row !== undefined && row.userId === userId ? { ...row } : null);
  }

  findByPrefix(keyPrefix: string): Promise<McpKeyRecord | null> {
    for (const row of this.rows.values()) {
      if (row.keyPrefix === keyPrefix) return Promise.resolve({ ...row });
    }
    return Promise.resolve(null);
  }

  revoke(userId: string, keyId: string, reason: string): Promise<McpKeyRecord> {
    const row = this.rows.get(keyId);
    if (row === undefined || row.userId !== userId) {
      return Promise.reject(new NotFoundError('API key not found.'));
    }
    if (row.status === 'revoked' || row.revokedAt !== null) return Promise.resolve({ ...row });
    const now = new Date();
    const next: McpKeyRecord = {
      ...row,
      status: 'revoked',
      revokedAt: now,
      revocationReason: reason,
      updatedAt: now,
    };
    this.rows.set(keyId, next);
    return Promise.resolve({ ...next });
  }

  recordUsage(
    keyId: string,
    usage: { at?: Date | undefined; ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<void> {
    if (this.failRecordUsage) return Promise.reject(new Error('usage tracking down'));
    this.usageCalls.push({ keyId, ...usage });
    const row = this.rows.get(keyId);
    if (row !== undefined) {
      this.rows.set(keyId, {
        ...row,
        lastUsedAt: usage.at ?? new Date(),
        lastUsedIp: usage.ip ?? null,
        lastUsedUserAgent: usage.userAgent ?? null,
      });
    }
    return Promise.resolve();
  }
}
