import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useAuthContext } from '../../providers/AuthProvider.jsx';
import { useTodos } from '../../providers/TodoProvider.jsx';
import * as guestApi from '../../utils/guestApi';
import { fetchTodos as apiFetchTodos, fetchTags as apiFetchTags } from '../../utils/api';
import { useApi } from '../../hooks/useApi';

export default function ExportDataModal({ isOpen, onClose }) {
  const { guestMode, currentUser } = useAuthContext();
  const { todos: providerTodos, tags: providerTags } = useTodos();
  const { fetchWithAuth } = useApi();
  const [preview, setPreview] = useState(null);
  const [exportBlobUrl, setExportBlobUrl] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const exported_at = new Date().toISOString();
      try {
        if (guestMode) {
          const gt = await guestApi.fetchTodos();
          const tg = await guestApi.fetchTags();
          const settings = {
            theme: localStorage.getItem('theme') || 'dark',
            layout: {
              showSidebar: localStorage.getItem('showSidebar') === 'true'
            },
            locale: localStorage.getItem('locale') || 'en'
          };
          const stats = {
            totalTodos: (gt || []).length,
            completedCount: (gt || []).filter(t => t.isCompleted).length
          };
          const data = { exported_at, user: { mode: 'guest' }, todos: gt || [], tags: tg || [], settings, stats };
          setPreview(data);
        } else {
          // Try to use API endpoint if available
          try {
            // Use authenticated fetch so the request is sent to the API server
            // (use absolute API base from Vite env) and include auth token.
            const res = await fetchWithAuth('/api/export');
            if (res && res.ok) {
              const data = await res.json();
              setPreview(data);
              return;
            }
          } catch (err) {
            // fallback to provider state (could be token error or network)
            // console.debug('Export fetch failed, falling back to provider:', err?.message || err);
          }
          const stats = {
            totalTodos: (providerTodos || []).length,
            completedCount: (providerTodos || []).filter(t => t.isCompleted).length
          };
          const data = { exported_at, user: { id: currentUser?.id, email: currentUser?.email, profile: currentUser?.profile || null }, todos: providerTodos || [], tags: providerTags || [], stats };
          setPreview(data);
        }
      } catch (err) {
        setPreview({ exported_at, error: String(err) });
      }
    })();
  }, [isOpen, guestMode, providerTodos, providerTags, currentUser, fetchWithAuth]);

  useEffect(() => {
    return () => {
      if (exportBlobUrl) URL.revokeObjectURL(exportBlobUrl);
    };
  }, [exportBlobUrl]);

  const handleDownload = () => {
    if (!preview) return;
    const json = JSON.stringify(preview, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    setExportBlobUrl(url);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `lifeline-export-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // small toast - use simple alert if no toast system
    try {  
      const ev = new CustomEvent('lifeline:toast', { detail: { message: 'Data exported successfully!' } });
      window.dispatchEvent(ev);
    } catch (e) {}
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Your Data">
      <p>Download all your tasks, tags, preferences, and profile data.</p>
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, maxHeight: 300, overflow: 'auto', background: 'var(--color-surface)' }}>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', margin: 0 }}>{preview ? JSON.stringify(preview.todos?.slice(0,10) || preview, null, 2) : 'Preparing preview...'}</pre>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={handleDownload} style={{ width: '100%', padding: '10px 14px', background: '#00FF7F', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Download JSON</button>
      </div>
    </Modal>
  );
}
