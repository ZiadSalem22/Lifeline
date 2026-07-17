import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { createDb, createPool, type Db } from '../../src/infrastructure/db/client.js';
import { tags, todos, todoTags, users } from '../../src/infrastructure/db/schema.js';
import { DrizzleTodoRepository } from '../../src/infrastructure/repositories/todo-repository.js';
import { DrizzleTagRepository } from '../../src/infrastructure/repositories/tag-repository.js';
import { ImportData } from '../../src/application/data-transfer/import-data.js';
import { ForbiddenError } from '../../src/domain/errors.js';
import type { ImportTodoInput, NewTodoData } from '../../src/application/ports.js';

/**
 * Integration suite against a REAL Postgres (baseline applied, pg_trgm on).
 * Run with:
 *   TEST_DATABASE_URL=postgres://lifeline:lifeline@localhost:15432/lifeline
 * Skipped entirely when TEST_DATABASE_URL is unset.
 */
const DATABASE_URL = process.env.TEST_DATABASE_URL;

function newTodo(overrides: Partial<NewTodoData> = {}): NewTodoData {
  return {
    title: 'Integration todo',
    description: null,
    dueDate: null,
    dueTime: null,
    isFlagged: false,
    duration: 0,
    priority: 'medium',
    subtasks: [],
    order: 0,
    recurrence: null,
    habitId: null,
    originalId: null,
    tagIds: [],
    ...overrides,
  };
}

