import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { fetchTags, toggleTodo, searchTodos, fetchTodosForMonth, batchTodos } from '../../utils/api';
import { FlagIcon, EditIcon, CalendarIcon } from '../../icons/Icons';
import { parseISO, format, isValid, isToday, isTomorrow, isYesterday, isSameYear } from 'date-fns';
import styles from './AdvancedSearch.module.css';

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
  const [taskNumber, setTaskNumber] = useState('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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

  const formatDueDate = (dateStr) => {
    if (!dateStr) return 'No date';
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(d)) return 'No date';
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isYesterday(d)) return 'Yesterday';
    const fmt = isSameYear(d, new Date()) ? 'MMM d' : 'MMM d, yyyy';
    return format(d, fmt);
  };

  const navigateToDay = useCallback((dueDate, id) => {
    if (onGoToDay && dueDate) onGoToDay(dueDate, id);
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
        const list = monthTodos || [];
        setAllTodos(list);
        setTotal(list.length);
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
    if (taskNumber) {
      const num = parseInt(taskNumber, 10);
      if (!isNaN(num)) {
        out = out.filter(t => t.taskNumber === num);
      }
    }
    if (selectedTags.length) {
      out = out.filter(t => (t.tags || []).some(tag => selectedTags.includes(tag.id)));
    }
    if (status !== 'any') out = out.filter(t => status === 'completed' ? t.isCompleted : !t.isCompleted);
    if (flaggedOnly) out = out.filter(t => t.isFlagged || t.flagged);
    if (startDate) out = out.filter(t => t.dueDate && t.dueDate >= startDate);
    if (endDate) out = out.filter(t => t.dueDate && t.dueDate <= endDate);
    if (minDuration) out = out.filter(t => (t.duration || 0) >= parseInt(minDuration));
    if (maxDuration) out = out.filter(t => (t.duration || 0) <= parseInt(maxDuration));

    switch (sortBy) {
      case 'priority': {
        const order = { high: 3, medium: 2, low: 1 };
        out.sort((a, b) => (order[b.priority] || 2) - (order[a.priority] || 2));
        break;
      }
      case 'duration':
        out.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'name':
        out.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'date_desc':
        out.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(b.dueDate) - new Date(a.dueDate);
        });
        break;
      case 'date_asc':
      case 'date':
      default:
        out.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }

    return out;
  }, [allTodos, taskNumber, query, selectedTags, priority, status, startDate, endDate, minDuration, maxDuration, flaggedOnly, sortBy]);

  // Display list (client preview vs live)
  const displayTodos = useMemo(() => (clientResults && clientResults.length) ? clientResults : filtered, [clientResults, filtered]);

  const hasFilters = useMemo(() => (
    (query && query.trim().length > 0) ||
    selectedTags.length > 0 ||
    priority !== 'any' ||
    status !== 'any' ||
    flaggedOnly ||
    startDate ||
    endDate ||
    minDuration ||
    maxDuration
  ), [query, selectedTags, priority, status, flaggedOnly, startDate, endDate, minDuration, maxDuration]);

  const isPreview = (clientResults && clientResults.length) > 0;
  const isServerMode = !!fetchWithAuth && !guestMode && hasFilters && !isPreview;
  const displayTotal = isPreview ? clientResults.length : (total || filtered.length);

  const startIdx = (page - 1) * limit;
  const pageTodos = useMemo(() => {
    if (isServerMode) return displayTodos; // server already paginated by limit
    return displayTodos.slice(startIdx, startIdx + limit);
  }, [displayTodos, isServerMode, startIdx, limit]);

  useEffect(() => {
    if (!isServerMode) {
      // Reset to first page when client-side dataset changes
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTodos.map(t => t.id).join('|'), isServerMode]);

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

  // Batch handlers
  const handleBatchDeleteLocal = () => {
    if (!selectedIds.length) return;
    const ok = window.confirm(`Delete ${selectedIds.length} selected tasks? This only affects current view.`);
    if (!ok) return;
    setAllTodos(prev => prev.filter(t => !selectedIds.includes(t.id)));
    // Also remove from client preview if present
    if (clientResults && clientResults.length) {
      try { setClientResults(prev => prev.filter(t => !selectedIds.includes(t.id))); } catch { }
    }
    setSelectedIds([]);
    lastSelectedIndexRef.current = null;
  };

  const handleBatchMarkLocal = (toCompleted) => {
    if (!selectedIds.length) return;
    setAllTodos(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, isCompleted: !!toCompleted } : t));
    if (clientResults && clientResults.length) {
      try { setClientResults(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, isCompleted: !!toCompleted } : t)); } catch { }
    }
    setSelectedIds([]);
    lastSelectedIndexRef.current = null;
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    if (guestMode) return handleBatchDeleteLocal();
    try {
      await batchTodos('delete', selectedIds, fetchWithAuth);
      handleBatchDeleteLocal();
    } catch (e) {
      console.error('Batch delete failed', e);
    }
  };

  const handleBatchMark = async (toCompleted) => {
    if (!selectedIds.length) return;
    if (guestMode) return handleBatchMarkLocal(toCompleted);
    try {
      await batchTodos(toCompleted ? 'complete' : 'uncomplete', selectedIds, fetchWithAuth);
      handleBatchMarkLocal(toCompleted);
    } catch (e) {
      console.error('Batch mark failed', e);
    }
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
        taskNumber: taskNumber || undefined,
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
  }, [fetchWithAuth, flaggedOnly, limit, maxDuration, minDuration, query, selectedTags, sortBy, startDate, status, endDate, priority, taskNumber]);

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
      startDate ||
      endDate ||
      minDuration ||
      maxDuration ||
      taskNumber
    );

    if (!hasFilters) return;

    // debounce server search
    const t = setTimeout(() => {
      // perform live server search; page 1
      performSearch(1);
    }, 400);

    return () => clearTimeout(t);
  }, [fetchWithAuth, flaggedOnly, limit, maxDuration, minDuration, performSearch, query, selectedTags, sortBy, startDate, status, endDate, priority, taskNumber]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles["header-left"]}>
          <button onClick={onBack} className={styles["back-btn"]}>Back</button>
          <h2 className={styles.title}>Advanced Search</h2>
          <div className={styles["mode-info"]}>
            <span>{(clientResults && clientResults.length) ? clientResults.length : allTodos.length} results</span>
            <span className={styles["mode-badge"]}>{clientResults && clientResults.length ? (serverLoading ? 'Preview' : 'Preview') : (serverLoading ? 'Live — searching' : 'Live')}</span>
          </div>
        </div>
      </div>

      <div className={styles.container}>
        <section className={styles.card}>
          <div className={styles["controls-row"]}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, notes..." className={`${styles.input} ${styles["search-input"]}`} />
            <input value={taskNumber} onChange={e => setTaskNumber(e.target.value)} placeholder="Task #" className={styles.input} style={{ width: '85px', flex: '0 0 auto' }} type="number" />
            <button onClick={() => { setQuery(''); setTaskNumber(''); setSelectedTags([]); setPriority('any'); setStatus('any'); setStartDate(''); setEndDate(''); setMinDuration(''); setMaxDuration(''); setFlaggedOnly(false); setAllTodos([]); }} className={styles["clear-btn"]}>Clear</button>
            <button onClick={() => performSearch(1)} className={styles["search-btn"]}>Search</button>
          </div>

          <div className={styles["grid-row"]}>
            <div style={{ minWidth: '160px' }}>
              <label className={styles.label}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={styles.select}>
                <option value="any">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div style={{ minWidth: '160px' }}>
              <label className={styles.label}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={styles.select}>
                <option value="any">Any</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div style={{ minWidth: '160px' }}>
              <label className={styles.label}>Flagged</label>
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
                  <span style={{ color: 'var(--color-text-muted)' }}>Only flagged</span>
                </label>
              </div>
            </div>
          </div>

          <div className={styles["grid-row"]}>
            <div style={{ flex: 1 }}>
              <label className={styles.label}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={styles.select} />
            </div>
            <div style={{ flex: 1 }}>
              <label className={styles.label}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={styles.select} />
            </div>
          </div>

          <div className={styles["grid-row"]}>
            <div style={{ minWidth: '120px' }}>
              <label className={styles.label}>Min Duration (min)</label>
              <input type="number" value={minDuration} onChange={e => setMinDuration(e.target.value)} className={styles.select} />
            </div>
            <div style={{ minWidth: '120px' }}>
              <label className={styles.label}>Max Duration (min)</label>
              <input type="number" value={maxDuration} onChange={e => setMaxDuration(e.target.value)} className={styles.select} />
            </div>
            <div style={{ minWidth: '160px' }}>
              <label className={styles.label}>Sort</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={styles.select}>
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="duration">Duration</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label className={styles.label}>Tags</label>
            <div className={styles["tags-wrap"]}>
              {allTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`${styles.tag} ${selectedTags.includes(tag.id) ? styles["tag-selected"] : ''}`}
                  style={selectedTags.includes(tag.id) ? { '--tag-color': tag.color } : undefined}
                >
                  <span className={styles["tag-dot"]} style={{ background: tag.color }} />
                  <span style={{ lineHeight: 1 }}>{tag.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Quick filters row */}
        <div className={styles["quick-row"]}>
          <button onClick={() => { setPriority('high'); setStatus('any'); }} className={styles['quick-btn']}>High Priority</button>
          <button onClick={() => { setStatus('active'); setPriority('any'); }} className={styles['quick-btn']}>Active</button>
          <button onClick={() => { setStatus('completed'); setPriority('any'); }} className={styles['quick-btn']}>Completed</button>

          {/* Sort Toggle */}
          <button
            onClick={() => setSortBy(prev => prev === 'date' || prev === 'date_desc' ? 'date_asc' : 'date_desc')}
            className={styles['quick-btn']}
            style={{ width: 'auto', padding: '0 12px' }}
          >
            Sort: {sortBy === 'date_asc' ? 'Oldest' : 'Newest'}
          </button>
          {selectedIds.length > 0 && (
            <div className={styles["batch-buttons"]}>
              <button onClick={handleBatchDelete} className={styles['batch-delete']}>Delete</button>
              {(() => {
                const selected = displayTodos.filter(t => selectedIds.includes(t.id));
                const allCompleted = selected.length > 0 && selected.every(t => !!t.isCompleted);
                const label = allCompleted ? 'Mark as Undone' : 'Mark as Done';
                return (
                  <button onClick={() => handleBatchMark(!allCompleted)} className={styles['batch-mark']}>{label}</button>
                );
              })()}
              <span className={styles['batch-meta']}>{selectedIds.length} selected</span>
            </div>
          )}
          <div className={styles['quick-meta']}>Showing {pageTodos.length} of {displayTotal}</div>
        </div>

        {/* Results */}
        <div className={styles["results-card"]}>
          <div className={styles.list}>
            {pageTodos.map((todo, idx) => (
              <div
                key={todo.id}
                onClick={(e) => handleRowClick(todo.id, idx, e)}
                className={`${styles.row} ${isSelected(todo.id) ? styles["row-selected"] : ''}`}
                onDoubleClick={() => navigateToDay(todo.dueDate, todo.id)}
                onTouchStart={(e) => {
                  const now = Date.now();
                  if (now - lastTapRef.current < 300) {
                    e.preventDefault();
                    navigateToDay(todo.dueDate, todo.id);
                  }
                  lastTapRef.current = now;
                }}
              >
                <div className={styles["row-left"]}>
                  <div className={styles.stack}>
                    <div className={styles["title-row"]}>
                      <span
                        onDoubleClick={() => navigateToDay(todo.dueDate, todo.id)}
                        title={todo.dueDate ? `Go to ${todo.dueDate}` : 'No date'}
                        className={styles["todo-title"]}
                      >
                        {todo.taskNumber && (
                          <span className={styles["task-number"]}>#{todo.taskNumber}</span>
                        )} {todo.title}
                      </span>
                      <div
                        title={todo.dueDate || 'No date'}
                        className={styles["date-pill"]}
                      >
                        <CalendarIcon />
                        <span style={{ lineHeight: 1 }}>{formatDueDate(todo.dueDate)}</span>
                      </div>
                    </div>
                    {todo.description && <div className={styles.desc}>{todo.description}</div>}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {(todo.tags || []).map(t => (
                        <span key={t.id} className={styles["tag-chip"]} style={{ '--tag-color': t.color, '--tag-color-bg': `${t.color}15`, '--tag-color-border': `${t.color}30` }}>{t.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.actions}>
                  {todo.isFlagged && <FlagIcon filled />}
                  <button onClick={(e) => { e.stopPropagation(); onOpenTodo && onOpenTodo(todo); }} title="Open/Edit" className={styles["icon-btn"]}><EditIcon /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Pagination controls */}
      <div className={styles.pager}>
        <button
          onClick={() => {
            if (page > 1) {
              if (isServerMode) performSearch(page - 1); else setPage(p => Math.max(1, p - 1));
            }
          }}
          disabled={page <= 1}
          className="btn"
        >Prev</button>
        <div className={styles["pager-info"]}>Page {page} of {Math.max(1, Math.ceil((displayTotal || 0) / limit))}</div>
        <div className={styles["pager-info"]} style={{ fontSize: '.9rem' }}>Showing {pageTodos.length} of {displayTotal}</div>
        <button
          onClick={() => {
            const hasMore = (page * limit) < displayTotal;
            if (hasMore) {
              if (isServerMode) performSearch(page + 1); else setPage(p => p + 1);
            }
          }}
          disabled={(page * limit) >= displayTotal}
          className="btn"
        >Next</button>
      </div>
    </div>
  );
};

export default AdvancedSearch;
