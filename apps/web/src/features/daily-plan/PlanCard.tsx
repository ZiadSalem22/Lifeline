import { useEffect, useRef, useState } from 'react';
import type { DragEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { clearTextSelection, suppressTextSelection } from './lib/gesture-select';
import { masonryRowSpan } from './lib/masonry';
import styles from './DailyPlan.module.css';

/** Hold the section bar this long without moving to lift the card (touch reorder). */
const LIFT_MS = 350;
/** Movement beyond this during the hold reads as a scroll, not a lift. */
const SLOP_PX = 8;
/** Viewport band near the top/bottom edge that auto-scrolls while dragging. */
const EDGE_PX = 96;

const preventTouchScroll = (event: TouchEvent) => event.preventDefault();

export interface PlanCardProps {
  secKey: string;
  title: string;
  badge?: ReactNode;
  order: number;
  wide: boolean;
  /** Container currently fits two columns (span 2 is only legal then). */
  canWide: boolean;
  gapPx: number;
  /** This card is the drag source (dimmed while its ghost travels). */
  dragging: boolean;
  onToggleWide: () => void;
  onHide: () => void;
  onDragStartKey: (key: string) => void;
  /** Fired while dragging over this card — the grid makes room live. */
  onDragOverKey: (key: string) => void;
  onDragEndKey: () => void;
  onDropOnKey: (key: string) => void;
  /** Keyboard reorder from the grip (arrow keys): move one slot. */
  onMoveKey: (key: string, delta: -1 | 1) => void;
  children: ReactNode;
}

/**
 * Masonry card frame (design handoff): secbar header + absolute top-right
 * controls — grip ⣿ (HTML5 drag to reorder, arrow keys when focused), width
 * ⇄ (1↔2 panels), hide ✕. Controls fade in on card hover/focus (CSS).
 * The card measures itself (ResizeObserver) and sets its grid-row span so the
 * dense grid packs like masonry.
 *
 * Touch reorder: HTML5 drag never fires on touch, so the section bar doubles
 * as a hold-to-lift handle — press ~350ms (a scroll cancels it), the card
 * pops, the grid live-reorders under the finger through the same
 * onDragOver/onDrop wiring the grip uses, and the viewport auto-scrolls near
 * its edges so far-away slots are reachable.
 */
export function PlanCard(props: PlanCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [lifted, setLifted] = useState(false);

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

  // ── hold-to-lift touch reorder ──
  const press = useRef<{
    pointerId: number;
    el: HTMLElement;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    timer: number | null;
    lifted: boolean;
    raf: number;
  } | null>(null);

  const hitTest = () => {
    const p = press.current;
    if (!p || typeof document.elementFromPoint !== 'function') return;
    const over = document.elementFromPoint(p.lastX, p.lastY)?.closest<HTMLElement>('[data-sec]')
      ?.dataset['sec'];
    if (over && over !== props.secKey) props.onDragOverKey(over);
  };

  // Edge auto-scroll loop: holding near the viewport edge keeps scrolling
  // (pointermove alone stalls when the finger is stationary).
  const edgeLoop = () => {
    const p = press.current;
    if (!p || !p.lifted) return;
    if (p.lastY < EDGE_PX) window.scrollBy(0, -14);
    else if (p.lastY > window.innerHeight - EDGE_PX) window.scrollBy(0, 14);
    hitTest();
    p.raf = requestAnimationFrame(edgeLoop);
  };

  const clearPress = () => {
    const p = press.current;
    if (!p) return;
    if (p.timer !== null) window.clearTimeout(p.timer);
    cancelAnimationFrame(p.raf);
    suppressTextSelection(false);
    document.removeEventListener('touchmove', preventTouchScroll);
    if (p.lifted) {
      try {
        p.el.releasePointerCapture(p.pointerId);
      } catch {
        /* pointer already gone */
      }
      setLifted(false);
    }
    press.current = null;
  };

  useEffect(() => clearPress, []);

  const lift = () => {
    const p = press.current;
    if (!p) return;
    p.timer = null;
    p.lifted = true;
    try {
      p.el.setPointerCapture(p.pointerId);
    } catch {
      /* jsdom / stale pointer */
    }
    // Finger held still past the delay — no scroll owns this touch yet, so
    // claim it before the first drag movement pans the page instead.
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    clearTextSelection();
    navigator.vibrate?.(10);
    setLifted(true);
    props.onDragStartKey(props.secKey);
    p.raf = requestAnimationFrame(edgeLoop);
  };

  const onBarPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    suppressTextSelection(true);
    press.current = {
      pointerId: event.pointerId,
      el: event.currentTarget as HTMLElement,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      timer: window.setTimeout(lift, LIFT_MS),
      lifted: false,
      raf: 0,
    };
  };

  const onBarPointerMove = (event: ReactPointerEvent) => {
    const p = press.current;
    if (!p || event.pointerId !== p.pointerId) return;
    p.lastX = event.clientX;
    p.lastY = event.clientY;
    if (!p.lifted) {
      if (Math.hypot(p.lastX - p.startX, p.lastY - p.startY) > SLOP_PX) clearPress();
      return;
    }
    event.preventDefault();
    hitTest();
  };

  const onBarPointerUp = (event: ReactPointerEvent) => {
    const p = press.current;
    if (!p || event.pointerId !== p.pointerId) return;
    const wasLifted = p.lifted;
    clearPress();
    if (wasLifted) props.onDropOnKey(props.secKey);
  };

  const onBarPointerCancel = () => {
    const p = press.current;
    if (!p) return;
    const wasLifted = p.lifted;
    clearPress();
    if (wasLifted) props.onDragEndKey();
  };

  return (
    <div
      ref={ref}
      className={[
        styles.card,
        props.dragging && !lifted ? styles.cardDragging : undefined,
        lifted ? styles.cardLifted : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      data-sec={props.secKey}
      style={{
        order: props.order,
        gridColumn: props.wide && props.canWide ? 'span 2' : 'auto',
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        props.onDragOverKey(props.secKey);
      }}
      onDrop={handleDrop}
    >
      <button
        type="button"
        draggable
        className={`${styles.cardCtl} ${styles.ctlGrip}`}
        title="Drag to rearrange (or focus and use arrow keys)"
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
        onDragEnd={props.onDragEndKey}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            props.onMoveKey(props.secKey, -1);
          } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            props.onMoveKey(props.secKey, 1);
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
        // Pointless on single-column layouts (phones) — hidden, not removed,
        // so the control row keeps its geometry when the grid widens again.
        style={props.canWide ? undefined : { display: 'none' }}
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
      <div
        className={styles.secbar}
        onPointerDown={onBarPointerDown}
        onPointerMove={onBarPointerMove}
        onPointerUp={onBarPointerUp}
        onPointerCancel={onBarPointerCancel}
        onContextMenu={(event) => {
          if (press.current) event.preventDefault();
        }}
      >
        <span>{props.title}</span>
        {props.badge !== undefined && <span className={styles.secbarBadge}>{props.badge}</span>}
      </div>
      {props.children}
    </div>
  );
}
