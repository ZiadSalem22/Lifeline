import type { StatsResponse } from '@lifeline/shared';
import { DonutChart, LineChart } from '../../../shared/ui/charts/charts';
import styles from '../Statistics.module.css';

/**
 * The original Statistics content, preserved 1:1 — metric tiles, completion
 * donut, tasks-per-day line, top tags.
 */
export function TasksSection({ stats }: { stats: StatsResponse }) {
  const totals = stats.periodTotals;
  const topTags = stats.topTags;
  const groups = stats.groups;
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
          <div className={styles.metricValue}>{totals.avgDuration}m</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Time Spent</div>
          <div className={styles.metricValue}>{totals.timeSpentTotal}m</div>
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
          <h3 className={styles.cardTitle}>Tasks per Day</h3>
          <div className={styles.lineWrap}>
            <LineChart points={points} />
          </div>
          <div className={styles.legend}>
            <span>Max: {maxPerDay}</span>
            <span>Points: {points.length}</span>
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
