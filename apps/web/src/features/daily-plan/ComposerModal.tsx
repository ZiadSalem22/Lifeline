import { createPortal } from 'react-dom';
import type { Tag, Todo } from '@lifeline/shared';
import { Composer } from '../todos/components/Composer';
import styles from './ComposerModal.module.css';

export interface ComposerModalProps {
  open: boolean;
  allTags: readonly Tag[];
  allTodos: readonly Todo[];
  /** 'today' | 'tomorrow' | 'YYYY-MM-DD' — fallback dueDate, as in Tasks mode. */
  effectiveDate: string;
  /** Preset due date ('YYYY-MM-DD') re-applied on every open. */
  initialDueDate?: string | undefined;
  /** Preset due time ('HH:mm') re-applied on every open. */
  initialDueTime?: string | undefined;
  onClose: () => void;
}

/**
 * The full Tasks-mode Composer as a popup, for the Daily Plan cards. Not the
 * shared Modal on purpose: the Composer brings its own card chrome, and it
 * must own dismissal — only a mousedown that starts on the overlay itself
 * closes (closeOnOutsideClick=false disables the composer's document-level
 * outside-close, and Escape still works via its own key handler). Everything
 * stays mounted between opens so an accidental dismiss keeps the draft.
 */
export function ComposerModal({
  open,
  allTags,
  allTodos,
  effectiveDate,
  initialDueDate,
  initialDueTime,
  onClose,
}: ComposerModalProps) {
  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      hidden={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Add task">
        <Composer
          open={open}
          allTags={allTags}
          allTodos={allTodos}
          effectiveDate={effectiveDate}
          onRequestClose={onClose}
          initialDueDate={initialDueDate}
          initialDueTime={initialDueTime}
          closeOnOutsideClick={false}
          initialFocus="title"
        />
      </div>
    </div>,
    document.body,
  );
}
