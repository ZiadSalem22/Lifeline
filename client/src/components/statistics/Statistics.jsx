import { useEffect, useState, useMemo } from 'react';
import { fetchStats, fetchStatsRange, saveSettings } from '../../utils/api';
import { CloseIcon, StatsIcon } from '../../icons/Icons';
import styles from './Statistics.module.css';

const Metric = ({ label, value }) => (
  <div className={styles.metric}>
    <div className={styles.metricLabel}>{label}</div>
    <div className={styles.metricValue}>{value}</div>
  </div>
);

const Bar = ({ percent, color }) => (
  <div className={styles['progress-wrap']}>
    <div className={styles['progress-bar']} style={{ width: `${percent}%`, background: color || 'var(--color-primary)' }} />
  </div>
);

// Minimal, dependency-free charts (SVG)
const DonutChart = ({ value = 0, size = 120, stroke = 12, color = 'var(--color-primary)' }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={radius} stroke="var(--color-border)" strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fill="var(--color-text)">{clamped}%</text>
    </svg>
  );
};

const LineChart = ({ points = [], height = 120, color = 'var(--color-primary)' }) => {
  if (!points.length) return <div className={styles.empty}>No data</div>;
  const width = Math.max(240, points.length * 24);
  const maxY = points.reduce((m, p) => Math.max(m, p.y), 0) || 1;
  const stepX = width / Math.max(1, points.length - 1);
  const path = points.map((p, i) => `${i===0?'M':'L'} ${i*stepX} ${height - (p.y/maxY)*height}`).join(' ');
  return (
    <svg className={styles.lineChart} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={i*stepX} cy={height - (p.y/maxY)*height} r="3" fill={color} />
      ))}
    </svg>
  );
};

