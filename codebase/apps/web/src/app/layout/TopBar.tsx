import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { MenuIcon, SearchIcon } from '../../shared/ui/icons';
import { Button } from '../../shared/ui/Button';
import { useAuth } from '../providers/auth-context';
import styles from './TopBar.module.css';

export interface TopBarProps {
  onOpenSidebar: () => void;
  onOpenSettings: () => void;
}

function pageTitle(pathname: string): string {
  if (pathname === '/search' || pathname === '/advanced-search') return 'Search';
  if (pathname === '/statistics' || pathname === '/stats') return 'Statistics';
  if (pathname === '/profile') return 'Profile';
  return 'Home';
}

export function TopBar({ onOpenSidebar, onOpenSettings }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, guestMode, login, logout } = useAuth();

  const onSearchPage = location.pathname === '/search' || location.pathname === '/advanced-search';
  const [menuOpen, setMenuOpen] = useState(false);
  const identityRef = useRef<HTMLDivElement | null>(null);

  // The query lives in the URL: typing navigates to /search?q=… and leaving
  // /search clears the input (old TopBar behavior, now derived state).
  const query = onSearchPage ? (searchParams.get('q') ?? '') : '';
  const onQueryChange = (value: string) => {
    if (value.trim().length > 0 || onSearchPage) {
      void navigate(
        { pathname: '/search', search: value ? `?q=${encodeURIComponent(value)}` : '' },
        { replace: onSearchPage },
      );
    }
  };

  // Click outside closes the identity dropdown.
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (identityRef.current && !identityRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuOpen]);

  const name =
    currentUser?.profile?.firstName ??
    currentUser?.name ??
    (currentUser?.email ? currentUser.email.split('@')[0] : null) ??
    'User';
  const avatar = currentUser?.picture ?? null;

  return (
    <header className={styles.topBar}>
      <button
        type="button"
        className={styles.menuButton}
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <MenuIcon />
      </button>

      <h2 className={styles.title}>{pageTitle(location.pathname)}</h2>

      <div className={styles.search}>
        <span className={styles.searchIcon}>
          <SearchIcon width={16} height={16} />
        </span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="Search tasks and tags"
        />
      </div>

      <div className={styles.identityArea}>
        {currentUser && !guestMode ? (
          <div className={styles.identityWrap} ref={identityRef}>
            <button
              type="button"
              className={styles.identityChip}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open profile menu"
            >
              {avatar ? (
                <img src={avatar} alt="" className={styles.avatar} />
              ) : (
                <span className={`${styles.avatar} ${styles.initial}`} aria-hidden="true">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className={styles.chipName}>{name}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {menuOpen && (
              <div className={styles.dropdown} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void navigate('/profile');
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.guestPill}>
            <span>Hello Guest</span>
            <Button variant="primary" size="sm" onClick={() => void login()}>
              Log in
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
