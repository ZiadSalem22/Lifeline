import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ExportDataModal from './ExportDataModal';
import { createTag, deleteTag, updateTag } from '../../utils/api';
import { DeleteIcon, TagIcon, EditIcon, CheckIcon, CloseIcon } from '../../icons/Icons';
import styles from './Settings.module.css';

const Settings = ({ isOpen, onClose, tags, setTags, theme, themes, setTheme, font, fonts, setFont, fetchWithAuth }) => {
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6366f1');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('tags');
    const [showExportModal, setShowExportModal] = useState(false);
    const [editingTagId, setEditingTagId] = useState(null);
    const [editTagName, setEditTagName] = useState('');
    const [editTagColor, setEditTagColor] = useState('');

    const handleAddTag = async (e) => {
        e.preventDefault();
        if (!newTagName.trim() || isSubmitting) return;

        try {
            setIsSubmitting(true);
            const created = await createTag(newTagName.trim(), newTagColor, fetchWithAuth);
            setTags([...tags, created]);
            setNewTagName('');
            setNewTagColor('#6366f1');
        } catch (error) {
            console.error('Failed to create tag', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStartEdit = (tag) => {
        setEditingTagId(tag.id);
        setEditTagName(tag.name);
        setEditTagColor(tag.color);
    };

    const handleCancelEdit = () => {
        setEditingTagId(null);
        setEditTagName('');
        setEditTagColor('');
    };

    const handleDeleteTag = async (id) => {
        try {
            await deleteTag(id, fetchWithAuth);
            setTags(tags.filter(t => t.id !== id));
        } catch (error) {
            console.error('Failed to delete tag', error);
        }
    };
    const handleSaveEdit = async (id) => {
        if (!editTagName.trim()) return;
        try {
            const updatedTag = await updateTag(id, editTagName.trim(), editTagColor, fetchWithAuth);
            setTags(tags.map(t => t.id === id ? updatedTag : t));
            handleCancelEdit();
        } catch (error) {
            console.error("Failed to update tag", error);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={styles.overlay}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.header}>
                            <div>
                                <h2 className={styles.title}>Settings</h2>
                                <p className={styles.subtitle}>Manage your tags and preferences</p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onClose}
                                className={styles['close-btn']}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = 'var(--color-text)';
                                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = 'var(--color-text-muted)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </motion.button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className={styles.tabs}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('tags')}
                                className={activeTab === 'tags' ? styles['tab-active'] : styles.tab}
                            >
                                Tags
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('appearance')}
                                className={activeTab === 'appearance' ? styles['tab-active'] : styles.tab}
                            >
                                Appearance
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('about')}
                                className={activeTab === 'about' ? styles['tab-active'] : styles.tab}
                            >
                                About
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('export')}
                                className={activeTab === 'export' ? styles['tab-active'] : styles.tab}
                            >
                                Export
                            </motion.button>
                        </div>
                        {showExportModal && (
                            <ExportDataModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
                        )}

                        {/* Content */}
                        <div className={styles['body']}>
                            {/* Tags Tab */}
                            {activeTab === 'tags' && (
                            <div className={styles['section']}>
                                <h3 style={{
                                    fontFamily: 'var(--font-family-heading)',
                                    fontSize: '1.125rem',
                                    fontWeight: '600',
                                    color: 'var(--color-text)',
                                    marginBottom: '16px'
                                }}>
                                    Tags
                                </h3>

                                {/* Add Tag Form */}
                                <form onSubmit={handleAddTag} className={styles['form-inline']}>
                                    <input
                                        type="text"
                                        placeholder="Tag name"
                                        value={newTagName}
                                        onChange={e => setNewTagName(e.target.value)}
                                        className={styles['text-input']}
                                        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                    />
                                    <div className={styles['relative']}>
                                        <input
                                            type="color"
                                            value={newTagColor}
                                            onChange={e => setNewTagColor(e.target.value)}
                                            className={styles['color-input']}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                        />
                                    </div>
                                    <motion.button
                                        type="submit"
                                        disabled={isSubmitting}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={styles['submit-btn']}
                                        onMouseEnter={(e) => {
                                            if (!isSubmitting) e.currentTarget.style.background = 'var(--color-primary-dark)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSubmitting) e.currentTarget.style.background = 'var(--color-primary)';
                                        }}
                                    >
                                        {isSubmitting ? (<div className={styles.spinner} />) : ('Add')}
                                    </motion.button>
                                </form>

                                {/* Tags List */}
                                <div className={`${styles.list} custom-scrollbar`}>
                                    <AnimatePresence mode="popLayout">
                                        {tags.length === 0 ? (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className={styles.empty}
                                            >
                                                <div className={styles['empty-icon']}>
                                                    <TagIcon />
                                                </div>
                                                <p className={styles['empty-text']}>
                                                    No tags yet. Create your first one!
                                                </p>
                                            </motion.div>
                                        ) : (
                                            tags.map((tag, index) => (
                                                <motion.div
                                                    key={tag.id}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20, height: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className={styles['tag-item-surface']}
                                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border-hover)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                                >
                                                    {editingTagId === tag.id ? (
                                                        <>
                                                            <div className={styles['edit-row']}>
                                                                <input
                                                                    type="color"
                                                                    value={editTagColor}
                                                                    onChange={(e) => setEditTagColor(e.target.value)}
                                                                    className={styles['color-input']}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={editTagName}
                                                                    onChange={(e) => setEditTagName(e.target.value)}
                                                                    className={styles['text-input']}
                                                                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                                                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleSaveEdit(tag.id);
                                                                        } else if (e.key === 'Escape') {
                                                                            handleCancelEdit();
                                                                        }
                                                                    }}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <motion.button
                                                                whileHover={{ scale: 1.1 }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => handleSaveEdit(tag.id)}
                                                                className={styles.btn}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = 'transparent';
                                                                }}
                                                            >
                                                                <CheckIcon />
                                                            </motion.button>
                                                            <motion.button
                                                                whileHover={{ scale: 1.1 }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={handleCancelEdit}
                                                                className={styles.btn}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.color = 'var(--color-text)';
                                                                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.color = 'var(--color-text-muted)';
                                                                    e.currentTarget.style.background = 'transparent';
                                                                }}
                                                            >
                                                                <CloseIcon />
                                                            </motion.button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className={styles.row}>
                                                                <div className={styles.swatch}>
                                                                    <div className={styles['swatch-color']} style={{ backgroundColor: tag.color }} />
                                                                </div>
                                                                <span className={styles['tag-name']}>
                                                                    {tag.name}
                                                                </span>
                                                            </div>
                                                            <div className={`tag-actions ${styles.actions}`}>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={() => handleStartEdit(tag)}
                                                                    className={styles.btn}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.color = 'var(--color-primary)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.color = 'var(--color-text-muted)';
                                                                    }}
                                                                >
                                                                    <EditIcon />
                                                                </motion.button>
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={() => handleDeleteTag(tag.id)}
                                                                    className={styles.btn}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.color = 'var(--color-danger)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.color = 'var(--color-text-muted)';
                                                                    }}
                                                                >
                                                                    <DeleteIcon />
                                                                </motion.button>
                                                            </div>
                                                        </>
                                                    )}
                                                </motion.div>
                                            ))
                                        )}
                                    </AnimatePresence>
                                                                </div>
                            </div>
                            )}

                            {/* Export Tab */}
                            {activeTab === 'export' && (
                                <div className={styles.section}>
                                    <h3 className={styles['section-title']}>Export</h3>
                                    <p className={styles['section-subtitle']}>Export your data (tasks, tags, and preferences). Use the button below to open the export dialog.</p>
                                    <div>
                                        <button onClick={() => setShowExportModal(true)} className={styles['submit-btn']}>Open Export Dialog</button>
                                    </div>
                                </div>
                            )}

                            {/* Appearance Tab */}
                            {activeTab === 'appearance' && (
                                <div className={styles.section}>
                                    <h3 className={styles['section-title']}>Appearance</h3>
                                    <div className={styles.panel}>
                                        <div className={styles['form-group']}>
                                            <label className={styles.label}>Theme</label>
                                            <select
                                                value={theme}
                                                onChange={(e) => setTheme(e.target.value)}
                                                className={styles.select}
                                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                            >
                                                {themes && themes.map((themeName) => (
                                                    <option key={themeName} value={themeName}>
                                                        {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles['form-group']}>
                                            <label className={styles.label}>Font</label>
                                            <select
                                                value={font}
                                                onChange={(e) => setFont(e.target.value)}
                                                className={styles.select}
                                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                            >
                                                {fonts && fonts.map((fontOption) => (
                                                    <option key={fontOption.value} value={fontOption.value} style={{ fontFamily: fontOption.value }}>
                                                        {fontOption.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles['form-group']}>
                                            <label className={styles.label}>Font Size</label>
                                            <input
                                                type="range"
                                                min="12"
                                                max="20"
                                                defaultValue="16"
                                                className={styles.range}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* About Tab */}
                            {activeTab === 'about' && (
                                <div className={styles.section}>
                                    <h3 className={styles['section-title']}>About</h3>
                                    <div className={styles.panel}>
                                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                            <h4 className={styles.h3}>Todo App</h4>
                                            <p className={styles['section-subtitle']}>Version 1.0.0</p>
                                            <p className={styles['section-subtitle']}>
                                                A beautiful and functional todo application built with React and Node.js.
                                                Organize your tasks efficiently with tags and priorities.
                                            </p>
                                            <div className={styles['section-border']} style={{ marginTop: '24px', paddingTop: '24px' }}>
                                                <p className={styles['section-subtitle']}>
                                                    © 2024 Todo App. All rights reserved.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className={styles['section-border']} style={{ paddingTop: '16px' }}>
                                <p className={styles['section-subtitle']} style={{ textAlign: 'center' }}>
                                    Press <kbd className={styles.kbd}>Esc</kbd> to close
                                </p>
                            </div>
                        </div>

                        
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Settings;
