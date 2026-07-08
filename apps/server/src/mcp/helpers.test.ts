import { describe, expect, it } from 'vitest';
import type { Todo } from '@lifeline/shared';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { McpScopeError, McpToolInputError, normalizeToolError } from './errors.js';
import {
  resolveCreateDueDate,
  resolveNaturalLanguageDueDate,
  resolveUpdateDueDate,
} from './due-date.js';
import { createMcpRateLimiter } from './rate-limit.js';
import { normalizeTask } from './payloads.js';
import {
  createToolErrorResult,
  formatSingleTaskPreview,
  formatTaskListPreview,
} from './previews.js';
import {
  buildNormalizedPrincipal,
  hasRequiredScope,
  looksLikeJwt,
  resolveMcpOAuthConfig,
} from './auth.js';
import { parseEnv } from '../config/env.js';
import { resolveWindowToken, weekStartIndexFrom } from './windows.js';

/** Wednesday 2026-07-08 (UTC) — fixed clock for date-math goldens. */
const NOW = new Date('2026-07-08T12:00:00.000Z');

function makeTodo(partial: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    taskNumber: 7,
    title: 'Test task',
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
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    ...partial,
  };
}

describe('due-date natural language resolution', () => {
  it('resolves the documented tokens (UTC)', () => {
    expect(resolveNaturalLanguageDueDate('today', NOW)).toBe('2026-07-08');
    expect(resolveNaturalLanguageDueDate('Tomorrow', NOW)).toBe('2026-07-09');
    expect(resolveNaturalLanguageDueDate('yesterday', NOW)).toBe('2026-07-07');
    expect(resolveNaturalLanguageDueDate('in 3 days', NOW)).toBe('2026-07-11');
    expect(resolveNaturalLanguageDueDate('in 1 day', NOW)).toBe('2026-07-09');
    // NOW is a Wednesday; "next wednesday" must jump a full week.
    expect(resolveNaturalLanguageDueDate('next wednesday', NOW)).toBe('2026-07-15');
    expect(resolveNaturalLanguageDueDate('next monday', NOW)).toBe('2026-07-13');
  });

  it('passes explicit dates and unknown strings through', () => {
    expect(resolveNaturalLanguageDueDate('2026-12-24', NOW)).toBe('2026-12-24');
    expect(resolveNaturalLanguageDueDate('someday', NOW)).toBe('someday');
  });

  it('create: missing/empty dueDate defaults to today, explicit null stays null', () => {
    expect(resolveCreateDueDate(undefined, NOW)).toBe('2026-07-08');
    expect(resolveCreateDueDate('', NOW)).toBe('2026-07-08');
    expect(resolveCreateDueDate(null, NOW)).toBeNull();
    expect(resolveCreateDueDate('tomorrow', NOW)).toBe('2026-07-09');
  });

  it("update: '' clears to null, values resolve", () => {
    expect(resolveUpdateDueDate('', NOW)).toBeNull();
    expect(resolveUpdateDueDate(null, NOW)).toBeNull();
    expect(resolveUpdateDueDate('in 2 days', NOW)).toBe('2026-07-10');
  });
});

