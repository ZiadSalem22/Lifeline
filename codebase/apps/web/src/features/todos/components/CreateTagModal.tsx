import { useState } from 'react';
import type { CreateTagInput, Tag } from '@lifeline/shared';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { randomTagColor } from '../lib/format';
import styles from './CreateTagModal.module.css';

/**
 * Create-new-tag modal (old App.jsx showNewTagModal overlay): name + color
 * input; default color is a random pick from the old 10-color preset palette.
 */

export interface CreateTagModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateTagInput) => Promise<Tag>;
}

function CreateTagBody({ onClose, onCreate }: Omit<CreateTagModalProps, 'open'>) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(randomTagColor);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), color });
      onClose();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create tag.');
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.body}>
      <input
        type="text"
        placeholder="Tag name"
        className={styles.nameInput}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void handleCreate();
          }
        }}
        autoFocus
        aria-label="Tag name"
      />
      <div className={styles.colorRow}>
        <label htmlFor="new-tag-color">Color:</label>
        <input
          id="new-tag-color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className={styles.colorInput}
        />
        <span className={styles.colorValue} style={{ color }}>
          {color}
        </span>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.footer}>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!name.trim() || submitting}
          onClick={() => void handleCreate()}
        >
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

export function CreateTagModal({ open, onClose, onCreate }: CreateTagModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Create New Tag">
      {open ? <CreateTagBody onClose={onClose} onCreate={onCreate} /> : null}
    </Modal>
  );
}
