import type { DailyPlanSettings } from '@lifeline/shared';
import { BarSeries, StatTile } from '../../../shared/ui/charts/charts';
import type { PlanAggregates } from '../plan-metrics-lib';
import styles from '../Statistics.module.css';

/** kcal vs target bars, macro averages vs targets, coverage + callouts. */
export function NutritionSection({
  agg,
  settings,
}: {
  agg: PlanAggregates;
  settings: DailyPlanSettings;
}) {
  const { nutrition } = agg;
  if (nutrition.loggedDays === 0) {
    return (
      <div className={styles.chartEmpty}>
        No meals logged in this period — the Meals card writes here.
      </div>
    );
  }
  const targets = settings.targets;
  const kcalPoints = agg.dates.map((date) => {
    const m = agg.byDate.get(date);
    return {
      x: date,
      y: m && m.mealCount > 0 ? m.kcal : null,
      title: m && m.mealCount > 0 ? `${date}: ${m.kcal} kcal` : `${date}: not logged`,
    };
  });
  const proteinPoints = agg.dates.map((date) => {
    const m = agg.byDate.get(date);
    return {
      x: date,
      y: m && m.mealCount > 0 ? m.protein : null,
      title: m && m.mealCount > 0 ? `${date}: ${m.protein}g protein` : `${date}: not logged`,
    };
  });

  return (
    <div className={styles.stack}>
      <div className={styles.tileGrid}>
        <StatTile label="Days logged" value={`${nutrition.loggedDays} / ${agg.dates.length}`} />
        <StatTile
          label="Avg kcal"
          value={nutrition.avg?.kcal ?? '—'}
          delta={`target ${targets.kcal.toLocaleString()}`}
        />
        <StatTile
          label="Avg protein"
          value={nutrition.avg ? `${nutrition.avg.protein}g` : '—'}
          delta={`target ${targets.protein}g`}
        />
        <StatTile
          label="Avg carbs / fat"
          value={nutrition.avg ? `${nutrition.avg.carbs} / ${nutrition.avg.fat}g` : '—'}
        />
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.cardTitle}>Calories vs target</h3>
        <BarSeries label="Calories per day" points={kcalPoints} target={targets.kcal} />
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.cardTitle}>Protein vs target</h3>
        <BarSeries label="Protein per day" points={proteinPoints} target={targets.protein} />
      </div>

      {nutrition.bestDay && nutrition.worstDay && (
        <div className={styles.legend}>
          <span>
            Closest to target: {nutrition.bestDay.date} ({nutrition.bestDay.kcal} kcal)
          </span>
          <span>
            Furthest: {nutrition.worstDay.date} ({nutrition.worstDay.kcal} kcal)
          </span>
        </div>
      )}
    </div>
  );
}
