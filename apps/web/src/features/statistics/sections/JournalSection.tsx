import { StatTile, TrendLine } from '../../../shared/ui/charts/charts';
import type { PlanAggregates } from '../plan-metrics-lib';
import styles from '../Statistics.module.css';

/** Mood + rating trends and journaling coverage (text lives in the Review). */
export function JournalSection({ agg }: { agg: PlanAggregates }) {
  const anyMood = agg.moodAm.some((v) => v !== null) || agg.moodPm.some((v) => v !== null);
  const anyRating = agg.rating.some((v) => v !== null);
  if (agg.journalDays === 0 && !anyMood && !anyRating) {
    return (
      <div className={styles.chartEmpty}>
        Nothing journaled in this period — the Evening Review writes here.
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.tileGrid}>
        <StatTile label="Journal days" value={`${agg.journalDays} / ${agg.dates.length}`} />
        <StatTile label="Gratitude entries" value={agg.gratitudeTotal} />
      </div>

      {anyMood && (
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Mood (AM vs PM)</h3>
          <TrendLine
            label="Mood trend"
            height={130}
            yMax={5}
            series={[
              {
                label: 'Morning',
                points: agg.dates.map((date, i) => ({ x: date, y: agg.moodAm[i] ?? null })),
              },
              {
                label: 'Evening',
                points: agg.dates.map((date, i) => ({ x: date, y: agg.moodPm[i] ?? null })),
              },
            ]}
          />
          <div className={styles.legend}>
            <span style={{ color: 'var(--chart-ink)' }}>— Morning</span>
            <span style={{ color: 'var(--chart-ink-2)' }}>— Evening</span>
          </div>
        </div>
      )}

      {anyRating && (
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Productivity rating</h3>
          <TrendLine
            label="Productivity rating trend"
            height={130}
            yMax={5}
            series={[
              {
                label: 'Rating',
                points: agg.dates.map((date, i) => ({ x: date, y: agg.rating[i] ?? null })),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
