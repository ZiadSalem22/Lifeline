import { problemSchema, PROBLEM_CONTENT_TYPE } from '@lifeline/shared';
import type { ErrorCode, Problem } from '@lifeline/shared';

/**
 * Typed fetch wrapper for the v1 API.
 *
 * Base URL = (VITE_API_BASE_URL ?? '') + '/api/v1' — empty base means
 * same-origin (dev proxy / production SPA serving).
 *
 * Auth is injected: the auth provider registers an async token supplier via
 * {@link setTokenSupplier}; when it yields a token, requests carry
 * `Authorization: Bearer <token>`.
 */

export type TokenSupplier = () => Promise<string | null>;

const nullSupplier: TokenSupplier = () => Promise.resolve(null);

let tokenSupplier: TokenSupplier = nullSupplier;

export function setTokenSupplier(supplier: TokenSupplier | null): void {
  tokenSupplier = supplier ?? nullSupplier;
}

export const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`;

/** RFC 7807 problem+json aware error. `problem` is null for non-problem bodies. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly problem: Problem | null;

  constructor(message: string, status: number, problem: Problem | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem?.code ?? null;
    this.problem = problem;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes(PROBLEM_CONTENT_TYPE) || contentType.includes('application/json')) {
    try {
      const payload: unknown = await response.json();
      const parsed = problemSchema.safeParse(payload);
      if (parsed.success) {
        return new ApiError(parsed.data.detail ?? parsed.data.title, response.status, parsed.data);
      }
    } catch {
      // fall through to the generic error below
    }
  }
  return new ApiError(`Request failed with status ${response.status}`, response.status, null);
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await tokenSupplier();
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json();
  return data as T;
}

/** Authenticated GET returning the raw body as a Blob (export downloads). */
async function getBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = await tokenSupplier();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers });
  if (!response.ok) throw await toApiError(response);
  return response.blob();
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>('PATCH', path, body),
  del: <T = void>(path: string): Promise<T> => request<T>('DELETE', path),
  getBlob,
};
