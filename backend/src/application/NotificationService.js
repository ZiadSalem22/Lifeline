/**
 * NotificationService
 * Notifications are intentionally disabled in the PostgreSQL-only Phase 3 runtime.
 */
class NotificationService {
    constructor() {
        this.disabledReason = 'Notifications are not supported in the PostgreSQL-only local runtime.';
    }

    getDisabledResponse() {
        return { disabled: true, reason: this.disabledReason };
    }

    /**
     * Schedule a notification for a todo
     * @param {Object} todo - The todo object
     * @param {number} minutesBefore - How many minutes before due date/time to notify
     */
    scheduleNotification(todo, minutesBefore = 0) {
        return null;
    }

    /**
     * Get notification text for a todo
     */
    getNotificationMessage(todo) {
        return null;
    }

    /**
     * Save notification to database
     */
    saveNotification(todoId, message, scheduledTime) {
        return Promise.resolve(null);
    }

    /**
     * Mark notification as sent
     */
    markNotificationSent(notificationId) {
        return Promise.resolve();
    }

    /**
     * Get pending notifications
     */
    getPendingNotifications() {
        return Promise.resolve([]);
    }

    /**
     * Delete notification
     */
    deleteNotification(notificationId) {
        return Promise.resolve();
    }

    /**
     * Delete all notifications for a todo
     */
    deleteNotificationsForTodo(todoId) {
        return Promise.resolve();
    }
}

module.exports = NotificationService;
