import { useEffect, useRef } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { masonryRowSpan } from './lib/masonry';
import styles from './DailyPlan.module.css';

export interface PlanCardProps {
  secKey: string;
  title: string;
  badge?: ReactNode;
  order: number;
  wide: boolean;
  /** Container currently fits two columns (span 2 is only legal then). */
  canWide: boolean;
  gapPx: number;
  onToggleWide: () => void;
  onHide: () => void;
  onDragStartKey: (key: string) => void;
  onDropOnKey: (key: string) => void;
  children: ReactNode;
}

/**
 * Masonry card frame (design handoff): secbar header + absolute top-right
 * controls — grip ⣿ (HTML5 drag to reorder), width ⇄ (1↔2 panels), hide ✕.
 * The card measures itself (ResizeObserver) and sets its grid-row span so the
 * dense grid packs like masonry.
 */
export function PlanCard(props: PlanCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      el.style.gridRowEnd = `span ${masonryRowSpan(el.offsetHeight, props.gapPx)}`;
    };
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    apply();
    if (typeof document.fonts?.ready?.then === 'function') {
      void document.fonts.ready.then(apply);
    }
    return () => observer.disconnect();
  }, [props.gapPx, props.wide, props.canWide]);

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    props.onDropOnKey(props.secKey);
  };

  return (
    <div
      ref={ref}
      className={styles.card}
      data-sec={props.secKey}
      style={{
        order: props.order,
        gridColumn: props.wide && props.canWide ? 'span 2' : 'auto',
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={handleDrop}
    >
      <button
        type="button"
        draggable
        className={`${styles.cardCtl} ${styles.ctlGrip}`}
        title="Drag to rearrange"
        aria-label={`Drag to rearrange ${props.title}`}
        onDragStart={(event) => {
          props.onDragStartKey(props.secKey);
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            try {
              event.dataTransfer.setData('text/plain', props.secKey);
            } catch {
              // some engines throw on setData in tests
            }
          }
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.7" />
          <circle cx="15" cy="6" r="1.7" />
          <circle cx="9" cy="12" r="1.7" />
          <circle cx="15" cy="12" r="1.7" />
          <circle cx="9" cy="18" r="1.7" />
          <circle cx="15" cy="18" r="1.7" />
        </svg>
      </button>
      <button
        type="button"
        className={[styles.cardCtl, styles.ctlWide, props.wide ? styles.ctlWideActive : undefined]
          .filter(Boolean)
          .join(' ')}
        title="Toggle width (1 or 2 panels)"
        aria-label={`Toggle width of ${props.title}`}
        aria-pressed={props.wide}
        onClick={props.onToggleWide}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 8L4 12l4 4" />
          <path d="M16 8l4 4-4 4" />
          <path d="M4 12h16" />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.cardCtl} ${styles.ctlHide}`}
        title="Hide section"
        aria-label={`Hide ${props.title}`}
        onClick={props.onHide}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5 5l14 14" />
          <path d="M19 5L5 19" />
        </svg>
      </button>
      <div className={styles.secbar}>
        <span>{props.title}</span>
        {props.badge !== undefined && <span className={styles.secbarBadge}>{props.badge}</span>}
      </div>
      {props.children}
    </div>
  );
}
