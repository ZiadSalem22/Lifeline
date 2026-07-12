import { useRef } from 'react';
import { format } from 'date-fns';
import {
  WEEK_DAY_NAMES,
  WEEK_LETTERS,
  daysAfter,
  daysBefore,
  weekDatesOf,
  weekIndexOf,
} from './lib/plan-model';
import styles from './DailyPlan.module.css';

const CIRC = 2 * Math.PI * 29;

export interface MastheadProps {
  dateStr: string;
  score: number;
  /** Personal subtitle line (empty hides the rule row). */
  subtitle: string;
  /** Week chips navigate to that day of the selected week when provided. */
  onSelectDay?: ((date: string) => void) | undefined;
}

/** "DAILY PLAN" display header: subtitle rules, date (± day, jump-to-date), week chips, score ring. */
export function Masthead({ dateStr, score, subtitle, onSelectDay }: MastheadProps) {
  const todayIdx = weekIndexOf(dateStr);
  const weekDates = weekDatesOf(dateStr);
  const dash = `${((score / 100) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;
  const dateLabel = format(new Date(`${dateStr}T00:00:00`), 'EEEE, MMMM d, yyyy');
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className={styles.masthead}>
      <div className={styles.mastheadLeft}>
        <div className={styles.mastheadTitle}>DAILY PLAN</div>
        {subtitle.trim().length > 0 && (
          <div className={styles.mastheadSub} dir="auto">
            <span className={styles.ruleLine} />
            {subtitle}
            <span className={styles.ruleLine} />
          </div>
        )}
      </div>
      <div className={styles.mastheadDate}>
        {onSelectDay ? (
          <div className={styles.dateRow}>
            <button
              type="button"
              className={styles.dayNavBtn}
              aria-label="Previous day"
              onClick={() => onSelectDay(daysBefore(dateStr, 1))}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.dateLabelBtn}
              aria-label="Change date"
              title="Jump to any date"
              onClick={() => {
                const input = dateInputRef.current;
                if (!input) return;
                if (typeof input.showPicker === 'function') input.showPicker();
                else input.click();
              }}
            >
              {dateLabel}
            </button>
            <button
              type="button"
              className={styles.dayNavBtn}
              aria-label="Next day"
              onClick={() => onSelectDay(daysAfter(dateStr, 1))}
            >
              ›
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className={styles.dateJumpInput}
              tabIndex={-1}
              value={dateStr}
              aria-label="Jump to date"
              onChange={(e) => {
                if (e.target.value) onSelectDay(e.target.value);
              }}
            />
          </div>
        ) : (
          <div className={styles.dateLabel}>{dateLabel}</div>
        )}
        <div className={styles.weekChips}>
          {WEEK_LETTERS.map((letter, i) =>
            onSelectDay ? (
              <button
                key={i}
                type="button"
                className={
                  i === todayIdx ? `${styles.weekChip} ${styles.weekChipToday}` : styles.weekChip
                }
                aria-label={`Go to ${WEEK_DAY_NAMES[i] ?? ''} ${weekDates[i] ?? ''}`}
                aria-current={i === todayIdx ? 'date' : undefined}
                onClick={() => {
                  const date = weekDates[i];
                  if (date && i !== todayIdx) onSelectDay(date);
                }}
              >
                {letter}
              </button>
            ) : (
              <span
                key={i}
                className={
                  i === todayIdx ? `${styles.weekChip} ${styles.weekChipToday}` : styles.weekChip
                }
              >
                {letter}
              </span>
            ),
          )}
        </div>
      </div>
      <div className={styles.scoreWrap}>
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          role="img"
          aria-label={`Daily score ${score}%`}
        >
          <circle cx="36" cy="36" r="29" fill="none" stroke="var(--plan-rule)" strokeWidth="6" />
          <circle
            className={styles.scoreRing}
            cx="36"
            cy="36"
            r="29"
            fill="none"
            stroke="var(--plan-primary)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={dash}
            transform="rotate(-90 36 36)"
          />
          <text
            x="36"
            y="41"
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill="var(--color-text)"
            fontFamily="var(--plan-display-font)"
          >
            {score}%
          </text>
        </svg>
        <div className={styles.scoreLabel}>Daily Score</div>
      </div>
    </div>
  );
}
