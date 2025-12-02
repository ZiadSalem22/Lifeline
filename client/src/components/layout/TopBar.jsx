import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { SearchIcon, SettingsIcon, MenuIcon } from '../../icons/Icons';
import './TopBar.css';

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
        <header className="top-bar">
            <div className="top-bar-main">
                {!isMobileSidebarOpen && (
                    <button
                        type="button"
                        className="top-bar-menu-button"
                        onClick={onOpenSidebar}
                        aria-label="Open navigation"
                    >
                        <MenuIcon />
                    </button>
                )}

                <div className="top-bar-title-wrap">
                    <h2 className="top-bar-title">Lifeline</h2>
                </div>

                <div className="top-bar-search">
                    <div className="search-icon">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                        aria-label="Search tasks and tags"
                    />
                </div>

                <div className="top-bar-actions">
                    {/* Settings icon removed; now inside identity dropdown */}
                    {guestMode && (
                        <div className="guest-pill" ref={dropdownRef}>
                            <span>Hello, Guest</span>
                            <button type="button" className="guest-login" onClick={() => loginWithRedirect()}>Log in</button>
                            <button
                                type="button"
                                className="guest-caret-btn"
                                aria-haspopup="true"
                                aria-expanded={open ? 'true' : 'false'}
                                aria-label="Open guest menu"
                                onClick={(e) => { e.stopPropagation(); toggle(); }}
                            >
                                ▾
                            </button>
                            {open && (
                                <div className="chip-dropdown" role="menu" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => { close(); loginWithRedirect(); }} role="menuitem">Login</button>
                                    <button type="button" onClick={() => { close(); loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } }); }} role="menuitem">Sign up</button>
                                </div>
                            )}
                        </div>
                    )}
                    {!guestMode && isAuthenticated && currentUser && (
                        <div className="identity-chip-container" ref={dropdownRef}>
                            <button
                                type="button"
                                className="identity-chip"
                                onClick={toggle}
                                aria-haspopup="true"
                                aria-expanded={open ? 'true' : 'false'}
                                aria-label="Open profile menu"
                            >
                                {avatar ? (
                                    <img src={avatar} alt={name || 'User'} className="chip-avatar" />
                                ) : (
                                    <div className="chip-avatar chip-initials">{(name || 'U').substring(0,1).toUpperCase()}</div>
                                )}
                                <div className="chip-name" title={name}>{name || 'User'} <span aria-hidden>▾</span></div>
                            </button>
                            {open && (
                                <div className="chip-dropdown" role="menu" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => { close(); props.onOpenProfile && props.onOpenProfile(); }} role="menuitem">Profile</button>
                                    <button type="button" onClick={() => { close(); onOpenSettings && onOpenSettings(); }} role="menuitem">Settings</button>
                                    <button type="button" onClick={dropdownLogout} role="menuitem">Logout</button>
                                </div>
                            )}
                        </div>
                    )}
                    {!guestMode && !isAuthenticated && (
                        <button type="button" className="top-bar-button top-bar-login" onClick={() => loginWithRedirect()} title="Login">Login</button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
