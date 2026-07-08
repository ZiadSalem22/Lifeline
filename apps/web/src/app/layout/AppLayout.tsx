import { useState } from 'react';
import { Outlet } from 'react-router';
import { SettingsModal } from '../../features/settings/SettingsModal';
import { Spinner } from '../../shared/ui/Spinner';
import { useAuth } from '../providers/auth-context';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppLayout.module.css';

/**
 * App chrome: sidebar + (topbar / page) grid, off-canvas sidebar below 768px.
 * Gates rendering until the first identity resolution finished (old app parity).
 */
export function AppLayout() {
  const { checkedIdentity, notice, guestMode } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Note: every sidebar navigation action calls onClose itself, so the
  // off-canvas sidebar closes on navigation without a location effect.

  if (!checkedIdentity) {
    return (
      <div className={styles.gate}>
        <Spinner size={44} label="Loading Lifeline" />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className={styles.main}>
        <TopBar
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {notice ? (
          <div className={styles.noticeBanner} role="status">
            {notice}
          </div>
        ) : guestMode ? (
          <div className={styles.guestBanner} role="status">
            Hello guest — your tasks are stored locally in this browser.
          </div>
        ) : null}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
