import { useState } from 'react';
import { CalendarHeatmap } from '../../../shared/ui/charts/charts';
import type { HeatDay } from '../../../shared/ui/charts/charts';
import { weekIndexOf } from '../../daily-plan/lib/plan-model';
import type { PlanAggregates } from '../plan-metrics-lib';
import styles from '../Statistics.module.css';

/** Per-habit completion %, streaks, and a heatmap for the picked habit. */
export function HabitsSection({ agg }: { agg: PlanAggregates }) {
  const rows = agg.habitRows;
  const [picked, setPicked] = useState<string | null>(null);
  const pickedId = picked ?? rows[0]?.id ?? null;

  if (agg.daysWithData === 0) {
    return (
      <div className={styles.chartEmpty}>
        No plan data in this period yet — the Daily Plan writes here.
      </div>
    );
  }

  const firstDate = agg.dates[0];
  const pad = firstDate !== undefined ? weekIndexOf(firstDate) : 0;
  const heatDays: HeatDay[] = [
    ...Array.from({ length: pad }, (_, i) => ({ date: `pad-${i}`, value: null })),
    ...agg.dates.map((date) => {
      const mark = pickedId === null ? undefined : agg.byDate.get(date)?.habits[pickedId];
      return {
        date,
        value: mark === true ? 1 : mark === false ? 0 : null,
        title: `${date}${mark === true ? ' — done' : mark === 'skip' ? ' — skipped' : mark === false ? ' — missed' : ''}`,
      };
    }),
  ];
  const pickedRow = rows.find((r) => r.id === pickedId);

  return (
    <div className={styles.stack}>
      <div className={styles.sectionCard}>
        <h3 className={styles.cardTitle}>Habit completion</h3>
        {rows.length === 0 && <div className={styles.chartEmpty}>No habits configured</div>}
        {rows.map((row) => (
          <div key={row.id} className={styles.habitStatRow}>
            <span dir="auto" className={styles.habitStatLabel}>
              {row.label}
            </span>
            <span className={styles.habitStatMeta}>
              {row.currentStreak >= 2 && (
                <span title={`${row.currentStreak}-day streak`}>×{row.currentStreak}</span>
              )}
            </span>
            <div className={styles.progressWrap}>
              <div
                className={styles.progressBar}
                style={{
                  width: `${row.pct ?? 0}%`,
                  background: 'var(--chart-ink)',
                }}
              />
            </div>
            <span className={styles.habitStatPct}>{row.pct === null ? '—' : `${row.pct}%`}</span>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Habit heatmap</h3>
          <div className={styles.chipRow}>
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                dir="auto"
                className={[styles.chip, row.id === pickedId ? styles.chipActive : undefined]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={row.id === pickedId}
                onClick={() => setPicked(row.id)}
              >
                {row.label}
              </button>
            ))}
          </div>
          <CalendarHeatmap days={heatDays} label={`${pickedRow?.label ?? 'Habit'} heatmap`} />
          {pickedRow && (
            <div className={styles.legend}>
              <span>
                Done {pickedRow.done} of {pickedRow.counted} tracked days
              </span>
              <span>Longest run: {pickedRow.longestRun}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
