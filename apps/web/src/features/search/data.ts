import { endOfMonth, format, startOfMonth } from 'date-fns';
import type { Todo } from '@lifeline/shared';
import { listTodos } from '../todos/data/api';

/**
 * Current-month preload for the search page's client "Preview" mode (the old
 * fetchTodosForMonth used limit=1000; v1 caps pageSize at 100, so pages are
 * followed until exhausted, with a safety cap).
 */
const MAX_MONTH_PAGES = 20;

export async function fetchMonthTodos(now: Date = new Date()): Promise<Todo[]> {
  const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(now), 'yyyy-MM-dd');
  const items: Todo[] = [];
  let page = 1;
  for (;;) {
    const result = await listTodos({ startDate, endDate, page, pageSize: 100 });
    items.push(...result.items);
    if (page >= result.totalPages || page >= MAX_MONTH_PAGES) break;
    page += 1;
  }
  return items;
}
