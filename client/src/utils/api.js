const API_BASE_ENV = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_ENV) {
    throw new Error('VITE_API_BASE_URL is not defined');
}

const API_BASE_URL = API_BASE_ENV.replace(/\/$/, '');

const joinUrl = (path) => {
    const p = path.startsWith('/') ? path : `/${path}`;
    // Avoid duplicate '/api' if API_BASE_URL already ends with '/api' and caller passed '/api/...'
    if (API_BASE_URL.endsWith('/api') && p.startsWith('/api')) {
        return `${API_BASE_URL}${p.replace(/^\/api/, '')}`;
    }
    return `${API_BASE_URL}${p}`;
};

const TODOS_URL = joinUrl('/todos');
const TAGS_URL = joinUrl('/tags');
const NOTIFICATIONS_URL = joinUrl('/notifications');
const STATS_URL = joinUrl('/stats');
const EXPORT_URL = joinUrl('/export');
const IMPORT_URL = joinUrl('/import');
const TODOS_BATCH_URL = joinUrl('/todos/batch');

const assertFetcher = (fetchWithAuth, caller) => {
    if (typeof fetchWithAuth !== 'function') {
        throw new Error(`${caller} requires fetchWithAuth`);
    }
    return fetchWithAuth;
};

const ensureOk = (response, message, context) => {
    if (!response.ok) {
        console.log('API ERROR STATUS:', response.status, context);
        throw new Error(message);
    }
    return response;
};

export const searchTodos = async (params = {}, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'searchTodos');
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.tags && params.tags.length) searchParams.set('tags', params.tags.join(','));
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.status) searchParams.set('status', params.status);
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (typeof params.flagged !== 'undefined') searchParams.set('flagged', params.flagged ? '1' : '0');
    if (params.minDuration) searchParams.set('minDuration', params.minDuration);
    if (params.maxDuration) searchParams.set('maxDuration', params.maxDuration);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);

    const response = await executeFetch(`${TODOS_URL}/search?${searchParams.toString()}`);
    ensureOk(response, 'Failed to search todos', 'searchTodos');
    return response.json();
};

export const fetchTodosForMonth = async (year, month, params = {}, fetchWithAuth) => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m)) throw new Error('Invalid year or month');
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const p = {
        ...(params || {}),
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        limit: params.limit || 1000,
    };
    return searchTodos(p, fetchWithAuth);
};

export const fetchTodos = async (fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'fetchTodos');
    const response = await executeFetch(TODOS_URL);
    ensureOk(response, 'Failed to fetch todos', 'fetchTodos');
    return response.json();
};

export const createTodo = async (title, dueDate, tags = [], isFlagged = false, duration = 0, priority = 'medium', dueTime = null, subtasks = [], description = '', recurrence = null, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'createTodo');
    const response = await executeFetch(TODOS_URL, {
        method: 'POST',
        body: JSON.stringify({ title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence }),
    });
    ensureOk(response, 'Failed to create todo', 'createTodo');
    return response.json();
};

export const reorderTodo = async (id, order, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'reorderTodo');
    const response = await executeFetch(`${TODOS_URL}/${id}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ order }),
    });
    ensureOk(response, 'Failed to reorder todo', 'reorderTodo');
    return response.json();
};

export const updateTodo = async (id, updates, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'updateTodo');
    const response = await executeFetch(`${TODOS_URL}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
    ensureOk(response, 'Failed to update todo', 'updateTodo');
    return response.json();
};

export const toggleTodo = async (id, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'toggleTodo');
    const response = await executeFetch(`${TODOS_URL}/${id}/toggle`, {
        method: 'PATCH',
    });
    ensureOk(response, 'Failed to toggle todo', 'toggleTodo');
    return response.json();
};

export const toggleFlag = async (id, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'toggleFlag');
    const response = await executeFetch(`${TODOS_URL}/${id}/flag`, {
        method: 'PATCH',
    });
    ensureOk(response, 'Failed to toggle flag', 'toggleFlag');
    return response.json();
};

