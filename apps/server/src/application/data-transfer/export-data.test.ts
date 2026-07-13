import { describe, expect, it } from 'vitest';
import type { Tag } from '@lifeline/shared';
import type { CurrentUser } from '../ports.js';
import {
  InMemoryTagRepository,
  InMemoryTodoRepository,
} from '../../../test/helpers/feature-fakes.js';
import { CSV_HEADER, ExportData, buildTasksPerDay } from './export-data.js';

const FROZEN_NOW = new Date('2026-07-06T12:00:00.000Z');

function tag(id: string, name: string): Tag {
  return { id, name, color: '#3B82F6', userId: null, isDefault: true };
}

function makeUser(): CurrentUser {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'u1',
    email: 'u1@example.com',
    name: 'User One',
    picture: null,
    role: 'free',
    roles: ['free'],
    subscriptionStatus: 'none',
    profile: {
      userId: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: null,
      country: null,
      city: null,
      timezone: 'UTC',
      avatarUrl: null,
      onboardingCompleted: true,
      startDayOfWeek: 'Monday',
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      userId: 'u1',
      theme: 'dark',
      locale: 'en',
      layout: {},
      createdAt: now,
      updatedAt: now,
    },
  };
}

function build() {
  const tags = new InMemoryTagRepository();
  tags.seedDefaults();
  const todos = new InMemoryTodoRepository(tags);
  return {
    todos,
    tags,
    exportData: new ExportData({ todos, tags, dailyPlans: emptyPlanRepo }, () => FROZEN_NOW),
  };
}

const emptyPlanRepo = {
  getAllDays: () => Promise.resolve([]),
  getSettings: () => Promise.resolve(null),
};

describe('ExportData.buildJson', () => {
  it('emits the full payload: camelCase user block, todos, tags, stats', async () => {
    const { todos, exportData } = build();
    todos.seed('u1', {
      title: 'Exported',
      dueDate: '2026-07-01',
      duration: 30,
      isCompleted: true,
      tags: [tag('default-work', 'Work')],
    });
    todos.seed('u1', { title: 'Hidden', archived: true }); // non-archived only

    const payload = await exportData.buildJson(makeUser());
    expect(payload.exportedAt).toBe('2026-07-06T12:00:00.000Z');
    expect(payload.user).toEqual({
      id: 'u1',
      email: 'u1@example.com',
      profile: expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        startDayOfWeek: 'Monday',
        onboardingCompleted: true,
      }),
      settings: { theme: 'dark', locale: 'en', layout: {} },
    });
    expect(payload.todos).toHaveLength(1);
    expect(payload.todos[0]).toMatchObject({
      title: 'Exported',
      dueDate: '2026-07-01',
      isCompleted: true,
      tags: [{ id: 'default-work', name: 'Work', color: '#3B82F6' }], // trimmed tag shape
    });
    expect(payload.todos[0]).toHaveProperty('taskNumber');
    expect(payload.todos[0]).not.toHaveProperty('archived');
    // Visible tags with isDefault flag.
    expect(payload.tags).toHaveLength(10);
    expect(payload.tags[0]).toHaveProperty('isDefault');
    // Stats: totals + topTags + 30-day zero-filled series.
    expect(payload.stats).toMatchObject({
      totalTodos: 1,
      completedCount: 1,
      completionRate: 100,
      avgDuration: 30,
      timeSpentTotal: 30,
      topTags: [{ id: 'default-work', name: 'Work', color: '#3B82F6', count: 1 }],
    });
  });

  it('stats.tasksPerDay covers exactly the last 30 days, zero-filled', () => {
    const { todos } = build();
    todos.seed('u1', { dueDate: '2026-07-01' });
    todos.seed('u1', { dueDate: '2026-07-01' });
    todos.seed('u1', { dueDate: '2020-01-01' }); // outside the window
    const series = buildTasksPerDay(todos.rowsFor('u1'), FROZEN_NOW);
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ day: '2026-06-07', count: 0 });
    expect(series[29]).toEqual({ day: '2026-07-06', count: 0 });
    expect(series.find((entry) => entry.day === '2026-07-01')).toEqual({
      day: '2026-07-01',
      count: 2,
    });
    expect(series.reduce((sum, entry) => sum + entry.count, 0)).toBe(2);
  });
});

describe('ExportData.buildCsv', () => {
  it('starts with the exact header row', async () => {
    const { exportData } = build();
    const csv = await exportData.buildCsv('u1');
    expect(csv.split('\n')[0]).toBe(CSV_HEADER);
    expect(CSV_HEADER).toBe(
      'id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags,subtasks,recurrence',
    );
  });

  it('formats a plain row: 1/0 booleans, ;-joined tags, Title(done|pending) subtasks', async () => {
    const { todos, exportData } = build();
    todos.seed('u1', {
      id: 't1',
      title: 'Simple',
      description: null,
      dueDate: '2026-07-01',
      dueTime: '09:00',
      isCompleted: true,
      isFlagged: false,
      priority: 'high',
      duration: 30,
      tags: [tag('default-work', 'Work'), tag('default-personal', 'Home')],
      subtasks: [
        { subtaskId: 'a', title: 'A', isCompleted: true, position: 1 },
        { subtaskId: 'b', title: 'B', isCompleted: false, position: 2 },
      ],
    });
    const csv = await exportData.buildCsv('u1');
    expect(csv.split('\n')[1]).toBe(
      't1,Simple,,2026-07-01,09:00,1,0,high,30,Work;Home,A(done);B(pending),',
    );
  });

  it('RFC 4180-quotes cells containing commas, quotes, or newlines', async () => {
    const { todos, exportData } = build();
    todos.seed('u1', {
      id: 't2',
      title: 'Buy milk, eggs',
      description: 'line1\nline2',
    });
    todos.seed('u1', { id: 't3', title: 'He said "go"' });
    const csv = await exportData.buildCsv('u1');
    expect(csv).toContain('t2,"Buy milk, eggs","line1\nline2"');
    expect(csv).toContain('t3,"He said ""go"""');
  });

  it('recurrence keeps the old backslash-escaped JSON as the cell value', async () => {
    const { todos, exportData } = build();
    todos.seed('u1', { id: 't4', title: 'Recurring', recurrence: { mode: 'daily' } });
    const csv = await exportData.buildCsv('u1');
    const line = csv.split('\n').find((row) => row.startsWith('t4,'));
    // Value {\"mode\":\"daily\"} then RFC 4180 quoting doubles the quotes.
    expect(line?.endsWith(',"{\\""mode\\"":\\""daily\\""}"')).toBe(true);
  });

  it('excludes archived todos and ends with a trailing newline', async () => {
    const { todos, exportData } = build();
    todos.seed('u1', { title: 'Visible' });
    todos.seed('u1', { title: 'Archived', archived: true });
    const csv = await exportData.buildCsv('u1');
    const lines = csv.split('\n');
    expect(lines.at(-1)).toBe(''); // trailing newline
    expect(lines).toHaveLength(3); // header + 1 row + trailing
    expect(csv).not.toContain('Archived');
  });
});
