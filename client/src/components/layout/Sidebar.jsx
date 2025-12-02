import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { SunIcon, MoonIcon, SearchIcon, CloseIcon, StatsIcon, HomeIcon, SettingsIcon } from '../../icons/Icons';
import ModernCalendar from '../calendar/ModernCalendar';
import { format, addDays } from 'date-fns';
import styles from './Sidebar.module.css';

const SlimButton = ({ active, onClick, children, title }) => (
    <button
        onClick={onClick}
        title={title}
        className={`${styles.slimButton} ${active ? styles.slimButtonActive : ''}`}
    >
        {children}
    </button>
);

const Sidebar = ({ selectedDate, onSelectDate, isOpen, onClose, onNavigate, theme, setTheme, searchQuery, setSearchQuery, onOpenSettings, onOpenLogin }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    // Sidebar uses app-level theme management (passed via props)
    const toggleTheme = () => {
        if (!setTheme) return;
        // App uses 'dark' and 'white' theme tokens (see `App.jsx` themes array).
        // Toggle between 'dark' and 'white' so Settings/Appearance stays in sync.
        const newTheme = theme === 'dark' ? 'white' : 'dark';
        setTheme(newTheme);
    };

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(today, 1), 'yyyy-MM-dd');

    // Determine the base date from current selection for continuous nav
    const resolveSelectedBaseDate = () => {
        if (!selectedDate) return today;
        if (selectedDate === 'today') return today;
        if (selectedDate === 'tomorrow') return addDays(today, 1);
        if (typeof selectedDate === 'string' && selectedDate.includes('-')) {
            const d = new Date(selectedDate + 'T00:00:00');
            return isNaN(d.getTime()) ? today : d;
        }
        return today;
    };

    const baseDate = resolveSelectedBaseDate();
    const prev = format(addDays(baseDate, -1), 'yyyy-MM-dd');
    const next = format(addDays(baseDate, 1), 'yyyy-MM-dd');

    const pickDay = (dayStr) => {
        if (!onSelectDate) return;
        if (dayStr === todayStr) onSelectDate('today');
        else if (dayStr === tomorrowStr) onSelectDate('tomorrow');
        else onSelectDate(dayStr);
    };

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        if (isOpen) root.classList.add('has-open-sidebar');
        else root.classList.remove('has-open-sidebar');
        return () => root.classList.remove('has-open-sidebar');
    }, [isOpen]);

    const portal = (
        <>
            <div
                className={`${styles.sidebarOverlay} ${isOpen ? 'open' : ''}`}
                onClick={onClose}
                aria-hidden={!isOpen}
            />
            <aside
                className={`${styles.sidebar} ${isOpen ? 'open' : ''}`}
                role="navigation"
                aria-label="Primary"
                data-open={isOpen ? 'true' : 'false'}
            >
                {isMobile && (
                    <>
                        <button
                            className={styles.mobileCloseButton}
                            onClick={onClose}
                            aria-label="Close sidebar"
                        >
                            <CloseIcon />
                        </button>

                        {/* Mobile: surface the search input inside the sidebar */}
                        <div className={styles.searchMobileWrap}>
                            <div className={styles.sidebarSearchMobile}>
                                <div className={styles.searchIcon}><SearchIcon /></div>
                                <input
                                    className={styles.searchInput}
                                    type="text"
                                    placeholder="Search"
                                    value={searchQuery || ''}
                                    onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </>
                )}

                <div className={styles.contentCol}>
                    {/* Quick actions row (no settings) - moved above calendar */}
                    <div className={styles.quickRow}>
                        <NavLink to="/" style={() => ({ textDecoration: 'none' })} end>
                            {({ isActive }) => (
                                <SlimButton title="Home" active={isActive} onClick={() => { if (isMobile && onClose) onClose(); }}>
                                    <HomeIcon />
                                </SlimButton>
                            )}
                        </NavLink>

                        <NavLink to="/search" style={() => ({ textDecoration: 'none' })}>
                            {({ isActive }) => (
                                <SlimButton title="Advanced Search" active={isActive} onClick={() => { if (isMobile && onClose) onClose(); }}>
                                    <SearchIcon />
                                </SlimButton>
                            )}
                        </NavLink>

                        <NavLink to="/statistics" style={() => ({ textDecoration: 'none' })}>
                            {({ isActive }) => (
                                <SlimButton title="Statistics" active={isActive} onClick={() => { if (isMobile && onClose) onClose(); }}>
                                    <StatsIcon width={16} height={16} />
                                </SlimButton>
                            )}
                        </NavLink>

                                                {isMobile ? (
                                                    // Show appearance and settings toggle inside sidebar on mobile (settings rightmost)
                                                    <>
                                                        <SlimButton onClick={toggleTheme} title="Toggle Light/Dark Mode">
                                                            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                                                        </SlimButton>
                                                        <SlimButton
                                                            title="Settings"
                                                            onClick={() => {
                                                                onOpenSettings && onOpenSettings();
                                                                if (isMobile && onClose) onClose();
                                                            }}
                                                        >
                                                            <SettingsIcon />
                                                        </SlimButton>
                                                    </>
                                                ) : (
                                                    <>
                                                        <SlimButton onClick={toggleTheme} title="Toggle Light/Dark Mode">
                                                            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                                                        </SlimButton>
                                                        <SlimButton
                                                            title="Settings"
                                                            onClick={() => {
                                                                onOpenSettings && onOpenSettings();
                                                                if (!isMobile && onClose) onClose();
                                                            }}
                                                        >
                                                            <SettingsIcon />
                                                        </SlimButton>
                                                    </>
                                                )}
                    </div>

                    {/* Calendar (original, cleaner layout) */}
                    <div className={styles.calendarWrap}>
                        <ModernCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />
                    </div>

                    {/* Prev / Today / Next - single row (compact) */}
                    <div className={styles.dayNavRow}>
                        <button
                            className={styles.btnPrev}
                            onClick={() => pickDay(prev)}
                            title="Previous day"
                        >
                            Previous
                        </button>
                        <button
                            className={styles.btnToday}
                            onClick={() => pickDay(todayStr)}
                            title="Today"
                        >
                            Today
                        </button>
                        <button
                            className={styles.btnNext}
                            onClick={() => pickDay(next)}
                            title="Next day"
                        >
                            Next
                        </button>
                    </div>
                </div>

                {/* lower calendar removed to avoid duplication */}

                <div className={styles.spacer} />
                <footer className={styles.footer}>
                    {isMobile && (
                        <button className={styles.sidebarFooterLogin} onClick={() => { onOpenLogin && onOpenLogin(); onClose && onClose(); }}>
                            Login
                        </button>
                    )}
                    <div className={styles.version}>
                        v{(import.meta.env.REACT_APP_VERSION || import.meta.env.VITE_APP_VERSION || '1.0')}
                    </div>
                </footer>
            </aside>
        </>
    );

    // Mount the overlay and sidebar at the document body so it is outside
    // any layout containers and can cover the full viewport (top:0).
    if (typeof document !== 'undefined') {
        return createPortal(portal, document.body);
    }

    return portal;
};

export default Sidebar;
