import { useEffect, useState, useMemo } from 'react';
import { fetchStats } from '../../utils/api';
import { CloseIcon, StatsIcon } from '../../icons/Icons';

const Metric = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', minWidth: '140px' }}>
    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{label}</div>
    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
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
    <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
            <StatsIcon width={22} height={22} />
          </div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-family-heading)' }}>Statistics</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onBack} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}><CloseIcon /></button>
        </div>
      </div>

      {loading && <div style={{ color: 'var(--color-text-muted)' }}>Loading statistics...</div>}
      {error && <div style={{ color: 'var(--color-danger)' }}>{error}</div>}

      {!loading && !error && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Metric label="Total Todos" value={total} />
            <Metric label="Completed" value={completed} />
            <Metric label="Completion Rate" value={`${completionRate}%`} />
            <Metric label="Avg. Duration" value={`${avgDuration}m`} />
            <Metric label="Time Spent (min)" value={timeSpent} />
          </div>

          <section style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '320px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>Tasks Per Day (last 30 days)</h3>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'end', height: '80px' }}>
                {tasksPerDay.map((d) => (
                  <div key={d.day} title={`${d.day}: ${d.count}`} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '14px', height: `${Math.round((d.count / maxPerDay) * 100)}%`, background: 'var(--color-primary)', borderRadius: '6px 6px 0 0' }} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: '320px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>Top Tags</h3>
              {topTags.length === 0 && <div style={{ color: 'var(--color-text-muted)' }}>No tags used yet</div>}
              {topTags.map(tag => (
                <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: tag.color || 'var(--color-border)', border: '1px solid var(--color-border)' }} />
                  <div style={{ flex: 1 }}>{tag.name}</div>
                  <div style={{ width: '100px' }}><Bar percent={Math.min(100, Math.round((tag.count / (topTags[0]?.count || 1)) * 100))} color={tag.color} /></div>
                  <div style={{ width: '36px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{tag.count}</div>
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
