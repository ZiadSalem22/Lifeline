import { vi } from 'vitest';
import type { Me, Profile, Settings, Tag, Todo } from '@lifeline/shared';
import { GUEST_TAGS_KEY, GUEST_TODOS_KEY } from '../shared/guest/guest-api';

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    firstName: 'Ziyad',
    lastName: 'Salem',
    phone: null,
    country: null,
    city: null,
    timezone: null,
    avatarUrl: null,
    startDayOfWeek: 'Monday',
    onboardingCompleted: true,
    ...overrides,
  };
}

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: 'user-1',
    email: 'ziyad@example.com',
    name: 'Ziyad',
    picture: null,
    role: 'free',
    roles: [],
    subscriptionStatus: 'free',
    profile: makeProfile(),
    settings: null,
    ...overrides,
  };
}

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { theme: 'dark', locale: 'en', layout: {}, ...overrides };
}

let todoCounter = 0;

export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  todoCounter += 1;
  const now = '2026-07-01T00:00:00.000Z';
  return {
    id: `todo-${todoCounter}`,
    taskNumber: todoCounter,
    title: `Task ${todoCounter}`,
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
    habitId: null,
    originalId: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeTag(overrides: Partial<Tag> = {}): Tag {
  todoCounter += 1;
  return {
    id: `tag-${todoCounter}`,
    name: `Tag ${todoCounter}`,
    color: '#3B82F6',
    userId: 'user-1',
    isDefault: false,
    ...overrides,
  };
}

export function seedGuestTodos(todos: Todo[]): void {
  window.localStorage.setItem(GUEST_TODOS_KEY, JSON.stringify(todos));
}

export function seedGuestTags(tags: Tag[]): void {
  window.localStorage.setItem(GUEST_TAGS_KEY, JSON.stringify(tags));
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function emptyPage(): {
  items: never[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
} {
  return { items: [], page: 1, pageSize: 50, totalItems: 0, totalPages: 0 };
}

/** Parses a JSON request body from RequestInit (string bodies only). */
export function bodyOf(init?: RequestInit): unknown {
  return typeof init?.body === 'string' ? JSON.parse(init.body) : null;
}

export function problemResponse(status: number, code: string, detail?: string): Response {
  return new Response(
    JSON.stringify({ title: code, status, code, ...(detail ? { detail } : {}) }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export type FetchOverride = (
  pathname: string,
  method: string,
  init?: RequestInit,
) => Response | Promise<Response> | null;

/**
 * Installs a global fetch mock answering the common /api/v1 surface with
 * benign defaults (empty lists, echoing writes). An optional `override` runs
 * first — return a Response to intercept, or null to fall through. Returns
 * the mock for call inspection.
 */
export function installFetchMock(me: Me, override?: FetchOverride) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const pathname = new URL(url, 'http://localhost').pathname;
      const method = init?.method ?? 'GET';

      if (override) {
        const handled = await override(pathname, method, init);
        if (handled) return handled;
      }

      if (pathname === '/api/v1/me' && method === 'GET') return jsonResponse(me);
      if (pathname === '/api/v1/me/settings' && method === 'PUT') {
        return jsonResponse(makeSettings());
      }
      if (pathname === '/api/v1/me/profile' && method === 'PUT') {
        return jsonResponse(makeProfile());
      }
      if (pathname === '/api/v1/todos' && method === 'GET') return jsonResponse(emptyPage());
      if (pathname === '/api/v1/tags' && method === 'GET') return jsonResponse([]);
      if (pathname === '/api/v1/stats' && method === 'GET') {
        return jsonResponse({
          periodTotals: {
            totalTodos: 0,
            completedCount: 0,
            completionRate: 0,
            avgDuration: 0,
            timeSpentTotal: 0,
          },
          topTags: [],
          groups: [],
        });
      }
      if (pathname === '/api/v1/mcp-keys' && method === 'GET') return jsonResponse({ items: [] });

      return problemResponse(404, 'not_found');
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
