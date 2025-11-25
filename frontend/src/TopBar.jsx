import React from 'react';
import { SearchIcon, SettingsIcon, MenuIcon } from './Icons';
import './TopBar.css';

const TopBar = (props) => {
    const {
        onOpenSettings,
        searchQuery,
        setSearchQuery,
        onLoginClick,
        onOpenSidebar,
        isMobileSidebarOpen
    } = props;
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
                    <button type="button" className="top-bar-button top-bar-settings" onClick={onOpenSettings} title="Settings">
                        <SettingsIcon />
                    </button>
                    <button
                        type="button"
                        className="top-bar-button top-bar-login"
                        onClick={onLoginClick}
                        title="Login"
                    >
                        Login
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
