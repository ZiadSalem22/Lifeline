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

  // Logged days only — a null→0 fill would draw unlogged days as fake
  // bottom-of-range dips in the sparkline.
  const scoreSpark = agg.scoreByDate.filter((s): s is number => s !== null);
  // Suffixes disambiguate the unit (pts = percentage points, not a count);
  // every delta is vs the equal-length previous period (the tile title).
  const scoreDelta = prev ? formatDelta(agg.scoreAvg, prev.scoreAvg, ' pts') : undefined;
  const habitDelta = prev ? formatDelta(agg.habitPct, prev.habitPct, ' pts') : undefined;
  const waterDelta = prev ? formatDelta(agg.waterAvg, prev.waterAvg, ' cups') : undefined;
  const workoutDelta = prev ? formatDelta(agg.workout.sessions, prev.workout.sessions) : undefined;
  const deltaTitle = 'vs previous period';

  // Weight change across the period, first → last weigh-in. Neutral tone on
  // purpose: whether losing or gaining is "good" is the user's goal, not ours.
  const w = agg.weight;
  const weightDelta =
    w.first && w.last && w.first.date !== w.last.date
      ? formatDelta(w.last.kg, w.first.kg, ' kg')
      : undefined;

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
          deltaTitle={deltaTitle}
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
          deltaTitle={deltaTitle}
        />
        <StatTile
          label="Water avg"
          value={agg.waterAvg === null ? '—' : `${agg.waterAvg} cups`}
          delta={waterDelta?.text}
          deltaTone={waterDelta?.tone}
          deltaTitle={deltaTitle}
        />
        <StatTile
          label="Workouts"
          value={agg.workout.sessions}
          delta={workoutDelta?.text}
          deltaTone={workoutDelta?.tone}
          deltaTitle={deltaTitle}
        />
        <StatTile label="Journal days" value={agg.journalDays} />
        {w.last && (
          <StatTile
            label="Weight"
            value={`${w.last.kg} kg`}
            delta={weightDelta?.text}
            deltaTone="neutral"
            deltaTitle="since the first weigh-in this period"
          />
        )}
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

      {w.count >= 2 && w.min !== null && w.max !== null && (
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Weight</h3>
          <TrendLine
            label="Weight trend"
            height={140}
            yMin={Math.floor(w.min - 1)}
            yMax={Math.ceil(w.max + 1)}
            series={[
              {
                label: 'Weight (kg)',
                points: agg.dates.map((date, i) => ({ x: date, y: w.series[i] ?? null })),
              },
            ]}
          />
          <div className={styles.legend}>
            <span>
              {w.first ? `${w.first.kg} kg → ${w.last?.kg} kg` : ''} · {w.count} weigh-ins
            </span>
            <span>
              low {w.min} · high {w.max}
            </span>
          </div>
        </div>
      )}

      {showHeatmap && (
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Consistency</h3>
          <CalendarHeatmap days={heatDays} label="Daily score heatmap" />
        </div>
      )}
    </div>
  );
}
