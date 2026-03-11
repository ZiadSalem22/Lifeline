const { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } = require('date-fns');
const { ValidationError } = require('../../utils/errors');
const { normalizeDateOnly } = require('./taskPayloads');

const ISO_DATE_TOKEN_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YYYY_MM_PATTERN = /^\d{4}-\d{2}$/;

function formatDateToken(date) {
  return format(date, 'yyyy-MM-dd');
}

function resolveDateToken(dateToken, now = new Date()) {
  if (dateToken === 'today') {
    return formatDateToken(now);
  }

  if (dateToken === 'tomorrow') {
    return formatDateToken(addDays(now, 1));
  }

  if (ISO_DATE_TOKEN_PATTERN.test(String(dateToken || ''))) {
    return String(dateToken);
  }

  throw new ValidationError('Invalid date token. Use today, tomorrow, or YYYY-MM-DD.');
}

/**
 * Resolves a window token to { start, end } date strings.
 * Supported tokens: this_week, next_week, this_month, next_month, overdue, YYYY-MM.
 * @param {string} windowToken
 * @param {Date} now
 * @param {{ startDayOfWeek?: number }} options - startDayOfWeek: 0=Sun..6=Sat
 * @returns {{ start: string, end: string }}
 */
function resolveWindowToken(windowToken, now = new Date(), options = {}) {
  const weekStartsOn = typeof options.startDayOfWeek === 'number' ? options.startDayOfWeek : 0;

  if (windowToken === 'this_week') {
    return {
      start: formatDateToken(startOfWeek(now, { weekStartsOn })),
      end: formatDateToken(endOfWeek(now, { weekStartsOn })),
    };
  }

  if (windowToken === 'next_week') {
    const nextWeekDay = addDays(now, 7);
    return {
      start: formatDateToken(startOfWeek(nextWeekDay, { weekStartsOn })),
      end: formatDateToken(endOfWeek(nextWeekDay, { weekStartsOn })),
    };
  }

  if (windowToken === 'this_month') {
    return {
      start: formatDateToken(startOfMonth(now)),
      end: formatDateToken(endOfMonth(now)),
    };
  }

  if (windowToken === 'next_month') {
    const nextMonthDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start: formatDateToken(startOfMonth(nextMonthDay)),
      end: formatDateToken(endOfMonth(nextMonthDay)),
    };
  }

  if (windowToken === 'overdue') {
    return {
      start: '2000-01-01',
      end: formatDateToken(addDays(now, -1)),
    };
  }

  if (YYYY_MM_PATTERN.test(String(windowToken || ''))) {
    const [year, month] = windowToken.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    return {
      start: formatDateToken(startOfMonth(monthDate)),
      end: formatDateToken(endOfMonth(monthDate)),
    };
  }

  throw new ValidationError('Invalid window token. Use this_week, next_week, this_month, next_month, overdue, or YYYY-MM.');
}

/**
 * Tests whether a task occurs within the given date range [start, end] inclusive.
 * Considers date-range recurrence spans.
 */
function doesTaskOccurInRange(todo, rangeStart, rangeEnd) {
  const span = getTaskDateSpan(todo);
  if (!span) return false;
  return span.start <= rangeEnd && span.end >= rangeStart;
}

function getTaskDateSpan(todo) {
  if (!todo) return null;

  const dueDate = normalizeDateOnly(todo.dueDate);
  const recurrence = todo.recurrence || null;

  if (recurrence?.mode === 'dateRange') {
    const start = normalizeDateOnly(recurrence.startDate || dueDate);
    const end = normalizeDateOnly(recurrence.endDate || dueDate);
    if (start && end) {
      return { start, end, isDateRange: true };
    }
  }

  if (!dueDate) {
    return null;
  }

  return {
    start: dueDate,
    end: dueDate,
    isDateRange: false,
  };
}

function doesTaskOccurOnDate(todo, dateValue) {
  const span = getTaskDateSpan(todo);
  if (!span) return false;
  return dateValue >= span.start && dateValue <= span.end;
}

function isTaskEligibleForUpcoming(todo, fromDate) {
  if (!todo || todo.isCompleted) return false;

  const span = getTaskDateSpan(todo);
  if (!span) return false;

  return span.end >= fromDate;
}

function getUpcomingSortDate(todo, fromDate) {
  const span = getTaskDateSpan(todo);
  if (!span) return '9999-12-31';
  return span.start < fromDate ? fromDate : span.start;
}

function compareTasksForUpcoming(a, b, fromDate) {
  const byEffectiveDate = getUpcomingSortDate(a, fromDate).localeCompare(getUpcomingSortDate(b, fromDate));
  if (byEffectiveDate !== 0) return byEffectiveDate;

  const byOrder = Number(a?.order || 0) - Number(b?.order || 0);
  if (byOrder !== 0) return byOrder;

  return Number(a?.taskNumber || 0) - Number(b?.taskNumber || 0);
}

module.exports = {
  ISO_DATE_TOKEN_PATTERN,
  YYYY_MM_PATTERN,
  compareTasksForUpcoming,
  doesTaskOccurInRange,
  doesTaskOccurOnDate,
  getTaskDateSpan,
  getUpcomingSortDate,
  isTaskEligibleForUpcoming,
  resolveDateToken,
  resolveWindowToken,
};
