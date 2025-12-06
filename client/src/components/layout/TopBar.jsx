import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { SearchIcon, SettingsIcon, MenuIcon } from '../../icons/Icons';
import styles from './TopBar.module.css';

const TopBar = (props) => {
    const {
        onOpenSettings,
        searchQuery,
        setSearchQuery,
        onLoginClick,
        onOpenSidebar,
        isMobileSidebarOpen,
        currentUser,
        guestMode,
        onLogout,
    } = props;
    const { loginWithRedirect, logout, isAuthenticated } = useAuth();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);
    const toggle = () => setOpen(o => !o);
    const close = () => setOpen(false);
    const name = (currentUser?.profile?.first_name)
        ? currentUser.profile.first_name
        : (currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : null));
    const avatar = currentUser?.picture;
    const dropdownLogout = () => {
        close();
        if (onLogout) onLogout();
        logout({ logoutParams: { returnTo: window.location.origin } });
    };

    // Close dropdown when clicking outside of the identity container
    useEffect(() => {
        function handleClickOutside(e) {
            if (!open) return;
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    return (
        <header className={styles['top-bar']}>
            <div className={styles['top-bar-main']}>
                {!isMobileSidebarOpen && (
                    <button
                        type="button"
                        className={styles['top-bar-menu-button']}
                        onClick={onOpenSidebar}
                        aria-label="Open navigation"
                    >
                        <MenuIcon />
                    </button>
                )}

                <div className={styles['top-bar-title-wrap']}>
                    <h2 className={styles['top-bar-title']}>Home</h2>
                </div>

                <div className={styles['top-bar-search']}>
                    <div className={styles['search-icon']}>
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles['search-input']}
                        aria-label="Search tasks and tags"
                    />
                </div>

                {/* Identity chip moved to its own division at the far right */}
                {!guestMode && isAuthenticated && currentUser && (
                    <div style={{ marginLeft: 'auto', paddingRight: '8px', display: 'flex', alignItems: 'center' }}>
                        <button
                            type="button"
                            className={styles['identity-chip']}
                            onClick={toggle}
                            aria-haspopup="true"
                            aria-expanded={open ? 'true' : 'false'}
                            aria-label="Open profile menu"
                            ref={dropdownRef}
                        >
                            {avatar ? (
                                <img src={avatar} alt={name || 'User'} className={styles['chip-avatar']} />
                            ) : (
                                <div className={`${styles['chip-avatar']} ${styles['chip-initials']}`}>{(name || 'U').substring(0,1).toUpperCase()}</div>
                            )}
                            <div className={styles['chip-name']} title={name}>{name || 'User'} <span aria-hidden>▾</span></div>
                        </button>
                        {open && (
                            <div className={styles['chip-dropdown']} role="menu" onClick={(e) => e.stopPropagation()}>
                                <button type="button" onMouseDown={() => { console.log('Profile clicked'); close(); props.onOpenProfile && props.onOpenProfile(); }} role="menuitem">Profile</button>
                                <button type="button" onMouseDown={() => { console.log('Settings clicked'); close(); onOpenSettings && onOpenSettings(); }} role="menuitem">Settings</button>
                                <button type="button" onMouseDown={() => { console.log('Logout clicked'); dropdownLogout(); }} role="menuitem">Logout</button>
                            </div>
                        )}
                    </div>
                )}
                {/* Guest pill and login button restored */}
                {(guestMode || !isAuthenticated) && (
                    <div style={{ marginLeft: 'auto', paddingRight: '8px', display: 'flex', alignItems: 'center' }}>
                        <div className={styles['guest-pill']}>
                            Hello Guest
                            <Button variant="primary" type="button" onClick={onLoginClick} ariaLabel="Login">
                                Login
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default TopBar;
