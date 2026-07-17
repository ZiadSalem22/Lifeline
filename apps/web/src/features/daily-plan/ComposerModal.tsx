import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PlanHabit, Tag, Todo } from '@lifeline/shared';
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
  /** Plan habits for the "Counts toward habit" select. */
  habits?: readonly PlanHabit[] | undefined;
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
  habits,
  onClose,
}: ComposerModalProps) {
  // Lock the page behind the popup — on phones the background otherwise
  // scrolls under your thumb while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

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
        {/* The sheet can outgrow a phone screen and Escape needs a keyboard —
            a sticky ✕ keeps cancel one thumb-tap away at any scroll depth. */}
        <div className={styles.closeRow}>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 5l14 14" />
              <path d="M19 5L5 19" />
            </svg>
          </button>
        </div>
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
          habits={habits}
        />
      </div>
    </div>,
    document.body,
  );
}
