import type { StatsResponse } from '@lifeline/shared';
import { CalendarHeatmap, StatTile, TrendLine } from '../../../shared/ui/charts/charts';
import type { HeatDay } from '../../../shared/ui/charts/charts';
import { weekIndexOf } from '../../daily-plan/lib/plan-model';
import { formatDelta, type PlanAggregates } from '../plan-metrics-lib';
import styles from '../Statistics.module.css';

export interface OverviewSectionProps {
  agg: PlanAggregates;
  prev: PlanAggregates | null;
  /** Task totals from the existing stats feed (joined for the tiles). */
  taskStats: StatsResponse | null;
  /** Heatmap only makes sense beyond a handful of days. */
  showHeatmap: boolean;
}

/** The executive page: headline tiles with deltas, score trend, score heat. */
export function OverviewSection({ agg, prev, taskStats, showHeatmap }: OverviewSectionProps) {
  if (agg.daysWithData === 0) {
    return (
      <div className={styles.chartEmpty}>
        No plan data in this period yet — the Daily Plan writes here.
      </div>
    );
  }

  const scoreSpark = agg.scoreByDate.map((s) => s ?? 0);
  const scoreDelta = prev ? formatDelta(agg.scoreAvg, prev.scoreAvg) : undefined;
  const habitDelta = prev ? formatDelta(agg.habitPct, prev.habitPct) : undefined;
  const waterDelta = prev ? formatDelta(agg.waterAvg, prev.waterAvg) : undefined;
  const workoutDelta = prev ? formatDelta(agg.workout.sessions, prev.workout.sessions) : undefined;

  // Pad to a Monday start so heat columns are calendar weeks.
  const firstDate = agg.dates[0];
  const pad = firstDate !== undefined ? weekIndexOf(firstDate) : 0;
  const heatDays: HeatDay[] = [
    ...Array.from({ length: pad }, (_, i) => ({ date: `pad-${i}`, value: null })),
    ...agg.dates.map((date, i) => ({
      date,
      value: agg.scoreByDate[i] === null ? null : (agg.scoreByDate[i] ?? 0) / 100,
    })),
  ];

  return (
    <div className={styles.stack}>
      <div className={styles.tileGrid}>
        <StatTile
          label="Daily score avg"
          value={agg.scoreAvg === null ? '—' : `${agg.scoreAvg}%`}
          delta={scoreDelta?.text}
          deltaTone={scoreDelta?.tone}
          spark={scoreSpark}
        />
        <StatTile
          label="Tasks completed"
          value={taskStats ? taskStats.periodTotals.completedCount : '—'}
        />
        <StatTile
          label="Habits"
          value={agg.habitPct === null ? '—' : `${agg.habitPct}%`}
          delta={habitDelta?.text}
          deltaTone={habitDelta?.tone}
        />
        <StatTile
          label="Water avg"
          value={agg.waterAvg === null ? '—' : `${agg.waterAvg} cups`}
          delta={waterDelta?.text}
          deltaTone={waterDelta?.tone}
        />
        <StatTile
          label="Workouts"
          value={agg.workout.sessions}
          delta={workoutDelta?.text}
          deltaTone={workoutDelta?.tone}
        />
        <StatTile label="Journal days" value={agg.journalDays} />
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.cardTitle}>Daily score</h3>
        <TrendLine
          label="Daily score trend"
          height={150}
          yMax={100}
          series={[
            {
              label: 'Score',
              points: agg.dates.map((date, i) => ({ x: date, y: agg.scoreByDate[i] ?? null })),
            },
          ]}
        />
      </div>

      {showHeatmap && (
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Consistency</h3>
          <CalendarHeatmap days={heatDays} label="Daily score heatmap" />
        </div>
      )}
    </div>
  );
}
