import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { addDays, format } from 'date-fns';
import {
  CloseIcon,
  HomeIcon,
  LogoIcon,
  MoonIcon,
  NoteIcon,
  SearchIcon,
  SettingsIcon,
  StatsIcon,
  SunIcon,
} from '../../shared/ui/icons';
import { IconButton } from '../../shared/ui/IconButton';
import { useAuth } from '../providers/auth-context';
import { useTheme } from '../providers/theme-context';
import { ModernCalendar } from './ModernCalendar';
import {
  parseSelectedDay,
  resolveWeekStart,
  selectedDayFromPath,
  weekStartsOnIndex,
} from './day-utils';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ open, onClose, onOpenSettings }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const selectedDay = selectedDayFromPath(location.pathname);
  const baseDate = parseSelectedDay(selectedDay);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStartsOn = weekStartsOnIndex(resolveWeekStart(currentUser));

  const goToDay = (dayStr: string) => {
    void navigate(dayStr === todayStr ? '/' : `/day/${dayStr}`);
    onClose();
  };

  // Old app toggled between the 'dark' and 'white' themes only.
  const toggleTheme = () => setTheme(theme === 'dark' ? 'white' : 'dark');

  // Escape closes the off-canvas sidebar (old behavior).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [styles.navLink, isActive ? styles.navLinkActive : undefined].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={[styles.overlay, open ? styles.overlayOpen : undefined]
          .filter(Boolean)
          .join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={[styles.sidebar, open ? styles.sidebarOpen : undefined]
          .filter(Boolean)
          .join(' ')}
        aria-label="Primary"
        data-open={open ? 'true' : 'false'}
      >
        <div className={styles.logoRow}>
          <span className={styles.logoMark}>
            <LogoIcon />
          </span>
          <span className={styles.logoText}>Lifeline</span>
          <button
            type="button"
            className={styles.mobileClose}
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <nav className={styles.quickNav} aria-label="Quick navigation">
          <NavLink to="/" className={navLinkClass} end onClick={onClose}>
            <HomeIcon width={16} height={16} />
            <span>Home</span>
          </NavLink>
          <NavLink to="/search" className={navLinkClass} onClick={onClose}>
            <SearchIcon width={16} height={16} />
            <span>Search</span>
          </NavLink>
          <NavLink to="/statistics" className={navLinkClass} onClick={onClose}>
            <StatsIcon width={16} height={16} />
            <span>Statistics</span>
          </NavLink>
          <NavLink to="/review" className={navLinkClass} onClick={onClose}>
            <NoteIcon width={16} height={16} />
            <span>Review</span>
          </NavLink>
        </nav>

        <div className={styles.utilityRow}>
          <IconButton
            aria-label="Toggle light/dark mode"
            title="Toggle Light/Dark Mode"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <SunIcon width={16} height={16} />
            ) : (
              <MoonIcon width={16} height={16} />
            )}
          </IconButton>
          <IconButton aria-label="Settings" title="Settings" onClick={onOpenSettings}>
            <SettingsIcon width={16} height={16} />
          </IconButton>
        </div>

        <div className={styles.calendarWrap}>
          {/* Keyed by the selected day so the visible month re-syncs to selection. */}
          <ModernCalendar
            key={selectedDay}
            selectedDate={selectedDay}
            onSelectDate={goToDay}
            weekStartsOn={weekStartsOn}
          />
        </div>

        <div className={styles.dayNavRow}>
          <button
            type="button"
            className={styles.dayNavBtn}
            onClick={() => goToDay(format(addDays(baseDate, -1), 'yyyy-MM-dd'))}
            title="Previous day"
          >
            Previous
          </button>
          <button
            type="button"
            className={`${styles.dayNavBtn} ${styles.dayNavToday}`}
            onClick={() => goToDay(todayStr)}
            title="Today"
          >
            Today
          </button>
          <button
            type="button"
            className={styles.dayNavBtn}
            onClick={() => goToDay(format(addDays(baseDate, 1), 'yyyy-MM-dd'))}
            title="Next day"
          >
            Next
          </button>
        </div>

        <div className={styles.spacer} />
        <footer className={styles.footer}>
          <div className={styles.version}>v{import.meta.env.VITE_APP_VERSION ?? '1.0'}</div>
        </footer>
      </aside>
    </>
  );
}
