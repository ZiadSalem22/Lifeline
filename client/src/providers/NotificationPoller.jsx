import React, { useEffect, useRef, useState } from 'react';
import { getPendingNotifications } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { useAuthContext } from './AuthProvider';

export default function NotificationPoller({ intervalMs = 60000, onNotify }) {
  const { guestMode, isAuthenticated } = useAuthContext();
  const { fetchWithAuth } = useApi();
  const timer = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || guestMode) return; // Only poll when authenticated
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await getPendingNotifications(fetchWithAuth);
        if (!cancelled && Array.isArray(data) && data.length && onNotify) {
          onNotify(data);
        }
        setError(null);
      } catch (e) {
        setError(e.message || 'Notification poll failed');
      }
      timer.current = setTimeout(poll, intervalMs);
    };
    poll();
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [isAuthenticated, guestMode, fetchWithAuth, intervalMs, onNotify]);

  if (error) {
    return <div style={{ position:'fixed', bottom:20, right:20, background:'var(--color-danger)', color:'#fff', padding:'6px 10px', borderRadius:8, fontSize:'0.75rem' }}>Notifications error</div>;
  }
  return null;
}
