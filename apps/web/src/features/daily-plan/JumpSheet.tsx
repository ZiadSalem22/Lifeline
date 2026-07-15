import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import styles from './JumpSheet.module.css';

/**
 * Jump navigation for the Daily Plan — a floating pill naming the section
 * currently in view, opening a bottom sheet that lists every visible section
 * with a live status line. Tapping a tile smooth-scrolls to that card
 * (`[data-sec]`); holding a tile lifts it (Apple home-screen style) so it can
 * be dragged into a new spot, persisting through the same order the grid's
 * own drag writes. Portaled to <body> like the plan's other popups, so it
 * styles off the :root --plan-* tokens and works in every theme.
 */

export interface JumpSection {
  key: string;
  label: string;
  /** One-line live status under the label ('' → label only). */
  status?: string;
  /** Full-width sections (meals, non-negotiables) jump but never reorder. */
  fixed?: boolean;
}

export interface JumpSheetProps {
  sections: JumpSection[];
  /** Persist a new order for the reorderable (grid) sections. */
  onReorder: (gridKeys: string[]) => void;
}

/** Hold this long without moving to lift a tile (a scroll cancels it). */
const LIFT_MS = 300;
/** Movement beyond this during the hold reads as a scroll, not a lift. */
const SLOP_PX = 8;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function sectionEl(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-sec="${key}"]`);
}

interface DragState {
  key: string;
  el: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** Layout slot the tile occupied when lifted (offset coords). */
  originLeft: number;
  originTop: number;
  timer: number | null;
  lifted: boolean;
}

const preventTouchScroll = (event: TouchEvent) => event.preventDefault();

export function JumpSheet({ sections, onReorder }: JumpSheetProps) {
  const [open, setOpen] = useState(false);
  /** null = at the top of the page (pill shows its own name, not a section). */
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  /** Live order while a tile is lifted; null = follow props. */
  const [preview, setPreview] = useState<string[] | null>(null);
  const [liftedKey, setLiftedKey] = useState<string | null>(null);
  // The sheet mounts on open and unmounts a beat after close, so the exit
  // slide can play — and so its tiles never shadow the page's own text
  // (screen readers and tests both see one "Water Tracker", not two).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open || !mounted) return undefined;
    const timer = window.setTimeout(() => setMounted(false), 260);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  const pillRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const previewRef = useRef<string[] | null>(null);
  const setPreviewBoth = (next: string[] | null) => {
    previewRef.current = next;
    setPreview(next);
  };

  const byKey = new Map(sections.map((s) => [s.key, s]));
  const baseOrder = sections.map((s) => s.key);
  // Preview may momentarily disagree with props (card hidden mid-drag) —
  // drop unknown keys, append new ones, so every section renders exactly once.
  const orderedKeys = (preview ?? baseOrder).filter((k) => byKey.has(k));
  for (const key of baseOrder) if (!orderedKeys.includes(key)) orderedKeys.push(key);

  // Handlers and window listeners read these through refs, synced post-render
  // (the compiler forbids ref writes during render).
  const sectionsRef = useRef(sections);
  const orderedRef = useRef(orderedKeys);
  useEffect(() => {
    sectionsRef.current = sections;
    orderedRef.current = orderedKeys;
  });

  // ── scrollspy: the lowest section whose top has passed the reading line ──
  useEffect(() => {
    let raf = 0;
    const spy = () => {
      raf = 0;
      if (window.scrollY < 60) {
        setCurrentKey(null);
        return;
      }
      const line = window.innerHeight * 0.35;
      let best: { key: string; top: number } | null = null;
      for (const section of sectionsRef.current) {
        const el = sectionEl(section.key);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= line && (best === null || top > best.top)) best = { key: section.key, top };
      }
      setCurrentKey(best ? best.key : null);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(spy);
    };
    spy();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ── drag helpers (declared before the effects that reference them) ──
  const applyLiftTransform = (d: DragState) => {
    // Finger delta, corrected by how far the tile's own layout slot moved
    // while the live preview reordered under it.
    const dx = d.lastX - d.startX + (d.originLeft - d.el.offsetLeft);
    const dy = d.lastY - d.startY + (d.originTop - d.el.offsetTop);
    d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
  };

  const clearDrag = (revert: boolean) => {
    const d = drag.current;
    if (!d) return;
    if (d.timer !== null) window.clearTimeout(d.timer);
    document.removeEventListener('touchmove', preventTouchScroll);
    if (d.lifted) {
      try {
        d.el.releasePointerCapture(d.pointerId);
      } catch {
        /* pointer already gone */
      }
      d.el.style.transform = '';
      setLiftedKey(null);
      if (revert) setPreviewBoth(null);
    }
    drag.current = null;
  };

  const openSheet = () => {
    setMounted(true);
    setOpen(true);
  };

  // Closing mid-drag (Escape, scrim tap) abandons any lift cleanly.
  const closeSheet = () => {
    clearDrag(true);
    setOpen(false);
  };

  // ── open/close: scroll lock, Escape, focus hand-off ──
  useEffect(() => {
    if (!open) return;
    const pill = pillRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      pill?.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeSheet only touches refs/state setters
  }, [open]);

  // Global teardown for an in-flight drag (unmount mid-drag must not leave a
  // non-passive touchmove blocker behind).
  useEffect(
    () => () => {
      if (drag.current?.timer !== null && drag.current) window.clearTimeout(drag.current.timer);
      document.removeEventListener('touchmove', preventTouchScroll);
    },
    [],
  );

  const jumpTo = (key: string) => {
    closeSheet();
    setCurrentKey(key);
    const el = sectionEl(key);
    if (!el) return;
    el.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    el.setAttribute('data-jump-flash', '');
    window.setTimeout(() => el.removeAttribute('data-jump-flash'), 950);
  };

  // ── hold-and-drag reorder ──
  const lift = () => {
    const d = drag.current;
    if (!d) return;
    d.timer = null;
    d.lifted = true;
    d.originLeft = d.el.offsetLeft;
    d.originTop = d.el.offsetTop;
    try {
      d.el.setPointerCapture(d.pointerId);
    } catch {
      /* jsdom / stale pointer */
    }
    // The finger is stationary past the hold delay, so no scroll owns this
    // touch yet — claim it, or the first drag movement scrolls the sheet.
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
    navigator.vibrate?.(10);
    setLiftedKey(d.key);
    applyLiftTransform(d);
  };

  const onTilePointerDown = (event: ReactPointerEvent, key: string) => {
    if (byKey.get(key)?.fixed || event.button !== 0) return;
    const el = event.currentTarget as HTMLElement;
    drag.current = {
      key,
      el,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      originLeft: el.offsetLeft,
      originTop: el.offsetTop,
      timer: window.setTimeout(lift, LIFT_MS),
      lifted: false,
    };
  };

  const onTilePointerMove = (event: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    d.lastX = event.clientX;
    d.lastY = event.clientY;
    if (!d.lifted) {
      // Still in the hold window: real movement means scroll, not lift.
      if (Math.hypot(d.lastX - d.startX, d.lastY - d.startY) > SLOP_PX) clearDrag(true);
      return;
    }
    event.preventDefault();
    applyLiftTransform(d);

    // Which tile's layout box is under the finger? (offset coords ignore the
    // FLIP transforms mid-animation, so hit-testing stays stable.)
    const grid = gridRef.current;
    if (!grid) return;
    const gridRect = grid.getBoundingClientRect();
    let targetKey: string | null = null;
    for (const child of grid.children) {
      const el = child as HTMLElement;
      const key = el.dataset['key'];
      if (!key || key === d.key || byKey.get(key)?.fixed) continue;
      const left = gridRect.left + el.offsetLeft - grid.scrollLeft;
      const top = gridRect.top + el.offsetTop - grid.scrollTop;
      if (
        event.clientX >= left &&
        event.clientX <= left + el.offsetWidth &&
        event.clientY >= top &&
        event.clientY <= top + el.offsetHeight
      ) {
        targetKey = key;
        break;
      }
    }
    if (!targetKey) return;
    const base = previewRef.current ?? orderedRef.current;
    const fromIdx = base.indexOf(d.key);
    const targetIdx = base.indexOf(targetKey);
    if (fromIdx === -1 || targetIdx === -1 || fromIdx === targetIdx) return;
    const next = base.filter((k) => k !== d.key);
    next.splice(
      fromIdx < targetIdx ? next.indexOf(targetKey) + 1 : next.indexOf(targetKey),
      0,
      d.key,
    );
    if (next.join('|') !== base.join('|')) setPreviewBoth(next);
  };

  const onTilePointerUp = (event: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    if (!d.lifted) {
      // Plain tap — let the click handler jump.
      clearDrag(false);
      return;
    }
    suppressClick.current = true;
    const finalOrder = previewRef.current;
    clearDrag(false);
    setPreviewBoth(null);
    if (finalOrder && finalOrder.join('|') !== baseOrder.join('|')) {
      onReorder(finalOrder.filter((k) => !byKey.get(k)?.fixed));
    }
  };

  const onTilePointerCancel = () => clearDrag(true);

  const onTileKeyDown = (event: ReactKeyboardEvent, key: string) => {
    const deltas: Record<string, -1 | 1> = {
      ArrowLeft: -1,
      ArrowUp: -1,
      ArrowRight: 1,
      ArrowDown: 1,
    };
    const delta = deltas[event.key];
    if (delta === undefined || byKey.get(key)?.fixed) return;
    event.preventDefault();
    const gridKeys = orderedKeys.filter((k) => !byKey.get(k)?.fixed);
    const at = gridKeys.indexOf(key);
    const to = at + delta;
    if (at === -1 || to < 0 || to >= gridKeys.length) return;
    const next = [...gridKeys];
    next.splice(at, 1);
    next.splice(to, 0, key);
    onReorder(next);
  };

  // FLIP: when tiles land in new slots (drag preview or persisted reorder),
  // glide them from their previous layout position. Offset coords, not
  // rects — the lifted tile's transform must not pollute the measurements.
  const tileSlots = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const reduced = prefersReducedMotion();
    const previous = tileSlots.current;
    const next = new Map<string, { left: number; top: number }>();
    for (const child of grid.children) {
      const el = child as HTMLElement;
      const key = el.dataset['key'];
      if (!key) continue;
      const pos = { left: el.offsetLeft, top: el.offsetTop };
      next.set(key, pos);
      const old = previous.get(key);
      if (
        open &&
        !reduced &&
        old &&
        key !== liftedKey &&
        typeof el.animate === 'function' &&
        (old.left !== pos.left || old.top !== pos.top)
      ) {
        el.animate(
          [
            { transform: `translate(${old.left - pos.left}px, ${old.top - pos.top}px)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
    }
    tileSlots.current = next;
    // The lifted tile's slot may have moved this render — keep it under the finger.
    if (drag.current?.lifted) applyLiftTransform(drag.current);
  });

  if (sections.length === 0) return null;

  const current = currentKey ? byKey.get(currentKey) : undefined;

  return createPortal(
    <>
      <button
        ref={pillRef}
        type="button"
        className={styles.pill}
        aria-label="Navigate sections"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openSheet}
      >
        <span className={styles.pillDots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.pillLabel}>{current ? current.label : 'Jump to…'}</span>
      </button>

      {mounted && (
        <>
          <div className={styles.scrim} data-open={open || undefined} onClick={closeSheet} />

          <div
            ref={sheetRef}
            className={styles.sheet}
            data-open={open || undefined}
            role="dialog"
            aria-modal="true"
            aria-label="Jump to section"
            aria-hidden={!open}
            inert={!open}
            tabIndex={-1}
          >
            <div className={styles.grabber} aria-hidden="true" />
            <div className={styles.head}>
              <span className={styles.title}>Sections</span>
              <span className={styles.hint}>tap to jump · hold to rearrange</span>
              <button
                type="button"
                className={styles.close}
                aria-label="Close"
                onClick={closeSheet}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l14 14" />
                  <path d="M19 5L5 19" />
                </svg>
              </button>
            </div>
            <div ref={gridRef} className={styles.tileGrid}>
              {orderedKeys.map((key) => {
                const section = byKey.get(key);
                if (!section) return null;
                const classes = [
                  styles.tile,
                  section.fixed ? styles.tileFixed : undefined,
                  key === currentKey ? styles.tileCurrent : undefined,
                  key === liftedKey ? styles.tileLifted : undefined,
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    key={key}
                    type="button"
                    data-key={key}
                    className={classes}
                    title={section.fixed ? undefined : 'Hold and drag (or arrow keys) to rearrange'}
                    onPointerDown={(event) => onTilePointerDown(event, key)}
                    onPointerMove={onTilePointerMove}
                    onPointerUp={onTilePointerUp}
                    onPointerCancel={onTilePointerCancel}
                    onKeyDown={(event) => onTileKeyDown(event, key)}
                    onContextMenu={(event) => {
                      if (drag.current) event.preventDefault();
                    }}
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      jumpTo(key);
                    }}
                  >
                    <span className={styles.tileLabel}>{section.label}</span>
                    {section.status ? (
                      <span className={styles.tileStatus}>{section.status}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className={styles.foot}>
              <button
                type="button"
                className={styles.footBtn}
                onClick={() => {
                  closeSheet();
                  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
                }}
              >
                ↑ Top
              </button>
              <button
                type="button"
                className={styles.footBtn}
                onClick={() => {
                  closeSheet();
                  window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                  });
                }}
              >
                ↓ Bottom
              </button>
            </div>
          </div>
        </>
      )}
    </>,
    document.body,
  );
}
