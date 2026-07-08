import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import type { Todo } from '@lifeline/shared';
import { useAuth } from '../../app/providers/auth-context';
import { guestApi } from '../../shared/guest/guest-api';
import { CalendarIcon, EditIcon, FlagIcon } from '../../shared/ui/icons';
import { listTodos } from '../todos/data/api';
import { useAllTags, useBatch } from '../todos/data/hooks';
import type { BatchAction } from '../todos/data/hooks';
import { fetchMonthTodos } from './data';
import {
  applyRowSelection,
  buildSearchParams,
  clientPreview,
  dayRouteToken,
  EMPTY_FILTERS,
  filterTodosClient,
  formatDueDateLabel,
  groupThisWeekOlder,
  hasActiveFilters,
} from './search-lib';
import type { SearchFilters, SearchSort } from './search-lib';
import { useDebouncedValue } from './use-debounced-value';
import styles from './AdvancedSearch.module.css';

/**
 * Advanced search — port of the old components/search/AdvancedSearch.jsx on
 * TanStack Query. Dual-mode engine:
 * - client "Preview": debounced 220ms free-text filter over the prefetched
 *   current-month cache (q ≥ 2 chars, ≤ 50 rows), shown until live lands;
 * - server "Live": debounced 400ms GET /todos with all filters, pageSize 10,
 *   Prev/Next pagination;
 * - guest mode filters localStorage todos entirely client-side.
 * Plus (decision 05): include-archived toggle with batch Restore.
 */

const PAGE_SIZE = 10;