describe.skipIf(DATABASE_URL === undefined)('DrizzleTodoRepository (real PG)', () => {
  let pool: pg.Pool;
  let db: Db;
  let repo: DrizzleTodoRepository;
  let tagRepo: DrizzleTagRepository;
  let userId: string;

  beforeAll(async () => {
    pool = createPool(DATABASE_URL as string);
    db = createDb(pool);
    repo = new DrizzleTodoRepository(db);
    tagRepo = new DrizzleTagRepository(db);
    userId = `it-todos-${randomUUID()}`;
    await db.insert(users).values({ id: userId, auth0Sub: userId });
  });

  afterAll(async () => {
    // users FK cascades wipe todos, todo_tags, and custom tags.
    await db.delete(users).where(eq(users.id, userId));
    await pool.end();
  });

  it('assigns 5 DISTINCT task numbers under Promise.all concurrency', async () => {
    const created = await Promise.all(
      Array.from({ length: 5 }, (_, i) => repo.create(userId, newTodo({ title: `race-${i}` }))),
    );
    const numbers = created.map((todo) => todo.taskNumber);
    expect(new Set(numbers).size).toBe(5);
    expect(numbers.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('createMany numbers sequentially inside one transaction', async () => {
    const created = await repo.createMany(userId, [
      newTodo({ title: 'bulk-1' }),
      newTodo({ title: 'bulk-2' }),
      newTodo({ title: 'bulk-3' }),
    ]);
    const numbers = created.map((todo) => todo.taskNumber);
    expect(numbers[1]).toBe((numbers[0] ?? 0) + 1);
    expect(numbers[2]).toBe((numbers[0] ?? 0) + 2);
  });

  describe('list filters', () => {
    let taggedId: string;
    let tagId: string;

    beforeAll(async () => {
      const tag = await tagRepo.create(userId, {
        id: randomUUID(),
        name: `it-tag-${randomUUID().slice(0, 8)}`,
        color: '#123456',
      });
      tagId = tag.id;
      const tagged = await repo.create(
        userId,
        newTodo({
          title: 'Filter fixture zebra quokka',
          description: 'some filter description',
          dueDate: '2026-03-01',
          duration: 90,
          priority: 'high',
          tagIds: [tagId],
        }),
      );
      taggedId = tagged.id;
      await repo.create(userId, newTodo({ title: 'March second', dueDate: '2026-03-02' }));
      await repo.create(userId, newTodo({ title: 'March third', dueDate: '2026-03-03' }));
    });

    it('q ILIKE matches title/description case-insensitively', async () => {
      const byTitle = await repo.list(userId, { q: 'ZEBRA QUOK', page: 1, pageSize: 50 });
      expect(byTitle.items.map((todo) => todo.id)).toEqual([taggedId]);
      const byDescription = await repo.list(userId, {
        q: 'filter description',
        page: 1,
        pageSize: 50,
      });
      expect(byDescription.items.some((todo) => todo.id === taggedId)).toBe(true);
    });

    it('a pure-numeric q (with or without #) also matches the task number', async () => {
      const fixture = await repo.findById(userId, taggedId);
      const taskNumber = fixture?.taskNumber ?? -1;
      const plain = await repo.list(userId, { q: String(taskNumber), page: 1, pageSize: 50 });
      expect(plain.items.some((todo) => todo.id === taggedId)).toBe(true);
      const hashed = await repo.list(userId, { q: `#${taskNumber}`, page: 1, pageSize: 50 });
      expect(hashed.items.some((todo) => todo.id === taggedId)).toBe(true);
    });

    it('tag filter uses an EXISTS over todo_tags', async () => {
      const result = await repo.list(userId, { tags: tagId, page: 1, pageSize: 50 });
      expect(result.items.map((todo) => todo.id)).toEqual([taggedId]);
    });

    it('endDate is inclusive on the wire (exclusive next-day cut in SQL)', async () => {
      const result = await repo.list(userId, {
        startDate: '2026-03-01',
        endDate: '2026-03-02',
        page: 1,
        pageSize: 50,
      });
      const dates = result.items.map((todo) => todo.dueDate);
      expect(dates).toContain('2026-03-01');
      expect(dates).toContain('2026-03-02');
      expect(dates).not.toContain('2026-03-03');
    });

    it('priority sort uses the CASE ranking high > medium > low', async () => {
      const result = await repo.list(userId, { sortBy: 'priority', page: 1, pageSize: 100 });
      expect(result.items[0]?.priority).toBe('high');
      const ranks = result.items.map((todo) =>
        todo.priority === 'high' ? 3 : todo.priority === 'medium' ? 2 : 1,
      );
      expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
    });

    it('pagination reports full totals while slicing items', async () => {
      const all = await repo.list(userId, { page: 1, pageSize: 100 });
      const page = await repo.list(userId, { page: 1, pageSize: 2 });
      expect(page.items).toHaveLength(2);
      expect(page.totalItems).toBe(all.totalItems);
      expect(all.totalItems).toBeGreaterThanOrEqual(8);
    });

    it('min/maxDuration bound the duration column', async () => {
      const result = await repo.list(userId, {
        minDuration: 60,
        maxDuration: 120,
        page: 1,
        pageSize: 50,
      });
      expect(result.items.map((todo) => todo.id)).toEqual([taggedId]);
    });
  });

  it('findSimilarByTitle uses pg_trgm similarity() with the threshold', async () => {
    const unique = `Water the garden plants ${randomUUID().slice(0, 4)}`;
    const seeded = await repo.create(userId, newTodo({ title: unique }));
    const loose = await repo.findSimilarByTitle(userId, 'water the garden plant', 5, 0.3);
    expect(loose.some((todo) => todo.id === seeded.id)).toBe(true);
    const strict = await repo.findSimilarByTitle(userId, 'completely unrelated words', 5, 0.9);
    expect(strict.some((todo) => todo.id === seeded.id)).toBe(false);
  });

  it('archive preserves todo_tags rows (decisions #4)', async () => {
    const tag = await tagRepo.create(userId, {
      id: randomUUID(),
      name: `it-keep-${randomUUID().slice(0, 8)}`,
      color: '#00FF00',
    });
    const created = await repo.create(userId, newTodo({ title: 'To archive', tagIds: [tag.id] }));
    const archived = await repo.setArchived(userId, created.id, true);
    expect(archived.archived).toBe(true);
    expect(archived.tags.map((t) => t.id)).toEqual([tag.id]);
    const links = await db.select().from(todoTags).where(eq(todoTags.todoId, created.id));
    expect(links).toHaveLength(1);
    // Restore keeps them too.
    const restored = await repo.setArchived(userId, created.id, false);
    expect(restored.tags).toHaveLength(1);
  });

  it('update relinks tags: old links replaced by the new set', async () => {
    const tagA = await tagRepo.create(userId, {
      id: randomUUID(),
      name: `it-a-${randomUUID().slice(0, 8)}`,
      color: '#111111',
    });
    const tagB = await tagRepo.create(userId, {
      id: randomUUID(),
      name: `it-b-${randomUUID().slice(0, 8)}`,
      color: '#222222',
    });
    const created = await repo.create(userId, newTodo({ title: 'Relink', tagIds: [tagA.id] }));
    const updated = await repo.update(userId, created.id, {
      tagIds: [tagB.id, 'unknown-tag-id'],
    });
    expect(updated.tags.map((t) => t.id)).toEqual([tagB.id]); // unknown dropped, A removed
    const links = await db.select().from(todoTags).where(eq(todoTags.todoId, created.id));
    expect(links.map((link) => link.tagId)).toEqual([tagB.id]);
  });

  it('update never flips archived; archived column survives partial updates', async () => {
    const created = await repo.create(userId, newTodo({ title: 'Stay archived' }));
    await repo.setArchived(userId, created.id, true);
    const updated = await repo.update(userId, created.id, { title: 'Renamed while archived' });
    expect(updated.archived).toBe(true); // old bug #2 fixed: no silent unarchive
  });

  it('upsertImported: keeps the incoming id, reassigns the task number, upserts on rerun', async () => {
    const importedId = randomUUID();
    const first = await repo.upsertImported(userId, {
      id: importedId,
      title: 'Imported once',
      description: null,
      dueDate: '2026-05-01',
      dueTime: null,
      isCompleted: true,
      isFlagged: false,
      duration: 15,
      priority: 'low',
      subtasks: [],
      order: 0,
      recurrence: null,
      originalId: 'missing-original', // unresolvable → nulled (FK safety)
      tagIds: [],
    });
    expect(first.id).toBe(importedId);
    expect(first.isCompleted).toBe(true);
    expect(first.originalId).toBeNull();
    expect(first.taskNumber).toBeGreaterThan(0);

    const second = await repo.upsertImported(userId, {
      id: importedId,
      title: 'Imported twice',
      description: null,
      dueDate: null,
      dueTime: null,
      isCompleted: false,
      isFlagged: false,
      duration: 0,
      priority: 'medium',
      subtasks: [],
      order: 0,
      recurrence: null,
      originalId: null,
      tagIds: [],
    });
    expect(second.id).toBe(importedId);
    expect(second.title).toBe('Imported twice');
    expect(second.taskNumber).toBe(first.taskNumber); // overwrite keeps the number
    const rows = await db.select().from(todos).where(eq(todos.id, importedId));
    expect(rows).toHaveLength(1);
  });

  it('countActiveByUser excludes archived rows', async () => {
    const before = await repo.countActiveByUser(userId);
    const created = await repo.create(userId, newTodo({ title: 'Cap fixture' }));
    expect(await repo.countActiveByUser(userId)).toBe(before + 1);
    await repo.setArchived(userId, created.id, true);
    expect(await repo.countActiveByUser(userId)).toBe(before);
  });

  // Regression (round1 #4): the free-tier cap is enforced INSIDE the create
  // transaction (under the advisory lock), so concurrent creates can't jointly
  // cross it. A dedicated fresh user avoids interference from the shared rows.
  it('activeCap is enforced atomically: 199 seeded + 3 concurrent creates ⇒ exactly one succeeds', async () => {
    const capUser = `it-cap-${randomUUID()}`;
    await db.insert(users).values({ id: capUser, auth0Sub: capUser });
    try {
      await repo.createMany(
        capUser,
        Array.from({ length: 199 }, (_, i) => newTodo({ title: `seed-${i}` })),
      );
      expect(await repo.countActiveByUser(capUser)).toBe(199);

      const results = await Promise.allSettled(
        Array.from({ length: 3 }, (_, i) =>
          repo.create(capUser, newTodo({ title: `race-${i}` }), { activeCap: 200 }),
        ),
      );
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(ForbiddenError);
      }
      // Lands exactly at the cap — never over.
      expect(await repo.countActiveByUser(capUser)).toBe(200);
    } finally {
      await db.delete(users).where(eq(users.id, capUser));
    }
  });

  // Regression (round1 #1/#5, round2 #1): import is ONE transaction — a
  // mid-import failure rolls the replace-mode purge back, so pre-existing data
  // survives; a clean payload commits atomically.
  describe('atomic import (importAll)', () => {
    function importRow(over: Partial<ImportTodoInput> = {}): ImportTodoInput {
      return {
        id: randomUUID(),
        title: 'Imported',
        description: null,
        dueDate: null,
        dueTime: null,
        isCompleted: false,
        isFlagged: false,
        duration: 0,
        priority: 'medium',
        subtasks: [],
        order: 0,
        recurrence: null,
        originalId: null,
        tagRefs: [],
        ...over,
      };
    }

    it('rolls back the replace purge when a row write fails mid-transaction', async () => {
      const importUser = `it-import-${randomUUID()}`;
      await db.insert(users).values({ id: importUser, auth0Sub: importUser });
      try {
        const a = await repo.create(importUser, newTodo({ title: 'Original A' }));
        const b = await repo.create(importUser, newTodo({ title: 'Original B' }));
        expect(await repo.countActiveByUser(importUser)).toBe(2);

        // Force a DB-level failure on a MID-LIST row: a NUL byte in the title
        // is rejected by Postgres text (22021) — the use-case can't pre-catch it.
        const nulTitle = `bad${String.fromCharCode(0)}title`;
        await expect(
          repo.importAll(importUser, {
            replace: true,
            tags: [],
            generateTagId: randomUUID,
            todos: [
              importRow({ title: 'New 1' }),
              importRow({ title: nulTitle }),
              importRow({ title: 'New 3' }),
            ],
          }),
        ).rejects.toThrow();

        // Purge rolled back — both originals still present, nothing imported.
        const rows = await db.select().from(todos).where(eq(todos.userId, importUser));
        const titles = rows.map((row) => row.title).sort();
        expect(titles).toEqual(['Original A', 'Original B']);
        expect(rows.map((row) => row.id).sort()).toEqual([a.id, b.id].sort());
      } finally {
        await db.delete(users).where(eq(users.id, importUser));
      }
    });

    it('a valid replace import commits atomically (purge + writes)', async () => {
      const importUser = `it-import2-${randomUUID()}`;
      await db.insert(users).values({ id: importUser, auth0Sub: importUser });
      try {
        await repo.create(importUser, newTodo({ title: 'Original' }));
        const result = await repo.importAll(importUser, {
          replace: true,
          tags: [],
          generateTagId: randomUUID,
          todos: [importRow({ title: 'Fresh 1' }), importRow({ title: 'Fresh 2' })],
        });
        expect(result).toEqual({ importedCount: 2 });
        const rows = await db.select().from(todos).where(eq(todos.userId, importUser));
        expect(rows.map((row) => row.title).sort()).toEqual(['Fresh 1', 'Fresh 2']);
      } finally {
        await db.delete(users).where(eq(users.id, importUser));
      }
    });

    it('replace remaps default tags and creates custom tags inside the transaction', async () => {
      const importUser = `it-import3-${randomUUID()}`;
      await db.insert(users).values({ id: importUser, auth0Sub: importUser });
      try {
        const result = await repo.importAll(importUser, {
          replace: true,
          generateTagId: randomUUID,
          tags: [
            { oldId: 'old-work', name: 'Work', color: '#000000', isDefault: true },
            { oldId: 'old-custom', name: 'ImportedCustom', color: '#ABCDEF', isDefault: false },
          ],
          todos: [importRow({ title: 'Tagged', tagRefs: ['old-work', 'old-custom'] })],
        });
        expect(result.importedCount).toBe(1);
        const created = (await repo.list(importUser, { page: 1, pageSize: 50 })).items[0];
        const names = created?.tags.map((tag) => tag.name).sort();
        expect(names).toEqual(['ImportedCustom', 'Work']);
      } finally {
        await db.delete(users).where(eq(users.id, importUser));
      }
    });

    it('the ImportData use-case rejects a bad payload with ZERO writes (replace)', async () => {
      const importUser = `it-import4-${randomUUID()}`;
      await db.insert(users).values({ id: importUser, auth0Sub: importUser });
      try {
        await repo.create(importUser, newTodo({ title: 'Survivor' }));
        const importData = new ImportData({ todos: repo });
        const badSubtaskTitle = 'x'.repeat(501);
        await expect(
          importData.execute(importUser, {
            data: {
              todos: [{ title: 'ok 1' }, { title: 'bad', subtasks: [{ title: badSubtaskTitle }] }],
            },
            mode: 'replace',
          }),
        ).rejects.toThrow();
        // The pre-existing todo is untouched — purge never ran.
        const rows = await db.select().from(todos).where(eq(todos.userId, importUser));
        expect(rows.map((row) => row.title)).toEqual(['Survivor']);
      } finally {
        await db.delete(users).where(eq(users.id, importUser));
      }
    });
  });

  it('visible-tag scoping: a default tag links, a foreign custom tag is dropped', async () => {
    const otherUser = `it-other-${randomUUID()}`;
    await db.insert(users).values({ id: otherUser, auth0Sub: otherUser });
    try {
      const foreignTag = await tagRepo.create(otherUser, {
        id: randomUUID(),
        name: `it-foreign-${randomUUID().slice(0, 8)}`,
        color: '#333333',
      });
      const created = await repo.create(
        userId,
        newTodo({ title: 'Scoped tags', tagIds: ['default-work', foreignTag.id] }),
      );
      expect(created.tags.map((t) => t.id)).toEqual(['default-work']);
    } finally {
      await db.delete(users).where(eq(users.id, otherUser));
    }
  });

  it('tag repository guards: duplicate name conflicts, default rows untouchable', async () => {
    const name = `it-dup-${randomUUID().slice(0, 8)}`;
    await tagRepo.create(userId, { id: randomUUID(), name, color: '#444444' });
    await expect(
      tagRepo.create(userId, { id: randomUUID(), name: name.toUpperCase(), color: '#555555' }),
    ).rejects.toThrow('A tag with this name already exists.');
    // Row-scoped writes cannot touch defaults.
    await expect(tagRepo.update(userId, 'default-work', { name: 'nope' })).rejects.toThrow(
      'Tag not found.',
    );
    await tagRepo.delete(userId, 'default-work'); // silent no-op at repo level
    const defaults = await db.select().from(tags).where(eq(tags.id, 'default-work'));
    expect(defaults).toHaveLength(1);
  });
});
