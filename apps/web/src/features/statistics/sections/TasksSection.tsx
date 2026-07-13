import type { StatsResponse } from '@lifeline/shared';
import { DonutChart, LineChart } from '../../../shared/ui/charts/charts';
import type { StatsPeriod } from '../stats-lib';
import styles from '../Statistics.module.css';

/** Minutes → "90m" / "1h 30m" so 4–5 digit totals stay readable. */
function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/**
 * The original Statistics content — metric tiles, completion donut, tasks
 * line, top tags. On the All tab the server groups by year, so the line is
 * per-year (labelled accordingly) rather than per-day.
 */
export function TasksSection({ stats, period }: { stats: StatsResponse; period: StatsPeriod }) {
  const totals = stats.periodTotals;
  const topTags = stats.topTags;
  const groups = stats.groups;
  const perYear = period === 'all';
  const maxPerDay = groups.reduce((max, group) => Math.max(max, group.count), 0) || 1;
  const points = groups.map((group) => ({ x: group.date, y: group.count }));
  const maxTagCount = topTags[0]?.count ?? 1;

  return (
    <div className={styles.stack}>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Total</div>
          <div className={styles.metricValue}>{totals.totalTodos}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Completed</div>
          <div className={styles.metricValue}>{totals.completedCount}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Avg. Duration</div>
          <div className={styles.metricValue}>{formatMinutes(totals.avgDuration)}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Time Spent</div>
          <div className={styles.metricValue}>{formatMinutes(totals.timeSpentTotal)}</div>
        </div>
      </div>

      <section className={styles.sections}>
        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Completion</h3>
          <div className={styles.donutWrap}>
            <DonutChart value={totals.completionRate} />
          </div>
          <div className={styles.legend}>
            <span>Completed: {totals.completedCount}</span>
            <span>Total: {totals.totalTodos}</span>
          </div>
        </div>

        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>{perYear ? 'Tasks per Year' : 'Tasks per Day'}</h3>
          <div className={styles.lineWrap}>
            <LineChart points={points} label={perYear ? 'Tasks per year' : 'Tasks per day'} />
          </div>
          <div className={styles.legend}>
            <span>Max: {maxPerDay}</span>
            <span>
              {perYear ? 'Years' : 'Points'}: {points.length}
            </span>
          </div>
        </div>

        <div className={styles.sectionCard}>
          <h3 className={styles.cardTitle}>Top Tags</h3>
          {topTags.length === 0 && <div className={styles.chartEmpty}>No tags used yet</div>}
          {topTags.map((tag) => (
            <div key={tag.id} className={styles.tagRow}>
              <div className={styles.tagSwatch} style={{ background: tag.color }} />
              <div className={styles.tagName}>{tag.name}</div>
              <div className={styles.tagBar}>
                <div className={styles.progressWrap}>
                  <div
                    className={styles.progressBar}
                    style={{
                      width: `${Math.min(100, Math.round((tag.count / maxTagCount) * 100))}%`,
                      background: tag.color,
                    }}
                  />
                </div>
              </div>
              <div className={styles.tagCount}>{tag.count}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
