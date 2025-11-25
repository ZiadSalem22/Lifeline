import React, { useState, useRef } from 'react';
import { downloadExport, importTodos } from './api';

const ExportImport = ({ onImportComplete, isOpen, onClose }) => {
  const [exportFormat, setExportFormat] = useState('json');
  const [importMode, setImportMode] = useState('merge');
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    try {
      await downloadExport(exportFormat);
      setImportMessage(`Export started (${exportFormat.toUpperCase()})`);
      setTimeout(() => setImportMessage(''), 3000);
    } catch (error) {
      setImportError('Failed to export: ' + error.message);
      setTimeout(() => setImportError(''), 3000);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportError('');
      setImportMessage('Importing...');

      const fileContent = await file.text();
      const result = await importTodos(fileContent, importMode);

      setImportMessage(`Successfully imported ${result.importedCount} todos`);
      setTimeout(() => setImportMessage(''), 3000);

      // Reload parent component
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      setImportError('Import failed: ' + error.message);
      setTimeout(() => setImportError(''), 3000);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: 'var(--color-text)', marginTop: 0, marginBottom: '20px' }}>
          Export / Import
        </h2>

        {/* Export Section */}
        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', marginBottom: '12px' }}>
            Export Your Tasks
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--color-surface-light)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <option value="json">JSON Format</option>
              <option value="csv">CSV Format</option>
            </select>
            <button
              onClick={handleExport}
              style={{
                padding: '8px 16px',
                background: 'var(--color-primary)',
                color: 'var(--color-bg)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Download
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {exportFormat === 'json'
              ? 'Exports all tasks with full details as JSON file'
              : 'Exports all tasks as CSV file'}
          </p>
        </div>

        {/* Import Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: '1rem', marginBottom: '12px' }}>
            Import Tasks
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--color-surface-light)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <option value="merge">Merge (Keep existing)</option>
              <option value="replace">Replace (Clear all)</option>
            </select>
            <button
              onClick={handleImportClick}
              style={{
                padding: '8px 16px',
                background: 'var(--color-primary)',
                color: 'var(--color-bg)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Select File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {importMode === 'merge'
              ? 'Adds imported tasks to your existing tasks'
              : 'Replaces all your current tasks with imported ones'}
          </p>
        </div>

        {/* Messages */}
        {importMessage && (
          <div
            style={{
              padding: '12px',
              background: 'var(--color-primary)20',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
              borderRadius: '8px',
              fontSize: '0.875rem',
              marginBottom: '12px',
            }}
          >
            {importMessage}
          </div>
        )}

        {importError && (
          <div
            style={{
              padding: '12px',
              background: 'var(--color-danger)20',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              borderRadius: '8px',
              fontSize: '0.875rem',
              marginBottom: '12px',
            }}
          >
            {importError}
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px',
            background: 'var(--color-surface-light)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-light)';
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ExportImport;
