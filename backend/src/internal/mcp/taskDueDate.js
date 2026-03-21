function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatDateOnly(date) {
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}

function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveNaturalLanguageDueDate(value, now = new Date()) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (isDateOnly(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.toLowerCase();
  if (normalized === 'today') {
    return formatDateOnly(now);
  }

  if (normalized === 'tomorrow') {
    const nextDay = new Date(now);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return formatDateOnly(nextDay);
  }

  if (normalized === 'yesterday') {
    const previousDay = new Date(now);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    return formatDateOnly(previousDay);
  }

  const inDaysMatch = normalized.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) {
    const futureDate = new Date(now);
    futureDate.setUTCDate(futureDate.getUTCDate() + Number.parseInt(inDaysMatch[1], 10));
    return formatDateOnly(futureDate);
  }

  const nextDayMatch = normalized.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextDayMatch) {
    const targetDayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayIndex = targetDayNames.indexOf(nextDayMatch[1]);
    const nextDate = new Date(now);
    const currentDayIndex = nextDate.getUTCDay();
    const daysAhead = ((targetDayIndex - currentDayIndex + 7) % 7) || 7;
    nextDate.setUTCDate(nextDate.getUTCDate() + daysAhead);
    return formatDateOnly(nextDate);
  }

  return trimmed;
}

function normalizeMcpCreateDueDate(payload = {}, now = new Date()) {
  const resolvedDueDate = resolveNaturalLanguageDueDate(payload.dueDate, now);
  if (resolvedDueDate === undefined || resolvedDueDate === '') {
    return {
      ...payload,
      dueDate: formatDateOnly(now),
    };
  }

  return {
    ...payload,
    dueDate: resolvedDueDate,
  };
}

function normalizeMcpUpdateDueDate(payload = {}, existingTask = null, now = new Date()) {
  const hasDueDate = Object.prototype.hasOwnProperty.call(payload, 'dueDate');
  const resolvedDueDate = hasDueDate
    ? resolveNaturalLanguageDueDate(payload.dueDate, now)
    : undefined;

  if (hasDueDate) {
    return {
      ...payload,
      dueDate: resolvedDueDate === '' ? null : resolvedDueDate,
    };
  }

  return {
    ...payload,
  };
}

module.exports = {
  formatDateOnly,
  normalizeMcpCreateDueDate,
  normalizeMcpUpdateDueDate,
  resolveNaturalLanguageDueDate,
};