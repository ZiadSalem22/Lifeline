/**
 * On-screen keyboard tracking for bottom-sheet modals.
 *
 * iOS Safari overlays the software keyboard WITHOUT shrinking the layout
 * viewport — `100vh`/`100dvh` and a `position: fixed; bottom: 0` sheet stay
 * anchored to the full-height viewport, so the sheet's lower half (its input
 * row and buttons) ends up hidden behind the keyboard. `visualViewport` is
 * the only surface that reflects the keyboard, so we translate its state into
 * a `--kb-inset` custom property on :root that the modal CSS subtracts to lift
 * content above the keyboard. On Android Chrome the keyboard resizes the
 * viewport (with `interactive-widget=resizes-content`), so the inset stays ~0
 * there and `dvh` does the work — the two mechanisms compose without
 * double-counting.
 */

/** Below this many px the gap is URL-bar jitter, not a keyboard. */
const KEYBOARD_MIN_PX = 80;

/**
 * Bottom overlap (px) between the visible viewport and the layout viewport —
 * i.e. how much of the page the keyboard is covering. 0 when no keyboard.
 * Exported for unit testing; callers use the installed tracker below.
 */
export function computeKeyboardInset(
  innerHeight: number,
  viewport: { height: number; offsetTop: number },
): number {
  const overlap = innerHeight - viewport.height - viewport.offsetTop;
  return overlap > KEYBOARD_MIN_PX ? Math.round(overlap) : 0;
}

let installed = false;

/** Idempotently start writing --kb-inset on :root. Safe to call once at boot. */
export function installKeyboardInsetTracking(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  const vv = window.visualViewport;
  if (!vv) return () => {};
  installed = true;

  const root = document.documentElement;
  const update = () => {
    const inset = computeKeyboardInset(window.innerHeight, {
      height: vv.height,
      offsetTop: vv.offsetTop,
    });
    root.style.setProperty('--kb-inset', `${inset}px`);
  };

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();

  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    root.style.removeProperty('--kb-inset');
    installed = false;
  };
}