describe('window token resolution', () => {
  it('honors weekStartsOn for this_week (fixes the hardcoded-Sunday bug)', () => {
    expect(resolveWindowToken('this_week', NOW, { weekStartsOn: 1 })).toEqual({
      start: '2026-07-06',
      end: '2026-07-12',
    });
    expect(resolveWindowToken('this_week', NOW, { weekStartsOn: 0 })).toEqual({
      start: '2026-07-05',
      end: '2026-07-11',
    });
  });

  it('resolves next_week, months, overdue, and YYYY-MM', () => {
    expect(resolveWindowToken('next_week', NOW, { weekStartsOn: 1 })).toEqual({
      start: '2026-07-13',
      end: '2026-07-19',
    });
    expect(resolveWindowToken('this_month', NOW)).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
    expect(resolveWindowToken('next_month', NOW)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    });
    expect(resolveWindowToken('overdue', NOW)).toEqual({
      start: '2000-01-01',
      end: '2026-07-07',
    });
    expect(resolveWindowToken('2026-02', NOW)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('rejects unknown tokens with invalid_input', () => {
    expect(() => resolveWindowToken('sometime', NOW)).toThrowError(McpToolInputError);
  });

  it('maps week-start preference values', () => {
    expect(weekStartIndexFrom('Sunday')).toBe(0);
    expect(weekStartIndexFrom('monday')).toBe(1);
    expect(weekStartIndexFrom(6)).toBe(6);
    expect(weekStartIndexFrom(7)).toBeNull();
    expect(weekStartIndexFrom('noonday')).toBeNull();
    expect(weekStartIndexFrom(undefined)).toBeNull();
  });
});

describe('rate limiter (per-principal fixed window)', () => {
  it('caps per key and isolates buckets', () => {
    let time = 0;
    const limiter = createMcpRateLimiter({ limit: 3, windowMs: 60_000, now: () => time });
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(true);
    const blocked = limiter.hit('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    // Different principal — separate bucket (the old bug shared one).
    expect(limiter.hit('b').allowed).toBe(true);
    // Window rolls over.
    time = 61_000;
    expect(limiter.hit('a').allowed).toBe(true);
  });
});

describe('tool error mapping', () => {
  it('maps domain errors onto the old code/status vocabulary', () => {
    expect(normalizeToolError(new NotFoundError('Task not found.'))).toMatchObject({
      code: 'not_found',
      status: 404,
    });
    expect(normalizeToolError(new ConflictError('archived'))).toMatchObject({
      code: 'conflict',
      status: 409,
    });
    expect(normalizeToolError(new McpScopeError('missing scope'))).toMatchObject({
      code: 'scope_denied',
      status: 403,
    });
    expect(normalizeToolError(new McpToolInputError('bad'))).toMatchObject({
      code: 'invalid_input',
      status: 400,
    });
    expect(normalizeToolError(new Error('boom'))).toMatchObject({
      code: 'tool_execution_failed',
      status: 500,
    });
  });

  it('renders the old error-result shape', () => {
    const result = createToolErrorResult(new McpToolInputError('Provide taskNumber or id.'));
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('Provide taskNumber or id. (invalid_input)');
    expect(result.structuredContent.error).toMatchObject({
      code: 'invalid_input',
      status: 400,
      message: 'Provide taskNumber or id.',
      details: null,
    });
  });
});

describe('previews', () => {
  it('formats the old task line: #N | title | state | due | priority | Xm | tags | flagged', () => {
    const task = normalizeTask(
      makeTodo({
        taskNumber: 12,
        title: 'Ship report',
        dueDate: '2026-07-09',
        dueTime: '14:30',
        priority: 'high',
        duration: 45,
        isFlagged: true,
        tags: [
          { id: 't1', name: 'Work', color: '#111111', userId: null, isDefault: true },
          { id: 't2', name: 'Urgent', color: '#222222', userId: 'user-1', isDefault: false },
        ],
      }),
    );
    expect(formatTaskListPreview([task])).toBe(
      [
        '1 task(s)',
        '#12 | Ship report | active | due 2026-07-09 14:30 | high | 45m | tags: Work, Urgent | flagged',
      ].join('\n'),
    );
  });

  it('caps list previews at 5 with the Showing N of M hint', () => {
    const tasks = Array.from({ length: 8 }, (_, index) =>
      normalizeTask(makeTodo({ taskNumber: index + 1, title: `Task ${index + 1}` })),
    );
    const preview = formatTaskListPreview(tasks, { total: 8, label: 'Search results' });
    const lines = preview.split('\n');
    expect(lines[0]).toBe('Search results: 8 task(s)');
    expect(lines).toHaveLength(7); // header + 5 tasks + hint
    expect(lines[6]).toBe(
      'Showing 5 of 8 tasks. Use get_task with taskNumber for full detail or refine filters.',
    );
  });

  it('single-task preview includes the subtask checklist with subtaskId UUIDs', () => {
    const task = normalizeTask(
      makeTodo({
        subtasks: [
          {
            subtaskId: '3fa9e0f6-1111-4222-8333-444455556666',
            title: 'Step one',
            isCompleted: true,
            position: 1,
          },
          {
            subtaskId: '3fa9e0f6-7777-4888-9999-000011112222',
            title: 'Step two',
            isCompleted: false,
            position: 2,
          },
        ],
        archived: true,
      }),
    );
    const preview = formatSingleTaskPreview(task);
    expect(preview).toContain('Subtasks: 1/2 completed');
    expect(preview).toContain('  [x] Step one (3fa9e0f6-1111-4222-8333-444455556666)');
    expect(preview).toContain('  [ ] Step two (3fa9e0f6-7777-4888-9999-000011112222)');
    expect(preview).toContain('Archived: yes');
  });
});

describe('payload normalization', () => {
  it('emits the exact old key set with real timestamps and id-aliased subtasks', () => {
    const payload = normalizeTask(
      makeTodo({
        description: null,
        subtasks: [
          {
            subtaskId: 'aaaa1111-2222-4333-8444-555566667777',
            title: 'A',
            isCompleted: false,
            position: 1,
          },
        ],
      }),
    );
    expect(Object.keys(payload)).toEqual([
      'id',
      'taskNumber',
      'title',
      'description',
      'dueDate',
      'dueTime',
      'isCompleted',
      'isFlagged',
      'duration',
      'priority',
      'tags',
      'subtasks',
      'recurrence',
      'nextRecurrenceDue',
      'originalId',
      'archived',
      'createdAt',
      'updatedAt',
    ]);
    expect(payload.description).toBe('');
    expect(payload.nextRecurrenceDue).toBeNull();
    expect(payload.createdAt).toBe('2026-07-01T00:00:00.000Z');
    expect(payload.subtasks[0]).toMatchObject({
      subtaskId: 'aaaa1111-2222-4333-8444-555566667777',
      id: 'aaaa1111-2222-4333-8444-555566667777',
    });
  });
});

describe('principal + scopes', () => {
  const principal = buildNormalizedPrincipal({
    subjectType: 'api_key',
    lifelineUserId: 'user-1',
    authMethod: 'api_key',
    scopes: ['tasks:read'],
    subjectId: 'key-1',
    displayName: 'Test',
  });

  it('freezes the principal and normalizes scopes', () => {
    expect(Object.isFrozen(principal)).toBe(true);
    expect(principal.scopes).toEqual(['tasks:read']);
  });

  it('honors scope wildcards tasks:* and *', () => {
    expect(hasRequiredScope(principal, ['tasks:read'])).toBe(true);
    expect(hasRequiredScope(principal, ['tasks:write'])).toBe(false);
    const wildcard = buildNormalizedPrincipal({ ...principal, scopes: ['tasks:*'] });
    expect(hasRequiredScope(wildcard, ['tasks:write'])).toBe(true);
    const all = buildNormalizedPrincipal({ ...principal, scopes: ['*'] });
    expect(hasRequiredScope(all, ['tasks:write'])).toBe(true);
  });

  it('looksLikeJwt only matches three base64url segments', () => {
    expect(looksLikeJwt('aaa.bbb.ccc')).toBe(true);
    expect(looksLikeJwt('lk_0a1b2c3d.secretsecret')).toBe(false);
  });

  it('resolves OAuth config from MCP_AUTH0_* with AUTH0_* fallbacks', () => {
    const enabled = resolveMcpOAuthConfig(
      parseEnv({
        NODE_ENV: 'test',
        MCP_AUTH0_DOMAIN: 'tenant.auth0.com',
        MCP_AUTH0_AUDIENCE: 'https://lifeline-api',
      }),
    );
    expect(enabled.enabled).toBe(true);
    expect(enabled.issuerUrl).toBe('https://tenant.auth0.com/');
    expect(enabled.jwksUri).toBe('https://tenant.auth0.com/.well-known/jwks.json');

    const fallback = resolveMcpOAuthConfig(
      parseEnv({
        NODE_ENV: 'test',
        AUTH0_DOMAIN: 'https://fallback.auth0.com/',
        AUTH0_AUDIENCE: 'aud-a,aud-b',
      }),
    );
    expect(fallback.enabled).toBe(true);
    expect(fallback.issuerUrl).toBe('https://fallback.auth0.com/');
    expect(fallback.audiences).toEqual(['aud-a', 'aud-b']);

    const disabled = resolveMcpOAuthConfig(parseEnv({ NODE_ENV: 'test' }));
    expect(disabled.enabled).toBe(false);
  });
});
