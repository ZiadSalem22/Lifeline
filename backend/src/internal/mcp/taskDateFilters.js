const { addDays, format } = require('date-fns');
const { ValidationError } = require('../../utils/errors');
const { normalizeDateOnly } = require('./taskPayloads');

const ISO_DATE_TOKEN_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  compareTasksForUpcoming,
  doesTaskOccurOnDate,
  getTaskDateSpan,
  getUpcomingSortDate,
  isTaskEligibleForUpcoming,
  resolveDateToken,
};