const Statistics = ({ onBack, fetchWithAuth, guestMode, guestTodos = [], guestTags = [] }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('all'); // default to 'all'
  const [range, setRange] = useState({ startDate: null, endDate: null });
  const [weekStart, setWeekStart] = useState('monday'); // 'monday' | 'sunday' | 'saturday'
  const [showWeekStartPicker, setShowWeekStartPicker] = useState(false);

  const computeWeekStart = (d, start) => {
    const day = d.getDay(); // 0 Sun .. 6 Sat
    if (start === 'sunday') {
      // Sunday-based week: start is Sunday
      const diffToSunday = day; // if Sunday=0
      const s = new Date(d);
      s.setDate(d.getDate() - diffToSunday);
      return s;
    }
    if (start === 'saturday') {
      // Saturday-based week: start is Saturday
      const diffToSaturday = (day + 1) % 7; // if Sat=6 => (6+1)%7=0
      const s = new Date(d);
      s.setDate(d.getDate() - diffToSaturday);
      return s;
    }
    // default Monday
    const diffToMonday = (day + 6) % 7;
    const s = new Date(d);
    s.setDate(d.getDate() - diffToMonday);
    return s;
  };

  // Helpers to compute ranges from UI selections
  const setDay = (dateStr) => {
    if (!dateStr) return;
    setRange({ startDate: dateStr, endDate: dateStr });
  };
  const setWeek = (dateStr) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    const start = computeWeekStart(d, weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const toISO = (x) => x.toISOString().slice(0,10);
    setRange({ startDate: toISO(start), endDate: toISO(end) });
  };
  const setMonth = (monthStr) => {
    if (!monthStr) return;
    const [y, m] = monthStr.split('-').map(Number);
    const start = new Date(y, m-1, 1);
    const end = new Date(y, m, 0);
    const toISO = (x) => x.toISOString().slice(0,10);
    setRange({ startDate: toISO(start), endDate: toISO(end) });
  };
  const setYear = (yearStr) => {
    if (!yearStr) return;
    const y = Number(yearStr);
    const start = `${y}-01-01`;
    const end = `${y}-12-31`;
    setRange({ startDate: start, endDate: end });
  };

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
            // If 'all', fetch overall; if range set, fetch range; else wait for selection
            let data = null;
            if (period === 'all') {
              data = await fetchStats(fetchWithAuth);
            } else if (range.startDate && range.endDate) {
              data = await fetchStatsRange(fetchWithAuth, range.startDate, range.endDate);
            }
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
  }, [fetchWithAuth, guestMode, guestTodos, guestTags, period, range.startDate, range.endDate]);

  const changePeriod = (p) => {
    setPeriod(p);
    setStats(null);
    const now = new Date();
    const toISO = (x) => x.toISOString().slice(0,10);
    if (p === 'day') {
      setDay(toISO(now));
      return;
    }
    if (p === 'week') {
      applyPresetWeek(0); // this week based on weekStart
      return;
    }
    if (p === 'month') {
      const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      setMonth(ym);
      return;
    }
    if (p === 'year') {
      setYear(String(now.getFullYear()));
      return;
    }
    // 'all'
    setRange({ startDate: null, endDate: null });
  };

  const applyPresetWeek = (offsetWeeks = 0) => {
    const today = new Date();
    const base = new Date(today);
    base.setDate(today.getDate() + offsetWeeks * 7);
    const start = computeWeekStart(base, weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const toISO = (x) => x.toISOString().slice(0,10);
    setRange({ startDate: toISO(start), endDate: toISO(end) });
  };

  const saveWeekStart = async (value) => {
    try {
      setWeekStart(value);
      setShowWeekStartPicker(false);
      // Persist in user settings layout
      await saveSettings({ layout: { weekStart: value } }, fetchWithAuth, { quiet401: true });
    } catch (e) {
      console.warn('Failed to save weekStart preference (will keep locally):', e?.message || e);
    }
  };

  const total = stats?.periodTotals?.totalTodos ?? stats?.totalTodos ?? 0;
  const completed = stats?.periodTotals?.completedCount ?? stats?.completedCount ?? 0;
  const completionRate = stats?.periodTotals?.completionRate ?? stats?.completionRate ?? 0;
  const avgDuration = stats?.periodTotals?.avgDuration ?? stats?.avgDuration ?? 0;
  const timeSpent = stats?.periodTotals?.timeSpentTotal ?? stats?.timeSpentTotal ?? 0;

  const topTags = stats?.topTagsInPeriod ?? stats?.topTags ?? [];
  const groups = stats?.groups || stats?.tasksPerDay || [];

  const maxPerDay = useMemo(() => groups.reduce((m, d) => Math.max(m, d.count), 0) || 1, [groups]);
  const perDayPoints = useMemo(() => groups.map((d) => ({ x: d.period || d.date, y: d.count })), [groups]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
          <div className={styles['header-left']}>
          <div className={styles['icon-box']}>
            <StatsIcon width={22} height={22} />
          </div>
          <h2 className={styles.title}>Statistics</h2>
        </div>
      </div>
      <div className={styles.toolbar}>
        <div className={styles['toggle-group']} role="tablist" aria-label="Stats period">
          {[ 'all','day','week','month','year' ].map(p => (
            <button key={p} role="tab" aria-selected={period===p} onClick={()=>changePeriod(p)} className={`${styles.toggle} ${period===p?styles.toggleActive:''}`}>{p[0].toUpperCase()+p.slice(1)}</button>
          ))}
        </div>
        {/* Selection panel: shows inputs based on active period */}
        <div className={styles.panel} aria-live="polite">
          {period === 'day' && (
            <div className={styles.pickerRow}>
              <label className={styles.pickerLabel} htmlFor="stats-day">Pick a day</label>
              <input className={styles.input} id="stats-day" type="date" value={range.startDate ?? new Date().toISOString().slice(0,10)} onChange={(e)=>setDay(e.target.value)} />
            </div>
          )}
          {period === 'week' && (
            <div className={styles.pickerRow}>
              <label className={styles.pickerLabel} htmlFor="stats-week">Pick any date in week</label>
              <input className={styles.input} id="stats-week" type="date" value={range.startDate ?? new Date().toISOString().slice(0,10)} onChange={(e)=>setWeek(e.target.value)} />
            </div>
          )}
          {period === 'week' && (
            <div className={styles.chipRow}>
              <button type="button" className={styles.chip} onClick={()=>applyPresetWeek(0)}>This Week</button>
              <button type="button" className={styles.chip} onClick={()=>applyPresetWeek(-1)}>Last Week</button>
            </div>
          )}
          {period === 'week' && (
            <div className={styles.hint}>
              Week starts on {weekStart.charAt(0).toUpperCase()+weekStart.slice(1)} · <a onClick={()=>setShowWeekStartPicker(v=>!v)}>Change</a>
              {showWeekStartPicker && (
                <span style={{ marginLeft: 8 }}>
                  <button type="button" className={styles.chip} onClick={()=>saveWeekStart('monday')}>Monday</button>
                  <button type="button" className={styles.chip} onClick={()=>saveWeekStart('sunday')}>Sunday</button>
                  <button type="button" className={styles.chip} onClick={()=>saveWeekStart('saturday')}>Saturday</button>
                </span>
              )}
            </div>
          )}
          {period === 'month' && (
            <div className={styles.pickerRow}>
              <label className={styles.pickerLabel} htmlFor="stats-month">Pick a month</label>
              <input className={styles.input} id="stats-month" type="month" value={(range.startDate ? range.startDate.slice(0,7) : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`)} onChange={(e)=>setMonth(e.target.value)} />
            </div>
          )}
          {period === 'year' && (
            <div className={styles.pickerRow}>
              <label className={styles.pickerLabel} htmlFor="stats-year">Enter a year</label>
              <input className={styles.input} id="stats-year" type="number" min="1970" max="2100" step="1" placeholder={String(new Date().getFullYear())} onChange={(e)=>setYear(e.target.value)} />
            </div>
          )}
          {period === 'all' && (
            <div style={{ textAlign:'center', fontSize:'0.9rem', color:'var(--color-text-muted)' }}>
              Showing overall stats. Use Day/Week/Month/Year to select.
            </div>
          )}
        </div>
        <div className={styles['back-row']}>
          <button onClick={onBack} className={styles['back-btn']} title="Close"><CloseIcon /></button>
        </div>
      </div>
      

      {loading && <div className={styles.loading}>Loading statistics...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && stats && (
        <div className={styles.stack}>
          {/* Summary metrics */}
          <div className={styles.metrics}>
            <Metric label="Total" value={total} />
            <Metric label="Completed" value={completed} />
            <Metric label="Avg. Duration" value={`${avgDuration}m`} />
            <Metric label="Time Spent" value={`${timeSpent}m`} />
          </div>

          {/* Completion donut */}
          <section className={styles.sections}>
            <div className={styles['per-day']}>
              <h3 className={styles['card-title']}>Completion</h3>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                <DonutChart value={completionRate} />
              </div>
              <div className={styles.legend}>
                <span>Completed: {completed}</span>
                <span>Total: {total}</span>
              </div>
            </div>

            {/* Per-day line chart */}
            <div className={styles['per-day']}>
              <h3 className={styles['card-title']}>Tasks per Day</h3>
              <div className={styles.panel} style={{ overflowX:'auto' }}>
                <LineChart points={perDayPoints} />
              </div>
              <div className={styles.legend}>
                <span>Max: {maxPerDay}</span>
                <span>Points: {perDayPoints.length}</span>
              </div>
            </div>

            {/* Top tags list with progress bars */}
            <div className={styles['top-tags']}>
              <h3 className={styles['card-title']}>Top Tags</h3>
              {topTags.length === 0 && <div className={styles.loading}>No tags used yet</div>}
              {topTags.map(tag => (
                <div key={tag.id} className={styles['tag-row']}>
                  <div className={styles['tag-swatch']} style={{ '--swatch-color': tag.color || 'var(--color-border)' }} />
                  <div className={styles['tag-name']}>{tag.name}</div>
                  <div className={styles['tag-bar']}><Bar percent={Math.min(100, Math.round((tag.count / (topTags[0]?.count || 1)) * 100))} color={tag.color} /></div>
                  <div className={styles['tag-count']}>{tag.count}</div>
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
