import {
  INTERNAL_MCP_SHARED_SECRET_HEADER,
  MCP_PRINCIPAL_HEADERS,
} from '../constants.js';
import { BackendAdapterError } from '../errors.js';

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== null && typeof value !== 'undefined' && value !== ''));
}

function buildPrincipalHeaders(principal) {
  if (!principal) return {};

  return normalizeHeaders({
    [MCP_PRINCIPAL_HEADERS.subjectType]: principal.subjectType,
    [MCP_PRINCIPAL_HEADERS.lifelineUserId]: principal.lifelineUserId,
    [MCP_PRINCIPAL_HEADERS.authMethod]: principal.authMethod,
    [MCP_PRINCIPAL_HEADERS.scopes]: Array.isArray(principal.scopes) ? principal.scopes.join(',') : principal.scopes,
    [MCP_PRINCIPAL_HEADERS.subjectId]: principal.subjectId,
    [MCP_PRINCIPAL_HEADERS.displayName]: principal.displayName,
  });
}

function appendQuery(url, query = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'undefined' || value === null || value === '') continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      url.searchParams.set(key, value.join(','));
      continue;
    }

    url.searchParams.set(key, String(value));
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

function classifyErrorCode(status) {
  if (status === 400) return 'invalid_input';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'backend_unavailable';
  return 'backend_error';
}

export class LifelineBackendClient {
  constructor({ backendBaseUrl, internalSharedSecret, requestTimeoutMs = 5000, fetchImpl = fetch }) {
    this.backendBaseUrl = String(backendBaseUrl || '');
    this.internalSharedSecret = String(internalSharedSecret || '');
    this.requestTimeoutMs = requestTimeoutMs;
    this.fetchImpl = fetchImpl;
  }

  buildUrl(path, query = null) {
    const url = new URL(`/internal/mcp${path}`, this.backendBaseUrl);
    if (query) {
      appendQuery(url, query);
    }
    return url;
  }

  async request({ method = 'GET', path, principal = null, query = null, body = null }) {
    const url = this.buildUrl(path, query);
    const headers = normalizeHeaders({
      accept: 'application/json',
      'content-type': body ? 'application/json' : undefined,
      [INTERNAL_MCP_SHARED_SECRET_HEADER]: this.internalSharedSecret,
      ...buildPrincipalHeaders(principal),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const payload = await parseResponseBody(response);
      if (!response.ok) {
        throw new BackendAdapterError(
          payload?.message || `Backend request failed with status ${response.status}.`,
          {
            status: response.status,
            code: classifyErrorCode(response.status),
            details: payload,
          },
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof BackendAdapterError) {
        throw error;
      }

      if (error?.name === 'AbortError') {
        throw new BackendAdapterError('Backend request timed out.', {
          status: 504,
          code: 'backend_timeout',
        });
      }

      throw new BackendAdapterError('Backend request failed.', {
        status: 502,
        code: 'backend_network_error',
        details: { cause: error?.message || null },
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveApiKey(apiKey, metadata = {}) {
    return this.request({
      method: 'POST',
      path: '/auth/resolve-api-key',
      body: {
        apiKey,
        clientIp: metadata.clientIp || null,
        clientUserAgent: metadata.clientUserAgent || null,
      },
    });
  }

  async resolveOAuthPrincipal({ claims, scopes = [] }) {
    return this.request({
      method: 'POST',
      path: '/auth/resolve-oauth-principal',
      body: {
        claims,
        scopes,
      },
    });
  }

  async searchTasks(principal, filters = {}) {
    return this.request({
      method: 'GET',
      path: '/tasks/search',
      principal,
      query: filters,
    });
  }

  async getTaskByNumber(principal, taskNumber) {
    return this.request({
      method: 'GET',
      path: `/tasks/by-number/${encodeURIComponent(String(taskNumber))}`,
      principal,
    });
  }

  async listToday(principal) {
    return this.request({
      method: 'GET',
      path: '/tasks/day/today',
      principal,
    });
  }

  async listUpcoming(principal, options = {}) {
    return this.request({
      method: 'GET',
      path: '/tasks/upcoming',
      principal,
      query: options,
    });
  }

  async createTask(principal, payload) {
    return this.request({
      method: 'POST',
      path: '/tasks',
      principal,
      body: payload,
    });
  }

  async updateTask(principal, id, payload) {
    return this.request({
      method: 'PATCH',
      path: `/tasks/${encodeURIComponent(String(id))}`,
      principal,
      body: payload,
    });
  }

  async completeTask(principal, id) {
    return this.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(String(id))}/complete`,
      principal,
    });
  }

  async uncompleteTask(principal, id) {
    return this.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(String(id))}/uncomplete`,
      principal,
    });
  }

  async deleteTask(principal, id) {
    return this.request({
      method: 'DELETE',
      path: `/tasks/${encodeURIComponent(String(id))}`,
      principal,
    });
  }

  async getStatistics(principal) {
    return this.request({
      method: 'GET',
      path: '/tasks/statistics',
      principal,
    });
  }

  async exportTasks(principal) {
    return this.request({
      method: 'GET',
      path: '/tasks/export',
      principal,
    });
  }

  async listTags(principal) {
    return this.request({
      method: 'GET',
      path: '/tags',
      principal,
    });
  }

  async createTag(principal, payload) {
    return this.request({
      method: 'POST',
      path: '/tags',
      principal,
      body: payload,
    });
  }

  async updateTag(principal, id, payload) {
    return this.request({
      method: 'PATCH',
      path: `/tags/${encodeURIComponent(String(id))}`,
      principal,
      body: payload,
    });
  }

  async deleteTag(principal, id) {
    return this.request({
      method: 'DELETE',
      path: `/tags/${encodeURIComponent(String(id))}`,
      principal,
    });
  }

  async batchAction(principal, { action, taskNumbers }) {
    return this.request({
      method: 'POST',
      path: '/tasks/batch',
      principal,
      body: { action, taskNumbers },
    });
  }

  async restoreTask(principal, id) {
    return this.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(String(id))}/restore`,
      principal,
    });
  }

  async listTasksByWindow(principal, windowToken, options = {}) {
    return this.request({
      method: 'GET',
      path: `/tasks/window/${encodeURIComponent(String(windowToken))}`,
      principal,
      query: options,
    });
  }

  async findSimilarTasks(principal, options = {}) {
    return this.request({
      method: 'GET',
      path: '/tasks/similar',
      principal,
      query: options,
    });
  }

  async addSubtask(principal, taskId, payload) {
    return this.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(String(taskId))}/subtasks`,
      principal,
      body: payload,
    });
  }

  async completeSubtask(principal, taskId, subtaskId) {
    return this.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(String(taskId))}/subtasks/${encodeURIComponent(String(subtaskId))}/complete`,
      principal,
    });
  }

  async uncompleteSubtask(principal, taskId, subtaskId) {
    return this.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(String(taskId))}/subtasks/${encodeURIComponent(String(subtaskId))}/uncomplete`,
      principal,
    });
  }

  async updateSubtask(principal, taskId, subtaskId, payload) {
    return this.request({
      method: 'PATCH',
      path: `/tasks/${encodeURIComponent(String(taskId))}/subtasks/${encodeURIComponent(String(subtaskId))}`,
      principal,
      body: payload,
    });
  }

  async removeSubtask(principal, taskId, subtaskId) {
    return this.request({
      method: 'DELETE',
      path: `/tasks/${encodeURIComponent(String(taskId))}/subtasks/${encodeURIComponent(String(subtaskId))}`,
      principal,
    });
  }
}
