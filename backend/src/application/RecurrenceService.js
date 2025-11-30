const { v4: uuidv4 } = require('uuid');
const { addDays, addWeeks, addMonths, format, parse, getDay } = require('date-fns');

class RecurrenceService {
    /**
     * Calculate the next due date for a recurring task
     */
    static calculateNextDueDate(currentDueDate, recurrence) {
        if (!recurrence || !currentDueDate) return null;

        const current = new Date(currentDueDate + 'T00:00:00');
        let next;

        // Handle new recurrence modes
        if (recurrence.mode === 'daily') {
            next = addDays(current, 1);
        } else if (recurrence.mode === 'dateRange') {
            // For date range, keep adding 1 day until we exceed endDate
            next = addDays(current, 1);
            if (recurrence.endDate) {
                const endDate = new Date(recurrence.endDate + 'T00:00:00');
                if (next > endDate) {
                    return null; // Recurrence has ended
                }
            }
        } else if (recurrence.mode === 'specificDays') {
            // Find next occurrence on selected days
            next = addDays(current, 1);
            const maxDaysToCheck = 365;
            let daysChecked = 0;

            while (daysChecked < maxDaysToCheck) {
                const dayName = this.getDayName(getDay(next));
                if (recurrence.selectedDays && recurrence.selectedDays.includes(dayName)) {
                    break;
                }
                next = addDays(next, 1);
                daysChecked++;
            }

            if (daysChecked >= maxDaysToCheck) {
                return null; // No valid day found in next year
            }
        } else {
            // Legacy mode handling
            switch (recurrence.type) {
                case 'daily':
                    next = addDays(current, recurrence.interval || 1);
                    break;
                case 'weekly':
                    next = addWeeks(current, recurrence.interval || 1);
                    break;
                case 'monthly':
                    next = addMonths(current, recurrence.interval || 1);
                    break;
                case 'custom':
                    next = addDays(current, recurrence.interval || 1);
                    break;
                default:
                    return null;
            }

            // Check if next date is past the end date
            if (recurrence.endDate) {
                const endDate = new Date(recurrence.endDate + 'T00:00:00');
                if (next > endDate) {
                    return null;
                }
            }
        }

        return format(next, 'yyyy-MM-dd');
    }

    /**
     * Convert JS day number (0=Sun, 1=Mon, etc.) to day name
     */
    static getDayName(dayNumber) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayNumber];
    }

    /**
     * Check which recurring tasks need to be processed
     */
    static shouldCreateRecurrence(dueDate, isCompleted) {
        if (!isCompleted || !dueDate) return false;

        // Task was completed and has a due date
        return true;
    }

    /**
     * Create a new task instance from a recurring task
     */
    static createNextOccurrence(parentTodo) {
        if (!parentTodo.recurrence) return null;

        const nextDueDate = this.calculateNextDueDate(parentTodo.dueDate, parentTodo.recurrence);
        if (!nextDueDate) return null; // Recurrence ended

        const newId = uuidv4();

        return {
            id: newId,
            title: parentTodo.title,
            description: parentTodo.description,
            dueDate: nextDueDate,
            dueTime: parentTodo.dueTime,
            tags: parentTodo.tags,
            isFlagged: parentTodo.isFlagged,
            duration: parentTodo.duration,
            priority: parentTodo.priority,
            isCompleted: false,
            subtasks: (parentTodo.subtasks || []).map(st => ({
                ...st,
                isCompleted: false, // Reset subtasks for new occurrence
                id: uuidv4()
            })),
            recurrence: parentTodo.recurrence,
            originalId: parentTodo.originalId || parentTodo.id, // Track the original recurring task
            nextRecurrenceDue: null
        };
    }

    /**
     * Get display text for recurrence pattern
     */
    static getRecurrenceText(recurrence) {
        if (!recurrence) return null;

        // Handle new recurrence modes
        if (recurrence.mode === 'daily') {
            return 'Daily';
        } else if (recurrence.mode === 'dateRange') {
            const start = recurrence.startDate ? new Date(recurrence.startDate).toLocaleDateString() : '?';
            const end = recurrence.endDate ? new Date(recurrence.endDate).toLocaleDateString() : '?';
            return `${start} → ${end}`;
        } else if (recurrence.mode === 'specificDays') {
            if (recurrence.selectedDays && recurrence.selectedDays.length > 0) {
                const shortDays = recurrence.selectedDays.map(day => day.substring(0, 3)).join(', ');
                return shortDays;
            }
            return 'Specific days';
        }

        // Legacy mode handling
        const interval = recurrence.interval || 1;

        switch (recurrence.type) {
            case 'daily':
                return interval > 1 ? `Every ${interval} days` : 'Daily';
            case 'weekly':
                return interval > 1 ? `Every ${interval} weeks` : 'Weekly';
            case 'monthly':
                return interval > 1 ? `Every ${interval} months` : 'Monthly';
            case 'custom':
                return `Every ${interval} days (Custom)`;
            default:
                return null;
        }
    }
}

module.exports = RecurrenceService;
