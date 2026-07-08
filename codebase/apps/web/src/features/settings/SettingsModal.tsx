import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { format } from 'date-fns';
import type { Tag } from '@lifeline/shared';
import { useAuth } from '../../app/providers/auth-context';
import { useTheme } from '../../app/providers/theme-context';
import type { FontName, ThemeId } from '../../app/providers/theme-context';
import { Modal } from '../../shared/ui/Modal';
import { CheckIcon, CloseIcon, DeleteIcon, EditIcon, TagIcon } from '../../shared/ui/icons';
import { useAllTags, useCreateTag, useDeleteTag, useUpdateTag } from '../todos/data/hooks';
import { randomTagColor } from '../todos/lib/format';
import { downloadExportBlob, importData, resetAccount } from './data';
import {
  buildGuestExport,
  importGuestData,
  triggerDownload,
  wipeGuestData,
} from './export-import-lib';
import styles from './SettingsModal.module.css';

/**
 * Settings modal — port of the old components/settings/Settings.jsx with the
 * decision-05 fixes: tag CRUD is guest-aware, the font selector actually
 * changes the font, the 12–20 size slider is wired, themes render as a
 * 9-swatch grid, and export/import/reset work in guest mode too. Esc closes
 * (the old modal never handled Esc despite its footer hint).
 */

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'tags' | 'appearance' | 'about' | 'importExport';

/** Mini bg/surface/primary swatches per theme, mirroring tokens.css. */
const THEME_SWATCHES: Record<ThemeId, [string, string, string]> = {
  dark: ['#000', '#0d0d0d', '#0f4'],
  'blue-dark': ['#000', '#0d1a26', '#1e90ff'],
  white: ['#fff', '#f7f7f7', 'rgb(48, 199, 99)'],
  'clean-beige': ['#fdfbf7', '#f3eeda', '#8b7765'],
  pink: ['#fff0f5', '#ffe4e1', '#ff69b4'],
  red: ['#fff5ee', '#fa8072', '#dc143c'],
  blue: ['#f0f8ff', '#add8e6', '#1e90ff'],
  midnight: ['#191970', '#2c2c84', '#8a2be2'],
  sunset: ['#fffaf0', '#ffe4b5', '#ff8c00'],
};

