import React from 'react';
import { useAuthContext } from '../../providers/AuthProvider.jsx';
import { useTodos } from '../../providers/TodoProvider.jsx';

export default function StatusBanner() {
  const { guestMode, isAuthenticated, error: authError } = useAuthContext();
  const { error: todoError } = useTodos();
  const message = todoError || authError;
  if (!message && !guestMode) return null;
  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      background: guestMode ? 'linear-gradient(90deg,#442266,#662277)' : 'rgba(180,40,40,0.25)',
      color: '#fff',
      fontSize: '0.75rem',
      letterSpacing: '0.5px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      borderBottom: '1px solid rgba(255,255,255,0.15)'
    }}>
      {guestMode && <strong style={{ fontWeight: 600 }}>Guest Mode</strong>}
      {message && <span style={{ opacity: 0.9 }}>{message}</span>}
      {!isAuthenticated && guestMode && !message && <span style={{ opacity: 0.7 }}>You are browsing without signing in.</span>}
    </div>
  );
}