export const deleteTodo = async (id, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'deleteTodo');
    const response = await executeFetch(`${TODOS_URL}/${id}`, {
        method: 'DELETE',
    });
    ensureOk(response, 'Failed to delete todo', 'deleteTodo');
};

export const batchTodos = async (action, ids, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'batchTodos');
    const response = await executeFetch(TODOS_BATCH_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ids }),
    });
    ensureOk(response, 'Failed to batch update todos', 'batchTodos');
    return response.json();
};

export const exportTodos = async (format = 'json', fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'exportTodos');
    const response = await executeFetch(`${EXPORT_URL}?format=${format}`);
    ensureOk(response, 'Failed to export todos', 'exportTodos');
    if (format === 'csv') {
        return response.text();
    }
    return response.json();
};

export const downloadExport = async (format = 'json', fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'downloadExport');
    const response = await executeFetch(`${EXPORT_URL}?format=${format}`);
    ensureOk(response, 'Failed to export todos', 'downloadExport');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todos_export_${new Date().getTime()}.${format === 'csv' ? 'csv' : 'json'}`;
    link.click();
    window.URL.revokeObjectURL(url);
};

export const importTodos = async (data, mode = 'merge', fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'importTodos');
    const response = await executeFetch(IMPORT_URL, {
        method: 'POST',
        body: JSON.stringify({ data, mode }),
    });
    ensureOk(response, 'Failed to import todos', 'importTodos');
    return response.json();
};

export const getPendingNotifications = async (fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'getPendingNotifications');
    const response = await executeFetch(`${NOTIFICATIONS_URL}/pending`);
    ensureOk(response, 'Failed to fetch notifications', 'getPendingNotifications');
    return response.json();
};

export const scheduleNotification = async (todoId, minutesBefore = 0, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'scheduleNotification');
    const response = await executeFetch(`${NOTIFICATIONS_URL}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ todoId, minutesBefore }),
    });
    ensureOk(response, 'Failed to schedule notification', 'scheduleNotification');
    return response.json();
};

export const markNotificationSent = async (notificationId, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'markNotificationSent');
    const response = await executeFetch(`${NOTIFICATIONS_URL}/${notificationId}/sent`, {
        method: 'PATCH',
    });
    ensureOk(response, 'Failed to mark notification as sent', 'markNotificationSent');
    return response.json();
};

export const deleteNotification = async (notificationId, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'deleteNotification');
    const response = await executeFetch(`${NOTIFICATIONS_URL}/${notificationId}`, {
        method: 'DELETE',
    });
    ensureOk(response, 'Failed to delete notification', 'deleteNotification');
};

export const fetchTags = async (fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'fetchTags');
    const response = await executeFetch(TAGS_URL);
    ensureOk(response, 'Failed to fetch tags', 'fetchTags');
    return response.json();
};

export const fetchStats = async (fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'fetchStats');
    const response = await executeFetch(STATS_URL);
    ensureOk(response, 'Failed to fetch stats', 'fetchStats');
    return response.json();
};

export const createTag = async (name, color, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'createTag');
    const response = await executeFetch(TAGS_URL, {
        method: 'POST',
        body: JSON.stringify({ name, color }),
    });
    ensureOk(response, 'Failed to create tag', 'createTag');
    return response.json();
};

export const updateTag = async (id, name, color, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'updateTag');
    const response = await executeFetch(`${TAGS_URL}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, color }),
    });
    ensureOk(response, 'Failed to update tag', 'updateTag');
    return response.json();
};

export const deleteTag = async (id, fetchWithAuth) => {
    const executeFetch = assertFetcher(fetchWithAuth, 'deleteTag');
    const response = await executeFetch(`${TAGS_URL}/${id}`, {
        method: 'DELETE',
    });
    ensureOk(response, 'Failed to delete tag', 'deleteTag');
};
