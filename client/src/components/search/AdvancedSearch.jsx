import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { fetchTags, toggleTodo, searchTodos, fetchTodosForMonth } from '../../utils/api';
import { FlagIcon, EditIcon } from '../../icons/Icons';

const formatDuration = (totalMinutes) => {
  if (!totalMinutes) return '';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const AdvancedSearch = ({ onBack, onOpenTodo, onGoToDay, fetchWithAuth, guestMode, guestTodos = [], guestTags = [] }) => {
  const [allTodos, setAllTodos] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [priority, setPriority] = useState('any');
  const [status, setStatus] = useState('any');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [total, setTotal] = useState(0);
  const [monthTodos, setMonthTodos] = useState([]);
  const [clientResults, setClientResults] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const clientDebounceRef = useRef(null);
  const latestSearchIdRef = useRef(0);
  const [serverLoading, setServerLoading] = useState(false);
  const [monthLoaded, setMonthLoaded] = useState(false);
  const lastTapRef = useRef(0);
  const lastSelectedIndexRef = useRef(null);

  const navigateToDay = useCallback((dueDate) => {
    if (onGoToDay && dueDate) onGoToDay(dueDate);
  }, [onGoToDay]);

  useEffect(() => {
    if (guestMode) {
      setAllTags(guestTags || []);
      setAllTodos(guestTodos || []);
      setMonthTodos(guestTodos || []);
      setMonthLoaded(true);
      return;
    }
    if (!fetchWithAuth) {
      return;
    }
    const loadTags = async () => {
      try {
        const tags = await fetchTags(fetchWithAuth);
        setAllTags(tags || []);
      } catch (err) {
        console.error('Failed to load tags for search', err);
      }
    };
    loadTags();
    (async () => {
      try {
        const now = new Date();
        const res = await fetchTodosForMonth(now.getFullYear(), now.getMonth() + 1, {}, fetchWithAuth);
        if (res && res.todos) setMonthTodos(res.todos);
        setMonthLoaded(true);
      } catch (err) {
        console.debug('Month preload failed', err.message || err);
        // Fallback to locally available todos passed from parent
        setMonthTodos(guestTodos || []);
        setMonthLoaded(true);
      }
    })();
  }, [fetchWithAuth, guestMode, guestTodos, guestTags]);

  // When logged in and no filters, default results to monthTodos
  useEffect(() => {
    if (!guestMode && monthLoaded) {
      const hasFilters = (
        (query && query.trim().length > 0) ||
        selectedTags.length > 0 ||
        priority !== 'any' ||
        status !== 'any' ||
        flaggedOnly ||
        startDate ||
        endDate ||
        minDuration ||
        maxDuration
      );
      if (!hasFilters) {
        setAllTodos(monthTodos || []);
        setTotal((monthTodos || []).length);
        setPage(1);
      }
    }
  }, [guestMode, monthLoaded, monthTodos, query, selectedTags, priority, status, flaggedOnly, startDate, endDate, minDuration, maxDuration]);

  const toggleTag = (id) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = useMemo(() => {
    let out = [...allTodos];
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }
    if (selectedTags.length) {
      out = out.filter(t => t.tags && t.tags.some(tag => selectedTags.includes(tag.id)));
    }
    if (priority !== 'any') out = out.filter(t => (t.priority || 'medium') === priority);
    if (status !== 'any') out = out.filter(t => status === 'completed' ? t.isCompleted : !t.isCompleted);
    if (flaggedOnly) out = out.filter(t => t.isFlagged || t.flagged);
    if (startDate) out = out.filter(t => t.dueDate && t.dueDate >= startDate);
    if (endDate) out = out.filter(t => t.dueDate && t.dueDate <= endDate);
    if (minDuration) out = out.filter(t => (t.duration || 0) >= parseInt(minDuration));
    if (maxDuration) out = out.filter(t => (t.duration || 0) <= parseInt(maxDuration));

    switch (sortBy) {
      case 'priority': {
        const order = { high: 3, medium: 2, low: 1 };
        out.sort((a,b) => (order[b.priority]||2) - (order[a.priority]||2));
        break;
      }
      case 'duration':
        out.sort((a,b) => (b.duration||0) - (a.duration||0));
        break;
      case 'name':
        out.sort((a,b) => (a.title||'').localeCompare(b.title||''));
        break;
      case 'date':
      default:
        out.sort((a,b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }

    return out;
  }, [allTodos, query, selectedTags, priority, status, startDate, endDate, minDuration, maxDuration, flaggedOnly, sortBy]);

  // Display list (client preview vs live)
  const displayTodos = useMemo(() => (clientResults && clientResults.length) ? clientResults : filtered, [clientResults, filtered]);

  // Clear selection when data set changes significantly (e.g., new results)
  useEffect(() => { setSelectedIds([]); lastSelectedIndexRef.current = null; }, [displayTodos.map(t => t.id).join('|')]);

  // Esc to clear selection
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && selectedIds.length) {
        setSelectedIds([]);
        lastSelectedIndexRef.current = null;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedIds.length]);

  const isSelected = (id) => selectedIds.includes(id);
  const handleRowClick = (todoId, index, evt) => {
    if (evt && evt.shiftKey && lastSelectedIndexRef.current !== null) {
      const start = Math.min(lastSelectedIndexRef.current, index);
      const end = Math.max(lastSelectedIndexRef.current, index);
      const rangeIds = displayTodos.slice(start, end + 1).map(t => t.id);
      const merged = Array.from(new Set([...selectedIds, ...rangeIds]));
      setSelectedIds(merged);
    } else {
      setSelectedIds(prev => prev.includes(todoId) ? prev.filter(x => x !== todoId) : [...prev, todoId]);
      lastSelectedIndexRef.current = index;
    }
  };

  const handleToggleComplete = async (todo) => {
    if (!fetchWithAuth) return;
    try {
      await toggleTodo(todo.id, fetchWithAuth);
      setAllTodos(prev => prev.map(t => t.id === todo.id ? { ...t, isCompleted: !t.isCompleted } : t));
    } catch (err) {
      console.error('toggle complete failed', err);
    }
  };

  // Local-only batch handlers (no backend yet)
  const handleBatchDeleteLocal = () => {
    if (!selectedIds.length) return;
    const ok = window.confirm(`Delete ${selectedIds.length} selected tasks? This only affects current view.`);
    if (!ok) return;
    setAllTodos(prev => prev.filter(t => !selectedIds.includes(t.id)));
    // Also remove from client preview if present
    if (clientResults && clientResults.length) {
      try { setClientResults(prev => prev.filter(t => !selectedIds.includes(t.id))); } catch {}
    }
    setSelectedIds([]);
    lastSelectedIndexRef.current = null;
  };

  const handleBatchMarkLocal = (toCompleted) => {
    if (!selectedIds.length) return;
    setAllTodos(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, isCompleted: !!toCompleted } : t));
    if (clientResults && clientResults.length) {
      try { setClientResults(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, isCompleted: !!toCompleted } : t)); } catch {}
    }
    setSelectedIds([]);
    lastSelectedIndexRef.current = null;
  };

  // Trigger server-side search
  const performSearch = useCallback(async (p = 1) => {
    if (!fetchWithAuth) return;
    const searchId = ++latestSearchIdRef.current;
    setServerLoading(true);
    try {
      const params = {
        q: query || undefined,
        tags: selectedTags.length ? selectedTags : undefined,
        priority: priority !== 'any' ? priority : undefined,
        status: status !== 'any' ? status : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minDuration: minDuration || undefined,
        maxDuration: maxDuration || undefined,
        flagged: flaggedOnly ? true : undefined,
        sortBy: sortBy || undefined,
        page: p,
        limit
      };
      const hasFilters = Object.values(params).some(v => v !== undefined);
      const results = hasFilters
        ? await searchTodos(params, fetchWithAuth)
        : await fetchTodosForMonth(new Date().getFullYear(), new Date().getMonth() + 1, {}, fetchWithAuth);
      // Only apply results if this is the latest search
      if (searchId === latestSearchIdRef.current) {
        const list = results.todos || [];
        setAllTodos(list);
        setTotal((results.total !== undefined) ? results.total : list.length);
        setPage(results.page || p);
      }
    } catch (err) {
      console.error('Server-side search failed', err);
      // Fallback: use locally available todos from parent so page still renders
      if (searchId === latestSearchIdRef.current) {
        const list = guestTodos || [];
        setAllTodos(list);
        setTotal(list.length);
        setPage(1);
      }
    } finally {
      if (searchId === latestSearchIdRef.current) setServerLoading(false);
    }
  }, [fetchWithAuth, flaggedOnly, limit, maxDuration, minDuration, query, selectedTags, sortBy, startDate, status, endDate, priority]);

  // Client-side quick filter for current-month preload
  useEffect(() => {
    // Clear previous debounce
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);

    // Only run client-side search if we have monthTodos and the selected date range is within that month (or no range set)
    const canUseClient = monthTodos && monthTodos.length > 0 && (!startDate && !endDate);
    if (!canUseClient) {
      setClientResults([]);
      return;
    }

    if (!query || query.trim().length < 2) {
      // don't show huge client results for short queries
      setClientResults([]);
      return;
    }

    setClientLoading(true);
    clientDebounceRef.current = setTimeout(() => {
      try {
        const q = query.toLowerCase();
        const results = monthTodos.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
        setClientResults(results.slice(0, 50)); // limit preview
      } catch (e) {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 220);

    return () => {
      if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);
    };
  }, [query, monthTodos, startDate, endDate]);

  // Auto-trigger server-side search after debounce to create a "live" feel.
  useEffect(() => {
    // determine if there are meaningful filters (avoid firing for empty state)
    const hasFilters = (
      (query && query.trim().length > 0) ||
      selectedTags.length > 0 ||
      priority !== 'any' ||
      status !== 'any' ||
      flaggedOnly ||
      startDate ||
      endDate ||
      minDuration ||
      maxDuration
    );

    if (!hasFilters) return;

    // debounce server search
    const t = setTimeout(() => {
      // perform live server search; page 1
      performSearch(1);
    }, 400);

    return () => clearTimeout(t);
  }, [fetchWithAuth, flaggedOnly, limit, maxDuration, minDuration, performSearch, query, selectedTags, sortBy, startDate, status, endDate, priority]);

  return (
    <div style={{ padding: '28px', minHeight: '80vh', maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1000 }}>
      <style>{`
        /* Match Statistics page container behavior and prevent sidebar overlay */
        @media (max-width: 1300px) {
          .adv-search-grid { grid-template-columns: 1fr !important; }
          .adv-search-aside { order: 2; }
        }
        .adv-search-container { position: relative; z-index: 1000; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={onBack} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', fontWeight: 600 }}>Back</button>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-family-heading)', color: 'var(--color-text)' }}>Advanced Search</h2>
          <div style={{ marginLeft: '10px', color: 'var(--color-text-muted)', fontSize: '0.95rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>{(clientResults && clientResults.length) ? clientResults.length : allTodos.length} results</span>
            <span style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>{clientResults && clientResults.length ? (serverLoading ? 'Preview' : 'Preview') : (serverLoading ? 'Live — searching' : 'Live')}</span>
          </div>
        </div>
      </div>

      <div className="adv-search-container" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title or notes" style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface-light)', color: 'var(--color-text)', boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)' }} />
            <button onClick={() => { setQuery(''); setSelectedTags([]); setPriority('any'); setStatus('any'); setStartDate(''); setEndDate(''); setMinDuration(''); setMaxDuration(''); setFlaggedOnly(false); setAllTodos([]); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)' }}>Clear</button>
            <button onClick={performSearch} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'var(--color-bg)', marginLeft: '8px' }}>Search</button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ minWidth: '160px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Priority</label>
              <select value={priority} onChange={e=>setPriority(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <option value="any">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div style={{ minWidth: '160px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <option value="any">Any</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div style={{ minWidth: '160px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Flagged</label>
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={flaggedOnly} onChange={e=>setFlaggedOnly(e.target.checked)} />
                  <span style={{ color: 'var(--color-text-muted)' }}>Only flagged</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Start Date</label>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>End Date</label>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Min Duration (min)</label>
              <input type="number" value={minDuration} onChange={e=>setMinDuration(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            </div>
            <div style={{ minWidth: '120px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Max Duration (min)</label>
              <input type="number" value={maxDuration} onChange={e=>setMaxDuration(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            </div>
            <div style={{ minWidth: '160px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Sort</label>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="duration">Duration</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Tags</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: selectedTags.includes(tag.id) ? `1px solid ${tag.color}` : '1px solid var(--color-border)',
                    background: selectedTags.includes(tag.id) ? `${tag.color}20` : 'transparent',
                    color: selectedTags.includes(tag.id) ? tag.color : 'var(--color-text-muted)',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 8, background: tag.color, display: 'inline-block', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }} />
                  <span style={{ lineHeight: 1 }}>{tag.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Quick filters row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => { setPriority('high'); setStatus('any'); }} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>High Priority</button>
          <button onClick={() => { setStatus('active'); setPriority('any'); }} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>Active</button>
          <button onClick={() => { setStatus('completed'); setPriority('any'); }} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>Completed</button>
          {selectedIds.length > 0 && (
            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handleBatchDeleteLocal} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-danger, #e5484d)', background: 'var(--color-danger, #e5484d)', color: '#fff', fontWeight: 700 }}>Delete</button>
              {(() => {
                const selected = displayTodos.filter(t => selectedIds.includes(t.id));
                const allCompleted = selected.length > 0 && selected.every(t => !!t.isCompleted);
                const label = allCompleted ? 'Mark as Undone' : 'Mark as Done';
                return (
                  <button onClick={() => handleBatchMarkLocal(!allCompleted)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-primary)', color: 'var(--color-bg)', fontWeight: 700 }}>{label}</button>
                );
              })()}
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{selectedIds.length} selected</span>
            </div>
          )}
          <div style={{ marginLeft: 'auto', color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>{(clientResults && clientResults.length) ? clientResults.length : allTodos.length} results</div>
        </div>

        {/* Results */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflow: 'auto', position: 'relative', zIndex: 1000 }}>
            {displayTodos.map((todo, idx) => (
              <div
                key={todo.id}
                onClick={(e) => handleRowClick(todo.id, idx, e)}
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px', borderRadius: '10px',
                  background: isSelected(todo.id) ? 'var(--color-surface-light)' : 'var(--color-surface-light)',
                  outline: isSelected(todo.id) ? '2px solid var(--color-primary)' : '1px solid transparent',
                  gap: '12px', cursor: 'pointer'
                }}
                onDoubleClick={() => navigateToDay(todo.dueDate)}
                onTouchStart={(e) => {
                  const now = Date.now();
                  if (now - lastTapRef.current < 300) {
                    e.preventDefault();
                    navigateToDay(todo.dueDate);
                  }
                  lastTapRef.current = now;
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        onDoubleClick={() => navigateToDay(todo.dueDate)}
                        title={todo.dueDate ? `Go to ${todo.dueDate}` : 'No date'}
                        style={{
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {todo.title}
                      </span>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>{todo.dueDate ? todo.dueDate : 'No date'}</div>
                    </div>
                    {todo.description && <div style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.description}</div>}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(todo.tags || []).map(t => (
                        <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: 999, fontSize: '0.78rem', background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}>{t.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
                  {todo.isFlagged && <FlagIcon filled />}
                  <button onClick={(e) => { e.stopPropagation(); onOpenTodo && onOpenTodo(todo); }} title="Open/Edit" style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'transparent' }}><EditIcon /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Pagination controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
        <button onClick={() => { if (page > 1) { performSearch(page - 1); } }} disabled={page <= 1} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>Prev</button>
        <div style={{ color: 'var(--color-text-muted)' }}>Page {page} of {Math.max(1, Math.ceil((total || 0) / limit))}</div>
        <button onClick={() => { if ((page * limit) < total) { performSearch(page + 1); } }} disabled={(page * limit) >= total} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>Next</button>
      </div>
    </div>
  );
};

export default AdvancedSearch;
