import { useEffect, useState, useMemo } from 'react';
import { fetchStats } from '../../utils/api';
import { CloseIcon, StatsIcon } from '../../icons/Icons';
import styles from './Statistics.module.css';

const Metric = ({ label, value }) => (
  <div className={styles.metric}>
    <div className={styles.metricLabel}>{label}</div>
    <div className={styles.metricValue}>{value}</div>
  </div>
);

const Bar = ({ percent, color }) => (
  <div style={{ height: '10px', background: 'var(--color-surface)', borderRadius: '6px', overflow: 'hidden' }}>
    <div style={{ width: `${percent}%`, height: '100%', background: color || 'var(--color-primary)' }} />
  </div>
);

const Statistics = ({ onBack, fetchWithAuth, guestMode, guestTodos = [], guestTags = [] }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        if (guestMode) {
          // Compute stats locally from guestTodos/guestTags
          const totalTodos = Array.isArray(guestTodos) ? guestTodos.length : 0;
          const completedCount = guestTodos.filter(t => t.isCompleted).length;
          const completionRate = totalTodos ? Math.round((completedCount / totalTodos) * 100) : 0;
          const durations = guestTodos.map(t => parseInt(t.duration || 0, 10) || 0);
          const timeSpentTotal = durations.reduce((a, b) => a + b, 0);
          const avgDuration = totalTodos ? Math.round(timeSpentTotal / totalTodos) : 0;
          const tagCounts = {};
          guestTodos.forEach(t => {
            (t.tags || []).forEach(tag => { tagCounts[tag.id] = (tagCounts[tag.id] || 0) + 1; });
          });
          const topTags = Object.entries(tagCounts)
            .map(([id, count]) => {
              const tag = guestTags.find(t => t.id === id) || { id, name: 'Tag', color: 'var(--color-primary)' };
              return { id, name: tag.name, color: tag.color, count };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
          const perDayMap = {};
          guestTodos.forEach(t => {
            const d = t.dueDate || 'unscheduled';
            perDayMap[d] = (perDayMap[d] || 0) + 1;
          });
          const tasksPerDay = Object.entries(perDayMap)
            .filter(([d]) => d !== 'unscheduled')
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
          const data = { totalTodos, completedCount, completionRate, avgDuration, timeSpentTotal, topTags, tasksPerDay };
          if (mounted) setStats(data);
        } else {
          try {
            const data = await fetchStats(fetchWithAuth);
            if (mounted) setStats(data);
          } catch (apiErr) {
            console.warn('Stats fetch failed, computing locally as fallback:', apiErr?.message || apiErr);
            // Fallback to local computation even when logged in
            const totalTodos = Array.isArray(guestTodos) ? guestTodos.length : 0;
            const completedCount = guestTodos.filter(t => t.isCompleted).length;
            const completionRate = totalTodos ? Math.round((completedCount / totalTodos) * 100) : 0;
            const durations = guestTodos.map(t => parseInt(t.duration || 0, 10) || 0);
            const timeSpentTotal = durations.reduce((a, b) => a + b, 0);
            const avgDuration = totalTodos ? Math.round(timeSpentTotal / totalTodos) : 0;
            const tagCounts = {};
            guestTodos.forEach(t => { (t.tags || []).forEach(tag => { tagCounts[tag.id] = (tagCounts[tag.id] || 0) + 1; }); });
            const topTags = Object.entries(tagCounts).map(([id, count]) => {
              const tag = guestTags.find(t => t.id === id) || { id, name: 'Tag', color: 'var(--color-primary)' };
              return { id, name: tag.name, color: tag.color, count };
            }).sort((a, b) => b.count - a.count).slice(0, 8);
            const perDayMap = {};
            guestTodos.forEach(t => { const d = t.dueDate || 'unscheduled'; perDayMap[d] = (perDayMap[d] || 0) + 1; });
            const tasksPerDay = Object.entries(perDayMap).filter(([d]) => d !== 'unscheduled').map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
            const fallback = { totalTodos, completedCount, completionRate, avgDuration, timeSpentTotal, topTags, tasksPerDay };
            if (mounted) setStats(fallback);
          }
        }
      } catch (e) {
        console.error(e);
        if (mounted) setError(e.message || 'Failed to load stats');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [fetchWithAuth, guestMode, guestTodos, guestTags]);

  const total = stats?.totalTodos || 0;
  const completed = stats?.completedCount || 0;
  const completionRate = stats?.completionRate || 0;
  const avgDuration = stats?.avgDuration || 0;
  const timeSpent = stats?.timeSpentTotal || 0;

  const topTags = stats?.topTags || [];
  const tasksPerDay = stats?.tasksPerDay || [];

  const maxPerDay = useMemo(() => tasksPerDay.reduce((m, d) => Math.max(m, d.count), 0) || 1, [tasksPerDay]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBox}>
            <StatsIcon width={22} height={22} />
          </div>
          <h2 className={styles.title}>Statistics</h2>
        </div>
        <div className={styles.backRow}>
          <button onClick={onBack} className={styles.backBtn}><CloseIcon /></button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Loading statistics...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && stats && (
        <div className={styles.stack}>
          <div className={styles.metrics}>
            <Metric label="Total Todos" value={total} />
            <Metric label="Completed" value={completed} />
            <Metric label="Completion Rate" value={`${completionRate}%`} />
            <Metric label="Avg. Duration" value={`${avgDuration}m`} />
            <Metric label="Time Spent (min)" value={timeSpent} />
          </div>

          <section className={styles.sections}>
            <div className={styles.perDay}>
              <h3 className={styles.cardTitle}>Tasks Per Day (last 30 days)</h3>
              <div className={styles.perDayBars}>
                {tasksPerDay.map((d) => (
                  <div key={d.day} title={`${d.day}: ${d.count}`} className={styles.barCol}>
                    <div className={styles.bar} style={{ '--bar-height': `${Math.round((d.count / maxPerDay) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.topTags}>
              <h3 className={styles.cardTitle}>Top Tags</h3>
              {topTags.length === 0 && <div className={styles.loading}>No tags used yet</div>}
              {topTags.map(tag => (
                <div key={tag.id} className={styles.tagRow}>
                  <div className={styles.tagSwatch} style={{ '--swatch-color': tag.color || 'var(--color-border)' }} />
                  <div className={styles.tagName}>{tag.name}</div>
                  <div className={styles.tagBar}><Bar percent={Math.min(100, Math.round((tag.count / (topTags[0]?.count || 1)) * 100))} color={tag.color} /></div>
                  <div className={styles.tagCount}>{tag.count}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Statistics;
