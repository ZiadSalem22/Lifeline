import { format } from 'date-fns';
import { WEEK_LETTERS, weekIndexOf } from './lib/plan-model';
import styles from './DailyPlan.module.css';

const CIRC = 2 * Math.PI * 29;

export interface MastheadProps {
  dateStr: string;
  score: number;
}

/** "DAILY PLAN" display header: subtitle rules, date, week chips, score ring. */
export function Masthead({ dateStr, score }: MastheadProps) {
  const todayIdx = weekIndexOf(dateStr);
  const dash = `${((score / 100) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;
  const dateLabel = format(new Date(`${dateStr}T00:00:00`), 'EEEE, MMMM d, yyyy');

  return (
    <div className={styles.masthead}>
      <div className={styles.mastheadLeft}>
        <div className={styles.mastheadTitle}>DAILY PLAN</div>
        <div className={styles.mastheadSub}>
          <span className={styles.ruleLine} />
          discipline · focus · execution
          <span className={styles.ruleLine} />
        </div>
      </div>
      <div className={styles.mastheadDate}>
        <div className={styles.dateLabel}>{dateLabel}</div>
        <div className={styles.weekChips}>
          {WEEK_LETTERS.map((letter, i) => (
            <span
              key={i}
              className={
                i === todayIdx ? `${styles.weekChip} ${styles.weekChipToday}` : styles.weekChip
              }
            >
              {letter}
            </span>
          ))}
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
            fontFamily="var(--font-family-heading)"
          >
            {score}%
          </text>
        </svg>
        <div className={styles.scoreLabel}>Daily Score</div>
      </div>
    </div>
  );
}
