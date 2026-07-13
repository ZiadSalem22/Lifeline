import type { DailyPlanSettings } from '@lifeline/shared';
import { BarSeries, StatTile } from '../../../shared/ui/charts/charts';
import type { PlanAggregates } from '../plan-metrics-lib';
import styles from '../Statistics.module.css';

/** Sessions/sets tiles, sets-per-day bars, per-routine table, current PRs. */
export function WorkoutSection({
  agg,
  settings,
}: {
  agg: PlanAggregates;
  settings: DailyPlanSettings;
}) {
  if (agg.workout.sessions === 0 && agg.cardio.minutes === 0) {
    return (
      <div className={styles.chartEmpty}>
        No workouts logged in this period — the Workout card writes here.
      </div>
    );
  }
  const setsPoints = agg.dates.map((date) => {
    const m = agg.byDate.get(date);
    const sets = m?.workoutSets ?? null;
    return {
      x: date,
      y: sets !== null && sets > 0 ? sets : null,
      title: `${date}: ${sets && sets > 0 ? `${sets} sets` : 'rest'}`,
    };
  });
  const prs = settings.gym.prs.filter((pr) => pr.n.trim().length > 0);

  return (
    <div className={styles.stack}>
      <div className={styles.tileGrid}>
        <StatTile label="Sessions" value={agg.workout.sessions} />
        <StatTile label="Total sets" value={agg.workout.totalSets} />
        <StatTile
          label="Sets / session"
          value={
            agg.workout.sessions > 0
              ? Math.round((agg.workout.totalSets / agg.workout.sessions) * 10) / 10
              : '—'
          }
        />
        {agg.cardio.minutes > 0 && (
          <StatTile
            label="Cardio min"
            value={agg.cardio.minutes}
            delta={agg.cardio.kcal > 0 ? `~${agg.cardio.kcal.toLocaleString()} kcal` : undefined}
          />
        )}
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.cardTitle}>Sets per day</h3>
        <BarSeries label="Sets per day" points={setsPoints} />
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.cardTitle}>Routines</h3>
        {agg.workout.byRoutine.map((row) => (
          <div key={row.key} className={styles.habitStatRow}>
            <span dir="auto" className={styles.habitStatLabel}>
              {row.label}
            </span>
            <span className={styles.habitStatMeta}>{row.sets} sets</span>
            <div className={styles.progressWrap}>
              <div
                className={styles.progressBar}
                style={{
                  width: `${Math.round((row.sessions / agg.workout.sessions) * 100)}%`,
                  background: 'var(--chart-ink)',
                }}
              />
            </div>
            <span className={styles.habitStatPct}>{row.sessions}×</span>
          </div>
        ))}
      </div>

      {prs.length > 0 && (
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Personal records (current)</h3>
          <div className={styles.legend} style={{ flexWrap: 'wrap', gap: 12 }}>
            {prs.map((pr, i) => (
              <span key={`${pr.n}-${i}`}>
                {pr.n}: <strong>{pr.v}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
