import { useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '../../shared/ui/icons';
import type { WeekStartIndex } from './day-utils';
import styles from './ModernCalendar.module.css';

export interface ModernCalendarProps {
  /** 'today' | 'tomorrow' | 'YYYY-MM-DD' */
  selectedDate: string;
  onSelectDate: (day: string) => void;
  /** First column of the grid — derived from the user's preference upstream. */
  weekStartsOn: WeekStartIndex;
}

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function resolveSelected(selectedDate: string): Date | null {
  if (selectedDate === 'today') return new Date();
  if (selectedDate === 'tomorrow') return addDays(new Date(), 1);
  if (selectedDate.includes('-')) {
    const parsed = new Date(`${selectedDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Month grid, ported from the old ModernCalendar — minus the hardcoded Sunday
 * start. The initial visible month follows the selected day; the parent keys
 * this component by the selected day so selection changes re-sync the month.
 */
export function ModernCalendar({ selectedDate, onSelectDate, weekStartsOn }: ModernCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(
    () => resolveSelected(selectedDate) ?? new Date(),
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDayLabels = Array.from(
    { length: 7 },
    (_, i) => WEEK_LETTERS[(i + weekStartsOn) % 7] ?? '',
  );
  const leadingEmpty = (monthStart.getDay() - weekStartsOn + 7) % 7;

  const selected = resolveSelected(selectedDate);

  return (
    <div className={styles.wrap}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <ChevronLeftIcon width={16} height={16} />
        </button>
        <h3 className={styles.title}>{format(currentMonth, 'MMMM yyyy')}</h3>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRightIcon width={16} height={16} />
        </button>
      </div>

      <div className={styles.week}>
        {weekDayLabels.map((label, i) => (
          <div key={i} className={styles.weekDay} aria-hidden="true">
            {label}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {Array.from({ length: leadingEmpty }, (_, i) => (
          <div key={`empty-${i}`} className={styles.empty} />
        ))}
        {daysInMonth.map((date) => {
          const isSelected = selected !== null && isSameDay(date, selected);
          const classes = [
            styles.tile,
            isToday(date) && !isSelected ? styles.tileToday : undefined,
            isSelected ? styles.tileSelected : undefined,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={date.toISOString()}
              type="button"
              className={classes}
              onClick={() => onSelectDate(format(date, 'yyyy-MM-dd'))}
              aria-label={format(date, 'MMMM d, yyyy')}
              aria-pressed={isSelected}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
