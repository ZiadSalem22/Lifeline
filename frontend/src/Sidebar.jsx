import { useMediaQuery } from './useMediaQuery';
import { SunIcon, MoonIcon, SearchIcon, CloseIcon, StatsIcon, HomeIcon, SettingsIcon } from './Icons';
import ModernCalendar from './ModernCalendar';
import { format, addDays } from 'date-fns';

const SlimButton = ({ active, onClick, children, title }) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: active ? '1px solid var(--color-primary)' : '1px solid transparent',
            background: active ? 'var(--color-surface)' : 'transparent',
            color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
            cursor: 'pointer'
        }}
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
    const prev = format(addDays(today, -1), 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');
    const next = format(addDays(today, 1), 'yyyy-MM-dd');

    const pickDay = (dayStr) => {
        if (!onSelectDate) return;
        if (dayStr === todayStr) onSelectDate('today');
        else if (dayStr === next) onSelectDate('tomorrow');
        else onSelectDate(dayStr);
    };

    return (
        <>
            <div
                className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
                aria-hidden={!isOpen}
            />
            <aside
                className={`sidebar ${isOpen ? 'open' : ''}`}
                role="navigation"
                aria-label="Primary"
                data-open={isOpen ? 'true' : 'false'}
            >
                                {isMobile && (
                                        <>
                                        <button
                                                className="mobile-close-button"
                                                onClick={onClose}
                                                aria-label="Close sidebar"
                                        >
                                                <CloseIcon />
                                        </button>

                                        {/* Mobile: surface the search input inside the sidebar */}
                                        <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                                            <div className="sidebar-search-mobile">
                                                <div className="search-icon"><SearchIcon /></div>
                                                <input
                                                    className="search-input"
                                                    type="text"
                                                    placeholder="Search"
                                                    value={searchQuery || ''}
                                                    onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        </>
                                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'stretch', width: '100%' }}>
                    {/* Quick actions row (no settings) - moved above calendar */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <SlimButton onClick={() => onNavigate && onNavigate('home')} title="Home">
                            <HomeIcon />
                        </SlimButton>
                        <SlimButton onClick={() => onNavigate && onNavigate('search')} title="Advanced Search">
                            <SearchIcon />
                        </SlimButton>
                        <SlimButton onClick={() => onNavigate && onNavigate('stats')} title="Statistics">
                            <StatsIcon width={16} height={16} />
                        </SlimButton>
                                                {isMobile ? (
                                                    // Show appearance and settings toggle inside sidebar on mobile (settings rightmost)
                                                    <>
                                                        <SlimButton onClick={toggleTheme} title="Toggle Light/Dark Mode">
                                                            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                                                        </SlimButton>
                                                        <SlimButton onClick={() => onOpenSettings && onOpenSettings()} title="Settings">
                                                            <SettingsIcon />
                                                        </SlimButton>
                                                    </>
                                                ) : (
                                                    <SlimButton onClick={toggleTheme} title="Toggle Light/Dark Mode">
                                                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                                                    </SlimButton>
                                                )}
                    </div>

                    {/* Calendar (original, cleaner layout) */}
                    <div style={{ marginBottom: '8px', flexShrink: 0 }}>
                        <ModernCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />
                    </div>

                    {/* Prev / Today / Next - single row (compact) */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', marginTop: '4px', width: '100%' }}>
                        <button
                            onClick={() => pickDay(prev)}
                            title="Previous day"
                            style={{
                                padding: '2px 0',
                                borderRadius: '7px',
                                border: '1px solid var(--color-border)',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.68rem',
                                color: 'var(--color-text)',
                                minWidth: '54px',
                                width: '54px',
                                textAlign: 'center',
                                height: '26px',
                                lineHeight: '1'
                            }}
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => pickDay(todayStr)}
                            title="Today"
                            style={{
                                padding: '2px 0',
                                borderRadius: '7px',
                                border: '1.5px solid var(--color-primary)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-primary)',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                minWidth: '54px',
                                width: '54px',
                                height: '26px',
                                textAlign: 'center',
                                lineHeight: '1',
                                margin: '0 1px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => pickDay(next)}
                            title="Next day"
                            style={{
                                padding: '2px 0',
                                borderRadius: '7px',
                                border: '1px solid var(--color-border)',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.68rem',
                                color: 'var(--color-text)',
                                minWidth: '54px',
                                width: '54px',
                                textAlign: 'center',
                                height: '26px',
                                lineHeight: '1'
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>

                                {/* lower calendar removed to avoid duplication */}

                                <div style={{ flex: 1 }} />
                                <footer style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                        {isMobile && (
                                            <button className="sidebar-footer-login" onClick={() => { onOpenLogin && onOpenLogin(); onClose && onClose(); }}>
                                                Login
                                            </button>
                                        )}
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                                v{(import.meta.env.REACT_APP_VERSION || import.meta.env.VITE_APP_VERSION || '1.0')}
                                        </div>
                                </footer>
            </aside>
        </>
    );
};

export default Sidebar;
