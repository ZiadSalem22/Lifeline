import { useState } from 'react';
import { DAY_NAMES } from '@lifeline/shared';
import type { DayName, Recurrence } from '@lifeline/shared';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import styles from './RecurrenceSelector.module.css';

/**
 * Recurrence picker — 1:1 port of the old components/calendar/
 * RecurrenceSelector.jsx: modes daily / dateRange / specificDays with a
 * weekday picker; Apply validates the range (inline error instead of the old
 * alert()); Clear resets and removes the recurrence.
 */

export interface RecurrenceSelectorProps {
  open: boolean;
  recurrence: Recurrence | null;
  baseDate: string;
  onClose: () => void;
  onApply: (recurrence: Recurrence) => void;
  onClear: () => void;
}

type Mode = 'daily' | 'dateRange' | 'specificDays';

const DAY_SHORT: Record<DayName, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const MODE_OPTIONS: { key: Mode; label: string; desc: string; detail: string }[] = [
  {
    key: 'daily',
    label: 'Daily',
    desc: 'Every day between start and end',
    detail:
      'Creates separate tasks for each day in the selected span. Each day is its own task and can be completed independently.',
  },
  {
    key: 'dateRange',
    label: 'Date Range',
    desc: "Single continuous task — rendered until it's done",
    detail:
      'Creates one logical task that appears on every day between the start and end dates. Completing it marks the entire range done.',
  },
  {
    key: 'specificDays',
    label: 'Specific Weekdays',
    desc: 'Only selected weekdays in range',
    detail:
      'Shows a task on each day matching the selected weekdays inside the date span. Only selected weekdays get the task.',
  },
];

interface RecurrenceLike {
  mode?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  selectedDays?: unknown;
}

function readMode(recurrence: Recurrence | null): Mode {
  const mode = (recurrence as RecurrenceLike | null)?.mode;
  return mode === 'dateRange' || mode === 'specificDays' ? mode : 'daily';
}

function readString(recurrence: Recurrence | null, field: 'startDate' | 'endDate'): string {
  const value = (recurrence as RecurrenceLike | null)?.[field];
  return typeof value === 'string' ? value : '';
}

function readDays(recurrence: Recurrence | null): DayName[] {
  const value = (recurrence as RecurrenceLike | null)?.selectedDays;
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(
    (day): day is DayName =>
      typeof day === 'string' && (DAY_NAMES as readonly string[]).includes(day),
  );
}

function SelectorBody({
  recurrence,
  baseDate,
  onClose,
  onApply,
  onClear,
}: Omit<RecurrenceSelectorProps, 'open'>) {
  const [mode, setMode] = useState<Mode>(() => readMode(recurrence));
  const [startDate, setStartDate] = useState(() => readString(recurrence, 'startDate') || baseDate);
  const [endDate, setEndDate] = useState(() => readString(recurrence, 'endDate'));
  const [selectedDays, setSelectedDays] = useState<DayName[]>(() => readDays(recurrence));
  const [error, setError] = useState('');

  const toggleDay = (day: DayName) => {
    setSelectedDays((previous) =>
      previous.includes(day) ? previous.filter((d) => d !== day) : [...previous, day],
    );
  };

  const handleApply = () => {
    const invalidRange = !startDate || !endDate || new Date(startDate) > new Date(endDate);
    if (invalidRange) {
      setError('Please select a valid start and end date.');
      return;
    }
    if (mode === 'specificDays' && selectedDays.length === 0) {
      setError('Please select at least one weekday.');
      return;
    }
    const payload: Recurrence =
      mode === 'specificDays'
        ? { mode, type: 'specificDays', startDate, endDate, selectedDays }
        : { mode, type: mode, startDate, endDate };
    onApply(payload);
  };

  return (
    <div className={styles.body}>
      <div className={styles.modes}>
        {MODE_OPTIONS.map((option) => (
          <div key={option.key} className={styles.modeBlock}>
            <label
              className={[styles.modeOption, mode === option.key ? styles.modeActive : undefined]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name="recurrenceMode"
                checked={mode === option.key}
                onChange={() => setMode(option.key)}
              />
              <span className={styles.modeLabel}>{option.label}</span>
              <span className={styles.modeDesc}>{option.desc}</span>
            </label>
            {mode === option.key && (
              <p className={styles.modeDetail}>
                <strong>{option.label}:</strong> {option.detail}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={styles.dateRow}>
        <div className={styles.dateField}>
          <label htmlFor="recurrence-start">Start date</label>
          <input
            id="recurrence-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className={styles.dateField}>
          <label htmlFor="recurrence-end">End date</label>
          <input
            id="recurrence-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>

      {mode === 'specificDays' && (
        <div className={styles.daysGrid}>
          {DAY_NAMES.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={selectedDays.includes(day)}
              className={[
                styles.dayButton,
                selectedDays.includes(day) ? styles.dayActive : undefined,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => toggleDay(day)}
            >
              {DAY_SHORT[day]}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.footer}>
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RecurrenceSelector({ open, ...props }: RecurrenceSelectorProps) {
  return (
    <Modal open={open} onClose={props.onClose} title="Select Recurrence">
      {/* Body mounts fresh per open so drafts reset like the old effect did. */}
      {open ? <SelectorBody {...props} /> : null}
    </Modal>
  );
}
