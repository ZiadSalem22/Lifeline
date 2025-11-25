/**
 * NotificationService
 * Handles scheduling and management of browser notifications
 */
class NotificationService {
    constructor(db) {
        this.db = db;
        this.activeNotifications = new Map();
        this.initializeNotificationTable();
    }

    initializeNotificationTable() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                todo_id TEXT NOT NULL,
                message TEXT NOT NULL,
                scheduled_time TEXT NOT NULL,
                sent_time TEXT,
                is_sent INTEGER DEFAULT 0,
                FOREIGN KEY(todo_id) REFERENCES todos(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating notifications table:', err);
            }
        });
    }

    /**
     * Schedule a notification for a todo
     * @param {Object} todo - The todo object
     * @param {number} minutesBefore - How many minutes before due date/time to notify
     */
    scheduleNotification(todo, minutesBefore = 0) {
        if (!todo.dueDate) return null;

        try {
            let scheduledTime = new Date(todo.dueDate + 'T00:00:00');

            // Add time if available
            if (todo.dueTime) {
                const [hours, minutes] = todo.dueTime.split(':').map(Number);
                scheduledTime.setHours(hours, minutes, 0);
            }

            // Subtract minutes before
            scheduledTime = new Date(scheduledTime.getTime() - minutesBefore * 60000);

            const now = new Date();
            if (scheduledTime <= now) {
                // Already due or in the past
                return null;
            }

            const delayMs = scheduledTime.getTime() - now.getTime();

            return {
                scheduledTime: scheduledTime.toISOString(),
                delayMs
            };
        } catch (error) {
            console.error('Error scheduling notification:', error);
            return null;
        }
    }

    /**
     * Get notification text for a todo
     */
    getNotificationMessage(todo) {
        let message = `Task Due: ${todo.title}`;

        if (todo.priority) {
            message += ` [${todo.priority.toUpperCase()}]`;
        }

        if (todo.description) {
            const desc = todo.description.substring(0, 50);
            message += `\n${desc}${todo.description.length > 50 ? '...' : ''}`;
        }

        return message;
    }

    /**
     * Save notification to database
     */
    saveNotification(todoId, message, scheduledTime) {
        return new Promise((resolve, reject) => {
            const { v4: uuidv4 } = require('uuid');
            const notificationId = uuidv4();

            const stmt = this.db.prepare(
                'INSERT INTO notifications (id, todo_id, message, scheduled_time, is_sent) VALUES (?, ?, ?, ?, ?)'
            );
            stmt.run(notificationId, todoId, message, scheduledTime, 0, (err) => {
                if (err) reject(err);
                else resolve(notificationId);
            });
            stmt.finalize();
        });
    }

    /**
     * Mark notification as sent
     */
    markNotificationSent(notificationId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(
                'UPDATE notifications SET is_sent = 1, sent_time = ? WHERE id = ?'
            );
            stmt.run(new Date().toISOString(), notificationId, (err) => {
                if (err) reject(err);
                else resolve();
            });
            stmt.finalize();
        });
    }

    /**
     * Get pending notifications
     */
    getPendingNotifications() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM notifications WHERE is_sent = 0 AND scheduled_time <= datetime("now") ORDER BY scheduled_time ASC',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Delete notification
     */
    deleteNotification(notificationId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM notifications WHERE id = ?', [notificationId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Delete all notifications for a todo
     */
    deleteNotificationsForTodo(todoId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM notifications WHERE todo_id = ?', [todoId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = NotificationService;
