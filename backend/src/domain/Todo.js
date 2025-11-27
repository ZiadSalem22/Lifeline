class Todo {
    constructor(id, title, isCompleted = false, dueDate = null, tags = [], isFlagged = false, duration = 0, priority = 'medium', dueTime = null, subtasks = [], order = 0, description = '', recurrence = null, nextRecurrenceDue = null, originalId = null, userId = null) {
        if (!title) throw new Error('Title cannot be empty');
        this.id = id;
        this.title = title;
        this.isCompleted = isCompleted;
        this.dueDate = dueDate;
        this.tags = tags;
        this.isFlagged = isFlagged;
        this.duration = duration;
        this.priority = priority; // 'high', 'medium', 'low'
        this.dueTime = dueTime; // Time string (HH:mm)
        this.subtasks = subtasks; // Array of {id, title, isCompleted}
        this.order = order; // For drag & drop ordering
        this.description = description || '';
        this.recurrence = recurrence; // { type: 'daily'|'weekly'|'monthly'|'custom', endDate: null|string, interval: 1 }
        this.nextRecurrenceDue = nextRecurrenceDue; // ISO string of when next recurrence is due
        this.originalId = originalId; // For tracking recurring task originals
        this.userId = userId; // Owner user id
    }

    toggle() {
        this.isCompleted = !this.isCompleted;
    }

    toggleFlag() {
        this.isFlagged = !this.isFlagged;
    }

    getRecurrencePattern() {
        if (!this.recurrence) return null;
        return {
            type: this.recurrence.type,
            interval: this.recurrence.interval || 1,
            endDate: this.recurrence.endDate,
            daysOfWeek: this.recurrence.daysOfWeek // For weekly recurrence
        };
    }
}

module.exports = Todo;