function themeLabel(theme: ThemeId): string {
  return theme
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/* ── tags tab ─────────────────────────────────────────────────────────────── */

function TagsTab() {
  const tagsQuery = useAllTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(randomTagColor);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const tags = tagsQuery.data ?? [];

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim() || createTag.isPending) return;
    setError('');
    try {
      await createTag.mutateAsync({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(randomTagColor());
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to create tag.');
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setError('');
    try {
      await updateTag.mutateAsync({ id, patch: { name: editName.trim(), color: editColor } });
      cancelEdit();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update tag.');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await deleteTag.mutateAsync(id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete tag.');
    }
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Tags</h3>

      <form className={styles.tagForm} onSubmit={handleAdd}>
        <input
          type="text"
          className={styles.textInput}
          placeholder="Tag name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          aria-label="New tag name"
        />
        <input
          type="color"
          className={styles.colorInput}
          value={newColor}
          onChange={(event) => setNewColor(event.target.value)}
          aria-label="New tag color"
        />
        <button type="submit" className={styles.primaryButton} disabled={createTag.isPending}>
          {createTag.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.tagList}>
        {tags.length === 0 ? (
          <div className={styles.emptyTags}>
            <TagIcon />
            <p>No tags yet. Create your first one!</p>
          </div>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className={styles.tagItem}>
              {editingId === tag.id ? (
                <>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={editColor}
                    onChange={(event) => setEditColor(event.target.value)}
                    aria-label={`Edit color for ${tag.name}`}
                  />
                  <input
                    type="text"
                    className={styles.textInput}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void saveEdit(tag.id);
                      } else if (event.key === 'Escape') {
                        event.stopPropagation();
                        cancelEdit();
                      }
                    }}
                    autoFocus
                    aria-label={`Edit name for ${tag.name}`}
                  />
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => void saveEdit(tag.id)}
                    aria-label={`Save tag ${tag.name}`}
                  >
                    <CheckIcon width={16} height={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={cancelEdit}
                    aria-label="Cancel tag edit"
                  >
                    <CloseIcon width={16} height={16} />
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.tagSwatch} style={{ background: tag.color }} />
                  <span className={styles.tagName}>{tag.name}</span>
                  {tag.isDefault ? (
                    <span className={styles.defaultBadge}>Default</span>
                  ) : (
                    <span className={styles.tagActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => startEdit(tag)}
                        aria-label={`Edit tag ${tag.name}`}
                      >
                        <EditIcon width={16} height={16} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconButton} ${styles.dangerIcon}`}
                        onClick={() => void handleDelete(tag.id)}
                        aria-label={`Delete tag ${tag.name}`}
                      >
                        <DeleteIcon width={16} height={16} />
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── appearance tab ───────────────────────────────────────────────────────── */

function AppearanceTab() {
  const { theme, setTheme, font, setFont, fontSize, setFontSize, themes, fonts } = useTheme();

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Appearance</h3>

      <div className={styles.formGroup}>
        <span className={styles.label}>Theme</span>
        <div className={styles.themeGrid}>
          {themes.map((id) => {
            const [bg, surface, primary] = THEME_SWATCHES[id];
            return (
              <button
                key={id}
                type="button"
                className={[styles.themeCard, theme === id ? styles.themeCardActive : undefined]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setTheme(id)}
                aria-pressed={theme === id}
                aria-label={`Theme ${themeLabel(id)}`}
              >
                <span className={styles.swatchRow}>
                  <span className={styles.swatch} style={{ background: bg }} />
                  <span className={styles.swatch} style={{ background: surface }} />
                  <span className={styles.swatch} style={{ background: primary }} />
                </span>
                <span className={styles.themeName}>{themeLabel(id)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="settings-font">
          Font
        </label>
        <select
          id="settings-font"
          className={styles.select}
          value={font}
          onChange={(event) => setFont(event.target.value as FontName)}
        >
          {fonts.map((name) => (
            <option key={name} value={name} style={{ fontFamily: name }}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="settings-font-size">
          Font Size <span className={styles.fontSizeValue}>{fontSize}px</span>
        </label>
        <input
          id="settings-font-size"
          type="range"
          min={12}
          max={20}
          step={1}
          value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value))}
          className={styles.range}
        />
      </div>
    </div>
  );
}

/* ── import/export tab ────────────────────────────────────────────────────── */

function ImportExportTab({ guestMode }: { guestMode: boolean }) {
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const flash = (setter: (value: string) => void, value: string) => {
    setter(value);
    setTimeout(() => setter(''), 3000);
  };

  const handleExport = async () => {
    setError('');
    try {
      if (guestMode) {
        const payload = buildGuestExport();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `lifeline-export-${format(new Date(), 'yyyy-MM-dd')}.json`);
        flash(setMessage, 'Export downloaded (JSON)');
      } else {
        const blob = await downloadExportBlob(exportFormat);
        triggerDownload(blob, `todos_export_${Date.now()}.${exportFormat}`);
        flash(setMessage, `Export started (${exportFormat.toUpperCase()})`);
      }
    } catch (exportError) {
      flash(
        setError,
        `Failed to export: ${exportError instanceof Error ? exportError.message : 'unknown error'}`,
      );
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setMessage('Importing...');
    try {
      const text = await file.text();
      const importedCount = guestMode
        ? importGuestData(text, importMode)
        : (await importData(text, importMode)).importedCount;
      setMessage(`Successfully imported ${importedCount} todos. Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (importError) {
      setMessage('');
      flash(
        setError,
        `Import failed: ${importError instanceof Error ? importError.message : 'unknown error'}`,
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete ALL your todos, tags, and theme? This cannot be undone.',
      )
    ) {
      return;
    }
    setError('');
    setMessage('Deleting account data...');
    try {
      if (guestMode) wipeGuestData();
      else await resetAccount();
      setMessage('Account data deleted. Reloading...');
      setTimeout(() => window.location.reload(), 1200);
    } catch (resetError) {
      setMessage('');
      flash(
        setError,
        `Failed to reset: ${resetError instanceof Error ? resetError.message : 'unknown error'}`,
      );
    }
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Import / Export</h3>
      <p className={styles.sectionSubtitle}>
        Export your data (tasks, tags, preferences) or import a previously exported file to restore
        your workspace.
      </p>

      <div className={styles.ioBlock}>
        <h4 className={styles.ioTitle}>Export Your Tasks</h4>
        <div className={styles.ioRow}>
          <select
            className={styles.select}
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as 'json' | 'csv')}
            disabled={guestMode}
            aria-label="Export format"
          >
            <option value="json">JSON Format</option>
            {!guestMode && <option value="csv">CSV Format</option>}
          </select>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleExport()}
          >
            Download
          </button>
        </div>
        <p className={styles.helper}>
          {guestMode
            ? 'Exports your local guest workspace as a JSON file'
            : exportFormat === 'json'
              ? 'Exports all tasks with full details as JSON file'
              : 'Exports all tasks as CSV file'}
        </p>
      </div>

      <div className={styles.ioBlock}>
        <h4 className={styles.ioTitle}>Import Tasks</h4>
        <div className={styles.ioRow}>
          <select
            className={styles.select}
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as 'merge' | 'replace')}
            aria-label="Import mode"
          >
            <option value="merge">Merge (Keep existing)</option>
            <option value="replace">Replace (Clear all)</option>
          </select>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => fileInputRef.current?.click()}
          >
            Select File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={guestMode ? '.json' : '.json,.csv'}
            className={styles.hiddenFile}
            onChange={(event) => void handleFileSelected(event.target.files?.[0])}
            aria-label="Import file"
          />
        </div>
        <p className={styles.helper}>
          {importMode === 'merge'
            ? 'Adds imported tasks to your existing tasks'
            : 'Replaces all your current tasks with imported ones'}
        </p>
      </div>

      {message && (
        <div className={styles.message} role="status">
          {message}
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <div className={styles.dangerBlock}>
        <h4 className={styles.dangerTitle}>Delete All Data</h4>
        <p className={styles.dangerText}>
          This will permanently delete all your todos, tags, and theme. This action cannot be
          undone.
        </p>
        <button type="button" className={styles.dangerButton} onClick={() => void handleReset()}>
          Delete All Data
        </button>
      </div>
    </div>
  );
}

/* ── the modal ────────────────────────────────────────────────────────────── */

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'tags', label: 'Tags' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'about', label: 'About' },
  { key: 'importExport', label: 'Import / Export' },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { guestMode } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('tags');

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className={styles.body}>
        <p className={styles.subtitle}>Manage your tags and preferences</p>

        <div className={styles.tabs} role="tablist" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={[styles.tab, activeTab === tab.key ? styles.tabActive : undefined]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'tags' && <TagsTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'importExport' && <ImportExportTab guestMode={guestMode} />}
        {activeTab === 'about' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>About</h3>
            <div className={styles.about}>
              <h4 className={styles.aboutName}>Lifeline</h4>
              <p className={styles.sectionSubtitle}>Version 1.0.0</p>
              <p className={styles.sectionSubtitle}>
                A beautiful and functional Do Apps experience built with React and Node.js. Organize
                your do apps efficiently with tags and priorities.
              </p>
              <p className={styles.copyright}>© 2025 Golden Gateway. All rights reserved.</p>
            </div>
          </div>
        )}

        <p className={styles.footerHint}>
          Press <kbd className={styles.kbd}>Esc</kbd> to close
        </p>
      </div>
    </Modal>
  );
}
