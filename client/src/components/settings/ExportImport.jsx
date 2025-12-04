import React, { useState, useRef } from 'react';
import { downloadExport, importTodos, resetAccountData } from '../../utils/api';
import styles from './ExportImport.module.css';

// Settings-adjacent dialog responsible for exporting and importing workspace data safely.
const ExportImport = ({ onImportComplete, isOpen, onClose, fetchWithAuth }) => {
  const [exportFormat, setExportFormat] = useState('json');
  const [importMode, setImportMode] = useState('merge');
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    if (!fetchWithAuth) {
      setImportError('Authentication not ready');
      setTimeout(() => setImportError(''), 3000);
      return;
    }
    try {
      await downloadExport(exportFormat, fetchWithAuth);
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
      if (!fetchWithAuth) {
        setImportError('Authentication not ready');
        setTimeout(() => setImportError(''), 3000);
        return;
      }
      setImportError('');
      setImportMessage('Importing...');

      const fileContent = await file.text();
      const result = await importTodos(fileContent, importMode, fetchWithAuth);

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

  // Add reset handler
  const handleResetAccount = async () => {
    if (!window.confirm('Are you sure you want to delete ALL your todos, tags, and theme? This cannot be undone.')) return;
    try {
      setImportMessage('Resetting account data...');
      await resetAccountData(fetchWithAuth);
      setImportMessage('Account data deleted. Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setImportError('Failed to reset account: ' + error.message);
      setTimeout(() => setImportError(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Export / Import</h2>

        {/* Export Section */}
        <div className={styles.section}>
          <h3>
            Export Your Tasks
          </h3>
          <div className={styles.row}>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className={styles.select}
            >
              <option value="json">JSON Format</option>
              <option value="csv">CSV Format</option>
            </select>
            <button
              onClick={handleExport}
              className={styles["primary-btn"]}
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
        <div className={styles.section} style={{ borderBottom: 'none' }}>
          <h3>
            Import Tasks
          </h3>
          <div className={styles.row}>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
              className={styles.select}
            >
              <option value="merge">Merge (Keep existing)</option>
              <option value="replace">Replace (Clear all)</option>
            </select>
            <button
              onClick={handleImportClick}
              className={styles["primary-btn"]}
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
          <div className={styles.message}>{importMessage}</div>
        )}

        {importError && (
          <div className={styles.error}>{importError}</div>
        )}

        {/* Delete/Reset Button */}
        <div className={styles.section} style={{ borderTop: '1px solid var(--color-border)', marginTop: 24, paddingTop: 16 }}>
          <h3 style={{ color: 'var(--color-danger)' }}>Delete All Data</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', margin: 0 }}>
            This will permanently delete all your todos, tags, and theme. This action cannot be undone.
          </p>
          <button
            onClick={handleResetAccount}
            className={styles['danger-btn']}
            style={{ marginTop: 12 }}
          >
            Delete All Data
          </button>
        </div>

        {/* Close Button */}
        <button onClick={onClose} className={styles['close-btn']}>Close</button>
      </div>
    </div>
  );
};

export default ExportImport;
