import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createTag, deleteTag, updateTag } from './api';
import { DeleteIcon, TagIcon, EditIcon, CheckIcon, CloseIcon } from './Icons';

const Settings = ({ isOpen, onClose, tags, setTags, theme, themes, setTheme, font, fonts, setFont }) => {
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6366f1');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('tags');
    const [editingTagId, setEditingTagId] = useState(null);
    const [editTagName, setEditTagName] = useState('');
    const [editTagColor, setEditTagColor] = useState('');

    const handleAddTag = async (e) => {
        e.preventDefault();
        if (!newTagName.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const newTag = await createTag(newTagName, newTagColor);
            setTags([...tags, newTag]);
            setNewTagName('');
            setNewTagColor('#6366f1');
        } catch (error) {
            console.error("Failed to create tag", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTag = async (id) => {
        try {
            await deleteTag(id);
            setTags(tags.filter(t => t.id !== id));
        } catch (error) {
            console.error("Failed to delete tag", error);
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

    const handleSaveEdit = async (id) => {
        if (!editTagName.trim()) return;
        try {
            const updatedTag = await updateTag(id, editTagName.trim(), editTagColor);
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
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'var(--shadow-dark)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '16px'
                    }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '512px',
                            boxShadow: '0 25px 50px -12px var(--shadow-dark)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '24px',
                            borderBottom: '1px solid var(--color-border)'
                        }}>
                            <div>
                                <h2 style={{
                                    fontFamily: 'var(--font-family-heading)',
                                    fontSize: '1.5rem',
                                    fontWeight: 'bold',
                                    color: 'var(--color-text)'
                                }}>
                                    Settings
                                </h2>
                                <p style={{
                                    fontSize: '0.875rem',
                                    color: 'var(--color-text-muted)',
                                    marginTop: '4px'
                                }}>
                                    Manage your tags and preferences
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onClose}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '12px',
                                    color: 'var(--color-text-muted)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
                                }}
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
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            padding: '12px 24px',
                            borderBottom: '1px solid var(--color-border)',
                            background: 'var(--color-surface-light)'
                        }}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('tags')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeTab === 'tags' ? 'var(--color-primary)' : 'transparent',
                                    color: activeTab === 'tags' ? 'var(--color-bg)' : 'var(--color-text-muted)',
                                    fontWeight: '500',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
                                }}
                            >
                                Tags
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('appearance')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeTab === 'appearance' ? 'var(--color-primary)' : 'transparent',
                                    color: activeTab === 'appearance' ? 'var(--color-bg)' : 'var(--color-text-muted)',
                                    fontWeight: '500',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
                                }}
                            >
                                Appearance
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('about')}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeTab === 'about' ? 'var(--color-primary)' : 'transparent',
                                    color: activeTab === 'about' ? 'var(--color-bg)' : 'var(--color-text-muted)',
                                    fontWeight: '500',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
                                }}
                            >
                                About
                            </motion.button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '24px' }}>
                            {/* Tags Tab */}
                            {activeTab === 'tags' && (
                            <div style={{ marginBottom: '24px' }}>
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
                                <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                                    <input
                                        type="text"
                                        placeholder="Tag name"
                                        value={newTagName}
                                        onChange={e => setNewTagName(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'var(--color-surface-light)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '12px',
                                            padding: '10px 16px',
                                            color: 'var(--color-text)',
                                            fontFamily: 'var(--font-family-base)',
                                            outline: 'none',
                                            transition: 'border-color 0.3s'
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                    />
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="color"
                                            value={newTagColor}
                                            onChange={e => setNewTagColor(e.target.value)}
                                            style={{
                                                width: '48px',
                                                height: '100%',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                border: '2px solid var(--color-border)',
                                                transition: 'border-color 0.3s',
                                                padding: 0,
                                                background: 'transparent'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                        />
                                    </div>
                                    <motion.button
                                        type="submit"
                                        disabled={isSubmitting}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            padding: '10px 24px',
                                            background: 'var(--color-primary)',
                                            borderRadius: '12px',
                                            color: 'var(--color-bg)',
                                            fontWeight: '500',
                                            fontSize: '0.875rem',
                                            border: 'none',
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.3s',
                                            boxShadow: '0 10px 15px -3px var(--shadow-primary)',
                                            opacity: isSubmitting ? 0.5 : 1
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSubmitting) e.currentTarget.style.background = 'var(--color-primary-dark)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSubmitting) e.currentTarget.style.background = 'var(--color-primary)';
                                        }}
                                    >
                                        {isSubmitting ? (
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                border: '2px solid var(--color-surface)',
                                                borderTopColor: 'var(--color-bg)',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite'
                                            }} />
                                        ) : (
                                            'Add'
                                        )}
                                    </motion.button>
                                </form>

                                {/* Tags List */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    maxHeight: '256px',
                                    overflowY: 'auto',
                                    paddingRight: '8px'
                                }} className="custom-scrollbar">
                                    <AnimatePresence mode="popLayout">
                                        {tags.length === 0 ? (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                style={{
                                                    textAlign: 'center',
                                                    padding: '32px 0'
                                                }}
                                            >
                                                <div style={{ fontSize: '2.25rem', marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                                                    <TagIcon />
                                                </div>
                                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
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
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '12px',
                                                        background: 'var(--color-surface-light)',
                                                        borderRadius: '12px',
                                                        border: '1px solid var(--color-border)',
                                                        transition: 'border-color 0.3s',
                                                        gap: '8px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border-hover)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                                >
                                                    {editingTagId === tag.id ? (
                                                        <>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                                                <input
                                                                    type="color"
                                                                    value={editTagColor}
                                                                    onChange={(e) => setEditTagColor(e.target.value)}
                                                                    style={{
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        borderRadius: '8px',
                                                                        cursor: 'pointer',
                                                                        border: '2px solid var(--color-border)',
                                                                        padding: 0,
                                                                        background: 'transparent'
                                                                    }}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={editTagName}
                                                                    onChange={(e) => setEditTagName(e.target.value)}
                                                                    style={{
                                                                        flex: 1,
                                                                        background: 'var(--color-surface)',
                                                                        border: '1px solid var(--color-border)',
                                                                        borderRadius: '8px',
                                                                        padding: '8px 12px',
                                                                        color: 'var(--color-text)',
                                                                        fontFamily: 'var(--font-family-base)',
                                                                        fontSize: '0.875rem',
                                                                        outline: 'none',
                                                                        transition: 'border-color 0.3s'
                                                                    }}
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
                                                                style={{
                                                                    padding: '8px',
                                                                    color: 'var(--color-primary)',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    transition: 'color 0.3s'
                                                                }}
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
                                                                style={{
                                                                    padding: '8px',
                                                                    color: 'var(--color-text-muted)',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    transition: 'color 0.3s'
                                                                }}
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
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                                <div
                                                                    style={{
                                                                        width: '16px',
                                                                        height: '16px',
                                                                        borderRadius: '50%',
                                                                        border: '2px solid var(--color-border)',
                                                                        backgroundColor: tag.color
                                                                    }}
                                                                />
                                                                <span style={{
                                                                    fontFamily: 'var(--font-family-base)',
                                                                    color: 'var(--color-text)',
                                                                    fontWeight: '500'
                                                                }}>
                                                                    {tag.name}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '4px', opacity: 0 }} className="tag-actions">
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }}
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={() => handleStartEdit(tag)}
                                                                    style={{
                                                                        padding: '8px',
                                                                        color: 'var(--color-text-muted)',
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        borderRadius: '8px',
                                                                        cursor: 'pointer',
                                                                        transition: 'color 0.3s'
                                                                    }}
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
                                                                    style={{
                                                                        padding: '8px',
                                                                        color: 'var(--color-text-muted)',
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        borderRadius: '8px',
                                                                        cursor: 'pointer',
                                                                        transition: 'color 0.3s'
                                                                    }}
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

                            {/* Appearance Tab */}
                            {activeTab === 'appearance' && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{
                                        fontFamily: 'var(--font-family-heading)',
                                        fontSize: '1.125rem',
                                        fontWeight: '600',
                                        color: 'var(--color-text)',
                                        marginBottom: '16px'
                                    }}>
                                        Appearance
                                    </h3>
                                    <div style={{
                                        padding: '16px',
                                        background: 'var(--color-surface-light)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                color: 'var(--color-text)',
                                                marginBottom: '8px'
                                            }}>
                                                Theme
                                            </label>
                                            <select
                                                value={theme}
                                                onChange={(e) => setTheme(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 16px',
                                                    paddingRight: '32px',
                                                    background: 'var(--color-surface)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--color-text)',
                                                    fontSize: '0.875rem',
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    transition: 'border-color 0.3s'
                                                }}
                                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                            >
                                                {themes && themes.map((themeName) => (
                                                    <option key={themeName} value={themeName} style={{ background: 'var(--color-surface)', borderRadius: '8px' }}>
                                                        {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                color: 'var(--color-text)',
                                                marginBottom: '8px'
                                            }}>
                                                Font
                                            </label>
                                            <select
                                                value={font}
                                                onChange={(e) => setFont(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 16px',
                                                    paddingRight: '32px',
                                                    background: 'var(--color-surface)',
                                                    border: '1px solid var(--color-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--color-text)',
                                                    fontSize: '0.875rem',
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    transition: 'border-color 0.3s',
                                                    fontFamily: font
                                                }}
                                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                                            >
                                                {fonts && fonts.map((fontOption) => (
                                                    <option key={fontOption.value} value={fontOption.value} style={{ background: 'var(--color-surface)', borderRadius: '8px', fontFamily: fontOption.value }}>
                                                        {fontOption.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{
                                                display: 'block',
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                color: 'var(--color-text)',
                                                marginBottom: '8px'
                                            }}>
                                                Font Size
                                            </label>
                                            <input
                                                type="range"
                                                min="12"
                                                max="20"
                                                defaultValue="16"
                                                style={{
                                                    width: '100%',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* About Tab */}
                            {activeTab === 'about' && (
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{
                                        fontFamily: 'var(--font-family-heading)',
                                        fontSize: '1.125rem',
                                        fontWeight: '600',
                                        color: 'var(--color-text)',
                                        marginBottom: '16px'
                                    }}>
                                        About
                                    </h3>
                                    <div style={{
                                        padding: '16px',
                                        background: 'var(--color-surface-light)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--color-border)'
                                    }}>
                                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                            <h4 style={{
                                                fontSize: '1.25rem',
                                                fontWeight: 'bold',
                                                color: 'var(--color-text)',
                                                marginBottom: '8px'
                                            }}>
                                                Todo App
                                            </h4>
                                            <p style={{
                                                fontSize: '0.875rem',
                                                color: 'var(--color-text-muted)',
                                                marginBottom: '16px'
                                            }}>
                                                Version 1.0.0
                                            </p>
                                            <p style={{
                                                fontSize: '0.875rem',
                                                color: 'var(--color-text-muted)',
                                                lineHeight: '1.5'
                                            }}>
                                                A beautiful and functional todo application built with React and Node.js.
                                                Organize your tasks efficiently with tags and priorities.
                                            </p>
                                            <div style={{
                                                marginTop: '24px',
                                                paddingTop: '24px',
                                                borderTop: '1px solid var(--color-border)'
                                            }}>
                                                <p style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--color-text-muted)'
                                                }}>
                                                    © 2024 Todo App. All rights reserved.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div style={{
                                paddingTop: '16px',
                                borderTop: '1px solid var(--color-border)'
                            }}>
                                <p style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--color-text-muted)',
                                    textAlign: 'center'
                                }}>
                                    Press <kbd style={{
                                        padding: '4px 8px',
                                        background: 'var(--color-surface-light)',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        border: '1px solid var(--color-border)',
                                        fontFamily: 'inherit'
                                    }}>Esc</kbd> to close
                                </p>
                            </div>
                        </div>

                        <style jsx>{`
              .tag-actions {
                opacity: 0 !important;
              }
              .tag-actions:hover,
              div:hover .tag-actions {
                opacity: 1 !important;
              }
            `}</style>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Settings;