export function AdvancedSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { guestMode, checkedIdentity } = useAuth();

  const urlQ = searchParams.get('q') ?? '';
  const [filters, setFilters] = useState<SearchFilters>({ ...EMPTY_FILTERS, q: urlQ });

  // TopBar typing updates ?q= — one-way sync into the local filter state
  // (render-time adjustment, mirroring the old externalQuery effect).
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setFilters((current) => ({ ...current, q: urlQ }));
  }

  const [page, setPage] = useState(1);
  const filtersJson = JSON.stringify(filters);
  const [lastFiltersJson, setLastFiltersJson] = useState(filtersJson);
  if (filtersJson !== lastFiltersJson) {
    setLastFiltersJson(filtersJson);
    setPage(1);
  }

  const tagsQuery = useAllTags();
  const allTags = tagsQuery.data ?? [];

  // Month preload (guest: the full local list).
  const monthQuery = useQuery({
    queryKey: ['search', 'month', guestMode ? 'guest' : 'server'],
    enabled: checkedIdentity,
    queryFn: () => (guestMode ? guestApi.fetchTodos() : fetchMonthTodos()),
  });
  const monthTodos = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);

  // Live server search (debounced 400ms via the serialized filter state).
  const debouncedFiltersJson = useDebouncedValue(filtersJson, 400);
  const debouncedFilters = useMemo(
    () => JSON.parse(debouncedFiltersJson) as SearchFilters,
    [debouncedFiltersJson],
  );
  const liveEnabled = checkedIdentity && !guestMode && hasActiveFilters(debouncedFilters);
  const liveQuery = useQuery({
    queryKey: ['search', 'live', debouncedFiltersJson, page],
    enabled: liveEnabled,
    placeholderData: keepPreviousData,
    queryFn: () => listTodos(buildSearchParams(debouncedFilters, page, PAGE_SIZE)),
  });

  // Client preview (debounced 220ms; disabled when a date range or archived
  // view is requested — the month cache cannot answer those).
  const debouncedQ = useDebouncedValue(filters.q, 220);
  const preview = useMemo(() => {
    if (guestMode || filters.startDate || filters.endDate || filters.includeArchived) return [];
    return clientPreview(monthTodos, debouncedQ);
  }, [
    guestMode,
    monthTodos,
    debouncedQ,
    filters.startDate,
    filters.endDate,
    filters.includeArchived,
  ]);

  // Client filtering for guest mode and the no-filter browse view.
  const clientList = useMemo(
    () => filterTodosClient(monthTodos, filters),
    // filtersJson is the stable serialization of filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthTodos, filtersJson],
  );

  /* ── mode resolution: live > preview > client ───────────────────────────── */

  const liveData = liveEnabled ? liveQuery.data : undefined;
  const mode: 'live' | 'preview' | 'client' =
    liveData !== undefined ? 'live' : preview.length > 0 ? 'preview' : 'client';

  const clientRows = mode === 'preview' ? preview : clientList;
  const totalItems = mode === 'live' ? (liveData?.totalItems ?? 0) : clientRows.length;
  const totalPages =
    mode === 'live'
      ? Math.max(1, liveData?.totalPages ?? 1)
      : Math.max(1, Math.ceil(clientRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageTodos =
    mode === 'live'
      ? (liveData?.items ?? [])
      : clientRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const groups = groupThisWeekOlder(pageTodos, filters.sortBy);
  const rows = groups.grouped ? [...groups.thisWeek, ...groups.older] : pageTodos;
  const rowIds = rows.map((todo) => todo.id);

  /* ── selection ───────────────────────────────────────────────────────────── */

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const rowIdsKey = rowIds.join('|');
  const [lastRowIdsKey, setLastRowIdsKey] = useState(rowIdsKey);
  if (rowIdsKey !== lastRowIdsKey) {
    setLastRowIdsKey(rowIdsKey);
    setSelectedIds([]);
    setAnchorIndex(null);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedIds((current) => (current.length > 0 ? [] : current));
        setAnchorIndex(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleRowClick = (index: number, event: MouseEvent) => {
    const next = applyRowSelection(selectedIds, rowIds, index, event.shiftKey, anchorIndex);
    setSelectedIds(next.selectedIds);
    setAnchorIndex(next.anchorIndex);
  };

  /* ── batch actions ───────────────────────────────────────────────────────── */

  const batch = useBatch();
  const runBatch = async (action: BatchAction) => {
    if (selectedIds.length === 0) return;
    if (action === 'archive') {
      const message = guestMode
        ? `Delete ${selectedIds.length} selected tasks permanently?`
        : `Archive ${selectedIds.length} selected tasks?`;
      if (!window.confirm(message)) return;
    }
    try {
      await batch.mutateAsync({ action, ids: selectedIds });
      setSelectedIds([]);
      setAnchorIndex(null);
      await queryClient.invalidateQueries({ queryKey: ['search'] });
    } catch {
      // Batch failures leave the current view untouched; the next refetch resyncs.
    }
  };

  const selectedRows = rows.filter((todo) => selectedIds.includes(todo.id));
  const allSelectedCompleted =
    selectedRows.length > 0 && selectedRows.every((todo) => todo.isCompleted);

  /* ── navigation ─────────────────────────────────────────────────────────── */

  const goToDay = useCallback(
    (dueDate: string | null, id: string) => {
      if (!dueDate) return;
      void navigate(`/day/${dayRouteToken(dueDate)}?taskId=${id}`);
    },
    [navigate],
  );

  const setFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const modeBadge =
    mode === 'preview'
      ? 'Preview'
      : liveQuery.isFetching && liveEnabled
        ? 'Live — searching'
        : 'Live';

  const renderRow = (todo: Todo, index: number) => (
    <div
      key={todo.id}
      className={[
        styles.row,
        selectedIds.includes(todo.id) ? styles.rowSelected : undefined,
        todo.isCompleted ? styles.rowCompleted : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => handleRowClick(index, event)}
      onDoubleClick={() => goToDay(todo.dueDate, todo.id)}
      data-testid={`search-row-${todo.id}`}
    >
      <div className={styles.rowMain}>
        <div className={styles.titleRow}>
          <span
            className={styles.rowTitle}
            title={todo.dueDate ? `Go to ${todo.dueDate}` : 'No date'}
          >
            <span className={styles.taskNumber}>#{todo.taskNumber}</span> {todo.title}
          </span>
          {todo.archived && <span className={styles.archivedBadge}>Archived</span>}
          <span className={styles.datePill} title={todo.dueDate ?? 'No date'}>
            <CalendarIcon width={13} height={13} />
            {formatDueDateLabel(todo.dueDate)}
          </span>
        </div>
        {todo.description && <div className={styles.rowDescription}>{todo.description}</div>}
        {todo.tags.length > 0 && (
          <div className={styles.rowTags}>
            {todo.tags.map((tag) => (
              <span
                key={tag.id}
                className={styles.tagChip}
                style={{
                  color: tag.color,
                  borderColor: `${tag.color}30`,
                  background: `${tag.color}15`,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.rowActions}>
        {todo.isFlagged && (
          <span className={styles.flag}>
            <FlagIcon filled width={16} height={16} />
          </span>
        )}
        <button
          type="button"
          className={styles.iconButton}
          title="Open/Edit"
          aria-label={`Open task ${todo.taskNumber}`}
          onClick={(event) => {
            event.stopPropagation();
            goToDay(todo.dueDate, todo.id);
          }}
        >
          <EditIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {urlQ ? `Search Results for "${urlQ}"` : 'Advanced Search'}
        </h1>
        <div className={styles.modeInfo}>
          <span>{totalItems} results</span>
          <span className={styles.modeBadge}>{modeBadge}</span>
        </div>
      </div>

      {/* ── filters panel ────────────────────────────────────────────────── */}
      <section className={styles.card}>
        <div className={styles.controlsRow}>
          <input
            className={`${styles.input} ${styles.searchInput}`}
            value={filters.q}
            onChange={(event) => setFilter('q', event.target.value)}
            placeholder="Search title, notes..."
            aria-label="Search text"
          />
          <input
            className={`${styles.input} ${styles.numberInput}`}
            type="number"
            value={filters.taskNumber}
            onChange={(event) => setFilter('taskNumber', event.target.value)}
            placeholder="Task #"
            aria-label="Task number"
          />
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => setFilters({ ...EMPTY_FILTERS })}
          >
            Clear
          </button>
        </div>

        <div className={styles.gridRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="search-priority">
              Priority
            </label>
            <select
              id="search-priority"
              className={styles.select}
              value={filters.priority}
              onChange={(event) =>
                setFilter('priority', event.target.value as SearchFilters['priority'])
              }
            >
              <option value="any">Any</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="search-status">
              Status
            </label>
            <select
              id="search-status"
              className={styles.select}
              value={filters.status}
              onChange={(event) =>
                setFilter('status', event.target.value as SearchFilters['status'])
              }
            >
              <option value="any">Any</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Flagged</span>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={filters.flaggedOnly}
                onChange={(event) => setFilter('flaggedOnly', event.target.checked)}
              />
              <span>Only flagged</span>
            </label>
          </div>
          {!guestMode && (
            <div className={styles.field}>
              <span className={styles.label}>Archived</span>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={filters.includeArchived}
                  onChange={(event) => setFilter('includeArchived', event.target.checked)}
                />
                <span>Include archived</span>
              </label>
            </div>
          )}
        </div>

        <div className={styles.gridRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="search-start">
              Start Date
            </label>
            <input
              id="search-start"
              className={styles.select}
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilter('startDate', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="search-end">
              End Date
            </label>
            <input
              id="search-end"
              className={styles.select}
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilter('endDate', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="search-min">
              Min Duration (min)
            </label>
            <input
              id="search-min"
              className={styles.select}
              type="number"
              value={filters.minDuration}
              onChange={(event) => setFilter('minDuration', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="search-max">
              Max Duration (min)
            </label>
            <input
              id="search-max"
              className={styles.select}
              type="number"
              value={filters.maxDuration}
              onChange={(event) => setFilter('maxDuration', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="search-sort">
              Sort
            </label>
            <select
              id="search-sort"
              className={styles.select}
              value={filters.sortBy}
              onChange={(event) => setFilter('sortBy', event.target.value as SearchSort)}
            >
              <option value="date_desc">Date (newest)</option>
              <option value="date_asc">Date (oldest)</option>
              <option value="priority">Priority</option>
              <option value="duration">Duration</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className={styles.tagsSection}>
          <span className={styles.label}>Tags</span>
          <div className={styles.tagsWrap}>
            {allTags.map((tag) => {
              const active = filters.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={[styles.tag, active ? styles.tagSelected : undefined]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    active
                      ? { borderColor: tag.color, color: tag.color, background: `${tag.color}20` }
                      : undefined
                  }
                  onClick={() =>
                    setFilter(
                      'tagIds',
                      active
                        ? filters.tagIds.filter((id) => id !== tag.id)
                        : [...filters.tagIds, tag.id],
                    )
                  }
                  aria-pressed={active}
                >
                  <span className={styles.tagDot} style={{ background: tag.color }} />
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── quick filters + batch bar ────────────────────────────────────── */}
      <div className={styles.quickRow}>
        <button
          type="button"
          className={styles.quickButton}
          onClick={() => setFilters((current) => ({ ...current, priority: 'high', status: 'any' }))}
        >
          High Priority
        </button>
        <button
          type="button"
          className={styles.quickButton}
          onClick={() =>
            setFilters((current) => ({ ...current, status: 'active', priority: 'any' }))
          }
        >
          Active
        </button>
        <button
          type="button"
          className={styles.quickButton}
          onClick={() =>
            setFilters((current) => ({ ...current, status: 'completed', priority: 'any' }))
          }
        >
          Completed
        </button>
        <button
          type="button"
          className={styles.quickButton}
          onClick={() =>
            setFilter('sortBy', filters.sortBy === 'date_desc' ? 'date_asc' : 'date_desc')
          }
        >
          Sort: {filters.sortBy === 'date_asc' ? 'Oldest' : 'Newest'}
        </button>

        {selectedIds.length > 0 && (
          <div className={styles.batchBar}>
            <button
              type="button"
              className={styles.batchDanger}
              onClick={() => void runBatch('archive')}
            >
              {guestMode ? 'Delete' : 'Archive'}
            </button>
            <button
              type="button"
              className={styles.batchButton}
              onClick={() => void runBatch(allSelectedCompleted ? 'uncomplete' : 'complete')}
            >
              {allSelectedCompleted ? 'Mark as Undone' : 'Mark as Done'}
            </button>
            {!guestMode && filters.includeArchived && (
              <button
                type="button"
                className={styles.batchButton}
                onClick={() => void runBatch('restore')}
              >
                Restore
              </button>
            )}
            <span className={styles.batchMeta}>{selectedIds.length} selected</span>
          </div>
        )}

        <div className={styles.quickMeta}>
          Showing {pageTodos.length} of {totalItems}
        </div>
      </div>

      {/* ── results ──────────────────────────────────────────────────────── */}
      <div className={styles.resultsCard}>
        {rows.length === 0 ? (
          <div className={styles.empty}>
            {monthQuery.isLoading || (liveEnabled && liveQuery.isLoading)
              ? 'Searching…'
              : 'No matching tasks.'}
          </div>
        ) : groups.grouped ? (
          <>
            {groups.thisWeek.length > 0 && (
              <div className={styles.group}>
                <div className={styles.groupHeader}>This Week</div>
                {groups.thisWeek.map((todo) => renderRow(todo, rowIds.indexOf(todo.id)))}
              </div>
            )}
            {groups.older.length > 0 && (
              <div className={styles.group}>
                <div className={styles.groupHeader}>Older</div>
                {groups.older.map((todo) => renderRow(todo, rowIds.indexOf(todo.id)))}
              </div>
            )}
          </>
        ) : (
          rows.map((todo, index) => renderRow(todo, index))
        )}
      </div>

      {/* ── pagination ───────────────────────────────────────────────────── */}
      <div className={styles.pager}>
        <button
          type="button"
          className={styles.pagerButton}
          disabled={currentPage <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Prev
        </button>
        <div className={styles.pagerInfo}>
          Page {currentPage} of {totalPages}
        </div>
        <button
          type="button"
          className={styles.pagerButton}
          disabled={currentPage >= totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
