const API_URL = 'http://localhost:3000/api/todos';

export const searchTodos = async (params = {}) => {
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

    const url = `${API_URL}/search?${searchParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to search todos');
    return response.json();
};

export const fetchTodosForMonth = async (year, month, params = {}) => {
    // year: full year e.g. 2025, month: 1-12
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (Number.isNaN(y) || Number.isNaN(m)) throw new Error('Invalid year or month');
    // build startDate and endDate strings
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0); // last day of month
    const p = { ...(params || {}), startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10), limit: params.limit || 1000 };
    return searchTodos(p);
};

export const fetchTodos = async () => {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch todos');
    return response.json();
};

export const createTodo = async (title, dueDate, tags = [], isFlagged = false, duration = 0, priority = 'medium', dueTime = null, subtasks = [], description = '', recurrence = null) => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, dueDate, tags, isFlagged, duration, priority, dueTime, subtasks, description, recurrence }),
    });
    if (!response.ok) throw new Error('Failed to create todo');
    return response.json();
};

export const reorderTodo = async (id, order) => {
    const response = await fetch(`${API_URL}/${id}/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
    });
    if (!response.ok) throw new Error('Failed to reorder todo');
    return response.json();
};

export const updateTodo = async (id, updates) => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update todo');
    return response.json();
};

export const toggleTodo = async (id) => {
    const response = await fetch(`${API_URL}/${id}/toggle`, {
        method: 'PATCH',
    });
    if (!response.ok) throw new Error('Failed to toggle todo');
    return response.json();
};

export const toggleFlag = async (id) => {
    const response = await fetch(`${API_URL}/${id}/flag`, {
        method: 'PATCH',
    });
    if (!response.ok) throw new Error('Failed to toggle flag');
    return response.json();
};

export const deleteTodo = async (id) => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete todo');
};

// Export/Import APIs
export const exportTodos = async (format = 'json') => {
    const response = await fetch(`http://localhost:3000/api/export?format=${format}`);
    if (!response.ok) throw new Error('Failed to export todos');
    if (format === 'csv') {
        return response.text();
    }
    return response.json();
};

export const downloadExport = async (format = 'json') => {
    const response = await fetch(`http://localhost:3000/api/export?format=${format}`);
    if (!response.ok) throw new Error('Failed to export todos');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todos_export_${new Date().getTime()}.${format === 'csv' ? 'csv' : 'json'}`;
    link.click();
    window.URL.revokeObjectURL(url);
};

export const importTodos = async (data, mode = 'merge') => {
    const response = await fetch('http://localhost:3000/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, mode }),
    });
    if (!response.ok) throw new Error('Failed to import todos');
    return response.json();
};

// Notification APIs
export const getPendingNotifications = async () => {
    const response = await fetch('http://localhost:3000/api/notifications/pending');
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
};

export const scheduleNotification = async (todoId, minutesBefore = 0) => {
    const response = await fetch('http://localhost:3000/api/notifications/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoId, minutesBefore }),
    });
    if (!response.ok) throw new Error('Failed to schedule notification');
    return response.json();
};

export const markNotificationSent = async (notificationId) => {
    const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}/sent`, {
        method: 'PATCH',
    });
    if (!response.ok) throw new Error('Failed to mark notification as sent');
    return response.json();
};

export const deleteNotification = async (notificationId) => {
    const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete notification');
};

export const fetchTags = async () => {
    const response = await fetch('http://localhost:3000/api/tags');
    if (!response.ok) throw new Error('Failed to fetch tags');
    return response.json();
};

export const fetchStats = async () => {
    const response = await fetch('http://localhost:3000/api/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
};

export const createTag = async (name, color) => {
    const response = await fetch('http://localhost:3000/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
    });
    if (!response.ok) throw new Error('Failed to create tag');
    return response.json();
};

export const updateTag = async (id, name, color) => {
    const response = await fetch(`http://localhost:3000/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
    });
    if (!response.ok) throw new Error('Failed to update tag');
    return response.json();
};

export const deleteTag = async (id) => {
    const response = await fetch(`http://localhost:3000/api/tags/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete tag');
};
