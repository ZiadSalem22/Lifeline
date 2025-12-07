import React, { useState, useRef, useMemo, useCallback, memo, useEffect } from 'react';
import { createTag } from '../utils/api';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, addDays } from 'date-fns';
import * as guestApi from '../utils/guestApi';
import { useGuestStorage } from '../hooks/useGuestStorage';
import { useApi } from '../hooks/useApi';
import { AuthProvider, useAuthContext } from '../providers/AuthProvider.jsx';
import { ThemeProvider, useTheme } from '../providers/ThemeProvider.jsx';
import { TodoProvider, useTodos } from '../providers/TodoProvider.jsx';
import { Navigate } from 'react-router-dom';
import NotificationPoller from '../providers/NotificationPoller.jsx';
import { SunIcon, MoonIcon, SettingsIcon, CalendarIcon, TomorrowIcon, SearchIcon, ArrowRightIcon, FlagIcon, CheckIcon, DeleteIcon, MenuIcon, SparklesIcon, CloseIcon, EditIcon, NoteIcon } from '../icons/Icons';
import AdvancedSearch from '../components/search/AdvancedSearch';
import AdvancedSearchPage from '../pages/AdvancedSearchPage';
import StatisticsPage from '../pages/StatisticsPage';
import SettingsPage from '../pages/SettingsPage';
import { Settings, ExportImport } from '../components/settings';
import RecurrenceSelector from '../components/calendar/RecurrenceSelector';
import RepeatIcon from '../icons/RepeatIcon';
import DashboardPage from '../pages/DashboardPage';
import AuthPage from '../pages/AuthPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import OnboardingPage from '../pages/OnboardingPage';
import ProfilePage from '../pages/ProfilePage.jsx';
import StatusBanner from '../components/common/StatusBanner.jsx';
function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const guestStorage = useGuestStorage();
  const { fetchWithAuth } = useApi();
  const { currentUser, guestMode, isAuthenticated, checkedIdentity, logout, authLoading, setGuestMode, login } = useAuthContext();
  const { theme, changeTheme, font, themes, changeFont } = useTheme();
  const {
    loading,
    error,
    todos,
    tags,
    filteredTodos,
    selectedDate,
    searchQuery,
    setSearchQuery,
    handleSelectDate,
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    setTodos,
    setTags,
    selectedFilterTags,
    setSelectedFilterTags,
    sortOption,
    setSortOption,
    toggleFlag
  } = useTodos();

  // Guest data reset handled inside AuthProvider now
  
  // Onboarding redirect based on profile
  React.useEffect(() => {
    // Only redirect after we've resolved identity to avoid competing redirects
    if (!checkedIdentity) return;
    // Don't navigate if already on the onboarding route
    if (location && location.pathname === '/onboarding') return;
    if (currentUser?.profile && currentUser.profile.onboarding_completed === false) {
      navigate('/onboarding');
    }
  }, [currentUser, navigate, checkedIdentity, location]);

    // Modal state for new tag creation
    const [showNewTagModal, setShowNewTagModal] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6C63FF');
  const [inputValue, setInputValue] = useState('');
  const [inputDescription, setInputDescription] = useState('');
  const fonts = [
    { name: 'Inter', value: '"Inter", sans-serif' },
    { name: 'DM Sans', value: '"DM Sans", sans-serif' },
    { name: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
    { name: 'Montserrat', value: '"Montserrat", sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", Times, serif' }
  ];
  // selectedDate managed by TodoProvider
  const [scheduleDate, setScheduleDate] = useState('');
  // Provider supplies loading state; legacy local isLoading removed

  const [selectedTags, setSelectedTags] = useState([]);
  const [isFlagged, setIsFlagged] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [priority, setPriority] = useState('medium');

  // searchQuery managed by TodoProvider
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [dueTime, setDueTime] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const inputRef = useRef(null);
  // navigate is declared earlier to avoid temporal dead zone in effects
  
  // selectedFilterTags provided by TodoProvider
  // sortOption managed by TodoProvider
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');
  const [editingTodoDescription, setEditingTodoDescription] = useState('');
  const [editingTodoTags, setEditingTodoTags] = useState([]);
  const [editingTodoSubtasks, setEditingTodoSubtasks] = useState([]);
  const [editingTodoPriority, setEditingTodoPriority] = useState('medium');
  const [editingTodoDuration, setEditingTodoDuration] = useState(0); // minutes
  const [savedMessage, setSavedMessage] = useState('');
  const [draggedTodoId, setDraggedTodoId] = useState(null);
  const [expandedTodoId, setExpandedTodoId] = useState(null);
  // Removed hasLoggedToken (token logging now unnecessary in App layer)

  // Toggle expanded state for a given todo card
  const toggleExpand = useCallback((id) => {
    setExpandedTodoId((prev) => (prev === id ? null : id));
  }, []);

  // handleSelectDate provided by TodoProvider
  // Recurring tasks and export/import states
  const [showRecurrenceSelector, setShowRecurrenceSelector] = useState(false);
  const [currentRecurrence, setCurrentRecurrence] = useState(null);
  const [showExportImport, setShowExportImport] = useState(false);

  const handleThemeChange = useCallback((newTheme) => { changeTheme(newTheme); }, [changeTheme]);
  const handleFontChange = useCallback((newFont) => { /* future: font provider */ }, []);


  // Removed legacy manual data/theme/notification initialization; handled by providers (AuthProvider, TodoProvider, ThemeProvider, NotificationPoller)

  // Removed legacy token logging effect (now handled within AuthProvider if needed)

  // filteredTodos provided by TodoProvider

  const [addTodoError, setAddTodoError] = useState('');
  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    setAddTodoError('');
    if (!inputValue.trim()) return;
    const totalDuration = (parseInt(hours) * 60) + parseInt(minutes);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const effectiveDate = scheduleDate && scheduleDate.includes('-')
        ? scheduleDate
        : (selectedDate === 'today' ? todayStr
         : (selectedDate === 'tomorrow' ? format(addDays(new Date(), 1), 'yyyy-MM-dd')
          : (typeof selectedDate === 'string' && selectedDate.includes('-') ? selectedDate : '')));
      await createTodo({
        title: inputValue.trim(),
        dueDate: effectiveDate || null,
        tags: selectedTags,
        isFlagged,
        duration: totalDuration,
        priority,
        dueTime: dueTime || null,
        subtasks,
        description: inputDescription,
        recurrence: currentRecurrence
      });
      setInputValue('');
      setInputDescription('');
      setHours(0);
      setMinutes(0);
      setDueTime('');
      setSubtasks([]);
      setNewSubtask('');
      setSelectedTags([]);
      setIsFlagged(false);
      setPriority('medium');
      setCurrentRecurrence(null);
      setShowTagInput(false);
      inputRef.current?.focus();
    } catch (error) {
      setAddTodoError(error?.message || 'Failed to add todo');
      console.error('Failed to add todo', error);
    }
  }, [inputValue, inputDescription, scheduleDate, selectedDate, selectedTags, isFlagged, hours, minutes, priority, dueTime, subtasks, currentRecurrence, createTodo]);

  const handleUpdateTodo = useCallback(async (id, updates) => {
    try {
      // Delegate to provider's updateTodo so normalization and state management are centralized
      const updated = await updateTodo(id, updates);
      return updated;
    } catch (error) {
      console.error('Failed to update todo', error);
      throw error;
    }
  }, [updateTodo]);

  const handleStartEdit = useCallback((todo) => {
    setEditingTodoId(todo.id);
    setEditingTodoTitle(todo.title);
    setEditingTodoDescription(todo.description || '');
    setEditingTodoTags((todo.tags || []).map(t => t.id));
    setEditingTodoSubtasks(todo.subtasks ? todo.subtasks.map(st => ({ ...st })) : []);
    setEditingTodoPriority(todo.priority || 'medium');
    setEditingTodoDuration(todo.duration || 0);
  }, []);

  const handleSaveEdit = useCallback(async (id) => {
    if (!editingTodoTitle.trim()) return;
    // Build updates including tags (convert ids to tag objects), subtasks, priority and duration
    const updates = { title: editingTodoTitle.trim(), description: editingTodoDescription, subtasks: editingTodoSubtasks, priority: editingTodoPriority, duration: editingTodoDuration };
    // Map tag ids to full tag objects using `tags` from parent scope
    const selectedTags = tags.filter(t => editingTodoTags.includes(t.id));
    updates.tags = selectedTags;
    await handleUpdateTodo(id, updates);
    setEditingTodoId(null);
    setEditingTodoTitle('');
    setEditingTodoDescription('');
    setEditingTodoTags([]);
    setEditingTodoSubtasks([]);
    setEditingTodoPriority('medium');
    setEditingTodoDuration(0);
    // Show saved toast
    setSavedMessage('Saved');
    setTimeout(() => setSavedMessage(''), 1800);
  }, [editingTodoTitle, editingTodoDescription, editingTodoTags, editingTodoSubtasks, editingTodoPriority, editingTodoDuration, handleUpdateTodo, tags]);

  const handleCancelEdit = useCallback(() => {
    setEditingTodoId(null);
    setEditingTodoTitle('');
    setEditingTodoDescription('');
  }, []);

  const handleToggle = useCallback(async (id) => {
    try {
      // Use provider's toggleTodo to keep state handling consistent
      await toggleTodo(id);
    } catch (error) {
      console.error('Failed to toggle todo', error);
    }
  }, [toggleTodo]);

  const handleFlag = useCallback(async (id, e) => {
    e.stopPropagation();
    try {
      // Use provider's toggleFlag
      await toggleFlag(id);
    } catch (error) {
      console.error("Failed to toggle flag", error);
    }
  }, [toggleFlag]);

  const handleUpdatePriority = useCallback(async (id, newPriority) => {
    try {
      await handleUpdateTodo(id, { priority: newPriority });
    } catch (error) {
      console.error('Failed to update priority', error);
    }
  }, [handleUpdateTodo]);

  const handleDragStart = useCallback((event, todoId) => {
    try {
      event.dataTransfer.setData('text/plain', todoId);
      event.dataTransfer.effectAllowed = 'move';
    } catch (error) {
      console.error('Failed to start drag', error);
    }
  }, []);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((event, targetTodoId) => {
    try {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData('text/plain');
      if (!sourceId || sourceId === targetTodoId) {
        return;
      }

      setTodos((prevTodos) => {
        const sourceIndex = prevTodos.findIndex((t) => t.id === sourceId);
        const targetIndex = prevTodos.findIndex((t) => t.id === targetTodoId);
        if (sourceIndex === -1 || targetIndex === -1) {
          return prevTodos;
        }

        const updated = [...prevTodos];
        const [moved] = updated.splice(sourceIndex, 1);
        updated.splice(targetIndex, 0, moved);
        return updated;
      });
    } catch (error) {
      console.error('Failed to handle drop', error);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      // Delegate to provider to keep state updates centralized
      await deleteTodo(id);
    } catch (error) {
      console.error("Failed to delete todo", error);
    }
  }, [deleteTodo]);

  const toggleTagSelection = (tag) => {
    if (selectedTags.find(t => t.id === tag.id)) {
      setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const formatDuration = useCallback((totalMinutes) => {
    if (!totalMinutes) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }, []);

  const title = useMemo(() => {
    if (searchQuery.trim()) return `Search Results for "${searchQuery}"`;
    if (selectedDate === 'today') return 'Today';
    if (selectedDate === 'tomorrow') return 'Tomorrow';
    // Check if selectedDate is a valid date string before creating a Date object
    if (selectedDate && typeof selectedDate === 'string' && selectedDate.includes('-')) {
      const date = new Date(selectedDate + 'T00:00:00');
      return format(date, 'EEEE, MMMM d');
    }
    // Handle case where selectedDate is a Date object
    if (selectedDate instanceof Date) {
      return format(selectedDate, 'EEEE, MMMM d');
    }
    return 'All Tasks'; // Fallback title
  }, [searchQuery, selectedDate]);
  const searchActive = useMemo(() => searchQuery.trim().length > 0, [searchQuery]);

  const handleGoToDay = useCallback((dateString) => {
    if (!dateString) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    if (dateString === today) handleSelectDate('today');
    else if (dateString === tomorrow) handleSelectDate('tomorrow');
    else handleSelectDate(dateString);
    const token = (dateString === today) ? 'today' : (dateString === tomorrow) ? 'tomorrow' : dateString;
    navigate(`/day/${token}`);
  }, [navigate, handleSelectDate]);

  // Keep selectedDate in sync with the URL when visiting /day/:day
  React.useEffect(() => {
    const m = location.pathname.match(/^\/day\/(today|tomorrow|\d{4}-\d{2}-\d{2})$/);
    if (m) {
      const token = m[1];
      if (selectedDate !== token) {
        handleSelectDate(token);
      }
    }
  }, [location.pathname, selectedDate, handleSelectDate]);

  const completedCount = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const dateFiltered = todos.filter(todo => {
      const due = todo.dueDate;
      // exact matches
      if (selectedDate === 'tomorrow' && due === tomorrow) return true;
      if (selectedDate === 'today' && due === today) return true;
      if (typeof selectedDate === 'string' && selectedDate.includes('-') && due === selectedDate) return true;
      // dateRange recurrence that covers the selected date
      try {
        if (todo.recurrence && todo.recurrence.mode === 'dateRange') {
          const start = todo.recurrence.startDate || due;
          const end = todo.recurrence.endDate || due;
          if (start && end) {
            let sel = selectedDate;
            if (selectedDate === 'today') sel = today;
            if (selectedDate === 'tomorrow') sel = tomorrow;
            if (typeof sel === 'string' && sel.includes('-') && sel >= start && sel <= end) return true;
          }
        }
      } catch (e) {
        // ignore and continue
      }
      // otherwise exclude when date-specific view
      if (selectedDate === 'today' || selectedDate === 'tomorrow' || (typeof selectedDate === 'string' && selectedDate.includes('-'))) return false;
      return true;
    });
    return dateFiltered.filter(t => t.isCompleted).length;
  }, [todos, selectedDate]);
  const totalDurationMinutes = useMemo(() => filteredTodos.reduce((acc, todo) => acc + (todo.duration || 0), 0), [filteredTodos]);
  const durationString = useMemo(() => formatDuration(totalDurationMinutes), [totalDurationMinutes]);
  const progress = useMemo(() => filteredTodos.length > 0 ? (completedCount / filteredTodos.length) * 100 : 0, [filteredTodos.length, completedCount]);

  // Ensure incomplete tasks appear before completed ones on Home
  const orderedTodos = useMemo(() => {
    // Preserve current sort within each group; just group by completion
    const incomplete = [];
    const complete = [];
    for (const t of filteredTodos) {
      (t.isCompleted ? complete : incomplete).push(t);
    }
    return [...incomplete, ...complete];
  }, [filteredTodos]);

  const sidebarProps = {
    selectedDate,
    onSelectDate: handleSelectDate,
    isOpen: isMobileSidebarOpen,
    onClose: () => setIsMobileSidebarOpen(false),
    searchQuery,
    setSearchQuery,
    onOpenSettings: () => setShowSettings(true),
    onOpenLogin: () => login && login(),
    onNavigate: setCurrentPage,
    theme,
    setTheme: handleThemeChange,
  };

  const topBarProps = {
    onOpenSettings: () => setShowSettings(true),
    onOpenExportImport: () => setShowExportImport(true),
    searchQuery,
    setSearchQuery,
    onOpenSidebar: () => setIsMobileSidebarOpen(true),
    isMobileSidebarOpen,
    onLoginClick: () => navigate('/auth'),
    onOpenProfile: () => navigate('/profile'),
    currentUser,
    guestMode,
    onLogout: () => logout({ logoutParams: { returnTo: window.location.origin } })
  };

  const settingsProps = {
    isOpen: showSettings,
    onClose: () => setShowSettings(false),
    tags,
    setTags,
    theme,
    themes,
    setTheme: handleThemeChange,
    font,
    fonts,
    setFont: handleFontChange,
    fetchWithAuth,
  };

  const recurrenceProps = {
    recurrence: currentRecurrence,
    baseDate: scheduleDate,
    isOpen: showRecurrenceSelector,
    onClose: () => setShowRecurrenceSelector(false),
    onApply: (recurrence) => {
      setCurrentRecurrence(recurrence);
      setShowRecurrenceSelector(false);
    },
    onClear: () => {
      setCurrentRecurrence(null);
      setShowRecurrenceSelector(false);
    },
  };

  const exportImportProps = {
    isOpen: showExportImport,
    onClose: () => setShowExportImport(false),
    onImportComplete: () => { setShowExportImport(false); },
    fetchWithAuth,
  };

  const commonOverlays = (
    <>
      <Settings {...settingsProps} />
      <RecurrenceSelector {...recurrenceProps} />
      <ExportImport {...exportImportProps} />
    </>
  );

  const renderHeroSection = () => (
        <div className="fade-in-slide-down home-hero app-hero-section">
      <div className="header-content">
        <h1 className="header-title">{title}</h1>
        {durationString && (
          <span className="duration-pill scale-in">{durationString}</span>
        )}
      </div>

      <div className="home-progress-row">
            <p className="home-progress-text app-progress-text">
          {completedCount} of {filteredTodos.length} completed
        </p>
        {filteredTodos.length > 0 && (
          <div className="home-progress-meter">
            <div className="home-progress-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {!searchActive && (
        <div className="home-filters-row">
          {tags.length > 0 && (
            <div className="home-filter-chips">
              <span className="home-filter-label">Filter:</span>
              {tags.map((tag) => {
                const isActive = selectedFilterTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      setSelectedFilterTags((prev) =>
                        prev.includes(tag.id)
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id]
                      );
                    }}
                    className={`home-filter-chip${isActive ? ' home-filter-chip--active' : ''}`}
                    style={{ '--chip-color': tag.color }}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {selectedFilterTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFilterTags([])}
                  className="home-filter-chip"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="home-sort-select"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="duration">Sort by Duration</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      )}
    </div>
  );

  if (loading || !checkedIdentity) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'transparent' }}>
        {/* <CosmicBackground /> */}
        <div className="fade-in-scale" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid var(--color-surface)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p style={{ color: 'var(--color-text)', fontWeight: 600 }}>Loading your tasks...</p>
        </div>
      </div>
    );
  }

  // Use react-router routes so the URL controls the view
  return (
    <>
      <StatusBanner />
      <NotificationPoller onNotify={() => { /* future: show notification toast */ }} />
      <Routes>
        {/* Day-specific route mirrors the home dashboard but with URL reflecting the selected day */}
        <Route path="/day/:day" element={
            <DashboardPage sidebarProps={sidebarProps} topBarProps={topBarProps}>
            {guestMode && (
              <div style={{ marginTop: '8px', marginBottom: '16px' }}>
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  padding: '12px 16px',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Hello guest</div>
                  <div style={{ fontSize: '0.95rem' }}>
                    You are using Guest Mode. Your tasks and tags are stored locally on this browser. Sign in to sync across devices.
                  </div>
                </div>
              </div>
            )}
              {/* Reuse the same dashboard content by rendering the same JSX as the home route below */}
              {/* Saved toast */}
            {savedMessage && (
              <div style={{ position: 'fixed', right: '20px', top: '80px', zIndex: 60 }}>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '10px', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', color: 'var(--color-text)', fontWeight: 600 }}>
                  {savedMessage}
                </div>
              </div>
                )}
              <div
                className="fade-in-slide-down"
                style={{ marginBottom: '48px' }}
              >
              <div className="header-content" style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <h1 className="header-title" style={{
                  fontFamily: 'var(--font-family-heading)',
                  fontWeight: 'bold',
                  color: 'var(--color-text)',
                  margin: 0
                }}>
                  {title}
                </h1>
                {durationString && (
                  <span
                    className="scale-in"
                    style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      background: 'var(--color-surface)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    {durationString}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-base)', margin: 0 }}>
                  {completedCount} of {filteredTodos.length} completed
                </p>
                {filteredTodos.length > 0 && (
                  <div style={{ flex: 1, maxWidth: '300px' }}>
                    <div style={{
                      height: '6px',
                      background: 'var(--color-surface)',
                      borderRadius: '9999px',
                      overflow: 'hidden'
                    }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          height: '100%',
                          background: 'var(--color-primary)',
                          borderRadius: '9999px',
                          width: `${progress}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* When searching: show results immediately below header; otherwise show filters first */}
              {!searchActive && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Tag Filter */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginRight: '4px' }}>Filter:</span>
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedFilterTags(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          border: `1px solid ${selectedFilterTags.includes(tag.id) ? tag.color : 'var(--color-border)'}`,
                          background: selectedFilterTags.includes(tag.id) ? `${tag.color}20` : 'transparent',
                          color: selectedFilterTags.includes(tag.id) ? tag.color : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                    {selectedFilterTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFilterTags([])}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-muted)',
                          background: 'transparent',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
                
                {/* Sort Dropdown */}
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    paddingRight: '32px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="date" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Date</option>
                  <option value="priority" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Priority</option>
                  <option value="duration" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Duration</option>
                  <option value="name" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Name</option>
                </select>
                
                </div>
              )}
            </div>
            {/* Task List (search results elevated if searching) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: searchActive ? '8px' : '0' }}>
              {filteredTodos.length === 0 && (
                <div
                  className="fade-in-scale-up"
                  style={{
                    textAlign: 'center',
                    padding: '80px 0'
                  }}
                >
                    <div
                      className="rotate-scale-infinite"
                      style={{ fontSize: '3rem', marginBottom: '16px', color: 'var(--color-primary)' }}
                    >
                      <SparklesIcon />
                    </div>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontFamily: 'var(--font-family-heading)',
                      fontWeight: '600',
                      color: 'var(--color-text)',
                      marginBottom: '8px'
                    }}>
                      All clear!
                    </h3>
                    <p style={{
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-family-base)',
                      margin: 0
                    }}>
                      No tasks for {title.toLowerCase()}
                    </p>
                  </div>
                )}

                {orderedTodos.map((todo, index) => (
                  <TaskCard
                    key={todo.id}
                    todo={todo}
                    index={index}
                    theme={theme}
                    onToggle={handleToggle}
                    onFlag={handleFlag}
                    onDelete={handleDelete}
                    formatDuration={formatDuration}
                    showDate={!!searchQuery.trim()}
                    onGoToDay={handleGoToDay}
                    isEditing={editingTodoId === todo.id}
                    editingTitle={editingTodoTitle}
                    editingDescription={editingTodoDescription}
                    editingTags={editingTodoTags}
                    setEditingTags={setEditingTodoTags}
                    editingSubtasks={editingTodoSubtasks}
                    setEditingSubtasks={setEditingTodoSubtasks}
                    editingPriority={editingTodoPriority}
                    setEditingPriority={setEditingTodoPriority}
                    editingDuration={editingTodoDuration}
                    setEditingDuration={setEditingTodoDuration}
                    allTags={tags}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    setEditingTitle={setEditingTodoTitle}
                    setEditingDescription={setEditingTodoDescription}
                    onUpdatePriority={handleUpdatePriority}
                    onUpdateTodo={handleUpdateTodo}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    isExpanded={expandedTodoId === todo.id}
                    onToggleExpand={() => toggleExpand(todo.id)}
                    setTodos={setTodos}
                    selectedFilterTags={selectedFilterTags}
                    setSelectedFilterTags={setSelectedFilterTags}
                  />
                ))}

              </div>
            {/* Add Task Form hidden when searching */}
            {!searchActive && (
              <form
              className="add-task-form add-task-form-animation"
              onSubmit={handleAdd}
              style={{
                marginTop: '32px',
                marginBottom: '40px',
                background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-light) 100%)',
                backdropFilter: 'blur(12px) saturate(160%)',
                borderRadius: '20px',
                padding: '28px 28px 24px',
                border: '1px solid var(--color-border)',
                boxShadow: '0 12px 32px -10px rgba(0,0,0,0.35)',
                transition: 'box-shadow 0.3s ease',
              }}
            >
              {/* Title on top, then description, then centered controls */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Title — What do you want to accomplish?"
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-light)',
                    color: 'var(--color-text)',
                    fontSize: '1.125rem',
                    fontFamily: 'var(--font-family-base)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    outline: 'none',
                    boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)',
                    fontWeight: 600
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                />
              </div>
              {/* (rest of form remains unchanged; omitted for brevity) */}
              </form>
            )}
            </DashboardPage>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage sidebarProps={sidebarProps} topBarProps={topBarProps} />
          </ProtectedRoute>
        } />
                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <OnboardingPage
                      user={currentUser}
                      guestMode={guestMode}
                      onCompleted={() => navigate('/')}
                    />
                  </ProtectedRoute>
                } />
        <Route path="/search" element={
            <AdvancedSearchPage
              sidebarProps={sidebarProps}
              topBarProps={topBarProps}
              searchProps={{
                onBack: () => navigate('/'),
                onOpenTodo: (todo) => { try { handleStartEdit(todo); } catch (e) {} ; navigate('/'); },
                onGoToDay: (date) => { try { handleGoToDay(date); } catch (e) {} ; navigate('/'); },
                fetchWithAuth,
                guestMode,
                guestTodos: todos,
                guestTags: tags,
              }}
            />
        } />

        <Route path="/advanced-search" element={
            <AdvancedSearchPage
              sidebarProps={sidebarProps}
              topBarProps={topBarProps}
              searchProps={{
                onBack: () => navigate('/'),
                onOpenTodo: (todo) => { try { handleStartEdit(todo); } catch (e) {} ; navigate('/'); },
                onGoToDay: (date) => { try { handleGoToDay(date); } catch (e) {} ; navigate('/'); },
                fetchWithAuth,
                guestMode,
                guestTodos: todos,
                guestTags: tags,
              }}
            />
        } />

        <Route path="/statistics" element={
            <StatisticsPage sidebarProps={sidebarProps} topBarProps={topBarProps} statsProps={{ onBack: () => navigate('/'), fetchWithAuth, guestMode, guestTodos: todos, guestTags: tags }} />
        } />

        <Route path="/stats" element={
            <StatisticsPage sidebarProps={sidebarProps} topBarProps={topBarProps} statsProps={{ onBack: () => navigate('/'), fetchWithAuth, guestMode, guestTodos: todos, guestTags: tags }} />
        } />

        <Route path="/auth" element={<AuthPage />} />


        {/* Remove auth route; guest mode uses home */}

        <Route path="/" element={
            <DashboardPage sidebarProps={sidebarProps} topBarProps={topBarProps}>
            {guestMode && (
              <div style={{ marginTop: '8px', marginBottom: '16px' }}>
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  padding: '12px 16px',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Hello guest</div>
                  <div style={{ fontSize: '0.95rem' }}>
                    You are using Guest Mode. Your tasks and tags are stored locally on this browser. Sign in to sync across devices.
                  </div>
                </div>
              </div>
            )}
            {/* Saved toast */}
            {savedMessage && (
              <div style={{ position: 'fixed', right: '20px', top: '80px', zIndex: 60 }}>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '10px', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', color: 'var(--color-text)', fontWeight: 600 }}>
                  {savedMessage}
                </div>
              </div>
                )}
              <div
                className="fade-in-slide-down"
                style={{ marginBottom: '48px' }}
              >
              <div className="header-content" style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <h1 className="header-title" style={{
                  fontFamily: 'var(--font-family-heading)',
                  fontWeight: 'bold',
                  color: 'var(--color-text)',
                  margin: 0
                }}>
                  {title}
                </h1>
                {durationString && (
                  <span
                    className="scale-in"
                    style={{
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      background: 'var(--color-surface)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    {durationString}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-family-base)', margin: 0 }}>
                  {completedCount} of {filteredTodos.length} completed
                </p>
                {filteredTodos.length > 0 && (
                  <div style={{ flex: 1, maxWidth: '300px' }}>
                    <div style={{
                      height: '6px',
                      background: 'var(--color-surface)',
                      borderRadius: '9999px',
                      overflow: 'hidden'
                    }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          height: '100%',
                          background: 'var(--color-primary)',
                          borderRadius: '9999px',
                          width: `${progress}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {!searchActive && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Tag Filter */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginRight: '4px' }}>Filter:</span>
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedFilterTags(prev =>
                            prev.includes(tag.id)
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          border: `1px solid ${selectedFilterTags.includes(tag.id) ? tag.color : 'var(--color-border)'}`,
                          background: selectedFilterTags.includes(tag.id) ? `${tag.color}20` : 'transparent',
                          color: selectedFilterTags.includes(tag.id) ? tag.color : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                    {selectedFilterTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFilterTags([])}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-muted)',
                          background: 'transparent',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
                
                {/* Sort Dropdown */}
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    paddingRight: '32px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="date" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Date</option>
                  <option value="priority" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Priority</option>
                  <option value="duration" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Duration</option>
                  <option value="name" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Sort by Name</option>
                </select>
                
                </div>
              )}
            </div>        {/* Add Task Form */}
            {addTodoError && !searchActive && (
              <div style={{
                color: 'var(--color-danger)',
                background: 'rgba(255,0,0,0.08)',
                border: '1px solid var(--color-danger)',
                borderRadius: '8px',
                padding: '10px 16px',
                marginBottom: '12px',
                fontWeight: 500,
                textAlign: 'center',
                fontSize: '1rem',
                letterSpacing: '0.01em',
              }}>
                {addTodoError}
              </div>
            )}
            {/* Hide add task form when searching */}
            {!searchActive && (
            <form
              className="add-task-form add-task-form-animation"
              onSubmit={handleAdd}
              style={{
                marginBottom: '40px',
                background: 'linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-light) 100%)',
                backdropFilter: 'blur(12px) saturate(160%)',
                borderRadius: '20px',
                padding: '28px 28px 24px',
                border: '1px solid var(--color-border)',
                boxShadow: '0 12px 32px -10px rgba(0,0,0,0.35)',
                transition: 'box-shadow 0.3s ease',
              }}
            >
              {/* Title on top, then description, then centered controls */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Title — What do you want to accomplish?"
                  style={{
                    width: '100%',
                    background: 'var(--color-surface-light)',
                    color: 'var(--color-text)',
                    fontSize: '1.125rem',
                    fontFamily: 'var(--font-family-base)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    outline: 'none',
                    boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.02)',
                    fontWeight: 600
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <textarea
                  value={inputDescription}
                  onChange={e => setInputDescription(e.target.value)}
                  placeholder="Add notes or description (optional)"
                  style={{
                    width: '100%',
                    minHeight: '64px',
                    background: 'var(--color-surface-light)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                <select
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    paddingRight: '32px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-family-base)',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.1s ease-out'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  {[...Array(13).keys()].map(h => <option key={h} value={h} style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>{h}h</option>)}
                </select>

                <select
                  value={minutes}
                  onChange={e => setMinutes(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    paddingRight: '32px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    fontFamily: 'var(--font-family-base',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.1s ease-out'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => <option key={m} value={m} style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>{m}m</option>)}
                </select>

                <button
                  type="button"
                  className="button-hover-scale"
                  onClick={() => setIsFlagged(!isFlagged)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    transition: 'all 0.1s ease-out',
                    border: isFlagged ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                    background: isFlagged ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-surface)',
                    color: isFlagged ? 'var(--color-danger)' : 'var(--color-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  <FlagIcon filled={isFlagged} />
                </button>

                <button
                  type="button"
                  className="button-hover-scale"
                  onClick={() => setShowTagInput(!showTagInput)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                >
                  #
                </button>

                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.1s ease-out'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                />

                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.1s ease-out'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                  placeholder="Time"
                />

                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    paddingRight: '32px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.1s ease-out'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                >
                  <option value="low" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Low Priority</option>
                  <option value="medium" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>Medium Priority</option>
                  <option value="high" style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>High Priority</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowRecurrenceSelector(true)}
                  title={currentRecurrence ? `Recurring ${currentRecurrence.type}` : 'Set recurrence'}
                  style={{
                    padding: '8px 16px',
                    background: currentRecurrence ? 'var(--color-primary)' : 'var(--color-surface)',
                    border: `1px solid ${currentRecurrence ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: '8px',
                    color: currentRecurrence ? 'var(--color-bg)' : 'var(--color-text)',
                    fontWeight: currentRecurrence ? '600' : '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease-out'
                  }}
                  onMouseEnter={(e) => {
                    if (!currentRecurrence) {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!currentRecurrence) {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }
                  }}
                >
                  {currentRecurrence ? `${currentRecurrence.type}` : 'Recurrence'}
                </button>

                <button
                  type="submit"
                  className="button-hover-scale-bg"
                  style={{
                    padding: '10px 28px',
                    background: 'var(--color-primary)',
                    borderRadius: '14px',
                    color: 'var(--color-bg)',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.25s ease, transform 0.2s ease',
                    boxShadow: '0 6px 18px -6px var(--shadow-primary)',
                    margin: '12px auto 0'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-primary-dark)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-primary)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Add Task
                </button>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(16, 185, 129, 0.1)' }}>
                {/* Subtasks */}
                <div style={{ marginBottom: showTagInput ? '16px' : '0' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSubtask.trim()) {
                          e.preventDefault();
                          setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtask.trim(), isCompleted: false }]);
                          setNewSubtask('');
                        }
                      }}
                      placeholder="Add subtask..."
                      style={{
                        flex: 1,
                        background: 'var(--color-surface-light)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        color: 'var(--color-text)',
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newSubtask.trim()) {
                          setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtask.trim(), isCompleted: false }]);
                          setNewSubtask('');
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--color-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'var(--color-bg)',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {subtasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {subtasks.map((subtask, idx) => (
                        <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: 'var(--color-surface-light)', borderRadius: '6px' }}>
                          <input
                            type="checkbox"
                            checked={subtask.isCompleted}
                            onChange={() => {
                              const updated = [...subtasks];
                              updated[idx].isCompleted = !updated[idx].isCompleted;
                              setSubtasks(updated);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text)', textDecoration: subtask.isCompleted ? 'line-through' : 'none' }}>
                            {subtask.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSubtasks(subtasks.filter((_, i) => i !== idx))}
                            style={{
                              padding: '4px 8px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                {showTagInput && (
                  <div
                    className="fade-in-height-auto"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignItems: 'center'
                    }}
                  >
                    {/* Plus icon button for new tag */}
                    <button
                      type="button"
                      aria-label="Add new tag"
                      onClick={() => setShowNewTagModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: '1.5px solid var(--color-border)',
                        background: 'var(--color-surface-light)',
                        color: 'var(--color-primary)',
                        fontSize: 20,
                        cursor: 'pointer',
                        marginRight: 2,
                        boxShadow: '0 2px 8px 0 var(--shadow-light)'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="10" y1="4" x2="10" y2="16" />
                        <line x1="4" y1="10" x2="16" y2="10" />
                      </svg>
                    </button>
                    {/* Tag buttons */}
                    {tags.map((tag, i) => {
                      const active = !!selectedTags.find(t => t.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          className="tag-button-fade-in-scale"
                          type="button"
                          onClick={() => toggleTagSelection(tag)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            borderRadius: '999px',
                            border: active ? `1px solid ${tag.color}` : '1px solid var(--color-border)',
                            background: active ? `${tag.color}20` : 'transparent',
                            color: active ? tag.color : 'var(--color-text-muted)',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            transition: 'all 0.12s ease-out',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: 8, background: tag.color, display: 'inline-block', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }} />
                          <span style={{ lineHeight: 1 }}>{tag.name}</span>
                        </button>
                      );
                    })}
                    {tags.length === 0 && (
                      <p style={{
                        fontSize: '0.875rem',
                        color: 'var(--color-text-muted)',
                        margin: 0
                      }}>
                        No tags yet.
                      </p>
                    )}
                  </div>
                )}
                  {/* Render New Tag Modal at the end of App for full overlay */}
                  {showNewTagModal && (
                    <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1200,
                        background: 'rgba(0,0,0,0.32)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => setShowNewTagModal(false)}
                    >
                      <div
                        style={{
                          background: 'var(--color-surface)',
                          borderRadius: 18,
                          boxShadow: '0 8px 32px 0 var(--shadow-dark)',
                          padding: '32px 28px 24px 28px',
                          minWidth: 340,
                          maxWidth: 400,
                          width: '90vw',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 18,
                          position: 'relative',
                          animation: 'fadeInScale 0.18s cubic-bezier(.4,1.3,.6,1)'
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label="Close"
                          onClick={() => setShowNewTagModal(false)}
                          style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            fontSize: 22,
                            cursor: 'pointer',
                            zIndex: 2
                          }}
                        >
                          ×
                        </button>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>Create New Tag</h3>
                        <input
                          type="text"
                          placeholder="Tag name"
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            fontSize: '1rem',
                            marginBottom: 8,
                          }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>Color:</label>
                          <input
                            type="color"
                            value={newTagColor}
                            onChange={e => setNewTagColor(e.target.value)}
                            style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.95rem', color: newTagColor }}>{newTagColor}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => setShowNewTagModal(false)}
                            style={{
                              padding: '6px 16px',
                              borderRadius: 8,
                              border: 'none',
                              background: 'var(--color-surface-light)',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!newTagName.trim()) return;
                              try {
                                const newTag = guestMode
                                  ? await guestApi.createTag(newTagName.trim(), newTagColor)
                                  : await createTag(newTagName.trim(), newTagColor, fetchWithAuth);
                                setTags(prev => [...prev, newTag]);
                                setShowNewTagModal(false);
                                setNewTagName('');
                                setNewTagColor('#6C63FF');
                              } catch (err) {
                                alert('Failed to create tag.');
                              }
                            }}
                            style={{
                              padding: '6px 16px',
                              borderRadius: 8,
                              border: 'none',
                              background: 'var(--color-primary)',
                              color: 'var(--color-bg)',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            disabled={!newTagName.trim()}
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
                </form>
              )}

            {/* Task List */}
              <div className="task-list-column" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: searchActive ? '8px' : '0' }}>
              {filteredTodos.length === 0 && (
                <div
                  className="fade-in-scale-up empty-state"
                  style={{
                    textAlign: 'center',
                    padding: '80px 0'
                  }}
                >
                    <div
                      className="rotate-scale-infinite empty-state-icon"
                      style={{ fontSize: '3rem', marginBottom: '16px', color: 'var(--color-primary)' }}
                    >
                      <SparklesIcon />
                    </div>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontFamily: 'var(--font-family-heading)',
                      fontWeight: '600',
                      color: 'var(--color-text)',
                      marginBottom: '8px'
                    }}>
                      All clear!
                    </h3>
                    <p style={{
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-family-base)',
                      margin: 0
                    }}>
                      No tasks for {title.toLowerCase()}
                    </p>
                  </div>
                )}

                {orderedTodos.map((todo, index) => (
                  <TaskCard
                    key={todo.id}
                    todo={todo}
                    index={index}
                    theme={theme}
                    onToggle={handleToggle}
                    onFlag={handleFlag}
                    onDelete={handleDelete}
                    formatDuration={formatDuration}
                    showDate={!!searchQuery.trim()}
                    onGoToDay={handleGoToDay}
                    isEditing={editingTodoId === todo.id}
                    editingTitle={editingTodoTitle}
                    editingDescription={editingTodoDescription}
                    editingTags={editingTodoTags}
                    setEditingTags={setEditingTodoTags}
                    editingSubtasks={editingTodoSubtasks}
                    setEditingSubtasks={setEditingTodoSubtasks}
                    editingPriority={editingTodoPriority}
                    setEditingPriority={setEditingTodoPriority}
                    editingDuration={editingTodoDuration}
                    setEditingDuration={setEditingTodoDuration}
                    allTags={tags}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    setEditingTitle={setEditingTodoTitle}
                    setEditingDescription={setEditingTodoDescription}
                    onUpdatePriority={handleUpdatePriority}
                    onUpdateTodo={handleUpdateTodo}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    isExpanded={expandedTodoId === todo.id}
                    onToggleExpand={() => toggleExpand(todo.id)}
                    setTodos={setTodos}
                    selectedFilterTags={selectedFilterTags}
                    setSelectedFilterTags={setSelectedFilterTags}
                  />
                ))}

              </div>
            </DashboardPage>
          } />

        {/* Catch-all: redirect any unknown path to home */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>

      {commonOverlays}

    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TodoProvider>
          <AppInner />
        </TodoProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

// Task Card Component
// Small modern chevron icon used for subtasks toggle
const ChevronIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M6 9l6 6 6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const TaskCard = memo(({ todo, index, onToggle, onFlag, onDelete, formatDuration, showDate, onGoToDay, isEditing, editingTitle, editingDescription, editingTags, setEditingTags, editingSubtasks, setEditingSubtasks, editingPriority, setEditingPriority, editingDuration, setEditingDuration, allTags, onStartEdit, onSaveEdit, onCancelEdit, setEditingTitle, setEditingDescription, onUpdatePriority, onUpdateTodo, onDragStart, onDragOver, onDrop, isExpanded, onToggleExpand, setTodos, selectedFilterTags, setSelectedFilterTags }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [subtaskEditingId, setSubtaskEditingId] = useState(null);
  const [subtaskEditingText, setSubtaskEditingText] = useState('');
  const [hoveredSubtaskId, setHoveredSubtaskId] = useState(null);
  const [showNotePreview, setShowNotePreview] = useState(false);
  
  const priorityColors = {
    high: '#ef4444',
    // Softer tones for better UX
    medium: '#FDBA74', // light orange (softer)
    low: '#6EE7B7' // light green (mint/emerald)
  };
  
  const priorityLabels = {
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };

  const subtaskProgress = todo.subtasks && todo.subtasks.length > 0
    ? (todo.subtasks.filter(st => st.isCompleted).length / todo.subtasks.length) * 100
    : 0;

  const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;

  return (
    <div
      className="task-card-enter-exit task-card-root"
      style={{
        cursor: hasSubtasks ? 'pointer' : 'move',
        opacity: 1,
        transform: 'translateY(0px)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={() => {
        // Only toggle completion on double-click when not editing
        if (!isEditing) onToggle(todo.id);
      }}
      onClick={(e) => {
        if (hasSubtasks && !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
          onToggleExpand();
        }
      }}
      draggable={!hasSubtasks || !isExpanded}
      onDragStart={(e) => {
        if (hasSubtasks && isExpanded) {
          e.preventDefault();
          return;
        }
        onDragStart && onDragStart(e, todo.id);
      }}
      onDragOver={(e) => onDragOver && onDragOver(e)}
      onDrop={(e) => onDrop && onDrop(e, todo.id)}
    >
        <div
        className="task-card-wrapper task-card-flex"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--color-surface)',
          border: `1px solid ${todo.isCompleted ? 'var(--color-border)' : 'var(--color-border)'}`,
          opacity: todo.isCompleted ? 0.6 : 1,
          transition: 'all 0.12s ease-out',
          cursor: hasSubtasks ? 'pointer' : 'default'
        }}
      >
        <button
          className="task-card-button task-card-toggle-button"
          onClick={() => onToggle(todo.id)}
          style={{
            flexShrink: 0,
            width: '20px',
            height: '20px',
            borderRadius: '6px',
            border: `2px solid ${todo.isCompleted ? 'var(--color-primary)' : 'var(--color-text-muted)'}`,
            background: todo.isCompleted ? 'var(--color-primary)' : 'transparent',
            color: todo.isCompleted ? 'var(--color-bg)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {todo.isCompleted && (
            <div
              className="check-icon-enter-exit check-icon-entered"
            >
                <CheckIcon />
              </div>
            )}
        </button>

        <div className="task-card-content" style={{ flex: 1, minWidth: 0 }}>
          <div className="task-card-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSaveEdit(todo.id);
                    } else if (e.key === 'Escape') {
                      onCancelEdit();
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    background: 'var(--color-surface-light)',
                    border: '1px solid var(--color-primary)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-family-base)',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
                <textarea
                  value={typeof editingDescription !== 'undefined' ? editingDescription : ''}
                  onChange={(e) => setEditingDescription && setEditingDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      onSaveEdit(todo.id);
                    } else if (e.key === 'Escape') {
                      onCancelEdit();
                    }
                  }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  placeholder="Add notes or description... (Ctrl+Enter to save)"
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    minHeight: '56px',
                    background: 'var(--color-surface-light)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '8px',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
                {/* Tags on top row */}
                <div className="task-card-edit-tags" style={{ marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text)' }}>Tags</label>
                  <div className="task-card-edit-tags-row" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {allTags && allTags.map(tag => {
                      const selected = editingTags && editingTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTags && setEditingTags(selected ? editingTags.filter(id => id !== tag.id) : [...(editingTags||[]), tag.id]);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 12px',
                            borderRadius: '999px',
                            border: selected ? `1px solid ${tag.color}` : '1px solid var(--color-border)',
                            background: selected ? `${tag.color}20` : 'transparent',
                            color: selected ? tag.color : 'var(--color-text-muted)',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            transition: 'all 0.12s ease-out',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: 8, background: tag.color, display: 'inline-block', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }} />
                          <span style={{ lineHeight: 1 }}>{tag.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Editing controls: priority and duration below tags, left-aligned */}
                <div className="task-card-edit-controls" style={{ display: 'flex', gap: '12px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                  <div className="task-card-edit-priority" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text)' }}>Priority</label>
                    <select value={editingPriority} onChange={(e) => setEditingPriority && setEditingPriority(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="task-card-edit-duration" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text)' }}>Duration</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="number" min={0} value={Math.floor((editingDuration||0)/60)} onChange={e => setEditingDuration && setEditingDuration(parseInt(e.target.value||0)*60 + (editingDuration||0)%60)} style={{ width: '64px', padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>h</span>
                      <input type="number" min={0} max={59} value={(editingDuration||0)%60} onChange={e => setEditingDuration && setEditingDuration(Math.floor((editingDuration||0)/60)*60 + parseInt(e.target.value||0))} style={{ width: '56px', padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>m</span>
                    </div>
                  </div>
                </div>

                <div className="task-card-edit-subtasks" style={{ marginTop: '10px', width: '100%' }} onClick={e => e.stopPropagation()}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Subtasks</label>
                    <div className="task-card-edit-subtasks-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', width: '100%' }}>
                    {(editingSubtasks || []).map((st, sidx) => (
                      <div key={st.id || sidx} className="task-card-edit-subtask-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                        <input type="checkbox" checked={!!st.isCompleted} onChange={(e) => setEditingSubtasks && setEditingSubtasks((prev) => prev.map(x => x.id === st.id ? { ...x, isCompleted: e.target.checked } : x))} style={{ flexShrink: 0 }} />
                        <input
                          type="text"
                          value={st.title}
                          onChange={(e) => setEditingSubtasks && setEditingSubtasks((prev) => prev.map(x => x.id === st.id ? { ...x, title: e.target.value } : x))}
                          style={{
                            flex: 1,
                            width: '100%',
                            padding: '6px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                        />
                        <button type="button" onClick={() => setEditingSubtasks && setEditingSubtasks((prev) => prev.filter(x => x.id !== st.id))} style={{ padding: '6px', borderRadius: '6px', border: 'none', background: 'transparent', color: 'var(--color-danger)', flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                    <div className="task-card-edit-subtask-new-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                      <input id={`new-subtask-${todo.id}`} type="text" placeholder="New subtask" style={{ flex: 1, width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }} />
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        const el = document.getElementById(`new-subtask-${todo.id}`);
                        if (!el) return;
                        const val = el.value.trim();
                        if (!val) return;
                        const newSt = { id: Date.now().toString(), title: val, isCompleted: false };
                        setEditingSubtasks && setEditingSubtasks((prev) => [...(prev||[]), newSt]);
                        el.value = '';
                        el.focus();
                      }} style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-bg)' }}>Add</button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span 
                  style={{
                    fontFamily: 'var(--font-family-base)',
                    color: todo.isCompleted ? 'var(--color-text-muted)' : 'var(--color-text)',
                    textDecoration: todo.isCompleted ? 'line-through' : 'none',
                    transition: 'all 0.1s ease-out',
                    cursor: 'pointer'
                  }}
                  onClick={() => !todo.isCompleted && onStartEdit(todo)}
                  title="Click to edit"
                >
                  {todo.title}
                </span>
                {todo.priority && (
                  (() => {
                    const isHigh = todo.priority === 'high';
                    const badgeColor = isHigh ? priorityColors.high : 'var(--color-text-muted)';
                    const badgeBorder = isHigh ? priorityColors.high : 'var(--color-border)';
                    const badgeBg = isHigh ? `${priorityColors.high}20` : 'transparent';
                    return (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          fontWeight: '500'
                        }}
                        title={`Priority: ${priorityLabels[todo.priority] || 'Medium'}`}
                      >
                        {priorityLabels[todo.priority] || 'Medium'}
                      </span>
                    );
                  })()
                )}
                {todo.duration > 0 && (
                  <span
                    className="scale-in"
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'var(--color-surface-light)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    {formatDuration(todo.duration)}
                  </span>
                )}
              </>
            )}
          {/* Description display (when not editing) */}
          {!isEditing && todo.description && (
            <div className="task-card-description" style={{
              marginTop: '6px',
              fontSize: '0.85rem',
              color: 'var(--color-text-muted)',
              lineHeight: '1.3',
              maxHeight: '3.6em',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {todo.description}
            </div>
          )}
          </div>
          {!isEditing && todo.tags && todo.tags.length > 0 && (
            <div className="task-card-tags-row" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {todo.tags.map((tag, i) => {
                const active = Array.isArray(selectedFilterTags) && selectedFilterTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className="tag-fade-in-slide-right"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!setSelectedFilterTags) return;
                      setSelectedFilterTags(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]);
                    }}
                    title={active ? 'Remove filter' : 'Filter by tag'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: active ? `1px solid ${tag.color}` : '1px solid var(--color-border)',
                      background: active ? `${tag.color}20` : 'transparent',
                      color: active ? tag.color : 'var(--color-text-muted)'
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: tag.color, display: 'inline-block' }} />
                    <span style={{ lineHeight: 1 }}>{tag.name}</span>
                  </button>
                );
              })}
              {!isEditing && todo.recurrence && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--color-primary)20',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary)',
                    fontWeight: '500',
                    textTransform: 'capitalize'
                  }}
                  title={`Repeats ${todo.recurrence.type || todo.recurrence.mode}${todo.recurrence.interval > 1 ? ` every ${todo.recurrence.interval}` : ''}`}
                >
                  <RepeatIcon size={12} style={{ marginRight: '6px' }} />
                  {todo.recurrence?.mode === 'daily'
                    ? 'Daily'
                    : todo.recurrence?.mode === 'dateRange'
                    ? 'Range'
                    : todo.recurrence?.mode === 'specificDays'
                    ? 'Weekdays'
                    : (todo.recurrence?.type || 'Recurring')}
                </span>
              )}
            </div>
          )}
          {!isEditing && todo.recurrence && (!todo.tags || todo.tags.length === 0) && (
            <div className="task-card-recurrence-row" style={{ display: 'flex', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'var(--color-primary)20',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}
                title={`Repeats ${todo.recurrence.type || todo.recurrence.mode}${todo.recurrence.interval > 1 ? ` every ${todo.recurrence.interval}` : ''}`}
              >
                <RepeatIcon size={12} style={{ marginRight: '6px' }} />
                {todo.recurrence?.mode === 'daily'
                  ? 'Daily'
                  : todo.recurrence?.mode === 'dateRange'
                  ? 'Range'
                  : todo.recurrence?.mode === 'specificDays'
                  ? 'Weekdays'
                  : (todo.recurrence?.type || 'Recurring')}
              </span>
            </div>
          )}
          {!isEditing && showDate && todo.dueDate && (
            <div className="task-card-date-row" style={{
              marginTop: '4px',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CalendarIcon />
              {(() => {
                const d = new Date(`${todo.dueDate}T00:00:00`);
                return isNaN(d.getTime()) ? '' : format(d, 'MMM d');
              })()}
              {todo.dueTime && (
                <span style={{ marginLeft: '4px' }}>
                  {todo.dueTime}
                </span>
              )}
            </div>
          )}
          {todo.dueTime && !showDate && (
            <div className="task-card-due-time-row" style={{
              marginTop: '4px',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🕐 {todo.dueTime}
            </div>
          )}
          
          {/* Subtasks */}
          {!isEditing && todo.subtasks && todo.subtasks.length > 0 && (
            <div className="task-card-subtasks" style={{ marginTop: '8px', width: '100%' }}>
              <div 
                className="task-card-subtasks-header-row"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginBottom: isExpanded ? '8px' : '6px',
                  cursor: hasSubtasks ? 'pointer' : 'default',
                  padding: '2px 0',
                  transition: 'all 0.16s ease'
                }}
                onClick={(e) => {
                  if (hasSubtasks) {
                    e.stopPropagation();
                    onToggleExpand();
                  }
                }}
              >
                <div className="task-card-subtasks-progress-bar" style={{ flex: 1, height: '6px', background: 'var(--color-surface-light)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <div 
                    className="task-card-subtasks-progress-fill"
                    style={{ 
                      height: '100%', 
                      background: `linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-light) 100%)`,
                      width: `${(todo.subtasks.filter(st => st.isCompleted).length / todo.subtasks.length) * 100}%`, 
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      borderRadius: '4px',
                      boxShadow: '0 0 8px rgba(var(--color-primary-rgb, 16, 185, 129), 0.3)'
                    }} 
                  />
                </div>
                <span className="task-card-subtasks-progress-label" style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--color-text-muted)',
                  fontWeight: '500',
                  minWidth: '40px',
                  textAlign: 'right'
                }}>
                  {todo.subtasks.filter(st => st.isCompleted).length}/{todo.subtasks.length}
                </span>
                {hasSubtasks && (
                  <motion.div
                    className="task-card-subtasks-chevron"
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <ChevronIcon color="var(--color-primary)" size={14} />
                  </motion.div>
                )}
              </div>
              {isExpanded && (
                <motion.div
                  className="task-card-subtasks-expanded-list"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    marginTop: '4px',
                    padding: '12px',
                    background: 'var(--color-surface-light)',
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {todo.subtasks.map((subtask, idx) => (
                    <motion.div
                      key={subtask.id}
                      className="task-card-subtasks-expanded-row"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        fontSize: '0.75rem',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        background: subtask.isCompleted ? 'transparent' : 'var(--color-surface)',
                        border: `1px solid ${subtask.isCompleted ? 'transparent' : 'var(--color-border)'}`,
                        transition: 'all 0.12s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (!subtask.isCompleted) {
                          e.currentTarget.style.background = 'var(--color-surface-hover)';
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }
                        setHoveredSubtaskId(subtask.id);
                      }}
                      onMouseLeave={(e) => {
                        if (!subtask.isCompleted) {
                          e.currentTarget.style.background = 'var(--color-surface)';
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                        }
                        setHoveredSubtaskId(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !subtask.isCompleted;
                        const updated = todo.subtasks.map(st =>
                          st.id === subtask.id ? { ...st, isCompleted: newValue } : st
                        );
                        setTodos(prev => prev.map(t => {
                          if (t.id === todo.id) {
                            return { ...t, subtasks: updated };
                          }
                          return t;
                        }));
                        onUpdateTodo(todo.id, { subtasks: updated }).catch(error => {
                          console.error("Failed to update subtask", error);
                          setTodos(prev => prev.map(t => {
                            if (t.id === todo.id) {
                              return { ...t, subtasks: todo.subtasks };
                            }
                            return t;
                          }));
                        });
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={subtask.isCompleted}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newValue = e.target.checked;
                          const updated = todo.subtasks.map(st =>
                            st.id === subtask.id ? { ...st, isCompleted: newValue } : st
                          );
                          setTodos(prev => prev.map(t => {
                            if (t.id === todo.id) {
                              return { ...t, subtasks: updated };
                            }
                            return t;
                          }));
                          onUpdateTodo(todo.id, { subtasks: updated }).catch(error => {
                            console.error("Failed to update subtask", error);
                            setTodos(prev => prev.map(t => {
                              if (t.id === todo.id) {
                                return { ...t, subtasks: todo.subtasks };
                              }
                              return t;
                            }));
                          });
                        }}
                        style={{ width: '12px', height: '12px' }}
                        onClick={(e) => e.stopPropagation()}
                      />

                      {subtaskEditingId === subtask.id ? (
                        <input
                          type="text"
                          value={subtaskEditingText}
                          onChange={(e) => setSubtaskEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const updated = todo.subtasks.map(st => st.id === subtask.id ? { ...st, title: subtaskEditingText.trim() || st.title } : st);
                              setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: updated } : t));
                              onUpdateTodo(todo.id, { subtasks: updated }).catch(err => console.error('Failed to save subtask edit', err));
                              setSubtaskEditingId(null);
                              setSubtaskEditingText('');
                            } else if (e.key === 'Escape') {
                              setSubtaskEditingId(null);
                              setSubtaskEditingText('');
                            }
                          }}
                          onBlur={() => {
                            const updated = todo.subtasks.map(st => st.id === subtask.id ? { ...st, title: subtaskEditingText.trim() || st.title } : st);
                            setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: updated } : t));
                            onUpdateTodo(todo.id, { subtasks: updated }).catch(err => console.error('Failed to save subtask edit', err));
                            setSubtaskEditingId(null);
                            setSubtaskEditingText('');
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            background: 'var(--color-surface-light)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: 'var(--color-text)'
                          }}
                        />
                      ) : (
                        <span style={{ 
                          color: subtask.isCompleted ? 'var(--color-text-muted)' : 'var(--color-text)', 
                          textDecoration: subtask.isCompleted ? 'line-through' : 'none',
                          flex: 1,
                          transition: 'all 0.2s ease',
                          fontWeight: subtask.isCompleted ? '400' : '500'
                        }}>
                          {subtask.title}
                        </span>
                      )}

                      <div className="task-card-subtasks-expanded-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={subtask.isFlagged ? 'Unflag subtask' : 'Flag subtask'}
                          onClick={() => {
                            const updated = todo.subtasks.map(st => st.id === subtask.id ? { ...st, isFlagged: !st.isFlagged } : st);
                            setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: updated } : t));
                            onUpdateTodo(todo.id, { subtasks: updated }).catch(err => {
                              console.error('Failed to toggle subtask flag', err);
                              setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: todo.subtasks } : t));
                            });
                          }}
                          style={{
                            display: subtask.isFlagged ? 'inline-flex' : 'none',
                            padding: '2px',
                            borderRadius: '6px',
                            background: 'transparent',
                            border: subtask.isFlagged ? `1px solid var(--color-danger)` : 'none',
                            cursor: 'pointer',
                            color: 'var(--color-danger)',
                            transition: 'color 0.12s, background 0.12s, border-color 0.12s',
                            transform: 'scale(0.9)'
                          }}
                        >
                          <FlagIcon filled={!!subtask.isFlagged} />
                        </button>

                        {hoveredSubtaskId === subtask.id && (
                          <button
                            type="button"
                            title="Edit subtask"
                            onClick={() => {
                              setSubtaskEditingId(subtask.id);
                              setSubtaskEditingText(subtask.title);
                            }}
                            style={{
                              padding: '2px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--color-text)',
                              transition: 'color 0.12s, transform 0.12s',
                              transform: 'scale(0.85)'
                            }}
                          >
                            <EditIcon />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              {!isExpanded && (
                <div className="task-card-subtasks-collapsed-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {todo.subtasks.slice(0, 2).map((subtask, idx) => (
                    <motion.div
                      key={subtask.id}
                      className="task-card-subtasks-collapsed-row"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        fontSize: '0.72rem',
                        padding: '2px 4px',
                        borderRadius: '6px',
                        transition: 'all 0.12s ease',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newValue = !subtask.isCompleted;
                        const updated = todo.subtasks.map(st =>
                          st.id === subtask.id ? { ...st, isCompleted: newValue } : st
                        );
                        setTodos(prev => prev.map(t => {
                          if (t.id === todo.id) {
                            return { ...t, subtasks: updated };
                          }
                          return t;
                        }));
                        onUpdateTodo(todo.id, { subtasks: updated }).catch(error => {
                          console.error("Failed to update subtask", error);
                          setTodos(prev => prev.map(t => {
                            if (t.id === todo.id) {
                              return { ...t, subtasks: todo.subtasks };
                            }
                            return t;
                          }));
                        });
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-surface-light)';
                        setHoveredSubtaskId(subtask.id);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        setHoveredSubtaskId(null);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={subtask.isCompleted}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newValue = e.target.checked;
                          const updated = todo.subtasks.map(st =>
                            st.id === subtask.id ? { ...st, isCompleted: newValue } : st
                          );
                          setTodos(prev => prev.map(t => {
                            if (t.id === todo.id) {
                              return { ...t, subtasks: updated };
                            }
                            return t;
                          }));
                          onUpdateTodo(todo.id, { subtasks: updated }).catch(error => {
                            console.error("Failed to update subtask", error);
                            setTodos(prev => prev.map(t => {
                              if (t.id === todo.id) {
                                return { ...t, subtasks: todo.subtasks };
                              }
                              return t;
                            }));
                          });
                        }}
                        style={{ width: '10px', height: '10px' }}
                        onClick={(e) => e.stopPropagation()}
                        className="subtask-checkbox-small"
                      />

                      {subtaskEditingId === subtask.id ? (
                        <input
                          type="text"
                          value={subtaskEditingText}
                          onChange={(e) => setSubtaskEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const updated = todo.subtasks.map(st => st.id === subtask.id ? { ...st, title: subtaskEditingText.trim() || st.title } : st);
                              setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: updated } : t));
                              onUpdateTodo(todo.id, { subtasks: updated }).catch(err => console.error('Failed to save subtask edit', err));
                              setSubtaskEditingId(null);
                              setSubtaskEditingText('');
                            } else if (e.key === 'Escape') {
                              setSubtaskEditingId(null);
                              setSubtaskEditingText('');
                            }
                          }}
                          onBlur={() => {
                            const updated = todo.subtasks.map(st => st.id === subtask.id ? { ...st, title: subtaskEditingText.trim() || st.title } : st);
                            setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: updated } : t));
                            onUpdateTodo(todo.id, { subtasks: updated }).catch(err => console.error('Failed to save subtask edit', err));
                            setSubtaskEditingId(null);
                            setSubtaskEditingText('');
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            minWidth: '120px',
                            background: 'var(--color-surface-light)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: 'var(--color-text)'
                          }}
                        />
                      ) : (
                        <span style={{ 
                          color: subtask.isCompleted ? 'var(--color-text-muted)' : 'var(--color-text)', 
                          textDecoration: subtask.isCompleted ? 'line-through' : 'none',
                          transition: 'all 0.2s ease',
                          flex: 1
                        }}>
                          {subtask.title}
                        </span>
                      )}

                      <div className="task-card-subtasks-collapsed-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={subtask.isFlagged ? 'Unflag subtask' : 'Flag subtask'}
                          onClick={() => {
                            const updated = todo.subtasks.map(st => st.id === subtask.id ? { ...st, isFlagged: !st.isFlagged } : st);
                            setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: updated } : t));
                            onUpdateTodo(todo.id, { subtasks: updated }).catch(err => {
                              console.error('Failed to toggle subtask flag', err);
                              setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: todo.subtasks } : t));
                            });
                          }}
                          style={{
                            display: subtask.isFlagged ? 'inline-flex' : 'none',
                            padding: '2px',
                            borderRadius: '6px',
                            background: 'transparent',
                            border: subtask.isFlagged ? `1px solid var(--color-danger)` : 'none',
                            cursor: 'pointer',
                            color: 'var(--color-danger)',
                            transition: 'color 0.12s, background 0.12s, border-color 0.12s',
                            transform: 'scale(0.85)'
                          }}
                        >
                          <FlagIcon filled={!!subtask.isFlagged} />
                        </button>

                        {hoveredSubtaskId === subtask.id && (
                          <button
                            type="button"
                            title="Edit subtask"
                            onClick={() => {
                              setSubtaskEditingId(subtask.id);
                              setSubtaskEditingText(subtask.title);
                            }}
                            style={{
                              padding: '2px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--color-text)',
                              transition: 'color 0.12s, transform 0.12s',
                              transform: 'scale(0.85)'
                            }}
                          >
                            <EditIcon />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {todo.subtasks.length > 2 && (
                    <motion.div
                      className="task-card-subtasks-collapsed-more"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--color-text-muted)', 
                        fontStyle: 'italic', 
                        paddingLeft: '28px',
                        paddingTop: '4px',
                        cursor: 'pointer',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand();
                      }}
                    >
                      +{todo.subtasks.length - 2} more
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="task-card-actions-col" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
          {todo.isFlagged && (
            <button
              className={`task-card-button flag-button ${todo.isFlagged ? 'flagged' : ''}`}
              onClick={(e) => onFlag(todo.id, e)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-danger)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <FlagIcon filled={true} />
            </button>
          )}

          {todo.description && (
            <div
              className="task-card-note-preview"
              title="Has notes"
              style={{ position: 'relative', padding: '6px', borderRadius: '8px', background: 'transparent', color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => { e.stopPropagation(); setShowNotePreview(true); }}
              onMouseLeave={(e) => { e.stopPropagation(); setShowNotePreview(false); }}
            >
              <NoteIcon />
              {showNotePreview && (
                <div className="task-card-note-preview-popup" style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '36px',
                  width: '260px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  padding: '10px',
                  borderRadius: '8px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  zIndex: 80,
                  fontSize: '0.85rem',
                  lineHeight: 1.35
                }} onMouseEnter={(e) => e.stopPropagation()} onMouseLeave={(e) => e.stopPropagation()}>
                  {todo.description}
                </div>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="task-card-edit-actions-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSaveEdit(todo.id); }}
              style={{
                padding: '8px 12px',
                background: 'var(--color-primary)',
                color: 'var(--color-bg)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              title="Save"
            >
              Save
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              title="Cancel"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            className={`task-card-hover-actions ${isHovered ? 'visible' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {!todo.isCompleted && (
              <button
                className="task-card-button"
                onClick={(e) => { e.stopPropagation(); onStartEdit(todo); }}
                style={{
                  padding: '8px',
                  color: 'var(--color-primary)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
                title="Edit"
              >
                <EditIcon />
              </button>
            )}
            <select
              value={todo.priority || 'medium'}
              onChange={(e) => onUpdatePriority(todo.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '4px 8px',
                paddingRight: '24px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                color: 'var(--color-text)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                outline: 'none'
              }}
              title="Change priority"
            >
              <option value="low" style={{ background: 'var(--color-surface)', borderRadius: '6px' }}>Low</option>
              <option value="medium" style={{ background: 'var(--color-surface)', borderRadius: '6px' }}>Medium</option>
              <option value="high" style={{ background: 'var(--color-surface)', borderRadius: '6px' }}>High</option>
            </select>
            {showDate && (
              <button
                className="task-card-button"
                onClick={() => onGoToDay(todo.dueDate)}
                style={{
                  padding: '8px',
                  color: 'var(--color-primary)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
                title="Go to day"
              >
                <ArrowRightIcon />
              </button>
            )}
            <button
              className="task-card-button delete-button"
              onClick={() => onDelete(todo.id)}
              style={{
                padding: '8px',
                color: '#a3a3a3',
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <DeleteIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

