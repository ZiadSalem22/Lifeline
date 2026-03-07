const CreateTodo = require('../../src/application/CreateTodo');
const CompleteRecurringTodo = require('../../src/application/CompleteRecurringTodo');
const RecurrenceService = require('../../src/application/RecurrenceService');
const Todo = require('../../src/domain/Todo');

class MockTodoRepository {
    constructor() {
        this.todos = [];
    }
    save(todo) {
        const index = this.todos.findIndex(t => t.id === todo.id);
        if (index !== -1) this.todos[index] = todo;
        else this.todos.push(todo);
        return Promise.resolve();
    }
    findById(id) {
        return Promise.resolve(this.todos.find(t => t.id === id));
    }
    findAll() {
        return Promise.resolve(this.todos);
    }
}

function rangeDates(startStr, endStr) {
    const arr = [];
    let cur = new Date(startStr + 'T00:00:00Z');
    const end = new Date(endStr + 'T00:00:00Z');
    while (cur <= end) {
        arr.push(cur.toISOString().slice(0,10));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return arr;
}

function countMatchingWeekdays(startStr, endStr, selectedDays) {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    let count = 0;
    let cur = new Date(startStr + 'T00:00:00Z');
    const end = new Date(endStr + 'T00:00:00Z');
    while (cur <= end) {
        if (selectedDays.includes(dayNames[cur.getUTCDay()])) count++;
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
}

describe('Recurrence behavior (desired specs)', () => {
    it('creates one todo per day for daily mode', async () => {
        const repo = new MockTodoRepository();
        const create = new CreateTodo(repo);
        const start = '2025-12-01';
        const end = '2025-12-03';
        const recurrence = { mode: 'daily', startDate: start, endDate: end };

        const first = await create.execute('user1', 'Daily Task', start, [], false, 0, 'medium', null, [], 'desc', recurrence);

        const expectedDates = rangeDates(start, end);
        expect(repo.todos).toHaveLength(expectedDates.length);
        const savedDates = repo.todos.map(t => t.dueDate).sort();
        expect(savedDates).toEqual(expectedDates);
        expect(first).toBeDefined();
    });

    it('creates todos only on selected weekdays for specificDays mode', async () => {
        const repo = new MockTodoRepository();
        const create = new CreateTodo(repo);
        const start = '2025-11-24'; // Monday
        const end = '2025-11-30'; // Sunday
        const selected = ['Monday','Wednesday','Friday'];
        const recurrence = { mode: 'specificDays', startDate: start, endDate: end, selectedDays: selected };

        await create.execute('user2', 'Specific Days Task', start, [], false, 0, 'medium', null, [], 'desc', recurrence);

        const expectedCount = countMatchingWeekdays(start, end, selected);
        expect(repo.todos).toHaveLength(expectedCount);
        // All saved todos should have dueDate within range
        for (const t of repo.todos) {
            expect(new Date(t.dueDate + 'T00:00:00Z') >= new Date(start + 'T00:00:00Z')).toBeTruthy();
            expect(new Date(t.dueDate + 'T00:00:00Z') <= new Date(end + 'T00:00:00Z')).toBeTruthy();
            expect(selected.includes((RecurrenceService.getDayName(new Date(t.dueDate + 'T00:00:00Z').getUTCDay())))).toBeTruthy();
        }
    });

    it('creates a single logical todo for dateRange mode (desired) and marks entire range complete on toggle', async () => {
        const repo = new MockTodoRepository();
        const create = new CreateTodo(repo);
        const start = '2025-12-01';
        const end = '2025-12-05';
        const recurrence = { mode: 'dateRange', startDate: start, endDate: end };

        // Desired behavior: one logical todo saved (not expanded into multiple)
        const todo = await create.execute('user3', 'Range Task', start, [], false, 0, 'medium', null, [], 'desc', recurrence);

        // Expect one todo stored representing the range
        expect(repo.todos).toHaveLength(1);
        const saved = repo.todos[0];
        expect(saved.recurrence).toEqual(recurrence);
        // Due date for the logical task should be the start date (UI will render it across the span)
        expect(saved.dueDate).toBe(start);

        // Now toggle/complete using CompleteRecurringTodo and expect it to mark completed and NOT create separate next occurrences
        const completeCase = new CompleteRecurringTodo(repo);
        await completeCase.execute(saved.id);

        const after = repo.todos;
        // The same todo should be marked completed
        expect(after.find(t => t.id === saved.id).isCompleted).toBe(true);
        // No new todos should have been created for the date range (logical task completed as a whole)
        expect(after).toHaveLength(1);
    });
});
