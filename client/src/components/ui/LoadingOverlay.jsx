import React from 'react';
import { useLoading } from '../../context/LoadingContext';

export default function LoadingOverlay() {
  const { isLoading, loadingMessage } = useLoading();
  if (!isLoading) return null;

  return (
    <div className="global-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-card" aria-hidden={false} style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
        <div className="global-loading-spinner" aria-hidden="true" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <div className="loading-sub" style={{ fontWeight: 700 }}>{loadingMessage || 'Loading…'}</div>
        </div>
      </div>
    </div>
  );
}
