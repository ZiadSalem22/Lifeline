import React from 'react';
import { useLoading } from '../../context/LoadingContext';

export default function LoadingOverlay() {
  const { isLoading, loadingMessage } = useLoading();
  if (!isLoading) return null;

  return (
    <div className="global-loading-overlay" role="status" aria-live="polite" aria-busy="true" aria-label={loadingMessage || 'Loading'}>
      <div className="loading-card" aria-hidden={false} style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="global-loading-spinner" aria-hidden={false} />
        {/* Apple-like boxed message under spinner (theme-aware) */}
        {loadingMessage ? (
          <div className="loading-message-box" role="status">{loadingMessage}</div>
        ) : null}
      </div>
    </div>
  );
}
